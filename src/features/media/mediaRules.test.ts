import { describe, expect, it } from 'vitest';

import {
  getFileExtension,
  getFileName,
  isSupportedVideoPath,
  normalizeTagName,
} from './mediaRules';

describe('mediaRules', () => {
  it('extrai nome e extensão de caminhos Windows e POSIX', () => {
    expect(getFileName('C:\\Videos\\Carros\\civic.MP4')).toBe('civic.MP4');
    expect(getFileName('/home/user/clip.webm')).toBe('clip.webm');
    expect(getFileExtension('C:\\Videos\\civic.MP4')).toBe('mp4');
    expect(getFileExtension('C:\\Videos\\.hidden')).toBeNull();
    expect(getFileExtension('C:\\Videos\\sem-extensao')).toBeNull();
  });

  it('aceita apenas .mp4, .mov e .webm', () => {
    expect(isSupportedVideoPath('a.mp4')).toBe(true);
    expect(isSupportedVideoPath('a.MOV')).toBe(true);
    expect(isSupportedVideoPath('a.webm')).toBe(true);
    expect(isSupportedVideoPath('a.mkv')).toBe(false);
    expect(isSupportedVideoPath('a.mp4.txt')).toBe(false);
  });

  it('normaliza nomes de tag', () => {
    expect(normalizeTagName('  Carros   Antigos ')).toBe('carros antigos');
    expect(normalizeTagName('   ')).toBe('');
  });
});
