import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { leadCandidatesService, fundingCallsService } from '../../lib/dataService';
import type { FundingCall, LeadCandidate, LeadCandidateStatus, ProjectManager } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (lead: LeadCandidate) => void;
  lead: LeadCandidate | null;
  fundingCalls: FundingCall[];
  projectManagers: ProjectManager[];
}

interface FormState {
  researcher_name: string;
  institution: string;
  call_type: string;
  funding_call_id: string;
  potential_project: string;
  status: LeadCandidateStatus;
  pm_id: string;
}

interface NewCallDraft {
  code: string;
  name: string;
  body: string;
  deadline: string;
}

const STATUS_OPTIONS: { value: LeadCandidateStatus; label: string }[] = [
  { value: 'attivo', label: 'Attivo' },
  { value: 'promosso', label: 'Promosso a concept' },
  { value: 'archiviato', label: 'Archiviato' },
];

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

export default function LeadCandidateFormModal({
  open, onClose, onSaved, lead, fundingCalls, projectManagers,
}: Props) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  // Non-expired calls from props + any newly created inline
  const [extraCalls, setExtraCalls] = useState<FundingCall[]>([]);
  const activeCalls = useMemo(() => {
    const all = [...fundingCalls, ...extraCalls];
    return all.filter((fc) => !fc.deadline || fc.deadline >= today);
  }, [fundingCalls, extraCalls, today]);

  const [form, setForm] = useState<FormState>({
    researcher_name: '', institution: '', call_type: '',
    funding_call_id: '', potential_project: '', status: 'attivo', pm_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline new-call creation
  const [showNewCall, setShowNewCall] = useState(false);
  const [newCall, setNewCall] = useState<NewCallDraft>({ code: '', name: '', body: '', deadline: '' });
  const [creatingCall, setCreatingCall] = useState(false);
  const [newCallError, setNewCallError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowNewCall(false);
    setNewCall({ code: '', name: '', body: '', deadline: '' });
    setExtraCalls([]);
    if (lead) {
      setForm({
        researcher_name: lead.researcher_name,
        institution: lead.institution ?? '',
        call_type: lead.call_type,
        funding_call_id: lead.funding_call_id ?? '',
        potential_project: lead.potential_project ?? '',
        status: lead.status,
        pm_id: lead.pm_id ?? '',
      });
    } else {
      setForm({
        researcher_name: '', institution: '', call_type: '',
        funding_call_id: '', potential_project: '', status: 'attivo', pm_id: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCallSelect(value: string) {
    if (value === '__new__') {
      setShowNewCall(true);
      return;
    }
    setShowNewCall(false);
    update('funding_call_id', value);
    if (value) {
      const fc = activeCalls.find((c) => c.id === value);
      if (fc) update('call_type', fc.body ?? fc.name);
    }
  }

  async function handleCreateCall() {
    if (!user) return;
    if (!newCall.code.trim() || !newCall.name.trim()) {
      setNewCallError('Codice e nome sono obbligatori.');
      return;
    }
    setCreatingCall(true); setNewCallError(null);
    try {
      const created = await fundingCallsService.create({
        code: newCall.code.trim(),
        name: newCall.name.trim(),
        body: newCall.body.trim() || null,
        deadline: newCall.deadline || null,
        lead_deadline: null,
        internal_deadline: null,
        description: null,
        notes: null,
        probability: 50,
        source_url: null,
      }, user.id);
      setExtraCalls((prev) => [...prev, created]);
      update('funding_call_id', created.id);
      update('call_type', created.body ?? created.name);
      setShowNewCall(false);
      setNewCall({ code: '', name: '', body: '', deadline: '' });
    } catch (e) {
      setNewCallError((e as { message?: string })?.message ?? 'Errore creazione bando');
    } finally { setCreatingCall(false); }
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
        call_type: form.call_type.trim() || 'Non classificato',
        funding_call_id: form.funding_call_id || null,
        potential_project: form.potential_project.trim() || null,
        status: form.status,
        pm_id: form.pm_id || null,
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

        {/* Bando di riferimento */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Bando di riferimento</label>
          <select
            value={showNewCall ? '__new__' : (form.funding_call_id || '')}
            onChange={(e) => handleCallSelect(e.target.value)}
            className={inputClass}
          >
            <option value="">— Nessun bando specifico —</option>
            {activeCalls.map((fc) => (
              <option key={fc.id} value={fc.id}>
                {fc.code} — {fc.name}{fc.deadline ? ` (scad. ${fc.deadline})` : ''}
              </option>
            ))}
            <option value="__new__">+ Crea nuovo bando in anagrafica…</option>
          </select>

          {/* Inline new-call mini-form */}
          {showNewCall && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Nuovo bando</p>
              {newCallError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{newCallError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Codice *</label>
                  <input
                    type="text" value={newCall.code}
                    onChange={(e) => setNewCall((n) => ({ ...n, code: e.target.value }))}
                    placeholder="es. HORIZON-MSCA-2025"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
                  <input
                    type="text" value={newCall.name}
                    onChange={(e) => setNewCall((n) => ({ ...n, name: e.target.value }))}
                    placeholder="es. Marie Skłodowska-Curie Postdoctoral"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tipologia</label>
                  <input
                    type="text" value={newCall.body}
                    onChange={(e) => setNewCall((n) => ({ ...n, body: e.target.value }))}
                    placeholder="es. HORIZON Europe, PNRR, Regionale…"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Scadenza</label>
                  <input
                    type="date" value={newCall.deadline}
                    onChange={(e) => setNewCall((n) => ({ ...n, deadline: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateCall}
                  disabled={creatingCall || !newCall.code.trim() || !newCall.name.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {creatingCall ? 'Creazione…' : 'Crea bando'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewCall(false); setNewCall({ code: '', name: '', body: '', deadline: '' }); }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tipologia manuale quando non è selezionato un bando */}
        {!form.funding_call_id && !showNewCall && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipologia / ambito</label>
            <input
              type="text"
              value={form.call_type}
              onChange={(e) => update('call_type', e.target.value)}
              placeholder="es. PNRR, Horizon Europe, Regionale, Privato…"
              className={inputClass}
            />
          </div>
        )}

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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Stato</label>
            <select value={form.status} onChange={(e) => update('status', e.target.value as LeadCandidateStatus)} className={inputClass}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Assegnato a</label>
            <select value={form.pm_id} onChange={(e) => update('pm_id', e.target.value)} className={inputClass}>
              <option value="">— Nessuno —</option>
              {projectManagers.filter((p) => p.active).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
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
