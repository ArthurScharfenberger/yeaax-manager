import {
  Channel,
  convertFileSrc,
  invoke,
  type InvokeArgs,
  type InvokeOptions,
} from '@tauri-apps/api/core';
import { appConfigDir, appLogDir } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';
import { z } from 'zod';

import { toAppError } from '@/lib/errors';
import { tiktokPrivacyLevelSchema } from '@/types';

import {
  type DesktopBridge,
  type FfmpegStatus,
  type MediaFileInfo,
  type TikTokAccount,
  type TikTokCreatorInfo,
  TIKTOK_PUBLISH_STATUSES,
  type TikTokPublishProgress,
  type TikTokPublishStatus,
  type TikTokPendingConnection,
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

const tiktokCreatorInfoSchema = z.object({
  nickname: z.string().max(100),
  username: z
    .string()
    .regex(/^[A-Za-z0-9._]{1,64}$/)
    .nullable(),
  avatarUrl: z.url({ protocol: /^https$/ }).nullable(),
  // Valores desconhecidos de uma versão futura da API são ignorados, não quebram o compositor.
  privacyLevelOptions: z.array(z.string()).transform((values) =>
    values.flatMap((value) => {
      const parsed = tiktokPrivacyLevelSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
  commentDisabled: z.boolean(),
  duetDisabled: z.boolean(),
  stitchDisabled: z.boolean(),
  maxVideoPostDurationSec: z.number().int().positive().nullable(),
});

const tiktokPublishProgressSchema = z.discriminatedUnion('stage', [
  z.object({ stage: z.literal('preparing') }),
  z.object({
    stage: z.literal('uploading'),
    sent: z.number().nonnegative(),
    total: z.number().positive(),
  }),
  z.object({ stage: z.literal('processing') }),
]);

const tiktokPublishStatusSchema = z.object({
  status: z.enum(TIKTOK_PUBLISH_STATUSES),
  failReason: z
    .string()
    .regex(/^[a-z_]{1,64}$/)
    .nullable(),
  postIds: z.array(z.string().regex(/^\d{1,25}$/)),
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

    tiktokCreatorInfo: (channelId): Promise<TikTokCreatorInfo> =>
      invokeCommand('tiktok_creator_info', tiktokCreatorInfoSchema, { channelId }),

    async tiktokPublish(channelId, request, onProgress) {
      // Progresso chega por um canal do Tauri; mensagens fora do formato são ignoradas.
      const channel = new Channel<unknown>((message) => {
        const parsed = tiktokPublishProgressSchema.safeParse(message);
        if (parsed.success) onProgress(parsed.data satisfies TikTokPublishProgress);
      });
      return invokeCommand('tiktok_publish', z.object({ publishId: z.string().min(1).max(64) }), {
        channelId,
        request,
        onProgress: channel,
      });
    },

    tiktokPublishStatus: (channelId, publishId): Promise<TikTokPublishStatus> =>
      invokeCommand('tiktok_publish_status', tiktokPublishStatusSchema, { channelId, publishId }),

    async openTikTokPolicy(policy) {
      await invokeCommand('open_tiktok_policy', z.null(), { policy });
    },

    getDataDirectory: () => appConfigDir(),

    getLogDirectory: () => appLogDir(),

    toAssetUrl: (path) => convertFileSrc(path),
  };
}
