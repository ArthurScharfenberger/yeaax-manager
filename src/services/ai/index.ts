import type { AIProvider } from './AIProvider';
import { MockAIProvider } from './MockAIProvider';

/** Ponto único de escolha do provider de IA. Hoje sempre o mock local. */
export function createAIProvider(): AIProvider {
  return new MockAIProvider();
}

export * from './AIProvider';
export { extractHashtags, findHashtags } from './hashtags';
