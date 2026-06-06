import { isDemoMode, supabase } from './supabase';

const TABLES = [
  'offers',
  'funding_calls',
  'concepts',
  'lead_candidates',
  'project_managers',
  'revenue_targets',
] as const;

export async function exportAllData(): Promise<void> {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const filename = `backup-offerte-${timestamp}.json`;

  let snapshot: Record<string, unknown[]>;

  if (isDemoMode) {
    // In demo mode pull from localStorage keys directly
    snapshot = Object.fromEntries(
      TABLES.map((t) => {
        try {
          const raw = localStorage.getItem(`demo_${t}`);
          return [t, raw ? (JSON.parse(raw) as unknown[]) : []];
        } catch {
          return [t, []];
        }
      }),
    );
  } else {
    if (!supabase) throw new Error('Supabase non inizializzato');
    const sb = supabase;
    const results = await Promise.all(
      TABLES.map(async (table) => {
        const { data, error } = await sb.from(table).select('*');
        if (error) throw new Error(`Errore export ${table}: ${error.message}`);
        return [table, data ?? []] as [string, unknown[]];
      }),
    );
    snapshot = Object.fromEntries(results);
  }

  const blob = new Blob(
    [JSON.stringify({ exported_at: new Date().toISOString(), tables: snapshot }, null, 2)],
    { type: 'application/json' },
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
