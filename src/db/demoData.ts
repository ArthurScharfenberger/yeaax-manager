import type { Clock } from '@/lib/clock';
import { DEMO_ID_PREFIX, DEMO_MEDIA_PATH_PREFIX } from '@/lib/demo';
import { logger } from '@/lib/logger';
import type {
  ChannelStatus,
  MediaStatus,
  Platform,
  Post,
  PostHistoryEntry,
  PostHistoryEvent,
  PostStatus,
} from '@/types';
import { addDays, addMinutes, ceilToMinutes, startOfDay } from '@/utils/date';
import { formatDateTime } from '@/utils/format';

import type { DbClient } from './client';
import type { Repositories } from './repositories';

/**
 * Dados de demonstração para a interface ficar utilizável sem APIs externas.
 *
 * - Inseridos uma única vez, apenas se o banco não tiver canais (nunca sobre dados reais).
 * - Todos os ids começam com `demo-`, o que permite removê-los com segurança.
 * - Datas são relativas ao momento do seed, para o dashboard sempre parecer "vivo".
 */
const SEEDED_SETTING_KEY = 'demo.seededAt';
const MB = 1024 * 1024;

interface DemoChannel {
  key: string;
  platform: Platform;
  username: string;
  displayName: string;
  status: ChannelStatus;
  syncedHoursAgo: number;
}

// prettier-ignore
const CHANNELS: DemoChannel[] = [
  { key: 'yeaxx-tt', platform: 'tiktok', username: 'yeaxx', displayName: 'YEAXX Cars', status: 'connected', syncedHoursAgo: 2 },
  { key: 'yeaxx-ig', platform: 'instagram', username: 'yeaxx', displayName: 'YEAXX Cars', status: 'connected', syncedHoursAgo: 3 },
  { key: 'techfix-tt', platform: 'tiktok', username: 'techfix.rs', displayName: 'TechFix', status: 'connected', syncedHoursAgo: 5 },
  { key: 'techfix-ig', platform: 'instagram', username: 'techfix.rs', displayName: 'TechFix', status: 'connected', syncedHoursAgo: 26 },
  { key: 'clipes-tt', platform: 'tiktok', username: 'clipes.diarios', displayName: 'Clipes', status: 'expired', syncedHoursAgo: 24 * 9 },
];

const TAGS = ['carros', 'tutorial', 'pronto', 'reaproveitar', 'clipes'];

interface DemoMedia {
  key: string;
  filename: string;
  duration: number;
  sizeMb: number;
  landscape?: boolean;
  status: MediaStatus;
  tags: string[];
  importedDaysAgo: number;
}

// prettier-ignore
const MEDIA: DemoMedia[] = [
  { key: '01', filename: 'civic-si-rolling-shot.mp4', duration: 42, sizeMb: 48.2, status: 'ready', tags: ['carros', 'pronto'], importedDaysAgo: 1 },
  { key: '02', filename: 'gol-gti-antes-depois.mp4', duration: 58, sizeMb: 61.5, status: 'ready', tags: ['carros'], importedDaysAgo: 2 },
  { key: '03', filename: 'detalhamento-interno.mov', duration: 84, sizeMb: 142.3, status: 'imported', tags: ['carros', 'reaproveitar'], importedDaysAgo: 3 },
  { key: '04', filename: 'trocar-tela-iphone-13.mp4', duration: 130, sizeMb: 96.1, status: 'ready', tags: ['tutorial', 'pronto'], importedDaysAgo: 1 },
  { key: '05', filename: 'limpeza-notebook-gamer.mp4', duration: 107, sizeMb: 88.4, status: 'used', tags: ['tutorial'], importedDaysAgo: 6 },
  { key: '06', filename: 'bateria-inchada-alerta.mp4', duration: 35, sizeMb: 27.9, status: 'ready', tags: ['tutorial'], importedDaysAgo: 4 },
  { key: '07', filename: 'montagem-pc-timelapse.webm', duration: 59, sizeMb: 39.6, landscape: true, status: 'processing', tags: ['tutorial', 'reaproveitar'], importedDaysAgo: 0 },
  { key: '08', filename: 'clipe-reacao-01.mp4', duration: 21, sizeMb: 15.2, status: 'ready', tags: ['clipes'], importedDaysAgo: 5 },
  { key: '09', filename: 'clipe-melhores-momentos.mp4', duration: 48, sizeMb: 33.7, status: 'imported', tags: ['clipes', 'reaproveitar'], importedDaysAgo: 7 },
  { key: '10', filename: 'som-escape-esportivo.mov', duration: 15, sizeMb: 22.8, status: 'error', tags: ['carros'], importedDaysAgo: 8 },
];

