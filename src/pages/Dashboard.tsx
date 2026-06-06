import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, Euro, Pencil, TrendingUp, Trophy } from 'lucide-react';
import { useOffersData } from '../hooks/useOffersData';
import { useNotifications } from '../contexts/NotificationsContext';
import { notificationsService, revenueTargetsService } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
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
  const { notify, prefs } = useNotifications();
  const { user } = useAuth();
  const [year, setYear] = useState<number | 'all'>('all');
  const [target, setTarget] = useState<number | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  // Fire deadline notifications once when offers load
  useEffect(() => {
    if (loading || !offers.length || !prefs || !user) return;
    const daysAhead = prefs.deadline_days_before ?? 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);
    const today = new Date().toISOString().slice(0, 10);

    void (async () => {
      for (const offer of offers) {
        if (!offer.deadline) continue;
        if (offer.outcome === 'approvato' || offer.outcome === 'rifiutato') continue;
        if (offer.deadline < today || offer.deadline > cutoff.toISOString().slice(0, 10)) continue;
        const alreadySent = await notificationsService.has(user.id, 'offer_deadline', offer.id);
        if (alreadySent) continue;
        await notify({
          type: 'offer_deadline',
          title: `Scadenza imminente: ${offer.name}`,
          body: `Scadenza il ${offer.deadline}`,
          entity_id: offer.id,
          entity_type: 'offer',
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const filteredOffers = useMemo(() => filterByYear(offers, year), [offers, year]);
  const kpis = useMemo(() => computeKPIs(filteredOffers), [filteredOffers]);

  const targetYear = year !== 'all' ? year : new Date().getFullYear();
  // Banner and target always use the specific reference year (never "all")
  const yearOffers = useMemo(() => filterByYear(offers, targetYear), [offers, targetYear]);
  const kpisYear = useMemo(() => computeKPIs(yearOffers), [yearOffers]);

  useEffect(() => {
    void revenueTargetsService.get(targetYear).then((t) => {
      setTarget(t);
      setTargetInput(t !== null ? String(t) : '');
    });
  }, [targetYear]);

  async function saveTarget() {
    const val = Number(targetInput.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(val) || val < 0) return;
    await revenueTargetsService.set(targetYear, val);
    setTarget(val);
    setEditingTarget(false);
  }

  function startEditTarget() {
    setTargetInput(target !== null ? String(target) : '');
    setEditingTarget(true);
  }

  function compactEUR(value: number): string {
    if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
    return formatEUR(value);
  }

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

      {/* Risultati banner */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-4 flex-1 min-w-[160px]">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 opacity-80">Approvate · {targetYear}</p>
            <p className="text-4xl font-black tabular-nums text-emerald-700 leading-tight">
              {loading ? '…' : kpisYear.approvati}
            </p>
            <p className="text-xs text-emerald-600 opacity-70">progetti vinti</p>
          </div>
        </div>
        <div className="hidden sm:block w-px h-12 bg-emerald-200 shrink-0" />
        <div className="flex items-center gap-4 flex-1 min-w-[160px]">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 opacity-80">Ricavo · {targetYear}</p>
            <p className="text-4xl font-black tabular-nums text-teal-700 leading-tight">
              {loading ? '…' : compactEUR(kpisYear.ricavoApprovato)}
            </p>
            <p className="text-xs text-teal-600 opacity-70">da offerte approvate</p>
          </div>
        </div>
      </div>

      {/* Target fatturato */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Target fatturato · {targetYear}</p>
          </div>
          {!editingTarget && (
            <button
              onClick={startEditTarget}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              {target !== null ? 'Modifica' : 'Imposta target'}
            </button>
          )}
        </div>

        {editingTarget ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">€</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveTarget(); if (e.key === 'Escape') setEditingTarget(false); }}
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
            <button onClick={() => void saveTarget()} className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
              Salva
            </button>
            <button onClick={() => setEditingTarget(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
              Annulla
            </button>
          </div>
        ) : target !== null ? (
          <>
            <div className="flex items-end justify-between mb-1.5">
              <span className="text-2xl font-bold tabular-nums text-slate-900">
                {Math.round(Math.min((kpisYear.ricavoApprovato / target) * 100, 100))}%
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                {compactEUR(kpisYear.ricavoApprovato)} / {compactEUR(target)}
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  kpisYear.ricavoApprovato >= target ? 'bg-emerald-500' :
                  kpisYear.ricavoApprovato / target >= 0.6 ? 'bg-teal-500' :
                  kpisYear.ricavoApprovato / target >= 0.3 ? 'bg-amber-400' : 'bg-slate-300'
                }`}
                style={{ width: `${Math.min((kpisYear.ricavoApprovato / target) * 100, 100)}%` }}
              />
            </div>
            {kpisYear.ricavoApprovato >= target && (
              <p className="mt-1.5 text-xs font-semibold text-emerald-600">🎯 Target raggiunto!</p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400 italic">Nessun target impostato per {targetYear}.</p>
        )}
      </div>

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
          <MonthlyChart offers={offers} />
        </div>
        <StatusDistribution offers={filteredOffers} />
      </div>
    </div>
  );
}
