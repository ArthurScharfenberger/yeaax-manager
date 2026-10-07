/** Regras puras da biblioteca de mídia. */

/** Mantido em sincronia com `SUPPORTED_VIDEO_EXTENSIONS` em src-tauri/src/commands/media.rs. */
export const SUPPORTED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'] as const;
export type SupportedVideoExtension = (typeof SUPPORTED_VIDEO_EXTENSIONS)[number];

const VIDEO_MIME_TYPES: Record<SupportedVideoExtension, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export const MAX_TAG_LENGTH = 32;

export function getFileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function getFileExtension(path: string): string | null {
  const name = getFileName(path);
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === name.length - 1) return null;
  return name.slice(dotIndex + 1).toLowerCase();
}

export function isSupportedVideoExtension(
  extension: string | null,
): extension is SupportedVideoExtension {
  return (
    extension !== null && (SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(extension)
  );
}

export function isSupportedVideoPath(path: string): boolean {
  return isSupportedVideoExtension(getFileExtension(path));
}

export function getVideoMimeType(extension: SupportedVideoExtension): string {
  return VIDEO_MIME_TYPES[extension];
}

/** Normaliza o nome de uma tag: minúsculas, espaços simples, até 32 caracteres. */
export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH).trim();
}
