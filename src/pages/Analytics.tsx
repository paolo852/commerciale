import { useMemo, useState } from 'react';
import { BarChart3, CalendarClock, FileCheck } from 'lucide-react';
import { useOffersData } from '../hooks/useOffersData';
import { computeAvgDecisionTime, filterByYear } from '../lib/analytics';
import KpiCard from '../components/dashboard/KpiCard';
import MonthlyTrend from '../components/analytics/MonthlyTrend';
import TypeComparison from '../components/analytics/TypeComparison';
import SuccessByFundingCall from '../components/analytics/SuccessByFundingCall';
import SuccessByProjectManager from '../components/analytics/SuccessByProjectManager';
import YearSelector from '../components/YearSelector';

export default function Analytics() {
  const { offers, projectManagers, fundingCalls, loading, error } = useOffersData();
  const [year, setYear] = useState<number | 'all'>('all');

  const filteredOffers = useMemo(() => filterByYear(offers, year), [offers, year]);

  const avgDecision = useMemo(() => computeAvgDecisionTime(filteredOffers), [filteredOffers]);
  const decided = useMemo(
    () => filteredOffers.filter((o) => o.outcome !== 'nessuno').length,
    [filteredOffers],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Performance e trend delle offerte
            {year !== 'all' && <> · anno <strong className="text-slate-700">{year}</strong></>}
          </p>
        </div>
        <YearSelector offers={offers} value={year} onChange={setYear} />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Offerte totali" value={loading ? '…' : filteredOffers.length} icon={BarChart3} accent="indigo" />
        <KpiCard label="Offerte con esito" value={loading ? '…' : decided} hint="Approvate o rifiutate" icon={FileCheck} accent="sky" />
        <KpiCard
          label="Tempo medio di decisione"
          value={loading ? '…' : avgDecision === null ? '—' : `${Math.round(avgDecision)} gg`}
          hint="Da presentazione a esito"
          icon={CalendarClock}
          accent="emerald"
        />
      </div>

      <MonthlyTrend offers={filteredOffers} year={year === 'all' ? undefined : year} />
      <TypeComparison offers={filteredOffers} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SuccessByFundingCall offers={filteredOffers} fundingCalls={fundingCalls} />
        <SuccessByProjectManager offers={filteredOffers} projectManagers={projectManagers} />
      </div>
    </div>
  );
}
