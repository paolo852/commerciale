import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { leadCandidatesService } from '../../lib/dataService';
import type { FundingCall, LeadCandidate, LeadCandidateStatus } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (lead: LeadCandidate) => void;
  lead: LeadCandidate | null;
  fundingCalls: FundingCall[];
  existingCallTypes: string[];
}

interface FormState {
  researcher_name: string;
  institution: string;
  call_type: string;
  call_type_custom: string;
  funding_call_id: string;
  potential_project: string;
  status: LeadCandidateStatus;
}

const STATUS_OPTIONS: { value: LeadCandidateStatus; label: string }[] = [
  { value: 'attivo', label: 'Attivo' },
  { value: 'promosso', label: 'Promosso a concept' },
  { value: 'archiviato', label: 'Archiviato' },
];

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

export default function LeadCandidateFormModal({
  open, onClose, onSaved, lead, fundingCalls, existingCallTypes,
}: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>({
    researcher_name: '', institution: '', call_type: '', call_type_custom: '',
    funding_call_id: '', potential_project: '', status: 'attivo',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tutti i tipi disponibili (esistenti + "Nuovo…")
  const allCallTypes = [...new Set([...existingCallTypes])];

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (lead) {
      const known = existingCallTypes.includes(lead.call_type);
      setForm({
        researcher_name: lead.researcher_name,
        institution: lead.institution ?? '',
        call_type: known ? lead.call_type : '__custom__',
        call_type_custom: known ? '' : lead.call_type,
        funding_call_id: lead.funding_call_id ?? '',
        potential_project: lead.potential_project ?? '',
        status: lead.status,
      });
    } else {
      setForm({
        researcher_name: '', institution: '',
        call_type: allCallTypes[0] ?? '__custom__',
        call_type_custom: '',
        funding_call_id: '', potential_project: '', status: 'attivo',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function resolvedCallType(): string {
    if (form.call_type === '__custom__') return form.call_type_custom.trim() || 'Non classificato';
    return form.call_type || 'Non classificato';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.researcher_name.trim()) { setError('Il nome del ricercatore è obbligatorio.'); return; }

    setSaving(true); setError(null);
    try {
      const payload = {
        researcher_name: form.researcher_name.trim(),
        institution: form.institution.trim() || null,
        call_type: resolvedCallType(),
        funding_call_id: form.funding_call_id || null,
        potential_project: form.potential_project.trim() || null,
        status: form.status,
      };
      const saved = lead
        ? await leadCandidatesService.update(lead.id, payload)
        : await leadCandidatesService.create(payload, user.id);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore nel salvataggio');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={lead ? 'Modifica lead' : 'Nuovo lead candidate'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome ricercatore *</label>
            <input type="text" required value={form.researcher_name}
              onChange={(e) => update('researcher_name', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Istituto / Azienda</label>
            <input type="text" value={form.institution}
              onChange={(e) => update('institution', e.target.value)}
              placeholder="es. Politecnico di Milano" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipologia di bando</label>
          <div className="flex gap-2">
            <select
              value={form.call_type}
              onChange={(e) => update('call_type', e.target.value)}
              className={`${inputClass} flex-1`}
            >
              {allCallTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              <option value="__custom__">+ Nuova tipologia…</option>
            </select>
            {form.call_type === '__custom__' && (
              <input
                type="text"
                value={form.call_type_custom}
                onChange={(e) => update('call_type_custom', e.target.value)}
                placeholder="Nome tipologia (es. HORIZON Europe)"
                className={`${inputClass} flex-1`}
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Call specifica
            <span className="ml-1.5 text-xs font-normal text-slate-400">(opzionale)</span>
          </label>
          <select
            value={form.funding_call_id}
            onChange={(e) => update('funding_call_id', e.target.value)}
            className={inputClass}
          >
            <option value="">— Nessuna call specifica —</option>
            {fundingCalls.map((fc) => (
              <option key={fc.id} value={fc.id}>{fc.code} — {fc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Dati di massima sul progetto potenziale</label>
          <textarea
            rows={4}
            value={form.potential_project}
            onChange={(e) => update('potential_project', e.target.value)}
            placeholder="Descrivi brevemente l'idea progettuale, il tema di ricerca, il TRL, le tecnologie…"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Stato</label>
          <select value={form.status} onChange={(e) => update('status', e.target.value as LeadCandidateStatus)} className={inputClass}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
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
  );
}
