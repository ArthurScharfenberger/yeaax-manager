import { z } from 'zod';

import type { Id, IsoDateString } from './common';

export const MEDIA_TYPES = ['video', 'image'] as const;
export const mediaTypeSchema = z.enum(MEDIA_TYPES);
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const MEDIA_STATUSES = ['imported', 'processing', 'ready', 'used', 'error'] as const;
export const mediaStatusSchema = z.enum(MEDIA_STATUSES);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

/** Etiqueta livre para classificar mídia (ex.: `carros`, `tutorial`, `reaproveitar`). */
export interface Tag {
  id: Id;
  name: string;
  createdAt: IsoDateString;
}

export interface TagWithUsage extends Tag {
  usageCount: number;
}

/**
 * Conteúdo da biblioteca. O arquivo original permanece onde o usuário o guardou;
 * o app armazena apenas o caminho e os metadados (ver DEC-006).
 */
export interface Media {
  id: Id;
  filename: string;
  originalFilename: string;
  filePath: string;
  type: MediaType;
  mimeType: string;
  /** Tamanho em bytes. */
  size: number;
  /** Duração em segundos. `null` enquanto não for possível ler os metadados. */
  duration: number | null;
  width: number | null;
  height: number | null;
  thumbnailPath: string | null;
  status: MediaStatus;
  tags: Tag[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
