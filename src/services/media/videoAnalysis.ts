export interface VideoMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
}

export interface VideoAnalysis extends VideoMetadata {
  /** Quadro do vídeo em JPEG, ou `null` se não foi possível capturar. */
  thumbnail: Blob | null;
}

const TIMEOUT_MS = 10_000;
const THUMBNAIL_MAX_WIDTH = 360;
const THUMBNAIL_QUALITY = 0.8;
/** Captura perto do início, mas evitando o primeiro quadro (muitas vezes preto). */
const THUMBNAIL_AT_SECONDS = 1;

function readMetadata(video: HTMLVideoElement): VideoMetadata {
  return {
    duration: Number.isFinite(video.duration) ? video.duration : null,
    width: video.videoWidth || null,
    height: video.videoHeight || null,
  };
}

function captureFrame(video: HTMLVideoElement): Promise<Blob | null> {
  if (!video.videoWidth || !video.videoHeight) return Promise.resolve(null);
  const scale = Math.min(1, THUMBNAIL_MAX_WIDTH / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/jpeg', THUMBNAIL_QUALITY);
    } catch {
      // Canvas "contaminado" (origem sem CORS): segue sem miniatura.
      resolve(null);
    }
  });
}

/**
 * Carrega o vídeo fora do DOM. Com `capture`, busca um quadro e o converte em JPEG.
 * Só o necessário é lido (cabeçalho + trecho do quadro) — nunca o arquivo inteiro.
 */
function loadVideo(src: string, capture: boolean): Promise<VideoAnalysis | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    // O protocolo `asset:` do Tauri responde com Access-Control-Allow-Origin da janela,
    // então o canvas não fica bloqueado. Sem captura, não há motivo para usar CORS.
    if (capture) video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = capture ? 'auto' : 'metadata';

    let metadata: VideoMetadata | null = null;
    let settled = false;

    const finish = (thumbnail: Blob | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(metadata ? { ...metadata, thumbnail } : null);
    };

    const timer = window.setTimeout(() => {
      finish(null);
    }, TIMEOUT_MS);

    video.addEventListener('loadedmetadata', () => {
      metadata = readMetadata(video);
      if (!capture) {
        finish(null);
        return;
      }
      // Dispara 'seeked' quando o quadro estiver disponível.
      video.currentTime = Math.min(THUMBNAIL_AT_SECONDS, (metadata.duration ?? 0) / 2);
    });
    video.addEventListener('seeked', () => {
      void captureFrame(video).then(finish, () => {
        finish(null);
      });
    });
    video.addEventListener('error', () => {
      finish(null);
    });

    video.src = src;
  });
}

/**
 * Lê duração/resolução e captura uma miniatura usando o WebView2 (DEC-017/DEC-018).
 * Solução provisória até o FFmpeg: codecs não suportados retornam `null` ou sem miniatura.
 */
export async function analyzeVideo(src: string): Promise<VideoAnalysis | null> {
  const withFrame = await loadVideo(src, true);
  if (withFrame) return withFrame;
  // Se o carregamento com CORS falhar, ainda tenta obter ao menos os metadados.
  return loadVideo(src, false);
}
