import { useEffect, useRef, useState, type FormEvent } from 'react';
import { File, Paperclip, Trash2, Upload } from 'lucide-react';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { leadsService, leadFilesService } from '../../lib/dataService';
import { formatDate } from '../../lib/format';
import type { Lead, LeadFile, LeadStatus } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onPromote?: (lead: Lead) => void;
  lead: Lead | null;
}

interface FormState {
  name: string;
  pi: string;
  ente: string;
  description: string;
  status: LeadStatus;
  notes: string;
}

const emptyForm: FormState = {
  name: '', pi: '', ente: '', description: '', status: 'in_valutazione', notes: '',
};

function fromLead(l: Lead): FormState {
  return {
    name: l.name,
    pi: l.pi ?? '',
    ente: l.ente ?? '',
    description: l.description ?? '',
    status: l.status,
    notes: l.notes ?? '',
  };
}

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

const STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: 'in_valutazione', label: 'In valutazione' },
  { value: 'promosso', label: 'Promosso a offerta' },
  { value: 'rifiutato', label: 'Rifiutato' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function LeadFormModal({ open, onClose, onSaved, onPromote, lead }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<LeadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(lead ? fromLead(lead) : emptyForm);
    setError(null);
    if (lead) {
      void leadFilesService.list(lead.id).then(setFiles).catch(() => setFiles([]));
    } else {
      setFiles([]);
    }
  }, [open, lead]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) { setError('Il nome della tecnologia è obbligatorio.'); return; }

    setSaving(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        pi: form.pi.trim() || null,
        ente: form.ente.trim() || null,
        description: form.description.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (lead) await leadsService.update(lead.id, payload);
      else await leadsService.create(payload, user.id);
      onSaved(); onClose();
    } catch (e) {
      const msg = (e as { message?: string })?.message
        ?? (e instanceof Error ? e.message : null)
        ?? 'Errore nel salvataggio';
      setError(msg);
    } finally { setSaving(false); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!lead) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const uploaded = await leadFilesService.upload(lead.id, file);
      setFiles((prev) => [uploaded, ...prev]);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Errore upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleFileRemove(file: LeadFile) {
    try {
      await leadFilesService.remove(file);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Errore eliminazione file');
    }
  }

  async function handleFileOpen(file: LeadFile) {
    const url = await leadFilesService.signedUrl(file.storage_path);
    if (url) window.open(url, '_blank');
  }

  return (
    <Modal open={open} onClose={onClose} title={lead ? 'Modifica lead' : 'Nuovo lead'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome tecnologia *</label>
          <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Principal Investigator (PI)</label>
            <input type="text" value={form.pi} onChange={(e) => update('pi', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ente di riferimento</label>
            <input type="text" value={form.ente} onChange={(e) => update('ente', e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrizione sintetica della tecnologia</label>
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Descrivi la tecnologia, il suo principio funzionante, il TRL e le potenziali applicazioni…"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Stato</label>
          <select value={form.status} onChange={(e) => update('status', e.target.value as LeadStatus)} className={inputClass}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Note</label>
          <textarea rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)}
            className={`${inputClass} resize-none`} />
        </div>

        {/* Upload file (solo se il lead esiste già) */}
        {lead && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3.5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                File di supporto ({files.length})
              </label>
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Caricamento…' : 'Carica file'}
              </button>
            </div>
            {files.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">Nessun file caricato.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
                    <File className="w-4 h-4 text-slate-400 shrink-0" />
                    <button type="button" onClick={() => handleFileOpen(f)}
                      className="flex-1 text-left truncate text-slate-700 hover:text-indigo-600 transition">
                      {f.filename}
                    </button>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0">{formatBytes(f.size)}</span>
                    <span className="text-xs text-slate-400 shrink-0 hidden sm:inline">{formatDate(f.uploaded_at)}</span>
                    <button type="button" onClick={() => handleFileRemove(f)}
                      className="text-slate-300 hover:text-red-500 transition shrink-0" title="Elimina">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-between items-center pt-2 gap-2 flex-wrap">
          {lead && onPromote && lead.status !== 'promosso' && (
            <button type="button" onClick={() => onPromote(lead)}
              className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition">
              ✓ Promuovi a offerta
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition">
              {saving ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
