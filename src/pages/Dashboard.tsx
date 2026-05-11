import { useMemo, useState } from 'react';
import { CheckCircle, Clock, Euro, TrendingUp } from 'lucide-react';
import { useOffersData } from '../hooks/useOffersData';
import { computeKPIs, filterByYear } from '../lib/analytics';
import { formatEUR } from '../lib/format';
import KpiCard from '../components/dashboard/KpiCard';
import UpcomingDeadlines from '../components/dashboard/UpcomingDeadlines';
import MonthlyChart from '../components/dashboard/MonthlyChart';
import StatusDistribution from '../components/dashboard/StatusDistribution';
import ProbabilisticRevenue from '../components/dashboard/ProbabilisticRevenue';
import YearSelector from '../components/YearSelector';

export default function Dashboard() {
  const { offers, projectManagers, fundingCalls, loading, error } = useOffersData();
  const [year, setYear] = useState<number | 'all'>('all');

  const filteredOffers = useMemo(() => filterByYear(offers, year), [offers, year]);
  const kpis = useMemo(() => computeKPIs(filteredOffers), [filteredOffers]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Panoramica delle offerte commerciali
            {year !== 'all' && <> · anno <strong className="text-slate-700">{year}</strong></>}
          </p>
        </div>
        <YearSelector offers={offers} value={year} onChange={setYear} />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Totale in offerta"
          value={loading ? '…' : formatEUR(kpis.totalInOfferta)}
          hint="Presentate non rifiutate"
          icon={Euro}
          accent="indigo"
        />
        <KpiCard
          label="In lavorazione"
          value={loading ? '…' : kpis.inLavorazione}
          hint="Offerte aperte"
          icon={Clock}
          accent="sky"
        />
        <KpiCard
          label="In attesa di esito"
          value={loading ? '…' : kpis.inAttesaEsito}
          hint="Presentate, esito da definire"
          icon={TrendingUp}
          accent="amber"
        />
        <KpiCard
          label="Tasso di successo"
          value={
            loading ? '…' : kpis.tassoSuccesso === null
              ? '—'
              : `${Math.round(kpis.tassoSuccesso * 100)}%`
          }
          hint={kpis.tassoSuccesso === null ? 'Nessun esito registrato' : 'Approvate / decise'}
          icon={CheckCircle}
          accent="emerald"
        />
      </div>

      <ProbabilisticRevenue offers={filteredOffers} />

      {/* Le scadenze prossime sono sempre "prossimi 30 giorni" indipendentemente dall'anno */}
      <UpcomingDeadlines offers={offers} projectManagers={projectManagers} fundingCalls={fundingCalls} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <MonthlyChart offers={filteredOffers} year={year === 'all' ? undefined : year} />
        </div>
        <StatusDistribution offers={filteredOffers} />
      </div>
    </div>
  );
}
