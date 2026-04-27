import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { allowedUsersService } from '../../lib/dataService';
import { isDemoMode } from '../../lib/supabase';
import type { AllowedUser } from '../../types';
import { formatDate } from '../../lib/format';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

export default function AllowedUsersTab() {
  const [items, setItems] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AllowedUser | null>(null);

  async function reload() {
    setLoading(true); setError(null);
    try { setItems(await allowedUsersService.list()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore nel caricamento'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void reload(); }, []);

  function openNew() { setEmail(''); setName(''); setFormOpen(true); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await allowedUsersService.create({ email, name: name.trim() || null });
      setFormOpen(false);
      await reload();
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? 'Errore nel salvataggio';
      setError(msg);
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!toDelete) return;
    try { await allowedUsersService.remove(toDelete.id); setToDelete(null); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Errore nell\'eliminazione'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{items.length} {items.length === 1 ? 'utente autorizzato' : 'utenti autorizzati'}</p>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition">
          <UserPlus className="w-4 h-4" /> Aggiungi utente
        </button>
      </div>

      {isDemoMode && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          Modalità demo — la lista utenti è simulata in localStorage e non influenza l'accesso.
        </div>
      )}

      {!isDemoMode && (
        <div className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm">
          <strong>Nota bootstrap:</strong> il primo utente deve essere inserito direttamente nel SQL Editor di Supabase con
          <code className="mx-1 px-1.5 py-0.5 bg-indigo-100 rounded text-xs font-mono">
            INSERT INTO allowed_users (email) VALUES ('tua@email.com');
          </code>
        </div>
      )}

      {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Aggiunto il</th>
              <th className="text-right px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm">Caricamento…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12">
                <ShieldCheck className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nessun utente autorizzato.</p>
              </td></tr>
            ) : items.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{u.email}</td>
                <td className="px-4 py-3.5 text-sm text-slate-600">{u.name ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-3.5 text-sm text-slate-500 tabular-nums">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setToDelete(u)} className="text-xs text-slate-400 hover:text-red-600 transition">Rimuovi</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Aggiungi utente autorizzato">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="utente@example.com" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Mario Rossi" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFormOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition">
              {saving ? 'Salvataggio…' : 'Aggiungi'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!toDelete} title="Rimuovere l'utente?"
        message={toDelete ? `"${toDelete.email}" non potrà più accedere all'applicazione.` : ''}
        confirmLabel="Rimuovi" variant="danger" onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
