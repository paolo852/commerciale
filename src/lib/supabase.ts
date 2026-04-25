import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function isValidUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * isDemoMode = true quando le env Supabase non sono configurate o non valide.
 * In demo mode l'app usa localStorage come storage dei dati.
 */
export const isDemoMode = !isValidUrl(supabaseUrl) || !supabaseAnonKey?.trim();

function createSupabaseClient(): SupabaseClient | null {
  if (isDemoMode) return null;
  try {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (e) {
    console.warn('Supabase init failed, falling back to demo mode:', e);
    return null;
  }
}

export const supabase: SupabaseClient | null = createSupabaseClient();
