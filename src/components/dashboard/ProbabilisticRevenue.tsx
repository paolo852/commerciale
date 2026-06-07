import { useMemo } from 'react';
import type { Offer } from '../../types';
import { computeProbabilisticRevenue, type ProbabilisticRevenue as ProbRev } from '../../lib/analytics';
import { formatEUR } from '../../lib/format';

function ScenarioBar({
  p10, p50, p90, maxPossible,
}: { p10: number; p50: number; p90: number; maxPossible: number }) {
  if (maxPossible === 0) return null;
  const pct = (v: number) => Math.max(0, Math.min(100, (v / maxPossible) * 100));
  return (
    <div className="mt-4 mb-1">
      <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="absolute top-0 h-full bg-gradient-to-r from-amber-200 via-emerald-300 to-emerald-400"
          style={{ left: `${pct(p10)}%`, width: `${Math.max(0, pct(p90) - pct(p10))}%` }}
        />
        <div className="absolute top-0 h-full w-0.5 bg-emerald-700" style={{ left: `${pct(p50)}%` }} />
      </div>
      <div className="relative mt-1 h-4">
        {([
          { v: p10, label: 'P10', color: 'text-amber-600' },
          { v: p50, label: 'P50', color: 'text-emerald-700' },
          { v: p90, label: 'P90', color: 'text-emerald-600' },
        ] as const).map(({ v, label, color }) => (
          <span
            key={label}
            className={`absolute text-[10px] font-semibold ${color} -translate-x-1/2`}
            style={{ left: `${pct(v)}%` }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-3">
        <span>0</span>
        <span>max · {formatEUR(maxPossible)}</span>
      </div>
    </div>
  );
}

function RevenueSection({
  title,
  subtitle,
  accent,
  rev,
}: {
  title: string;
  subtitle: string;
  accent: 'emerald' | 'indigo';
  rev: ProbRev;
}) {
  const accentExpected = accent === 'emerald' ? 'text-emerald-700' : 'text-indigo-700';
  const scenarios = [
    { label: 'Pessimistico', sublabel: 'P10', value: rev.p10, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Mediano',      sublabel: 'P50', value: rev.p50, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { label: 'Ottimistico',  sublabel: 'P90', value: rev.p90, color: 'text-emerald-800', bg: 'bg-emerald-50', border: 'border-emerald-300' },
  ] as const;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
        <div>
          <p className="text-sm font-semibold text-slate-800">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Valore atteso E[X]</p>
          <p className={`text-lg font-bold tabular-nums ${accentExpected}`}>{formatEUR(rev.expected)}</p>
        </div>
      </div>

      {rev.pipelineCount === 0 ? (
        <p className="py-4 text-sm text-slate-400 text-center">Nessuna offerta attiva.</p>
      ) : (
        <>
          <ScenarioBar p10={rev.p10} p50={rev.p50} p90={rev.p90} maxPossible={rev.maxPossible} />
          <div className="grid grid-cols-3 gap-3 mt-5">
            {scenarios.map((s) => (
              <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                <p className={`mt-1.5 text-lg font-bold tabular-nums ${s.color}`}>{formatEUR(s.value)}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{s.sublabel}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProbabilisticRevenue({ offers }: { offers: Offer[] }) {
  // Solo offerte presentate (outcome=nessuno, status=presentata) + confermate
  const presentateOnly = useMemo(
    () => offers.filter((o) => o.outcome === 'approvato' || o.status === 'presentata'),
    [offers],
  );
  // Pipeline completa: presentate + in lavorazione + confermate
  const revPresentate = useMemo(() => computeProbabilisticRevenue(presentateOnly), [presentateOnly]);
  const revCompleta   = useMemo(() => computeProbabilisticRevenue(offers), [offers]);

  const inLavorazioneCount = useMemo(
    () => offers.filter((o) => o.status === 'in_lavorazione' && o.outcome === 'nessuno').length,
    [offers],
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Previsione fatturato</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {revCompleta.method === 'exact' ? 'Calcolo esatto' : 'Simulazione Monte Carlo (50k campioni)'}
          {revCompleta.confermato > 0 && <> · <span className="text-emerald-600 font-medium">{formatEUR(revCompleta.confermato)} già confermato</span></>}
        </p>
      </div>

      <div className="px-5 py-5 space-y-6">
        <RevenueSection
          title="Offerte presentate"
          subtitle={`Basata sulle ${revPresentate.pipelineCount} offerte già presentate e in attesa di esito`}
          accent="emerald"
          rev={revPresentate}
        />

        <div className="border-t border-slate-100 pt-6">
          <RevenueSection
            title="Pipeline completa"
            subtitle={`Include anche le ${inLavorazioneCount} offerte ancora in lavorazione`}
            accent="indigo"
            rev={revCompleta}
          />
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          Ogni offerta è modellata come variabile di Bernoulli: contribuisce il budget se vinta, 0 se persa.
          I percentili indicano l'intervallo di confidenza del fatturato aggiuntivo.
        </p>
      </div>
    </div>
  );
}
