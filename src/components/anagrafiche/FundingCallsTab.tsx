import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fundingCallsService } from '../../lib/dataService';
import type { FundingCall } from '../../types';
import { formatDate, toDateInputValue } from '../../lib/format';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';

interface FormState {
  code: string;
  name: string;
  body: string;
  deadline: string;
  notes: string;
}

const emptyForm: FormState = {
  code: '',
  name: '',
  body: '',
  deadline: '',
  notes: '',
};

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
    setLoading(true);
    setError(null);
    try {
      setItems(await fundingCallsService.list());
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

  function openEdit(fc: FundingCall) {
    setEditing(fc);
    setForm({
      code: fc.code,
      name: fc.name,
      body: fc.body ?? '',
      deadline: toDateInputValue(fc.deadline),
      notes: fc.notes ?? '',
    });
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        body: form.body.trim() || null,
        deadline: form.deadline || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        await fundingCallsService.update(editing.id, payload);
      } else {
        await fundingCallsService.create(payload, user.id);
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
      await fundingCallsService.remove(toDelete.id);
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
          {items.length} {items.length === 1 ? 'bando' : 'bandi'}
        </p>
        <button
          onClick={openNew}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          + Nuovo bando
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
              <th className="text-left px-4 py-3 font-medium">Codice</th>
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left px-4 py-3 font-medium">Ente</th>
              <th className="text-left px-4 py-3 font-medium">Scadenza</th>
              <th className="text-right px-4 py-3 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">
                  Caricamento…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-slate-400">
                  Nessun bando. Aggiungine uno per iniziare.
                </td>
              </tr>
            ) : (
              items.map((fc) => (
                <tr
                  key={fc.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openEdit(fc)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{fc.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{fc.name}</td>
                  <td className="px-4 py-3 text-slate-600">{fc.body ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(fc.deadline)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setToDelete(fc);
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
        title={editing ? 'Modifica bando' : 'Nuovo bando'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Codice *</label>
              <input
                type="text"
                required
                placeholder="RIA-2024"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ente erogatore</label>
              <input
                type="text"
                placeholder="MIMIT"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Scadenza bando</label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
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
        title="Eliminare il bando?"
        message={
          toDelete
            ? `"${toDelete.code} — ${toDelete.name}" verrà rimosso dall'anagrafica.`
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
