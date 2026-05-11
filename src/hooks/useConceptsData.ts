import { useCallback, useEffect, useState } from 'react';
import { conceptsService } from '../lib/dataService';
import type { Concept } from '../types';

export interface ConceptsData {
  concepts: Concept[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useConceptsData(): ConceptsData {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConcepts(await conceptsService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return { concepts, loading, error, reload };
}
