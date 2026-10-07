const JPEG_QUALITY = 0.85;

/**
 * Lê uma imagem local (miniatura no protocolo `asset:`) como data URL JPEG, para enviar à IA.
 * Usa canvas em vez de `fetch` para respeitar a CSP (`connect-src` não inclui `asset:`);
 * o protocolo `asset:` responde com CORS da janela, então o canvas não fica bloqueado.
 */
export function loadImageAsDataUrl(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
