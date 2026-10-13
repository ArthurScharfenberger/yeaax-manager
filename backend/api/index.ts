import { createApp } from '../src/app.js';
import { consoleLogger } from '../src/logger.js';
import { createRateLimiter } from '../src/rateLimit.js';

/**
 * Função única da Vercel (todas as rotas chegam aqui pelo rewrite em vercel.json).
 * Ver backend/README.md e docs/ARCHITECTURE.md → Backend mínimo.
 */
const handle = createApp({
  env: process.env,
  fetch: globalThis.fetch.bind(globalThis),
  logger: consoleLogger,
  rateLimiter: createRateLimiter(Date.now),
  now: Date.now,
});

export default { fetch: handle };
