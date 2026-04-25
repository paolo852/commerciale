import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * isDemoMode = true quando le env Supabase non sono configurate.
 * In demo mode l'app usa localStorage come storage dei dati,
 * così è possibile testare senza un'istanza Supabase reale.
 */
export const isDemoMode = !supabaseUrl || !supabaseAnonKey;

export const supabase: SupabaseClient | null = isDemoMode
  ? null
  : createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
