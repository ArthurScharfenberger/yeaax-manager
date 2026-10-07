import type { MediaFilters, Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { AppError, toAppError } from '@/lib/errors';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import type { VideoMetadata } from '@/services/media/videoMetadata';
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

interface MediaServiceDeps {
  repositories: Pick<Repositories, 'media' | 'tags' | 'posts'>;
  desktop: DesktopBridge;
  /** Leitura de duração/resolução (melhor esforço). Injetável para testes. */
  probeMetadata: (path: string) => Promise<VideoMetadata | null>;
  clock: Clock;
}

export function createMediaService({
  repositories,
  desktop,
  probeMetadata,
  clock,
}: MediaServiceDeps) {
  const { media, tags, posts } = repositories;

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

    const metadata = await probeMetadata(info.path).catch((error: unknown) => {
      logger.warn('Não foi possível ler metadados do vídeo', { path: info.path, error });
      return null;
    });

    const now = clock.now().toISOString();
    const record = {
      id: createId(),
      filename: info.fileName,
      originalFilename: getFileName(path),
      filePath: info.path,
      type: 'video' as const,
      mimeType: getVideoMimeType(extension),
      size: info.size,
      duration: metadata?.duration ?? null,
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
      thumbnailPath: null,
      status: 'imported' as const,
      createdAt: now,
      updatedAt: now,
    };
    await media.insert(record);
    return { ...record, tags: [] };
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

    /** Remove o registro da biblioteca. O arquivo original nunca é apagado. */
    async remove(id: Id): Promise<void> {
      const activePosts = await posts.count({ mediaId: id, statuses: ['scheduled', 'publishing'] });
      if (activePosts > 0) {
        throw new AppError(
          'MEDIA_IN_USE',
          `Este vídeo está em ${activePosts} post(s) agendado(s). Cancele-os antes de remover.`,
        );
      }
      await media.delete(id);
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;
