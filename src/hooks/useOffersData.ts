import { useCallback, useEffect, useState } from 'react';
import {
  offersService,
  projectManagersService,
  fundingCallsService,
} from '../lib/dataService';
import type { Offer, ProjectManager, FundingCall } from '../types';

export interface OffersData {
  offers: Offer[];
  projectManagers: ProjectManager[];
  fundingCalls: FundingCall[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useOffersData(): OffersData {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [projectManagers, setProjectManagers] = useState<ProjectManager[]>([]);
  const [fundingCalls, setFundingCalls] = useState<FundingCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, pm, fc] = await Promise.all([
        offersService.list(),
        projectManagersService.list(),
        fundingCallsService.list(),
      ]);
      setOffers(o);
      setProjectManagers(pm);
      setFundingCalls(fc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { offers, projectManagers, fundingCalls, loading, error, reload };
}
