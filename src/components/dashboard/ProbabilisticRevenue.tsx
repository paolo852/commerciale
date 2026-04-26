import { useMemo } from 'react';
import type { Offer } from '../../types';
import { computeProbabilisticRevenue } from '../../lib/analytics';
import { formatEUR } from '../../lib/format';

function ScenarioBar({
  p10, p50, p90, maxPossible,
}: { p10: number; p50: number; p90: number; maxPossible: number }) {
  if (maxPossible === 0) return null;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / maxPossible) * 100));
  const p10pct = pct(p10);
  const p50pct = pct(p50);
  const p90pct = pct(p90);

  return (
    <div className="mt-5 mb-1">
      <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
        {/* range P10 → P90 */}
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-amber-200 via-emerald-300 to-emerald-400"
          style={{ left: `${p10pct}%`, width: `${Math.max(0, p90pct - p10pct)}%` }}
        />
        {/* tick P50 */}
        <div
          className="absolute top-0 h-full w-0.5 bg-emerald-700"
          style={{ left: `${p50pct}%` }}
        />
      </div>
      <div className="relative mt-1 h-4">
        {([
          { pctVal: p10pct, label: 'P10', color: 'text-amber-600' },
          { pctVal: p50pct, label: 'P50', color: 'text-emerald-700' },
          { pctVal: p90pct, label: 'P90', color: 'text-emerald-600' },
        ] as const).map(({ pctVal, label, color }) => (
          <span
            key={label}
            className={`absolute text-[10px] font-semibold ${color} -translate-x-1/2`}
            style={{ left: `${pctVal}%` }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-3">
        <span>0</span>
        <span>max possibile · {formatEUR(maxPossible)}</span>
      </div>
    </div>
  );
}

export default function ProbabilisticRevenue({ offers }: { offers: Offer[] }) {
  const rev = useMemo(() => computeProbabilisticRevenue(offers), [offers]);

  const scenarios = [
    {
      label: 'Pessimistico',
      sublabel: 'P10 — il 10% delle simulazioni va sotto questo valore',
      value: rev.p10,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Atteso',
      sublabel: 'P50 — mediana della distribuzione',
      value: rev.p50,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      label: 'Ottimistico',
      sublabel: 'P90 — il 10% delle simulazioni va sopra questo valore',
      value: rev.p90,
      color: 'text-emerald-800',
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
    },
  ] as const;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Previsione fatturato</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {rev.pipelineCount} offerte attive
            {rev.confermato > 0 && <> · {formatEUR(rev.confermato)} già confermato</>}
            {' · '}
            <span className="text-slate-400">
              {rev.method === 'exact' ? 'calcolo esatto' : 'simulazione Monte Carlo'}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
            Valore atteso E[X]
          </p>
          <p className="text-lg font-bold tabular-nums text-indigo-700">
            {formatEUR(rev.expected)}
          </p>
        </div>
      </div>

      {rev.pipelineCount === 0 ? (
        <p className="px-5 py-10 text-sm text-slate-400 text-center">
          Nessuna offerta attiva con probabilità impostata.
        </p>
      ) : (
        <div className="px-5 py-5">
          <ScenarioBar p10={rev.p10} p50={rev.p50} p90={rev.p90} maxPossible={rev.maxPossible} />

          <div className="grid grid-cols-3 gap-3 mt-6">
            {scenarios.map((s) => (
              <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className={`mt-1.5 text-xl font-bold tabular-nums ${s.color}`}>
                  {formatEUR(s.value)}
                </p>
                <p className="mt-1 text-[11px] text-slate-400 leading-tight">{s.sublabel}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-slate-400 leading-relaxed">
            Distribuzione esatta del fatturato come convoluzione di {rev.pipelineCount} eventi
            indipendenti (ogni offerta vale "budget" se vinta, "0" se persa).
            I percentili sono calcolati direttamente sulla CDF —
            mai superiori al massimo teorico ({formatEUR(rev.maxPossible)}).
          </p>
        </div>
      )}
    </div>
  );
}
