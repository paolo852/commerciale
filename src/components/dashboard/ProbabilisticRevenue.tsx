import { useMemo } from 'react';
import type { Offer } from '../../types';
import { computeProbabilisticRevenue } from '../../lib/analytics';
import { formatEUR } from '../../lib/format';

function ScenarioBar({ p10, p50, p90 }: { p10: number; p50: number; p90: number }) {
  if (p90 === 0) return null;
  const toPercent = (v: number) => Math.round((v / p90) * 100);
  const p10pct = toPercent(p10);
  const p50pct = toPercent(p50);

  return (
    <div className="mt-5 mb-1">
      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
        {/* range P10 → P90 */}
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-amber-200 via-emerald-300 to-emerald-400 rounded-full"
          style={{ left: `${p10pct}%`, right: 0 }}
        />
      </div>
      {/* tick labels */}
      <div className="relative mt-1 h-4">
        {([
          { pct: p10pct, label: 'P10', color: 'text-amber-600' },
          { pct: p50pct, label: 'P50', color: 'text-emerald-600' },
          { pct: 100, label: 'P90', color: 'text-emerald-700' },
        ] as const).map(({ pct, label, color }) => (
          <span
            key={label}
            className={`absolute text-[10px] font-semibold ${color} -translate-x-1/2`}
            style={{ left: `${pct}%` }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ProbabilisticRevenue({ offers }: { offers: Offer[] }) {
  const rev = useMemo(() => computeProbabilisticRevenue(offers), [offers]);

  const scenarios = [
    {
      label: 'Pessimistico',
      sublabel: 'P10 — solo il 10% delle volte si va sotto',
      value: rev.p10,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      bar: 'bg-amber-400',
    },
    {
      label: 'Atteso',
      sublabel: 'P50 — valore mediano della distribuzione',
      value: rev.p50,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      bar: 'bg-emerald-500',
    },
    {
      label: 'Ottimistico',
      sublabel: 'P90 — solo il 10% delle volte si va sopra',
      value: rev.p90,
      color: 'text-emerald-800',
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
      bar: 'bg-emerald-600',
    },
  ] as const;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Previsione fatturato</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Basata su {rev.pipelineCount} offerte attive con probabilità stimata
            {rev.confermato > 0 && ` · ${formatEUR(rev.confermato)} già confermato`}
          </p>
        </div>
        {rev.confermato > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {formatEUR(rev.confermato)} confermato
          </span>
        )}
      </div>

      {rev.pipelineCount === 0 ? (
        <p className="px-5 py-10 text-sm text-slate-400 text-center">
          Nessuna offerta attiva con probabilità impostata.
        </p>
      ) : (
        <div className="px-5 py-5">
          {/* Barra visiva */}
          <ScenarioBar p10={rev.p10} p50={rev.p50} p90={rev.p90} />

          {/* Tre card scenario */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {scenarios.map((s) => (
              <div
                key={s.label}
                className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}
              >
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {s.label}
                </p>
                <p className={`mt-1.5 text-xl font-bold tabular-nums ${s.color}`}>
                  {formatEUR(s.value)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400 leading-tight">{s.sublabel}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-slate-400">
            Calcolo: μ = Σ(p·budget), σ² = Σ(p·(1−p)·budget²), P10/P90 = μ ∓ 1.28σ.
            Assume indipendenza tra le offerte.
          </p>
        </div>
      )}
    </div>
  );
}
