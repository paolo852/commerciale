import { useMemo, useState } from 'react';
import { Briefcase, ChevronDown, ChevronRight, FileText, Pencil, Sparkles } from 'lucide-react';
import type { FundingCall, Offer } from '../../types';

interface Props {
  offers: Offer[];         // offerte già filtrate per anno
  fundingCalls: FundingCall[];
  onSelectCall: (fundingCode: string | null) => void;  // null = "senza bando"
}

type Kind = 'financed' | 'consulting' | 'none';

interface Bucket {
  key: string;
  kind: Kind;
  code: string;          // codice bando / cliente / "Senza bando"
  name: string;          // nome esteso (bando o cliente)
  body?: string | null;  // ente / tipologia (sottotitolo)
  count: number;
  totalBudget: number;
  financedCount: number;
  consultingCount: number;
}

function compactEUR(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000)     return `€${Math.round(v / 1_000)}K`;
  return `€${Math.round(v)}`;
}

export default function OffersInPreparationSummary({ offers, fundingCalls, onSelectCall }: Props) {
  const [open, setOpen] = useState(true);

  const inPreparation = useMemo(
    () => offers.filter((o) => o.status === 'in_lavorazione' && o.outcome === 'nessuno'),
    [offers],
  );

  const fcByCode = useMemo(() => new Map(fundingCalls.map((fc) => [fc.code, fc])), [fundingCalls]);
  const fcById   = useMemo(() => new Map(fundingCalls.map((fc) => [fc.id, fc])), [fundingCalls]);

  const buckets = useMemo<Bucket[]>(() => {
    const map = new Map<string, Bucket>();
    for (const o of inPreparation) {
      let key: string, kind: Kind, code: string, name: string;
      let body: string | null = null;
      let isConsulting = false;

      if (o.type === 'financed' && o.funding_call) {
        key = o.funding_call;
        kind = 'financed';
        const fc = fcByCode.get(o.funding_call);
        code = fc?.code ?? o.funding_call;
        name = fc?.name ?? o.funding_call;
        body = fc?.body ?? null;
      } else if (o.type === 'consulting' && o.consulting_call_id) {
        const fc = fcById.get(o.consulting_call_id);
        if (fc) {
          key = fc.code;
          kind = 'financed';
          code = fc.code;
          name = fc.name;
          body = fc.body ?? null;
          isConsulting = true;
        } else {
          key = `__consulting__:${o.client ?? '—'}`;
          kind = 'consulting';
          code = o.client ?? '—';
          name = 'Consulenza';
          isConsulting = true;
        }
      } else if (o.type === 'consulting') {
        key = `__consulting__:${o.client ?? '—'}`;
        kind = 'consulting';
        code = o.client ?? '—';
        name = 'Consulenza';
        isConsulting = true;
      } else {
        key = '__nocall__';
        kind = 'none';
        code = 'Senza bando';
        name = 'Da assegnare';
        body = null;
      }

      const b = map.get(key) ?? {
        key, kind, code, name, body, count: 0, totalBudget: 0,
        financedCount: 0, consultingCount: 0,
      };
      b.count += 1;
      b.totalBudget += o.budget;
      if (isConsulting) b.consultingCount += 1;
      else b.financedCount += 1;
      map.set(key, b);
    }
    return [...map.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'it'),
    );
  }, [inPreparation, fcByCode, fcById]);

  if (inPreparation.length === 0) return null;

  const totalBudget = buckets.reduce((s, b) => s + b.totalBudget, 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* ── Header cliccabile ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
          <Pencil className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Offerte in preparazione</p>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            <strong className="text-slate-700">{inPreparation.length}</strong>
            {' '}offert{inPreparation.length === 1 ? 'a' : 'e'}
            {' · '}
            <strong className="text-slate-700">{buckets.length}</strong>
            {' '}{buckets.length === 1 ? 'bando/cliente' : 'bandi/clienti'}
            {' · '}
            <span className="font-semibold text-slate-700">{compactEUR(totalBudget)}</span>{' totale'}
          </p>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {/* ── Righe ── */}
      {open && (
        <ul className="border-t border-slate-100 divide-y divide-slate-100">
          {buckets.map((b) => {
            const isClickable = b.kind === 'financed';
            const Icon = b.kind === 'financed' ? FileText : b.kind === 'consulting' ? Briefcase : Sparkles;
            const accent =
              b.kind === 'financed' ? { pill: 'bg-indigo-600 text-white', ico: 'text-indigo-600 bg-indigo-50', codeText: 'text-indigo-600' }
              : b.kind === 'consulting' ? { pill: 'bg-cyan-600 text-white', ico: 'text-cyan-600 bg-cyan-50', codeText: 'text-cyan-700' }
              : { pill: 'bg-slate-500 text-white', ico: 'text-slate-400 bg-slate-100', codeText: 'text-slate-500' };

            // Evita ripetizioni: se code == name non riscrivere il nome, e non ripetere body se coincide.
            const showName = b.name.toLowerCase() !== b.code.toLowerCase();
            const showBody = b.body && b.body.toLowerCase() !== b.code.toLowerCase() && b.body.toLowerCase() !== b.name.toLowerCase();

            return (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => onSelectCall(isClickable ? b.code : null)}
                  disabled={!isClickable}
                  title={isClickable ? 'Filtra la lista offerte per questo bando' : undefined}
                  className={`w-full flex items-center gap-4 px-5 py-3 text-left transition ${
                    isClickable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  {/* Count pill (anchor visivo a sinistra) */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 tabular-nums text-base font-extrabold ${accent.pill}`}>
                    {b.count}
                  </div>

                  {/* Nome + codice + ente */}
                  <div className="flex-1 min-w-0">
                    {showName ? (
                      <>
                        <p className="text-sm font-semibold text-slate-900 truncate leading-tight">
                          {b.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 truncate">
                          <Icon className={`w-3 h-3 shrink-0 ${accent.codeText}`} />
                          <span className={`font-mono font-semibold ${accent.codeText}`}>{b.code}</span>
                          {showBody && <span className="text-slate-400 truncate">· {b.body}</span>}
                          {b.financedCount > 0 && b.consultingCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-cyan-50 text-cyan-700 border border-cyan-100 tabular-nums" title={`${b.financedCount} finanziate + ${b.consultingCount} consulenze`}>
                              {b.financedCount}f + {b.consultingCount}c
                            </span>
                          )}
                          {b.financedCount === 0 && b.consultingCount > 0 && b.kind === 'financed' && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-cyan-50 text-cyan-700 border border-cyan-100">
                              consulenza
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      // Nome uguale al codice: mostra il codice grande come titolo
                      <>
                        <div className="flex items-center gap-1.5">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${accent.codeText}`} />
                          <p className={`text-sm font-mono font-bold truncate ${accent.codeText}`}>{b.code}</p>
                          {b.financedCount > 0 && b.consultingCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-px rounded bg-cyan-50 text-cyan-700 border border-cyan-100 tabular-nums">
                              {b.financedCount}f + {b.consultingCount}c
                            </span>
                          )}
                        </div>
                        {showBody && <p className="text-xs text-slate-500 mt-0.5 truncate">{b.body}</p>}
                      </>
                    )}
                  </div>

                  {/* Budget */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-slate-800">{compactEUR(b.totalBudget)}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">budget</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
