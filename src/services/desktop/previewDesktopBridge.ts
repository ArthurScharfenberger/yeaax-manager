import { AppError } from '@/lib/errors';

import type { DesktopBridge, TikTokPolicy } from './DesktopBridge';

/** Mesmas URLs da lista fixa do Rust (src-tauri/src/commands/tiktok.rs). */
const TIKTOK_POLICY_URLS: Record<TikTokPolicy, string> = {
  music_usage: 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en',
  branded_content: 'https://www.tiktok.com/legal/page/global/bc-policy/en',
};

const DESKTOP_ONLY_MESSAGE =
  'Importar arquivos locais só é possível no app desktop. Rode `npm run app:dev`.';

/** Implementação para o modo preview (navegador): sem acesso ao sistema de arquivos. */
export function createPreviewDesktopBridge(): DesktopBridge {
  return {
    mode: 'preview',
    pickVideoFiles: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    inspectMediaFile: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    detectFfmpeg: () => Promise.resolve({ available: false, version: null }),
    saveThumbnail: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    deleteThumbnail: () => Promise.resolve(),
    setSecret: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    hasSecret: () => Promise.resolve(false),
    deleteSecret: () => Promise.resolve(),
    aiChatCompletion: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    // No preview o TikTok usa o MockSocialProvider (services/social); estes nunca são chamados.
    tiktokConnect: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    tiktokCancelConnect: () => Promise.resolve(),
    tiktokCommitConnection: () =>
      Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    tiktokDiscardConnection: () => Promise.resolve(),
    tiktokGetProfile: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    tiktokDisconnect: () => Promise.resolve(),
    tiktokCreatorInfo: () => Promise.reject(new AppError('NOT_AVAILABLE', DESKTOP_ONLY_MESSAGE)),
    // No navegador os links das políticas abrem numa aba nova (no app, o Rust abre o navegador do sistema).
    openTikTokPolicy: (policy) => {
      window.open(TIKTOK_POLICY_URLS[policy], '_blank', 'noopener,noreferrer');
      return Promise.resolve();
    },
    getDataDirectory: () => Promise.resolve(null),
    getLogDirectory: () => Promise.resolve(null),
    toAssetUrl: () => null,
  };
}
