import type { MediaFilters, Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { isDemoMediaPath } from '@/lib/demo';
import { AppError, toAppError } from '@/lib/errors';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import type { VideoMetadata } from '@/services/media/videoAnalysis';
import type { Id, Media, MediaStatus, TagWithUsage } from '@/types';

import {
  getFileExtension,
  getFileName,
  getVideoMimeType,
  isSupportedVideoExtension,
  normalizeTagName,
} from './mediaRules';

export interface ImportSkip {
  path: string;
  reason: string;
}

export interface ImportSummary {
  imported: Media[];
  skipped: ImportSkip[];
}

/** Resultado da análise de um vídeo local (metadados + miniatura JPEG). */
export interface AnalyzedVideo extends VideoMetadata {
  thumbnail: Uint8Array | null;
}

interface MediaServiceDeps {
  repositories: Pick<Repositories, 'media' | 'tags' | 'posts'>;
  desktop: DesktopBridge;
  /** Lê duração/resolução e captura um quadro (melhor esforço). Injetável para testes. */
  analyzeVideo: (path: string) => Promise<AnalyzedVideo | null>;
  clock: Clock;
}

export function createMediaService({
  repositories,
  desktop,
  analyzeVideo,
  clock,
}: MediaServiceDeps) {
  const { media, tags, posts } = repositories;

  async function analyze(path: string): Promise<AnalyzedVideo | null> {
    return analyzeVideo(path).catch((error: unknown) => {
      logger.warn('Não foi possível analisar o vídeo', { path, error });
      return null;
    });
  }

  /** Grava a miniatura; falhas não impedem a importação (o vídeo fica com placeholder). */
  async function storeThumbnail(mediaId: Id, jpeg: Uint8Array | null): Promise<string | null> {
    if (!jpeg) return null;
    return desktop.saveThumbnail(mediaId, jpeg).catch((error: unknown) => {
      logger.warn('Não foi possível salvar a miniatura', { mediaId, error });
      return null;
    });
  }

  async function importOne(path: string): Promise<Media | ImportSkip> {
    const extension = getFileExtension(path);
    if (!isSupportedVideoExtension(extension)) {
      return { path, reason: 'Formato não suportado (use .mp4, .mov ou .webm).' };
    }
    if (await media.findByPath(path)) {
      return { path, reason: 'Já está na biblioteca.' };
    }

    const info = await desktop.inspectMediaFile(path).catch((error: unknown) => toAppError(error));
    if (info instanceof AppError) return { path, reason: info.message };

    const analysis = await analyze(info.path);
    const id = createId();
    const thumbnailPath = await storeThumbnail(id, analysis?.thumbnail ?? null);

    const now = clock.now().toISOString();
    const record = {
      id,
      filename: info.fileName,
      originalFilename: getFileName(path),
      filePath: info.path,
      type: 'video' as const,
      mimeType: getVideoMimeType(extension),
      size: info.size,
      duration: analysis?.duration ?? null,
      width: analysis?.width ?? null,
      height: analysis?.height ?? null,
      thumbnailPath,
      status: 'imported' as const,
      createdAt: now,
      updatedAt: now,
    };
    await media.insert(record);
    return { ...record, tags: [] };
  }

  /** Gera a miniatura de um vídeo já importado e completa metadados ausentes. */
  async function generateThumbnail(id: Id): Promise<void> {
    const item = await media.getById(id);
    if (!item) throw new AppError('NOT_FOUND', 'Vídeo não encontrado na biblioteca.');
    if (isDemoMediaPath(item.filePath)) {
      throw new AppError('NOT_AVAILABLE', 'Vídeos de demonstração não têm arquivo real.');
    }

    // Revalida o arquivo e o autoriza no protocolo asset: nesta sessão.
    const info = await desktop.inspectMediaFile(item.filePath);
    const analysis = await analyze(info.path);
    if (!analysis?.thumbnail) {
      throw new AppError(
        'NOT_AVAILABLE',
        'Não foi possível extrair um quadro deste vídeo. O codec pode não ser suportado pelo WebView2.',
      );
    }

    const thumbnailPath = await desktop.saveThumbnail(id, analysis.thumbnail);
    await media.update(id, {
      thumbnailPath,
      duration: item.duration ?? analysis.duration,
      width: item.width ?? analysis.width,
      height: item.height ?? analysis.height,
      updatedAt: clock.now().toISOString(),
    });
  }

  /** Ids já tentados nesta sessão: uma falha (ex.: codec não suportado) não se repete em loop. */
  const thumbnailAttempts = new Set<Id>();

  /**
   * Gera, um vídeo por vez, as miniaturas que faltam (vídeos importados antes do recurso ou cuja
   * captura falhou na importação). Nunca lança erro: falhas ficam no log e o placeholder continua.
   */
  async function generateMissingThumbnails(): Promise<{ generated: number; failed: number }> {
    const pending = (await media.list()).filter(
      (item) =>
        item.thumbnailPath === null &&
        !isDemoMediaPath(item.filePath) &&
        !thumbnailAttempts.has(item.id),
    );

    const result = { generated: 0, failed: 0 };
    for (const item of pending) {
      thumbnailAttempts.add(item.id);
      try {
        await generateThumbnail(item.id);
        result.generated += 1;
      } catch (error) {
        result.failed += 1;
        logger.warn('Miniatura não gerada', { mediaId: item.id, error });
      }
    }
    if (result.generated > 0 || result.failed > 0) {
      logger.info('Miniaturas pendentes processadas', result);
    }
    return result;
  }

  /**
   * Registra arquivos na biblioteca sem copiá-los (DEC-006).
   * Cada arquivo é processado de forma independente: falhas viram `skipped`.
   */
  async function importPaths(paths: readonly string[]): Promise<ImportSummary> {
    const summary: ImportSummary = { imported: [], skipped: [] };
    for (const path of paths) {
      const result = await importOne(path);
      if ('reason' in result) summary.skipped.push(result);
      else summary.imported.push(result);
    }
    if (summary.imported.length > 0) {
      logger.info('Vídeos importados', { count: summary.imported.length });
    }
    return summary;
  }

  return {
    list: (filters?: MediaFilters) => media.list(filters),

    getById: (id: Id) => media.getById(id),

    listTags: (): Promise<TagWithUsage[]> => tags.listWithUsage(),

    /** Abre o seletor nativo e importa os arquivos escolhidos. */
    async importFromPicker(): Promise<ImportSummary> {
      return importPaths(await desktop.pickVideoFiles());
    },

    importPaths,

    generateMissingThumbnails,

    async updateStatus(id: Id, status: MediaStatus): Promise<void> {
      await media.update(id, { status, updatedAt: clock.now().toISOString() });
    },

    async addTag(mediaId: Id, rawName: string): Promise<void> {
      const name = normalizeTagName(rawName);
      if (!name) throw new AppError('VALIDATION', 'Informe um nome para a tag.');

      const now = clock.now().toISOString();
      let tag = await tags.findByName(name);
      if (!tag) {
        tag = { id: createId(), name, createdAt: now };
        await tags.insert(tag);
      }
      await tags.attach(mediaId, tag.id, now);
    },

    removeTag: (mediaId: Id, tagId: Id) => tags.detach(mediaId, tagId),

    /** Remove o registro (e a miniatura gerada pelo app). O arquivo original nunca é apagado. */
    async remove(id: Id): Promise<void> {
      const activePosts = await posts.count({ mediaId: id, statuses: ['scheduled', 'publishing'] });
      if (activePosts > 0) {
        throw new AppError(
          'MEDIA_IN_USE',
          `Este vídeo está em ${activePosts} post(s) agendado(s). Cancele-os antes de remover.`,
        );
      }
      const item = await media.getById(id);
      await media.delete(id);
      if (item?.thumbnailPath) {
        await desktop.deleteThumbnail(id).catch((error: unknown) => {
          logger.warn('Não foi possível apagar a miniatura', { mediaId: id, error });
        });
      }
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
