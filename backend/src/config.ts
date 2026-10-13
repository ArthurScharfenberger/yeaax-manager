import { z } from 'zod';

/** Escopos que o app pode pedir ao TikTok (lista fechada). */
export const KNOWN_TIKTOK_SCOPES = [
  'user.info.basic',
  'user.info.profile',
  'user.info.stats',
  'video.list',
  'video.publish',
  'video.upload',
] as const;

export const DEFAULT_TIKTOK_SCOPES = 'user.info.basic,user.info.profile,video.publish,video.upload';

const scopesSchema = z
  .string()
  .trim()
  .transform((value) => [...new Set(value.split(',').map((scope) => scope.trim()))])
  .pipe(z.array(z.enum(KNOWN_TIKTOK_SCOPES)).min(1))
  .refine((scopes) => scopes.includes('user.info.basic'), 'user.info.basic é obrigatório');

const envSchema = z.object({
  TIKTOK_CLIENT_KEY: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{4,128}$/),
  TIKTOK_CLIENT_SECRET: z.string().trim().min(8).max(512).regex(/^\S+$/),
  TIKTOK_SCOPES: scopesSchema,
});

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  scopes: readonly string[];
}

export interface AppConfig {
  tiktok: TikTokConfig;
}

export type ConfigResult =
  | { ok: true; config: AppConfig }
  /** Só os NOMES das variáveis inválidas — nunca os valores. */
  | { ok: false; invalidKeys: string[] };

export type Env = Readonly<Record<string, string | undefined>>;

export function loadConfig(env: Env): ConfigResult {
  const scopes = env.TIKTOK_SCOPES?.trim();
  const result = envSchema.safeParse({
    TIKTOK_CLIENT_KEY: env.TIKTOK_CLIENT_KEY,
    TIKTOK_CLIENT_SECRET: env.TIKTOK_CLIENT_SECRET,
    // Variável vazia ou ausente usa o conjunto padrão.
    TIKTOK_SCOPES: scopes ? scopes : DEFAULT_TIKTOK_SCOPES,
  });
  if (!result.success) {
    const keys = result.error.issues.map((issue) => String(issue.path[0] ?? 'env'));
    return { ok: false, invalidKeys: [...new Set(keys)] };
  }
  const data = result.data;
  return {
    ok: true,
    config: {
      tiktok: {
        clientKey: data.TIKTOK_CLIENT_KEY,
        clientSecret: data.TIKTOK_CLIENT_SECRET,
        scopes: data.TIKTOK_SCOPES,
      },
    },
  };
}
