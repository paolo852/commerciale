import { useMemo } from 'react';
import { useOffersData } from '../hooks/useOffersData';
import { computeAvgDecisionTime } from '../lib/analytics';
import KpiCard from '../components/dashboard/KpiCard';
import MonthlyTrend from '../components/analytics/MonthlyTrend';
import TypeComparison from '../components/analytics/TypeComparison';
import SuccessByFundingCall from '../components/analytics/SuccessByFundingCall';
import SuccessByProjectManager from '../components/analytics/SuccessByProjectManager';

export default function Analytics() {
  const { offers, projectManagers, loading, error } = useOffersData();

  const avgDecision = useMemo(() => computeAvgDecisionTime(offers), [offers]);

  const decided = useMemo(
    () => offers.filter((o) => o.outcome !== 'nessuno').length,
    [offers],
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Analytics</h1>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* KPI riassuntivi */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Offerte totali"
          value={loading ? '…' : offers.length}
          accent="indigo"
        />
        <KpiCard
          label="Offerte con esito"
          value={loading ? '…' : decided}
          hint="Approvate o rifiutate"
          accent="sky"
        />
        <KpiCard
          label="Tempo medio di decisione"
          value={
            loading
              ? '…'
              : avgDecision === null
                ? '—'
                : `${Math.round(avgDecision)} gg`
          }
          hint="Da presentazione a esito"
          accent="emerald"
        />
      </div>

      {/* Trend temporale */}
      <div className="mb-6">
        <MonthlyTrend offers={offers} />
      </div>

      {/* Confronto tipologie */}
      <div className="mb-6">
        <TypeComparison offers={offers} />
      </div>

      {/* Tassi di successo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SuccessByFundingCall offers={offers} />
        <SuccessByProjectManager offers={offers} projectManagers={projectManagers} />
      </div>
    </div>
  );
}
