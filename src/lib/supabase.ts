import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './constants';

const PROVIDER_TOKEN_KEY = 'memrys_google_provider_token';

// Restore provider_token from localStorage if available
const storedToken = localStorage.getItem(PROVIDER_TOKEN_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Persist provider_token whenever the session changes
supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.provider_token) {
    localStorage.setItem(PROVIDER_TOKEN_KEY, session.provider_token);
  } else {
    localStorage.removeItem(PROVIDER_TOKEN_KEY);
  }
});

export { supabase, PROVIDER_TOKEN_KEY };
