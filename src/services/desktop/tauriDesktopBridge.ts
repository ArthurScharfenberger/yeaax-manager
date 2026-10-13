import { convertFileSrc, invoke, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core';
import { appConfigDir, appLogDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { z } from 'zod';

import { toAppError } from '@/lib/errors';

import type {
  DesktopBridge,
  FfmpegStatus,
  MediaFileInfo,
  TikTokAccount,
  TikTokPendingConnection,
} from './DesktopBridge';

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

const tiktokAccountSchema = z.object({
  openId: z.string().min(1).max(128),
  username: z
    .string()
    .regex(/^[A-Za-z0-9._]{1,64}$/)
    .nullable(),
  displayName: z.string().max(100),
  avatarUrl: z.url({ protocol: /^https$/ }).nullable(),
  scopes: z.array(z.string().max(64)),
});

const tiktokPendingSchema = z.object({
  connectionId: z.string().min(1).max(64),
  account: tiktokAccountSchema,
});

async function invokeCommand<T>(
  command: string,
  schema: z.ZodType<T>,
  args?: InvokeArgs,
  options?: InvokeOptions,
): Promise<T> {
  try {
    return schema.parse(await invoke(command, args, options));
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

    // Bytes enviados como corpo binário do IPC (sem JSON/base64); o id vai no header.
    saveThumbnail: (mediaId, jpeg) =>
      invokeCommand('save_thumbnail', z.string().min(1), jpeg, {
        headers: { 'media-id': mediaId },
      }),

    async deleteThumbnail(mediaId) {
      await invokeCommand('delete_thumbnail', z.null(), { mediaId });
    },

    async setSecret(name, value) {
      await invokeCommand('secret_set', z.null(), { name, value });
    },

    hasSecret: (name) => invokeCommand('secret_has', z.boolean(), { name }),

    async deleteSecret(name) {
      await invokeCommand('secret_delete', z.null(), { name });
    },

    aiChatCompletion: (body) => invokeCommand('ai_chat_completion', z.unknown(), { body }),

    tiktokConnect: (): Promise<TikTokPendingConnection> =>
      invokeCommand('tiktok_connect', tiktokPendingSchema),

    async tiktokCancelConnect() {
      await invokeCommand('tiktok_cancel_connect', z.null());
    },

    async tiktokCommitConnection(connectionId, channelId) {
      await invokeCommand('tiktok_commit_connection', z.null(), { connectionId, channelId });
    },

    async tiktokDiscardConnection(connectionId) {
      await invokeCommand('tiktok_discard_connection', z.null(), { connectionId });
    },

    tiktokGetProfile: (channelId): Promise<TikTokAccount> =>
      invokeCommand('tiktok_get_profile', tiktokAccountSchema, { channelId }),

    async tiktokDisconnect(channelId) {
      await invokeCommand('tiktok_disconnect', z.null(), { channelId });
    },

    getDataDirectory: () => appConfigDir(),

    getLogDirectory: () => appLogDir(),

    toAssetUrl: (path) => convertFileSrc(path),
  };
}
