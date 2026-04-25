import { useMemo } from 'react';
import { useOffersData } from '../hooks/useOffersData';
import { computeKPIs } from '../lib/analytics';
import { formatEUR } from '../lib/format';
import KpiCard from '../components/dashboard/KpiCard';
import UpcomingDeadlines from '../components/dashboard/UpcomingDeadlines';
import MonthlyChart from '../components/dashboard/MonthlyChart';
import StatusDistribution from '../components/dashboard/StatusDistribution';

export default function Dashboard() {
  const { offers, projectManagers, loading, error } = useOffersData();

  const kpis = useMemo(() => computeKPIs(offers), [offers]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Dashboard</h1>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Totale in offerta"
          value={loading ? '…' : formatEUR(kpis.totalInOfferta)}
          hint="Presentate non rifiutate"
          accent="indigo"
        />
        <KpiCard
          label="In lavorazione"
          value={loading ? '…' : kpis.inLavorazione}
          hint="Offerte aperte"
          accent="sky"
        />
        <KpiCard
          label="In attesa di esito"
          value={loading ? '…' : kpis.inAttesaEsito}
          hint="Presentate, esito da definire"
          accent="amber"
        />
        <KpiCard
          label="Tasso di successo"
          value={
            loading
              ? '…'
              : kpis.tassoSuccesso === null
                ? '—'
                : `${Math.round(kpis.tassoSuccesso * 100)}%`
          }
          hint={kpis.tassoSuccesso === null ? 'Nessun esito ancora registrato' : 'Approvate / decise'}
          accent="emerald"
        />
      </div>

      {/* Scadenze prossime */}
      <div className="mb-6">
        <UpcomingDeadlines offers={offers} projectManagers={projectManagers} />
      </div>

      {/* Grafici */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MonthlyChart offers={offers} />
        </div>
        <StatusDistribution offers={offers} />
      </div>
    </div>
  );
}
