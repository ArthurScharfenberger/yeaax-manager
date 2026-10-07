import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError, getErrorMessage, isExpectedError, toAppError } from './errors';
import { redact } from './logger';

describe('toAppError', () => {
  it('preserva AppError', () => {
    const error = new AppError('CONFLICT', 'Duplicado');
    expect(toAppError(error)).toBe(error);
  });

  it('converte erros de comando do Rust', () => {
    const error = toAppError({ code: 'UNSUPPORTED_FILE', message: 'Formato .mkv não suportado.' });
    expect(error.code).toBe('UNSUPPORTED_FILE');
    expect(error.message).toBe('Formato .mkv não suportado.');
  });

  it('usa a primeira mensagem de validação do Zod', () => {
    const result = z
      .object({ name: z.string().min(2, 'Nome curto demais.') })
      .safeParse({ name: 'a' });
    expect(getErrorMessage(result.error)).toBe('Nome curto demais.');
  });

  it('esconde detalhes técnicos de erros desconhecidos', () => {
    const error = toAppError(new Error('SQLITE_IOERR at 0x1234'));
    expect(error.code).toBe('UNKNOWN');
    expect(error.message).not.toContain('SQLITE');
  });

  it('separa regras de negócio de falhas reais', () => {
    expect(isExpectedError(new AppError('SCHEDULE_IN_PAST', 'x'))).toBe(true);
    expect(isExpectedError(new AppError('DATABASE', 'x'))).toBe(false);
    expect(isExpectedError(new Error('x'))).toBe(false);
  });
});

describe('redact', () => {
  it('oculta campos sensíveis em qualquer profundidade', () => {
    const value = redact({
      user: 'yeaxx',
      accessToken: 'abc',
      nested: { client_secret: 'xyz', api_key: '123', list: [{ password: 'p' }] },
      header: 'Bearer eyJhbGciOi.payload.sig',
    });
    expect(value).toEqual({
      user: 'yeaxx',
      accessToken: '[redacted]',
      nested: {
        client_secret: '[redacted]',
        api_key: '[redacted]',
        list: [{ password: '[redacted]' }],
      },
      header: 'Bearer [redacted]',
    });
  });
});
