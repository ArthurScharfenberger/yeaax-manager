import { describe, expect, it } from 'vitest';

import {
  canCancel,
  canDelete,
  canTransition,
  checkCaption,
  countHashtags,
  isEditable,
  isOverdue,
} from './postRules';

describe('transições de status', () => {
  it('permite o fluxo principal', () => {
    expect(canTransition('draft', 'scheduled')).toBe(true);
    expect(canTransition('scheduled', 'publishing')).toBe(true);
    expect(canTransition('publishing', 'published')).toBe(true);
    expect(canTransition('failed', 'scheduled')).toBe(true);
  });

  it('bloqueia transições inválidas', () => {
    expect(canTransition('published', 'draft')).toBe(false);
    expect(canTransition('draft', 'published')).toBe(false);
    expect(canTransition('cancelled', 'scheduled')).toBe(false);
  });

  it('considera manter o mesmo status como válido', () => {
    expect(canTransition('scheduled', 'scheduled')).toBe(true);
  });
});

describe('permissões por status', () => {
  it('impede editar posts publicados ou em publicação', () => {
    expect(isEditable('draft')).toBe(true);
    expect(isEditable('failed')).toBe(true);
    expect(isEditable('published')).toBe(false);
    expect(isEditable('publishing')).toBe(false);
  });

  it('só exclui rascunhos, cancelados e falhas', () => {
    expect(canDelete('draft')).toBe(true);
    expect(canDelete('scheduled')).toBe(false);
    expect(canDelete('published')).toBe(false);
  });

  it('não cancela o que já foi publicado ou cancelado', () => {
    expect(canCancel('scheduled')).toBe(true);
    expect(canCancel('published')).toBe(false);
    expect(canCancel('cancelled')).toBe(false);
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-10-07T20:00:00.000Z');

  it('marca agendados no passado', () => {
    expect(isOverdue({ status: 'scheduled', scheduledAt: '2026-10-07T19:00:00.000Z' }, now)).toBe(
      true,
    );
  });

  it('ignora futuros e outros status', () => {
    expect(isOverdue({ status: 'scheduled', scheduledAt: '2026-10-07T21:00:00.000Z' }, now)).toBe(
      false,
    );
    expect(isOverdue({ status: 'draft', scheduledAt: '2026-10-07T19:00:00.000Z' }, now)).toBe(
      false,
    );
  });
});

describe('checkCaption', () => {
  it('conta hashtags com acentos e números', () => {
    expect(countHashtags('Bom dia #carros #mecânica #top10 # solto')).toBe(3);
  });

  it('aplica o limite de 30 hashtags do Instagram', () => {
    const caption = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ');
    expect(checkCaption(caption, 'instagram').tooManyHashtags).toBe(true);
    expect(checkCaption(caption, 'tiktok').tooManyHashtags).toBe(false);
  });

  it('detecta legendas acima do limite', () => {
    expect(checkCaption('a'.repeat(2201), 'tiktok').tooLong).toBe(true);
    expect(checkCaption('a'.repeat(2200), 'tiktok').tooLong).toBe(false);
  });
});
