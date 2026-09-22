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
  code: string;          // codice bando o "Consulenza"
  name: string;          // nome bando o cliente
  body?: string | null;  // ente/tipologia (sottotitolo)
  count: number;
  totalBudget: number;
  financedCount: number;    // quante sono offerte finanziate
  consultingCount: number;  // quante sono consulenze legate al bando
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
  const fcById = useMemo(() => new Map(fundingCalls.map((fc) => [fc.id, fc])), [fundingCalls]);

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
        // Consulenza legata a un bando → confluisce nel bucket del bando
        const fc = fcById.get(o.consulting_call_id);
        if (fc) {
          key = fc.code;
          kind = 'financed';
          code = fc.code;
          name = fc.name;
          body = fc.body ?? null;
          isConsulting = true;
        } else {
          // ID orfano — fallback a consulenza per cliente
          key = `__consulting__:${o.client ?? '—'}`;
          kind = 'consulting';
          code = o.client ?? '—';
          name = 'Consulenza';
          isConsulting = true;
        }
      } else if (o.type === 'consulting') {
        // Consulenza libera senza bando di riferimento
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
  const maxCount = Math.max(...buckets.map((b) => b.count));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header cliccabile */}
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
          <p className="text-xs text-slate-500 mt-0.5">
            <strong className="text-slate-700 tabular-nums">{inPreparation.length}</strong>
            {' '}offert{inPreparation.length === 1 ? 'a' : 'e'} distribuit{inPreparation.length === 1 ? 'a' : 'e'} su{' '}
            <strong className="text-slate-700 tabular-nums">{buckets.length}</strong>
            {' '}{buckets.length === 1 ? 'bando/cliente' : 'bandi/clienti'}
            {' · '}
            <span className="text-slate-700 font-semibold tabular-nums">{compactEUR(totalBudget)}</span> tot.
          </p>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {/* Column labels */}
          <div className="grid grid-cols-[minmax(0,1fr)_100px_60px] gap-3 items-center px-5 py-2 bg-slate-50/70 border-b border-slate-100">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bando / cliente</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">Budget</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">Offerte</span>
          </div>

          {/* Rows */}
          <ul>
            {buckets.map((b, i) => {
              const isClickable = b.kind === 'financed';
              const pct = maxCount > 0 ? (b.count / maxCount) * 100 : 0;
              const Icon = b.kind === 'financed' ? FileText : b.kind === 'consulting' ? Briefcase : Sparkles;
              const iconColor = b.kind === 'financed'
                ? 'text-indigo-500 bg-indigo-50'
                : b.kind === 'consulting'
                ? 'text-cyan-600 bg-cyan-50'
                : 'text-slate-400 bg-slate-100';

              return (
                <li key={b.key} className={i > 0 ? 'border-t border-slate-100' : ''}>
                  <button
                    type="button"
                    onClick={() => onSelectCall(isClickable ? b.code : null)}
                    disabled={!isClickable}
                    title={isClickable ? 'Filtra la lista per questo bando' : undefined}
                    className={`relative w-full grid grid-cols-[minmax(0,1fr)_100px_60px] gap-3 items-center px-5 py-3 text-left overflow-hidden group ${
                      isClickable ? 'hover:bg-indigo-50/30' : ''
                    } disabled:cursor-default transition`}
                  >
                    {/* Barra di volume relativo (background) */}
                    <span
                      aria-hidden="true"
                      className={`absolute left-0 top-0 bottom-0 pointer-events-none transition-all ${
                        b.kind === 'financed'
                          ? 'bg-indigo-50/60'
                          : b.kind === 'consulting'
                          ? 'bg-cyan-50/60'
                          : 'bg-slate-100/60'
                      }`}
                      style={{ width: `${pct}%` }}
                    />

                    {/* Colonna 1: icona + nome */}
                    <div className="relative flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`text-sm font-mono font-bold truncate ${
                            b.kind === 'financed' ? 'text-indigo-700' :
                            b.kind === 'consulting' ? 'text-cyan-700' : 'text-slate-500'
                          }`}>
                            {b.code}
                          </p>
                          {b.financedCount > 0 && b.consultingCount > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-700 tabular-nums" title={`${b.financedCount} finanziate + ${b.consultingCount} consulenze`}>
                              {b.financedCount}f · {b.consultingCount}c
                            </span>
                          )}
                          {b.financedCount === 0 && b.consultingCount > 0 && b.kind === 'financed' && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-cyan-100 text-cyan-700">
                              consulenza
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          {b.name}
                          {b.body && <span className="text-slate-400"> · {b.body}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Colonna 2: budget */}
                    <div className="relative text-right">
                      <span className="text-sm font-semibold tabular-nums text-slate-700">
                        {compactEUR(b.totalBudget)}
                      </span>
                    </div>

                    {/* Colonna 3: count in pill grande */}
                    <div className="relative flex justify-end">
                      <span className={`inline-flex items-center justify-center min-w-9 h-8 px-2.5 rounded-lg text-sm font-extrabold tabular-nums transition ${
                        b.kind === 'financed'
                          ? 'bg-indigo-600 text-white group-hover:bg-indigo-700 group-disabled:bg-indigo-600'
                          : b.kind === 'consulting'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-slate-500 text-white'
                      }`}>
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