/** Quando o post acontece, relativo ao momento do seed. */
type DemoWhen = { hoursFromNow: number } | { dayOffset: number; time: string } | null;

interface DemoPost {
  key: string;
  channel: string;
  media: string | null;
  status: PostStatus;
  when: DemoWhen;
  caption: string;
  failure?: string;
}

// prettier-ignore
const POSTS: DemoPost[] = [
  { key: '01', channel: 'yeaxx-tt', media: '01', status: 'scheduled', when: { hoursFromNow: 2 }, caption: 'Civic Si no rolling shot de fim de tarde 🌅 Qual geração é a melhor? #civic #hondacivic #carros' },
  { key: '02', channel: 'yeaxx-ig', media: '01', status: 'scheduled', when: { hoursFromNow: 2.5 }, caption: 'Rolling shot do Civic Si com a luz perfeita do fim de tarde. Salva para inspirar o próximo ensaio 📸 #civic #carros #automotive' },
  { key: '03', channel: 'techfix-tt', media: '04', status: 'scheduled', when: { dayOffset: 1, time: '12:00' }, caption: 'Como trocar a tela do iPhone 13 em casa — passo a passo com as ferramentas certas 🔧 #iphone #tutorial #techfix' },
  { key: '04', channel: 'techfix-ig', media: '06', status: 'scheduled', when: { dayOffset: 1, time: '18:30' }, caption: 'Bateria estufada é sinal de alerta ⚠️ Veja o que fazer antes de carregar de novo. #bateria #celular #dica' },
  { key: '05', channel: 'yeaxx-tt', media: '02', status: 'scheduled', when: { dayOffset: 2, time: '19:00' }, caption: 'Gol GTI: antes e depois da restauração completa 🔧 Vale a pena restaurar? #golgti #vw #restauracao' },
  { key: '06', channel: 'clipes-tt', media: '08', status: 'scheduled', when: { dayOffset: 3, time: '20:00' }, caption: 'A reação mais sincera da semana 😂 #clipes #humor' },
  { key: '07', channel: 'techfix-tt', media: '07', status: 'review', when: { dayOffset: 1, time: '09:30' }, caption: 'Montagem completa de um PC gamer em timelapse ⏱️ #pcgamer #setup' },
  { key: '08', channel: 'yeaxx-ig', media: '03', status: 'draft', when: { dayOffset: 4, time: '11:00' }, caption: 'Detalhamento interno: o antes e depois que impressiona.' },
  { key: '09', channel: 'techfix-ig', media: '04', status: 'draft', when: null, caption: 'Versão Reels do tutorial da tela do iPhone — revisar corte inicial.' },
  { key: '10', channel: 'yeaxx-tt', media: null, status: 'draft', when: null, caption: 'Ideia: série "carros dos inscritos".' },
  { key: '11', channel: 'techfix-tt', media: '05', status: 'published', when: { hoursFromNow: -3 }, caption: 'Limpeza completa de notebook gamer: a temperatura caiu 18 °C 🧊 #notebook #manutencao' },
  { key: '12', channel: 'yeaxx-ig', media: '02', status: 'published', when: { dayOffset: -1, time: '19:30' }, caption: 'O Gol GTI voltou a brilhar ✨ Restauração completa no carrossel. #golgti #carros' },
  { key: '13', channel: 'techfix-ig', media: '05', status: 'published', when: { dayOffset: -2, time: '12:00' }, caption: 'Seu notebook esquentando demais? Limpeza resolve na maioria dos casos. #notebook #dica' },
  { key: '14', channel: 'clipes-tt', media: '09', status: 'failed', when: { hoursFromNow: -1 }, caption: 'Melhores momentos da semana 🎬 #clipes', failure: 'Sessão do TikTok expirada (simulado). Reconecte o canal e reagende.' },
  { key: '15', channel: 'yeaxx-tt', media: '10', status: 'cancelled', when: { dayOffset: -1, time: '10:00' }, caption: 'Som do escape esportivo 🔊 #carros' },
];

