import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Environment variable validation
const isConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  supabaseUrl !== 'https://your-project.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

if (!isConfigured && import.meta.env.DEV) {
  console.warn(
    '[Supabase] Missing or incomplete credentials in .env.local.\n' +
    'Please verify VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.'
  );
}

/**
 * Reusable Supabase client instance configured with persistent sessions.
 * Never exposes service-role keys; uses public anon/publishable credentials only.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Helper to check whether the Supabase client has valid credentials configured.
 */
export function isSupabaseConfigured(): boolean {
  return isConfigured;
}
