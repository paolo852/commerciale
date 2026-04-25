import { useMemo } from 'react';
import { BarChart3, CalendarClock, FileCheck } from 'lucide-react';
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
  const decided = useMemo(() => offers.filter((o) => o.outcome !== 'nessuno').length, [offers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Performance e trend delle offerte</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Offerte totali" value={loading ? '…' : offers.length} icon={BarChart3} accent="indigo" />
        <KpiCard label="Offerte con esito" value={loading ? '…' : decided} hint="Approvate o rifiutate" icon={FileCheck} accent="sky" />
        <KpiCard
          label="Tempo medio di decisione"
          value={loading ? '…' : avgDecision === null ? '—' : `${Math.round(avgDecision)} gg`}
          hint="Da presentazione a esito"
          icon={CalendarClock}
          accent="emerald"
        />
      </div>

      <MonthlyTrend offers={offers} />
      <TypeComparison offers={offers} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SuccessByFundingCall offers={offers} />
        <SuccessByProjectManager offers={offers} projectManagers={projectManagers} />
      </div>
    </div>
  );
}
