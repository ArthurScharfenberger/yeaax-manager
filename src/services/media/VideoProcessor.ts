import { AppError } from '@/lib/errors';

import type { DesktopBridge, FfmpegStatus } from '../desktop/DesktopBridge';

/**
 * Processamento local de vídeo (FFmpeg) — arquitetura preparada, sem implementação.
 *
 * Plano (docs/ROADMAP.md, Fase 2):
 *  - executar o FFmpeg pelo lado Rust, fora da thread principal, como "jobs";
 *  - registrar cada execução em `media_processing_jobs` (tabela futura);
 *  - nunca montar linhas de comando a partir de texto livre do usuário.
 */
export interface VideoProcessor {
  getStatus(): Promise<FfmpegStatus>;
  generateThumbnail(request: ThumbnailRequest): Promise<void>;
  adaptForPlatform(request: AdaptRequest): Promise<void>;
  applyWatermark(request: WatermarkRequest): Promise<void>;
}

export type VideoPreset = 'tiktok_vertical' | 'instagram_reels' | 'instagram_feed';

export interface ThumbnailRequest {
  sourcePath: string;
  outputPath: string;
  atSeconds: number;
}

export interface AdaptRequest {
  sourcePath: string;
  outputPath: string;
  preset: VideoPreset;
}

export interface WatermarkRequest {
  sourcePath: string;
  outputPath: string;
  watermarkPath: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

function notImplemented(operation: string): Promise<never> {
  return Promise.reject(
    new AppError('NOT_AVAILABLE', `${operation} ainda não foi implementado (integração FFmpeg).`),
  );
}

export function createVideoProcessor(desktop: DesktopBridge): VideoProcessor {
  return {
    getStatus: () => desktop.detectFfmpeg(),
    generateThumbnail: () => notImplemented('Gerar miniatura'),
    adaptForPlatform: () => notImplemented('Adaptar formato'),
    applyWatermark: () => notImplemented('Aplicar watermark'),
  };
}
