/**
 * Limite de requisições por IP em janela fixa, **em memória da instância**.
 *
 * Em funções serverless cada instância tem a própria memória: é uma proteção de melhor esforço contra
 * abuso simples. A proteção de borda recomendada é uma regra de rate limit no Firewall da Vercel
 * (ver backend/README.md). Nada é persistido.
 */
export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, rule: RateLimitRule): RateLimitDecision;
}

const MAX_TRACKED_KEYS = 10_000;

export function createRateLimiter(now: () => number): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  function prune(current: number) {
    for (const [key, bucket] of buckets) if (bucket.resetAt <= current) buckets.delete(key);
    // Ainda cheio (muitas chaves ativas): descarta as mais antigas para limitar a memória.
    for (const key of buckets.keys()) {
      if (buckets.size < MAX_TRACKED_KEYS) break;
      buckets.delete(key);
    }
  }

  return {
    check(key, rule) {
      const current = now();
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= current) {
        if (buckets.size >= MAX_TRACKED_KEYS) prune(current);
        bucket = { count: 0, resetAt: current + rule.windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      const allowed = bucket.count <= rule.limit;
      return {
        allowed,
        retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - current) / 1000)),
      };
    },
  };
}
