import type { AIProvider } from '@/types/app';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const DEFAULT_MODEL_ID = 'google/gemma-2-27b-it';
export const DEFAULT_MODEL_NAME = 'Gemma 2 27B';

export const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/parse-brain-dump`;

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  openrouter: 'OpenRouter',
};

export const PROVIDER_PRESETS: { provider: AIProvider; models: { id: string; name: string }[] }[] = [
  {
    provider: 'openai',
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'openai/o1', name: 'o1' },
      { id: 'openai/o3-mini', name: 'o3 Mini' },
    ],
  },
  {
    provider: 'anthropic',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
      { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
    ],
  },
  {
    provider: 'google',
    models: [
      { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B' },
      { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B' },
    ],
  },
];

export const IANA_TIMEZONES = Intl.supportedValuesOf('timeZone');

export const HALLUCINATION_WINDOW_DAYS = 365;
