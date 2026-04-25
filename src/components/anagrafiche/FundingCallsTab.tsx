import { useEffect, useState, type FormEvent } from 'react';
import { FileSearch, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fundingCallsService } from '../../lib/dataService';
import type { FundingCall } from '../../types';
import { formatDate, toDateInputValue } from '../../lib/format';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';

interface FormState { code: string; name: string; body: string; deadline: string; notes: string; }
const emptyForm: FormState = { code: '', name: '', body: '', deadline: '', notes: '' };

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

export default function FundingCallsTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<FundingCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FundingCall | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<FundingCall | null>(null);

  async function reload() {
    setLoading(true); setError(null);
    try { setItems(await fundingCallsService.list()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore nel caricamento'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  function openNew() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(fc: FundingCall) {
    setEditing(fc);
    setForm({ code: fc.code, name: fc.name, body: fc.body ?? '', deadline: toDateInputValue(fc.deadline), notes: fc.notes ?? '' });
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); if (!user) return;
    setSaving(true);
    try {
      const p = { code: form.code.trim(), name: form.name.trim(), body: form.body.trim() || null, deadline: form.deadline || null, notes: form.notes.trim() || null };
      if (editing) await fundingCallsService.update(editing.id, p);
      else await fundingCallsService.create(p, user.id);
      setFormOpen(false); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Errore nel salvataggio'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try { await fundingCallsService.remove(toDelete.id); setToDelete(null); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore nell\'eliminazione'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} {items.length === 1 ? 'bando' : 'bandi'}</p>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition">
          <Plus className="w-4 h-4" /> Nuovo bando
        </button>
      </div>

      {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Codice</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Ente</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Scadenza</th>
              <th className="text-right px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm">Caricamento…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12">
                <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nessun bando. Aggiungine uno.</p>
              </td></tr>
            ) : items.map((fc) => (
              <tr key={fc.id} onClick={() => openEdit(fc)} className="cursor-pointer hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3.5">
                  <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{fc.code}</span>
                </td>
                <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{fc.name}</td>
                <td className="px-4 py-3.5 text-sm text-slate-600">{fc.body ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums">{formatDate(fc.deadline)}</td>
                <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setToDelete(fc)} className="text-xs text-slate-400 hover:text-red-600 transition">Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Modifica bando' : 'Nuovo bando'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Codice *</label>
              <input type="text" required placeholder="RIA-2024" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Ente erogatore</label>
              <input type="text" placeholder="MIMIT" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Scadenza bando</label>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Note</label>
            <textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputClass} resize-none`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition">
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Eliminare il bando?"
        message={toDelete ? `"${toDelete.code} — ${toDelete.name}" verrà rimosso.` : ''}
        confirmLabel="Elimina" variant="danger" onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
