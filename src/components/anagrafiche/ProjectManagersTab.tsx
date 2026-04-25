import { useEffect, useState, type FormEvent } from 'react';
import { Plus, UserCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { projectManagersService } from '../../lib/dataService';
import type { ProjectManager } from '../../types';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';

interface FormState { name: string; email: string; active: boolean; }
const emptyForm: FormState = { name: '', email: '', active: true };

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

export default function ProjectManagersTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<ProjectManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectManager | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<ProjectManager | null>(null);

  async function reload() {
    setLoading(true); setError(null);
    try { setItems(await projectManagersService.list()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore nel caricamento'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  function openNew() { setEditing(null); setForm(emptyForm); setFormOpen(true); }
  function openEdit(pm: ProjectManager) {
    setEditing(pm); setForm({ name: pm.name, email: pm.email ?? '', active: pm.active }); setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); if (!user) return;
    setSaving(true);
    try {
      const p = { name: form.name.trim(), email: form.email.trim() || null, active: form.active };
      if (editing) await projectManagersService.update(editing.id, p);
      else await projectManagersService.create(p, user.id);
      setFormOpen(false); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Errore nel salvataggio'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try { await projectManagersService.remove(toDelete.id); setToDelete(null); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore nell\'eliminazione'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} project manager</p>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition">
          <Plus className="w-4 h-4" /> Nuovo PM
        </button>
      </div>

      {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Stato</th>
              <th className="text-right px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">Caricamento…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12">
                <UserCircle className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nessun project manager. Aggiungine uno.</p>
              </td></tr>
            ) : items.map((pm) => (
              <tr key={pm.id} onClick={() => openEdit(pm)} className="cursor-pointer hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{pm.name}</td>
                <td className="px-4 py-3.5 text-sm text-slate-600">{pm.email ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    pm.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {pm.active ? 'Attivo' : 'Inattivo'}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setToDelete(pm)} className="text-xs text-slate-400 hover:text-red-600 transition">Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Modifica project manager' : 'Nuovo project manager'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome *</label>
            <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Attivo
          </label>
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

      <ConfirmDialog open={!!toDelete} title="Eliminare il project manager?"
        message={toDelete ? `"${toDelete.name}" verrà rimosso definitivamente.` : ''}
        confirmLabel="Elimina" variant="danger" onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
