import { type DesktopBridge, SECRET_NAMES } from '../desktop/DesktopBridge';
import type {
  AIProvider,
  CaptionRequest,
  CaptionSuggestion,
  PostPlanDraft,
  PostPlanRequest,
} from './AIProvider';
import { MockAIProvider } from './MockAIProvider';
import { OpenAIProvider } from './OpenAIProvider';

export interface AIStatus {
  provider: 'openai' | 'mock';
  label: string;
  simulated: boolean;
}

/** Ponto único de IA do app: usa a OpenAI quando há chave no cofre; senão, o simulador local. */
export interface AIService {
  describe(): Promise<AIStatus>;
  generateCaptions(request: CaptionRequest): Promise<CaptionSuggestion[]>;
  planPost(request: PostPlanRequest): Promise<PostPlanDraft>;
  /** Valida chave, créditos e modelo com um pedido mínimo (lança `AppError` se falhar). */
  testConnection(): Promise<void>;
}

export function createAIService(options: {
  desktop: DesktopBridge;
  getModel: () => Promise<string>;
}): AIService {
  const { desktop, getModel } = options;
  const mock = new MockAIProvider();
  const openai = new OpenAIProvider({
    complete: (body) => desktop.aiChatCompletion(body),
    getModel,
  });

  async function active(): Promise<AIProvider> {
    if (desktop.mode !== 'desktop') return mock;
    return (await desktop.hasSecret(SECRET_NAMES.openaiApiKey)) ? openai : mock;
  }

  return {
    async describe() {
      const provider = await active();
      if (provider === openai) {
        return { provider: 'openai', label: `OpenAI · ${await getModel()}`, simulated: false };
      }
      return { provider: 'mock', label: mock.label, simulated: true };
    },
    generateCaptions: async (request) => (await active()).generateCaptions(request),
    planPost: async (request) => (await active()).planPost(request),
    testConnection: () => openai.testConnection(),
  };
}

export * from './AIProvider';
export { extractHashtags, findHashtags, normalizeHashtag } from './hashtags';
