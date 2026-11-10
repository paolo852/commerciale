import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Euro, Plus, Trash2 } from 'lucide-react';
import { offerBudgetItemsService } from '../../lib/dataService';
import { formatEUR } from '../../lib/format';
import type { OfferBudgetItem } from '../../types';

interface Props {
  offerId: string;
  offerBudget: number;   // budget totale dell'offerta (per confronto)
}

export default function OfferBudgetTracker({ offerId, offerBudget }: Props) {
  const [items, setItems] = useState<OfferBudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setItems(await offerBudgetItemsService.list(offerId)); }
    finally { setLoading(false); }
  }, [offerId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleAdd() {
    const maxPos = items.reduce((m, i) => Math.max(m, i.position), -1);
    const created = await offerBudgetItemsService.create({
      offer_id: offerId,
      label: 'Nuova voce',
      planned_eur: 0,
      actual_eur: 0,
      notes: null,
      position: maxPos + 1,
    });
    setItems((prev) => [...prev, created]);
  }

  async function handleUpdate(id: string, patch: Partial<OfferBudgetItem>) {
    setBusyId(id);
    try {
      const updated = await offerBudgetItemsService.update(id, patch);
      setItems((prev) => prev.map((it) => (it.id === id ? updated : it)));
    } finally { setBusyId(null); }
  }

  async function handleRemove(id: string) {
    if (!confirm('Eliminare questa voce di budget?')) return;
    setBusyId(id);
    try {
      await offerBudgetItemsService.remove(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } finally { setBusyId(null); }
  }

  const totals = useMemo(() => {
    const planned = items.reduce((s, i) => s + Number(i.planned_eur || 0), 0);
    const actual  = items.reduce((s, i) => s + Number(i.actual_eur || 0), 0);
    return { planned, actual, diff: actual - planned };
  }, [items]);

  const unallocated = offerBudget - totals.planned;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
          <Euro className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Budget tracker</p>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            <strong className="text-slate-700">{formatEUR(totals.planned)}</strong> pianificati
            {' · '}
            <strong className="text-slate-700">{formatEUR(totals.actual)}</strong> effettivi
            {offerBudget > 0 && (
              <>
                {' · '}
                <span className={unallocated < 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                  {unallocated >= 0 ? `${formatEUR(unallocated)} non allocati` : `${formatEUR(-unallocated)} oltre budget`}
                </span>
              </>
            )}
          </p>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <p className="text-xs text-slate-400 italic text-center py-6">Caricamento…</p>
          ) : items.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-slate-400 italic mb-3">Nessuna voce di budget. Aggiungi la prima.</p>
              <button type="button" onClick={() => void handleAdd()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                <Plus className="w-3.5 h-3.5" /> Aggiungi voce
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-2 text-left">Voce</th>
                      <th className="px-3 py-2 text-right w-32">Previsto</th>
                      <th className="px-3 py-2 text-right w-32">Effettivo</th>
                      <th className="px-3 py-2 text-right w-24">Scost.</th>
                      <th className="px-3 py-2 text-left">Note</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const diff = Number(it.actual_eur || 0) - Number(it.planned_eur || 0);
                      const diffCls = diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-slate-400';
                      return (
                        <tr key={it.id} className={`border-b border-slate-100 ${busyId === it.id ? 'opacity-50' : ''}`}>
                          <td className="px-5 py-2">
                            <input
                              type="text"
                              defaultValue={it.label}
                              onBlur={(e) => { if (e.target.value !== it.label) void handleUpdate(it.id, { label: e.target.value }); }}
                              className="w-full text-sm bg-transparent border-0 focus:bg-indigo-50/40 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" step="0.01" min="0"
                              defaultValue={it.planned_eur}
                              onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(it.planned_eur)) void handleUpdate(it.id, { planned_eur: v }); }}
                              className="w-full text-sm text-right tabular-nums bg-transparent border-0 focus:bg-indigo-50/40 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number" step="0.01" min="0"
                              defaultValue={it.actual_eur}
                              onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(it.actual_eur)) void handleUpdate(it.id, { actual_eur: v }); }}
                              className="w-full text-sm text-right tabular-nums bg-transparent border-0 focus:bg-indigo-50/40 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className={`px-3 py-2 text-right text-sm font-semibold tabular-nums ${diffCls}`}>
                            {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${formatEUR(diff)}`}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              defaultValue={it.notes ?? ''}
                              placeholder="…"
                              onBlur={(e) => { if ((e.target.value || null) !== it.notes) void handleUpdate(it.id, { notes: e.target.value || null }); }}
                              className="w-full text-xs text-slate-500 bg-transparent border-0 focus:bg-indigo-50/40 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 py-0.5"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button type="button" onClick={() => void handleRemove(it.id)}
                              className="text-slate-300 hover:text-red-500 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-sm">
                      <td className="px-5 py-2.5 text-slate-700">Totali</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{formatEUR(totals.planned)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{formatEUR(totals.actual)}</td>
                      <td className={`px-3 py-2.5 text-right tabular-nums ${totals.diff > 0 ? 'text-red-600' : totals.diff < 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {totals.diff === 0 ? '—' : `${totals.diff > 0 ? '+' : ''}${formatEUR(totals.diff)}`}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <button type="button" onClick={() => void handleAdd()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
                  <Plus className="w-3.5 h-3.5" /> Aggiungi voce
                </button>
                {offerBudget > 0 && (
                  <span className="text-xs text-slate-500">
                    Budget offerta: <strong className="text-slate-700 tabular-nums">{formatEUR(offerBudget)}</strong>
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
