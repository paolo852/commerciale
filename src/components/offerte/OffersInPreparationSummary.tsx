import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { FundingCall, Offer } from '../../types';

interface Props {
  offers: Offer[];         // offerte già filtrate per anno
  fundingCalls: FundingCall[];
  onSelectCall: (fundingCode: string | null) => void;  // null = "senza bando"
}

interface Bucket {
  key: string;               // funding code, oppure `__consulting__` per consulenze senza bando
  code: string;              // testo mostrato come "codice"
  name: string;              // nome esteso (bando o cliente)
  body?: string | null;      // ente/tipologia bando (secondaria)
  count: number;
  totalBudget: number;
}

export default function OffersInPreparationSummary({ offers, fundingCalls, onSelectCall }: Props) {
  const [open, setOpen] = useState(true);

  const inPreparation = useMemo(
    () => offers.filter((o) => o.status === 'in_lavorazione' && o.outcome === 'nessuno'),
    [offers],
  );

  const fcByCode = useMemo(() => new Map(fundingCalls.map((fc) => [fc.code, fc])), [fundingCalls]);

  const buckets = useMemo(() => {
    const map = new Map<string, Bucket>();
    for (const o of inPreparation) {
      let key: string;
      let code: string;
      let name: string;
      let body: string | null = null;

      if (o.type === 'financed' && o.funding_call) {
        key = o.funding_call;
        const fc = fcByCode.get(o.funding_call);
        code = fc?.code ?? o.funding_call;
        name = fc?.name ?? o.funding_call;
        body = fc?.body ?? null;
      } else if (o.type === 'consulting') {
        key = `__consulting__:${o.client ?? '—'}`;
        code = 'Consulenza';
        name = o.client ?? '—';
        body = null;
      } else {
        key = '__nocall__';
        code = 'Senza bando';
        name = '—';
      }

      const b = map.get(key) ?? { key, code, name, body, count: 0, totalBudget: 0 };
      b.count += 1;
      b.totalBudget += o.budget;
      map.set(key, b);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'it'));
  }, [inPreparation, fcByCode]);

  if (inPreparation.length === 0) return null;

  const totalBudget = buckets.reduce((s, b) => s + b.totalBudget, 0);
  const compactEUR = (v: number) =>
    v >= 1_000_000 ? `€${(v / 1_000_000).toFixed(1).replace('.', ',')}M`
    : v >= 1_000     ? `€${Math.round(v / 1_000)}K`
    : `€${Math.round(v)}`;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition text-left"
      >
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
        <Pencil className="w-4 h-4 text-indigo-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">
            Offerte in preparazione per bando
          </p>
          <p className="text-xs text-slate-500">
            {inPreparation.length} offert{inPreparation.length === 1 ? 'a' : 'e'} su {buckets.length} {buckets.length === 1 ? 'bando/cliente' : 'bandi/clienti'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Budget totale</p>
          <p className="text-sm font-bold tabular-nums text-slate-700">{compactEUR(totalBudget)}</p>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <ul className="divide-y divide-slate-100">
            {buckets.map((b) => {
              const isCallBucket = !b.key.startsWith('__consulting__') && b.key !== '__nocall__';
              return (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => onSelectCall(isCallBucket ? b.code : null)}
                    disabled={!isCallBucket}
                    className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-indigo-50/40 disabled:hover:bg-transparent transition text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-mono font-extrabold shrink-0 ${
                          isCallBucket ? 'text-indigo-600' : 'text-slate-400'
                        }`}>
                          {b.code}
                        </span>
                        <span className="text-sm text-slate-700 truncate">{b.name}</span>
                      </div>
                      {b.body && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{b.body}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs text-slate-400 tabular-nums">
                        {compactEUR(b.totalBudget)}
                      </span>
                    </div>

                    <div className="w-12 text-center shrink-0">
                      <span className="inline-flex items-center justify-center min-w-8 h-6 px-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold tabular-nums group-hover:bg-indigo-100 transition">
                        {b.count}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
