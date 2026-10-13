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

const redirectUriSchema = z.url({ protocol: /^https$/ }).refine((value) => {
  const url = new URL(value);
  return url.search === '' && url.hash === '' && !value.includes('#') && value.length < 512;
}, 'redirect URI precisa ser estático (sem query/fragmento) e ter menos de 512 caracteres');

const envSchema = z.object({
  TIKTOK_CLIENT_KEY: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{4,128}$/),
  TIKTOK_CLIENT_SECRET: z.string().trim().min(8).max(512).regex(/^\S+$/),
  TIKTOK_REDIRECT_URI: redirectUriSchema,
  TIKTOK_SCOPES: scopesSchema,
});

export interface TikTokConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
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
    TIKTOK_REDIRECT_URI: env.TIKTOK_REDIRECT_URI,
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
        redirectUri: data.TIKTOK_REDIRECT_URI,
        scopes: data.TIKTOK_SCOPES,
      },
    },
  };
}
