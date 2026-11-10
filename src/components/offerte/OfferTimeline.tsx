import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, ChevronDown, ChevronRight, Circle, Plus, Trash2, X } from 'lucide-react';
import { offerMilestonesService } from '../../lib/dataService';
import type { OfferMilestone, OfferMilestoneStatus } from '../../types';

interface Props {
  offerId: string;
}

// Milestone proposti di default se la timeline è vuota (l'utente li aggiunge con un click)
const SUGGESTED = [
  { label: 'Primo contatto con il consorzio' },
  { label: 'Allineamento partner / kick-off interno' },
  { label: 'Bozza proposta inviata' },
  { label: 'Submission' },
  { label: 'Decisione attesa' },
  { label: 'Firma Grant Agreement' },
  { label: 'Project start' },
];

function daysFromNow(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function OfferTimeline({ offerId }: Props) {
  const [items, setItems] = useState<OfferMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try { setItems(await offerMilestonesService.list(offerId)); }
    finally { setLoading(false); }
  }, [offerId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleAdd(label: string) {
    const maxPos = items.reduce((m, i) => Math.max(m, i.position), -1);
    const created = await offerMilestonesService.create({
      offer_id: offerId,
      label,
      due_date: null,
      status: 'pending',
      notes: null,
      position: maxPos + 1,
    });
    setItems((prev) => [...prev, created]);
  }

  async function handleUpdate(id: string, patch: Partial<OfferMilestone>) {
    setBusyId(id);
    try {
      const updated = await offerMilestonesService.update(id, patch);
      setItems((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } finally { setBusyId(null); }
  }

  async function toggleStatus(m: OfferMilestone) {
    const next: OfferMilestoneStatus = m.status === 'done' ? 'pending' : 'done';
    await handleUpdate(m.id, { status: next });
  }

  async function handleRemove(id: string) {
    if (!confirm('Eliminare questa milestone?')) return;
    setBusyId(id);
    try {
      await offerMilestonesService.remove(id);
      setItems((prev) => prev.filter((m) => m.id !== id));
    } finally { setBusyId(null); }
  }

  function startEdit(m: OfferMilestone) {
    setEditingId(m.id);
    setDraftLabel(m.label);
  }

  async function confirmEdit(m: OfferMilestone) {
    if (draftLabel.trim() && draftLabel !== m.label) {
      await handleUpdate(m.id, { label: draftLabel.trim() });
    }
    setEditingId(null);
  }

  const doneCount = items.filter((m) => m.status === 'done').length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
          <CalendarClock className="w-4 h-4 text-sky-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Timeline progetto</p>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {items.length === 0
              ? 'Nessuna milestone — puoi aggiungerne una qualunque o usare un template.'
              : <>
                  <strong className="text-slate-700">{doneCount}</strong>/{items.length} completate
                </>
            }
          </p>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-5">
          {loading ? (
            <p className="text-xs text-slate-400 italic text-center py-4">Caricamento…</p>
          ) : items.length === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 italic text-center">
                Aggiungi una milestone personalizzata o scegli una delle proposte qui sotto.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {SUGGESTED.map((s) => (
                  <button key={s.label} type="button" onClick={() => void handleAdd(s.label)}
                    className="text-xs px-2.5 py-1 rounded-full border border-dashed border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 transition">
                    + {s.label}
                  </button>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-center">
                <AddCustom onAdd={handleAdd} />
              </div>
            </div>
          ) : (
            <>
              <ul className="space-y-2.5">
                {items.map((m) => {
                  const isDone = m.status === 'done';
                  const days = m.due_date ? daysFromNow(m.due_date) : null;
                  const overdue = !isDone && days !== null && days < 0;
                  const urgent = !isDone && days !== null && days >= 0 && days <= 7;
                  return (
                    <li key={m.id} className={`group relative flex items-start gap-3 pl-4 pr-3 py-2.5 rounded-xl border transition ${
                      isDone ? 'bg-emerald-50/30 border-emerald-100'
                      : overdue ? 'bg-red-50/40 border-red-100'
                      : urgent ? 'bg-amber-50/40 border-amber-100'
                      : 'bg-white border-slate-200'
                    } ${busyId === m.id ? 'opacity-50' : ''}`}>
                      {/* Checkbox / status */}
                      <button type="button" onClick={() => void toggleStatus(m)}
                        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                          isDone ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 hover:border-emerald-500'
                        }`}>
                        {isDone ? <Check className="w-3 h-3 text-white" />
                                : <Circle className="w-2 h-2 text-transparent" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingId === m.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={draftLabel}
                            onChange={(e) => setDraftLabel(e.target.value)}
                            onBlur={() => void confirmEdit(m)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') { e.preventDefault(); void confirmEdit(m); }
                              if (e.key === 'Escape') { setEditingId(null); }
                            }}
                            className="w-full text-sm bg-white border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                        ) : (
                          <button type="button" onClick={() => startEdit(m)}
                            className={`text-sm font-medium text-left ${isDone ? 'text-slate-500 line-through' : 'text-slate-800 hover:text-indigo-700'}`}>
                            {m.label}
                          </button>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 text-xs">
                          <input
                            type="date"
                            defaultValue={m.due_date ?? ''}
                            onBlur={(e) => { if ((e.target.value || null) !== m.due_date) void handleUpdate(m.id, { due_date: e.target.value || null }); }}
                            className="text-slate-500 bg-transparent border-0 focus:bg-indigo-50/40 focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 py-0.5"
                          />
                          {m.due_date && !isDone && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                              overdue ? 'bg-red-100 text-red-700'
                              : urgent ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500'
                            }`}>
                              {overdue ? `${Math.abs(days ?? 0)}gg fa` : days === 0 ? 'oggi' : `tra ${days}gg`}
                            </span>
                          )}
                        </div>
                      </div>

                      <button type="button" onClick={() => void handleRemove(m.id)}
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition shrink-0 mt-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-center">
                <AddCustom onAdd={handleAdd} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Form compatto per aggiungere milestone custom ────────────────────────────
function AddCustom({ onAdd }: { onAdd: (label: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!value.trim()) return;
    setSaving(true);
    try { await onAdd(value.trim()); setValue(''); setEditing(false); }
    finally { setSaving(false); }
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
        <Plus className="w-3.5 h-3.5" /> Aggiungi milestone
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 w-full max-w-md">
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); if (e.key === 'Escape') setEditing(false); }}
        placeholder="Es. Submission, Firma GA…"
        className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button type="button" onClick={() => void submit()} disabled={!value.trim() || saving}
        className="p-1.5 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
        <Check className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => { setEditing(false); setValue(''); }}
        className="p-1.5 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
