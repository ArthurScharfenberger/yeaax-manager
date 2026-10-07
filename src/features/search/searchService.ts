import type { Repositories } from '@/db/repositories';
import type { Channel, Media, PostWithRelations } from '@/types';

export interface SearchResults {
  channels: Channel[];
  posts: PostWithRelations[];
  media: Media[];
}

export const MIN_SEARCH_LENGTH = 2;
const LIMIT_PER_GROUP = 5;

interface SearchServiceDeps {
  repositories: Pick<Repositories, 'channels' | 'posts' | 'media'>;
}

export function createSearchService({ repositories }: SearchServiceDeps) {
  const { channels, posts, media } = repositories;

  return {
    /** Busca simultânea em canais, posts (legenda/canal) e biblioteca. */
    async search(rawTerm: string): Promise<SearchResults> {
      const term = rawTerm.trim();
      if (term.length < MIN_SEARCH_LENGTH) return { channels: [], posts: [], media: [] };

      const needle = term.replace(/^@/, '').toLowerCase();
      const [allChannels, matchedPosts, matchedMedia] = await Promise.all([
        channels.list(),
        posts.listDetailed({ search: term, order: 'updated_desc', limit: LIMIT_PER_GROUP }),
        media.list({ search: term, limit: LIMIT_PER_GROUP }),
      ]);

      return {
        channels: allChannels
          .filter(
            (channel) =>
              channel.username.toLowerCase().includes(needle) ||
              channel.displayName.toLowerCase().includes(needle),
          )
          .slice(0, LIMIT_PER_GROUP),
        posts: matchedPosts,
        media: matchedMedia,
      };
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;
