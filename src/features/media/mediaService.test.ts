import { beforeEach, describe, expect, it } from 'vitest';

import type { Repositories } from '@/db/repositories';
import { createFixedClock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import { createPreviewDesktopBridge } from '@/services/desktop/previewDesktopBridge';
import { buildMedia } from '@/test/factories';
import { createTestRepositories } from '@/test/testDb';

import { type AnalyzedVideo, createMediaService, type MediaService } from './mediaService';

const NOW = new Date('2026-10-07T12:00:00.000Z');
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const ANALYSIS: AnalyzedVideo = { duration: 25.3, width: 576, height: 1024, thumbnail: JPEG };

/** Ponte desktop falsa: arquivos "existem" se estiverem em `files`. */
function createFakeDesktop(files: Record<string, number>) {
  const saved = new Map<string, Uint8Array>();
  const deleted: string[] = [];
  let failThumbnailSave = false;

  const desktop: DesktopBridge = {
    // Métodos não usados aqui (TikTok etc.) vêm da ponte de preview.
    ...createPreviewDesktopBridge(),
    mode: 'desktop',
    pickVideoFiles: () => Promise.resolve(Object.keys(files)),
    inspectMediaFile: (path) => {
      const size = files[path];
      if (size === undefined) {
        return Promise.reject(new AppError('FILE_NOT_FOUND', 'Arquivo não encontrado.'));
      }
      const fileName = path.split('\\').pop() ?? path;
      return Promise.resolve({ path, fileName, extension: 'mp4', size });
    },
    saveThumbnail: (mediaId, jpeg) => {
      if (failThumbnailSave) return Promise.reject(new AppError('IO_ERROR', 'Disco cheio.'));
      saved.set(mediaId, jpeg);
      return Promise.resolve(`C:\\AppData\\thumbnails\\${mediaId}.jpg`);
    },
    deleteThumbnail: (mediaId) => {
      deleted.push(mediaId);
      return Promise.resolve();
    },
    detectFfmpeg: () => Promise.resolve({ available: false, version: null }),
    setSecret: () => Promise.resolve(),
    hasSecret: () => Promise.resolve(false),
    deleteSecret: () => Promise.resolve(),
    aiChatCompletion: () => Promise.reject(new AppError('NOT_AVAILABLE', 'sem IA')),
    getDataDirectory: () => Promise.resolve(null),
    getLogDirectory: () => Promise.resolve(null),
    toAssetUrl: (path) => path,
  };

  return {
    desktop,
    saved,
    deleted,
    failThumbnailSaves: () => {
      failThumbnailSave = true;
    },
  };
}

describe('mediaService', () => {
  let repositories: Repositories;
  let fake: ReturnType<typeof createFakeDesktop>;
  let analysis: AnalyzedVideo | null;
  let service: MediaService;

  beforeEach(() => {
    repositories = createTestRepositories();
    fake = createFakeDesktop({ 'C:\\Videos\\white.mp4': 4_140_159 });
    analysis = ANALYSIS;
    service = createMediaService({
      repositories,
      desktop: fake.desktop,
      analyzeVideo: () => Promise.resolve(analysis),
      clock: createFixedClock(NOW),
    });
  });

  it('importa com metadados e miniatura', async () => {
    const { imported, skipped } = await service.importPaths(['C:\\Videos\\white.mp4']);

    expect(skipped).toEqual([]);
    const [media] = imported;
    expect(media).toMatchObject({
      filename: 'white.mp4',
      size: 4_140_159,
      duration: 25.3,
      width: 576,
      height: 1024,
      status: 'imported',
    });
    expect(media?.thumbnailPath).toBe(`C:\\AppData\\thumbnails\\${media?.id ?? ''}.jpg`);
    expect(fake.saved.get(media?.id ?? '')).toEqual(JPEG);
  });

  it('ignora formatos não suportados, duplicados e arquivos inexistentes', async () => {
    await service.importPaths(['C:\\Videos\\white.mp4']);
    const { imported, skipped } = await service.importPaths([
      'C:\\Videos\\clip.mkv',
      'C:\\Videos\\white.mp4',
      'C:\\Videos\\sumiu.mp4',
    ]);

    expect(imported).toEqual([]);
    expect(skipped.map((item) => item.reason)).toEqual([
      'Formato não suportado (use .mp4, .mov ou .webm).',
      'Já está na biblioteca.',
      'Arquivo não encontrado.',
    ]);
  });

  it('importa mesmo se a miniatura ou a análise falharem', async () => {
    fake.failThumbnailSaves();
    const first = await service.importPaths(['C:\\Videos\\white.mp4']);
    expect(first.imported[0]).toMatchObject({ thumbnailPath: null, duration: 25.3 });

    analysis = null;
    fake = createFakeDesktop({ 'C:\\Videos\\outro.mp4': 10 });
    service = createMediaService({
      repositories,
      desktop: fake.desktop,
      analyzeVideo: () => Promise.reject(new Error('codec')),
      clock: createFixedClock(NOW),
    });
    const second = await service.importPaths(['C:\\Videos\\outro.mp4']);
    expect(second.imported[0]).toMatchObject({ thumbnailPath: null, duration: null, width: null });
  });

  it('gera automaticamente as miniaturas que faltam e completa metadados', async () => {
    await repositories.media.insert(
      buildMedia({
        id: 'old',
        filePath: 'C:\\Videos\\white.mp4',
        duration: null,
        width: null,
        height: null,
      }),
    );
    await repositories.media.insert(buildMedia({ id: 'demo-media-01', filePath: 'demo://a.mp4' }));
    await repositories.media.insert(
      buildMedia({ id: 'done', filePath: 'C:\\Videos\\ok.mp4', thumbnailPath: 'C:\\t\\done.jpg' }),
    );

    expect(await service.generateMissingThumbnails()).toEqual({ generated: 1, failed: 0 });
    expect(await repositories.media.getById('old')).toMatchObject({
      thumbnailPath: 'C:\\AppData\\thumbnails\\old.jpg',
      duration: 25.3,
      width: 576,
    });
    // Demonstração e vídeos que já têm miniatura não são tocados.
    expect([...fake.saved.keys()]).toEqual(['old']);
  });

  it('registra falhas sem lançar erro e não repete a tentativa na mesma sessão', async () => {
    await repositories.media.insert(buildMedia({ id: 'gone', filePath: 'C:\\Videos\\sumiu.mp4' }));

    expect(await service.generateMissingThumbnails()).toEqual({ generated: 0, failed: 1 });
    expect(await service.generateMissingThumbnails()).toEqual({ generated: 0, failed: 0 });
  });

  it('apaga a miniatura ao remover da biblioteca', async () => {
    const { imported } = await service.importPaths(['C:\\Videos\\white.mp4']);
    const id = imported[0]?.id ?? '';

    await service.remove(id);

    expect(await repositories.media.getById(id)).toBeNull();
    expect(fake.deleted).toEqual([id]);
  });
});
