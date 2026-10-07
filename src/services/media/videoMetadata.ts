export interface VideoMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Lê duração e resolução usando um `<video preload="metadata">` fora do DOM.
 * O navegador baixa só o cabeçalho do arquivo — o vídeo completo não é carregado.
 *
 * É uma solução provisória e "melhor esforço": formatos/codecs não suportados pelo
 * WebView2 retornam `null`. A leitura definitiva virá do ffprobe (FFmpeg).
 */
export function probeVideoMetadata(
  src: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const finish = (result: VideoMetadata | null) => {
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(result);
    };

    const timer = window.setTimeout(() => {
      finish(null);
    }, timeoutMs);

    video.addEventListener('loadedmetadata', () => {
      finish({
        duration: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
    });
    video.addEventListener('error', () => {
      finish(null);
    });

    video.src = src;
  });
}