const channelId = (key: string) => `${DEMO_ID_PREFIX}channel-${key}`;
const mediaId = (key: string) => `${DEMO_ID_PREFIX}media-${key}`;
const tagId = (name: string) => `${DEMO_ID_PREFIX}tag-${name}`;
const postId = (key: string) => `${DEMO_ID_PREFIX}post-${key}`;

function resolveWhen(when: DemoWhen, now: Date): Date | null {
  if (when === null) return null;
  if ('hoursFromNow' in when) return ceilToMinutes(addMinutes(now, when.hoursFromNow * 60), 30);
  const [hours = 0, minutes = 0] = when.time.split(':').map(Number);
  const date = addDays(startOfDay(now), when.dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** Eventos de histórico coerentes com o status final do post. */
function historyFor(post: DemoPost, scheduledAt: Date | null, createdAt: Date): PostHistoryEntry[] {
  const entries: {
    event: PostHistoryEvent;
    at: Date;
    from?: PostStatus;
    to?: PostStatus;
    message?: string;
  }[] = [
    {
      event: 'created',
      at: createdAt,
      to: post.status === 'draft' || post.status === 'review' ? 'draft' : 'scheduled',
    },
  ];
  const scheduleMessage = scheduledAt ? `Agendado para ${formatDateTime(scheduledAt)}` : undefined;
  const isTerminal = post.status === 'published' || post.status === 'failed';

  if (post.status === 'review') {
    entries.push({
      event: 'status_changed',
      at: addMinutes(createdAt, 10),
      from: 'draft',
      to: 'review',
    });
  }
  if (post.status === 'scheduled' || post.status === 'cancelled' || isTerminal) {
    entries.push({
      event: 'scheduled',
      at: addMinutes(createdAt, 2),
      ...(scheduleMessage ? { message: scheduleMessage } : {}),
    });
  }
  if (isTerminal && scheduledAt) {
    entries.push({ event: 'publish_attempt', at: scheduledAt, message: 'Envio simulado.' });
    entries.push(
      post.status === 'published'
        ? {
            event: 'published',
            at: addMinutes(scheduledAt, 1),
            from: 'publishing',
            to: 'published',
            message: 'Publicado (simulado).',
          }
        : {
            event: 'failed',
            at: addMinutes(scheduledAt, 1),
            from: 'publishing',
            to: 'failed',
            ...(post.failure ? { message: post.failure } : {}),
          },
    );
  }
  if (post.status === 'cancelled') {
    entries.push({
      event: 'cancelled',
      at: addMinutes(createdAt, 30),
      from: 'scheduled',
      to: 'cancelled',
    });
  }

  return entries.map((entry, index) => ({
    id: `${DEMO_ID_PREFIX}history-${post.key}-${index}`,
    postId: postId(post.key),
    event: entry.event,
    fromStatus: entry.from ?? null,
    toStatus: entry.to ?? null,
    message: entry.message ?? null,
    createdAt: entry.at.toISOString(),
  }));
}

async function seed(repositories: Repositories, now: Date): Promise<void> {
  const nowIso = now.toISOString();

  for (const channel of CHANNELS) {
    await repositories.channels.insert({
      id: channelId(channel.key),
      platform: channel.platform,
      username: channel.username,
      displayName: channel.displayName,
      avatarUrl: null,
      status: channel.status,
      lastSyncedAt: addMinutes(now, -channel.syncedHoursAgo * 60).toISOString(),
      createdAt: addDays(now, -30).toISOString(),
      updatedAt: nowIso,
    });
  }

  for (const name of TAGS) {
    await repositories.tags.insert({
      id: tagId(name),
      name,
      createdAt: addDays(now, -30).toISOString(),
    });
  }

  for (const item of MEDIA) {
    const importedAt = addMinutes(
      addDays(now, -item.importedDaysAgo),
      -Number(item.key) * 37,
    ).toISOString();
    const extension = item.filename.split('.').pop();
    await repositories.media.insert({
      id: mediaId(item.key),
      filename: item.filename,
      originalFilename: item.filename,
      filePath: `${DEMO_MEDIA_PATH_PREFIX}${item.filename}`,
      type: 'video',
      mimeType: extension === 'mov' ? 'video/quicktime' : `video/${extension ?? 'mp4'}`,
      size: Math.round(item.sizeMb * MB),
      duration: item.duration,
      width: item.landscape ? 1920 : 1080,
      height: item.landscape ? 1080 : 1920,
      thumbnailPath: null,
      status: item.status,
      createdAt: importedAt,
      updatedAt: importedAt,
    });
    for (const tag of item.tags) {
      await repositories.tags.attach(mediaId(item.key), tagId(tag), importedAt);
    }
  }

  for (const item of POSTS) {
    const scheduledAt = resolveWhen(item.when, now);
    const createdAt = addMinutes(scheduledAt && scheduledAt < now ? scheduledAt : now, -24 * 60);
    const post: Post = {
      id: postId(item.key),
      channelId: channelId(item.channel),
      mediaId: item.media ? mediaId(item.media) : null,
      caption: item.caption,
      status: item.status,
      scheduledAt: scheduledAt?.toISOString() ?? null,
      publishedAt:
        item.status === 'published' && scheduledAt
          ? addMinutes(scheduledAt, 1).toISOString()
          : null,
      externalPostId: item.status === 'published' ? `mock_${item.key}` : null,
      createdAt: createdAt.toISOString(),
      updatedAt: nowIso,
    };
    await repositories.posts.insert(post);
    for (const entry of historyFor(item, scheduledAt, createdAt)) {
      await repositories.postHistory.insert(entry);
    }
  }
}

interface DemoDataServiceDeps {
  db: DbClient;
  repositories: Repositories;
  clock: Clock;
}

export function createDemoDataService({ db, repositories, clock }: DemoDataServiceDeps) {
  return {
    /** Insere os dados de demonstração na primeira execução, se o banco estiver vazio. */
    async seedIfNeeded(): Promise<boolean> {
      if ((await repositories.settings.get(SEEDED_SETTING_KEY)) !== null) return false;

      const now = clock.now();
      const hasRealData = (await repositories.channels.list()).length > 0;
      if (!hasRealData) {
        await seed(repositories, now);
        logger.info('Dados de demonstração inseridos');
      }
      await repositories.settings.set(
        SEEDED_SETTING_KEY,
        JSON.stringify(now.toISOString()),
        now.toISOString(),
      );
      return !hasRealData;
    },

    async hasDemoData(): Promise<boolean> {
      const rows = await db.select<{ total: number }>(
        `SELECT (SELECT COUNT(*) FROM channels WHERE id LIKE 'demo-%')
              + (SELECT COUNT(*) FROM media WHERE id LIKE 'demo-%') AS total`,
      );
      return (rows[0]?.total ?? 0) > 0;
    },

    /**
     * Remove todos os registros de demonstração. Posts criados pelo usuário em canais de
     * demonstração também são removidos (o canal deixa de existir).
     */
    async remove(): Promise<void> {
      await db.execute("DELETE FROM posts WHERE id LIKE 'demo-%' OR channel_id LIKE 'demo-%'");
      await db.execute("DELETE FROM media WHERE id LIKE 'demo-%'");
      await db.execute("DELETE FROM channels WHERE id LIKE 'demo-%'");
      await db.execute(
        "DELETE FROM tags WHERE id LIKE 'demo-%' AND id NOT IN (SELECT tag_id FROM media_tags)",
      );
      logger.info('Dados de demonstração removidos');
    },
  };
}

export type DemoDataService = ReturnType<typeof createDemoDataService>;
