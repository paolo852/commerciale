import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { projectManagersService } from '../../lib/dataService';
import type { ProjectManager } from '../../types';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';

interface FormState {
  name: string;
  email: string;
  active: boolean;
}

const emptyForm: FormState = { name: '', email: '', active: true };

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
    setLoading(true);
    setError(null);
    try {
      setItems(await projectManagersService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(pm: ProjectManager) {
    setEditing(pm);
    setForm({ name: pm.name, email: pm.email ?? '', active: pm.active });
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || null,
        active: form.active,
      };
      if (editing) {
        await projectManagersService.update(editing.id, payload);
      } else {
        await projectManagersService.create(payload, user.id);
      }
      setFormOpen(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try {
      await projectManagersService.remove(toDelete.id);
      setToDelete(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nell\'eliminazione');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {items.length} {items.length === 1 ? 'project manager' : 'project manager'}
        </p>
        <button
          onClick={openNew}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Nuovo PM
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Stato</th>
              <th className="text-right px-4 py-3 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-slate-400">
                  Caricamento…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-slate-400">
                  Nessun project manager. Aggiungine uno per iniziare.
                </td>
              </tr>
            ) : (
              items.map((pm) => (
                <tr
                  key={pm.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openEdit(pm)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">{pm.name}</td>
                  <td className="px-4 py-3 text-slate-600">{pm.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        pm.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {pm.active ? 'Attivo' : 'Inattivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(pm);
                      }}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Elimina
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Modifica project manager' : 'Nuovo project manager'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Attivo
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminare il project manager?"
        message={
          toDelete
            ? `"${toDelete.name}" verrà rimosso. Le offerte associate manterranno il riferimento vuoto.`
            : ''
        }
        confirmLabel="Elimina"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
