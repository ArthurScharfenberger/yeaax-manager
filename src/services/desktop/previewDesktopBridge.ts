import { AppError } from '@/lib/errors';

import type { DesktopBridge } from './DesktopBridge';

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
    getDataDirectory: () => Promise.resolve(null),
    getLogDirectory: () => Promise.resolve(null),
    toAssetUrl: () => null,
  };
}
