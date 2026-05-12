import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ExternalLink, FileSearch, FileText, Globe, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { fundingCallPdfService, fundingCallsService } from '../../lib/dataService';
import type { EUCall } from '../../../api/eu-calls';
import type { FundingCall } from '../../types';
import { formatDate, toDateInputValue } from '../../lib/format';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import EUCallsImportModal from './EUCallsImportModal';

interface FormState { code: string; name: string; body: string; deadline: string; description: string; notes: string; probability: number; }
const emptyForm: FormState = { code: '', name: '', body: '', deadline: '', description: '', notes: '', probability: 50 };

function probColor(p: number): string {
  if (p >= 70) return 'text-emerald-600';
  if (p >= 40) return 'text-amber-600';
  return 'text-red-500';
}

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

function CallsTable({
  rows, loading, onEdit, onDelete, emptyLabel = 'Nessun bando.', dimmed = false,
}: {
  rows: FundingCall[];
  loading: boolean;
  onEdit: (fc: FundingCall) => void;
  onDelete: (fc: FundingCall) => void;
  emptyLabel?: string;
  dimmed?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden ${dimmed ? 'opacity-70' : ''}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70">
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Codice</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Nome</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Ente</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Scadenza</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Prob.</th>
            <th className="text-right px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm">Caricamento…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-12">
              <FileSearch className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">{emptyLabel}</p>
            </td></tr>
          ) : rows.map((fc) => (
            <tr key={fc.id} onClick={() => onEdit(fc)} className="cursor-pointer hover:bg-slate-50/80 transition-colors">
              <td className="px-4 py-3.5">
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg">{fc.code}</span>
              </td>
              <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{fc.name}</td>
              <td className="px-4 py-3.5 text-sm text-slate-600">{fc.body ?? <span className="text-slate-300">—</span>}</td>
              <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums">{formatDate(fc.deadline)}</td>
              <td className="px-4 py-3.5 text-right">
                <span className={`text-sm font-semibold tabular-nums ${probColor(fc.probability ?? 50)}`}>
                  {fc.probability ?? 50}%
                </span>
              </td>
              <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-end gap-2">
                  {fc.source_url && (
                    <a href={fc.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-slate-400 hover:text-indigo-500 transition" title="Apri nel portale">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <button onClick={() => onDelete(fc)} className="text-xs text-slate-400 hover:text-red-600 transition">Elimina</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfRemoving, setPdfRemoving] = useState(false);
  const [euModalOpen, setEuModalOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const activeCalls = useMemo(() => items.filter((fc) => !fc.deadline || fc.deadline >= today), [items, today]);
  const pastCalls   = useMemo(() => items.filter((fc) => fc.deadline && fc.deadline < today)
    .sort((a, b) => (b.deadline ?? '').localeCompare(a.deadline ?? '')), [items, today]);

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
    setForm({ code: fc.code, name: fc.name, body: fc.body ?? '', deadline: toDateInputValue(fc.deadline), description: fc.description ?? '', notes: fc.notes ?? '', probability: fc.probability ?? 50 });
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); if (!user) return;
    setSaving(true);
    try {
      const p = { code: form.code.trim(), name: form.name.trim(), body: form.body.trim() || null, deadline: form.deadline || null, description: form.description.trim() || null, notes: form.notes.trim() || null, probability: form.probability, source_url: editing?.source_url ?? null };
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

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editing) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfUploading(true);
    try {
      const updated = await fundingCallPdfService.upload(editing.id, file);
      setEditing(updated);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore upload PDF');
    } finally {
      setPdfUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePdfRemove() {
    if (!editing?.pdf_path) return;
    setPdfRemoving(true);
    try {
      const updated = await fundingCallPdfService.remove(editing.id, editing.pdf_path);
      setEditing(updated);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore rimozione PDF');
    } finally {
      setPdfRemoving(false);
    }
  }

  async function openPdf() {
    if (!editing?.pdf_path) return;
    const url = await fundingCallPdfService.signedUrl(editing.pdf_path);
    if (url) window.open(url, '_blank');
  }

  async function handleEUImport(calls: EUCall[]) {
    if (!user) return;
    for (const c of calls) {
      await fundingCallsService.create(
        {
          code: c.identifier,
          name: c.title,
          body: c.programme || null,
          deadline: c.deadline,
          description: c.description ?? null,
          notes: null,
          probability: 50,
          source_url: c.url,
        },
        user.id,
      );
    }
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">
          {activeCalls.length} {activeCalls.length === 1 ? 'bando attivo' : 'bandi attivi'}
          {pastCalls.length > 0 && <span className="text-slate-400"> · {pastCalls.length} scaduti</span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEuModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition"
          >
            <Globe className="w-4 h-4" /> Importa da EU Portal
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition">
            <Plus className="w-4 h-4" /> Nuovo bando
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

      {/* Active calls table */}
      <CallsTable
        rows={activeCalls}
        loading={loading}
        onEdit={openEdit}
        onDelete={setToDelete}
        emptyLabel="Nessun bando attivo. Aggiungine uno."
      />

      {/* Past calls — collapsible */}
      {!loading && pastCalls.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 overflow-hidden">
          <button
            onClick={() => setPastOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-sm font-medium text-slate-600"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300" />
              Passati ({pastCalls.length})
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${pastOpen ? 'rotate-180' : ''}`} />
          </button>
          {pastOpen && (
            <CallsTable
              rows={pastCalls}
              loading={false}
              onEdit={openEdit}
              onDelete={setToDelete}
              dimmed
            />
          )}
        </div>
      )}

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
          <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">Probabilità di successo stimata</label>
              <span className={`text-lg font-bold tabular-nums ${probColor(form.probability)}`}>
                {form.probability}%
              </span>
            </div>
            <input
              type="range" min="0" max="100" step="1"
              value={form.probability}
              onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
              className="w-full h-2 rounded-full cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>0% — impossibile</span>
              <span>50% — incerto</span>
              <span>100% — certo</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Descrizione del bando
              <span className="ml-1.5 text-xs font-normal text-violet-600">(letta da Gemini per il matching AI)</span>
            </label>
            <textarea
              rows={5}
              placeholder="Obiettivi, criteri di ammissibilità, settori tematici, TRL richiesto, tipologia di soggetti ammessi…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Note operative</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputClass} resize-none`} />
          </div>

          {editing && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5">
              <p className="text-sm font-medium text-slate-700 mb-2.5">Documento bando (PDF)</p>
              {editing.pdf_path ? (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                  <button
                    type="button"
                    onClick={openPdf}
                    className="text-sm text-indigo-600 hover:underline flex-1 text-left truncate"
                  >
                    {editing.pdf_filename ?? 'documento.pdf'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePdfRemove}
                    disabled={pdfRemoving}
                    className="text-xs text-slate-400 hover:text-red-600 transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {pdfRemoving ? 'Rimozione…' : 'Rimuovi'}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handlePdfUpload}
                  />
                  <button
                    type="button"
                    disabled={pdfUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {pdfUploading ? 'Upload in corso…' : 'Carica PDF del bando'}
                  </button>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Il PDF viene letto da Gemini durante l'analisi AI dei lead.
                  </p>
                </div>
              )}
            </div>
          )}

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

      <EUCallsImportModal
        open={euModalOpen}
        onClose={() => setEuModalOpen(false)}
        onImport={handleEUImport}
      />
    </div>
  );
}
