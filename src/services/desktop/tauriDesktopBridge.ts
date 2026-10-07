import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { appConfigDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { z } from 'zod';

import { toAppError } from '@/lib/errors';

import type { DesktopBridge, FfmpegStatus, MediaFileInfo } from './DesktopBridge';

/** Mantido em sincronia com src-tauri/src/commands/media.rs. */
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];

// Respostas do lado nativo também são validadas antes de entrar no app.
const mediaFileInfoSchema = z.object({
  path: z.string().min(1),
  fileName: z.string().min(1),
  extension: z.string(),
  size: z.number().nonnegative(),
});

const ffmpegStatusSchema = z.object({
  available: z.boolean(),
  version: z.string().nullable(),
});

async function invokeCommand<T>(
  command: string,
  schema: z.ZodType<T>,
  args?: Record<string, unknown>,
): Promise<T> {
  try {
    return schema.parse(await invoke(command, args));
  } catch (error) {
    throw toAppError(error);
  }
}

export function createTauriDesktopBridge(): DesktopBridge {
  return {
    mode: 'desktop',

    async pickVideoFiles() {
      const selection = await open({
        title: 'Importar vídeos',
        multiple: true,
        directory: false,
        filters: [{ name: 'Vídeos (.mp4, .mov, .webm)', extensions: VIDEO_EXTENSIONS }],
      });
      if (selection === null) return [];
      return Array.isArray(selection) ? selection : [selection];
    },

    inspectMediaFile: (path): Promise<MediaFileInfo> =>
      invokeCommand('inspect_media_file', mediaFileInfoSchema, { path }),

    detectFfmpeg: (): Promise<FfmpegStatus> => invokeCommand('detect_ffmpeg', ffmpegStatusSchema),

    getDataDirectory: () => appConfigDir(),

    toAssetUrl: (path) => convertFileSrc(path),
  };
}
