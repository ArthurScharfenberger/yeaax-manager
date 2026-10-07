import { describe, expect, it } from 'vitest';

import { extractHashtags, findHashtags, normalizeHashtag } from './hashtags';

describe('normalizeHashtag', () => {
  it('remove acentos, espaços e símbolos', () => {
    expect(normalizeHashtag('Mecânica Rápida!')).toBe('mecanicarapida');
  });
});

describe('findHashtags', () => {
  it('encontra hashtags existentes sem duplicar', () => {
    expect(findHashtags('Olha isso #Carros #carros #Civic')).toEqual(['#carros', '#civic']);
  });
});

describe('extractHashtags', () => {
  it('extrai palavras relevantes ignorando stop words', () => {
    const tags = extractHashtags('Como trocar a tela do iPhone 13 em casa com segurança');
    expect(tags).toEqual(['#trocar', '#tela', '#iphone', '#casa', '#seguranca']);
  });

  it('prioriza hashtags já escritas e respeita o limite', () => {
    const tags = extractHashtags('#civic rolling shot de fim de tarde com Honda Civic Si', 3);
    expect(tags).toEqual(['#civic', '#rolling', '#shot']);
  });

  it('retorna vazio para texto sem palavras relevantes', () => {
    expect(extractHashtags('de um 13 com')).toEqual([]);
  });
});
