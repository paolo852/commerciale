import { useCallback, useEffect, useState } from 'react';
import { leadsService } from '../lib/dataService';
import type { Lead } from '../types';

export interface LeadsData {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useLeadsData(): LeadsData {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLeads(await leadsService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { leads, loading, error, reload };
}
