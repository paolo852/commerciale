import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { offersService } from '../../lib/dataService';
import { toDateInputValue } from '../../lib/format';
import { STATUS_OPTIONS, OUTCOME_OPTIONS } from '../Badges';
import type {
  Offer, OfferStatus, OfferOutcome, OfferType, ProjectManager, FundingCall,
} from '../../types';

interface OfferFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  offer: Offer | null;
  projectManagers: ProjectManager[];
  fundingCalls: FundingCall[];
}

interface FormState {
  name: string;
  type: OfferType;
  funding_call: string;
  client: string;
  deadline: string;
  budget: string;
  probability: number;
  project_manager_id: string;
  pi: string;
  ente: string;
  status: OfferStatus;
  outcome: OfferOutcome;
  submitted_at: string;
  decided_at: string;
  notes: string;
}

const emptyForm: FormState = {
  name: '', type: 'financed', funding_call: '', client: '',
  deadline: '', budget: '', probability: 50,
  project_manager_id: '', pi: '', ente: '',
  status: 'in_lavorazione',
  outcome: 'nessuno', submitted_at: '', decided_at: '', notes: '',
};

function fromOffer(o: Offer): FormState {
  return {
    name: o.name, type: o.type,
    funding_call: o.funding_call ?? '', client: o.client ?? '',
    deadline: toDateInputValue(o.deadline), budget: String(o.budget),
    probability: o.probability ?? 50,
    project_manager_id: o.project_manager_id ?? '',
    pi: o.pi ?? '', ente: o.ente ?? '',
    status: o.status, outcome: o.outcome,
    submitted_at: toDateInputValue(o.submitted_at),
    decided_at: toDateInputValue(o.decided_at),
    notes: o.notes ?? '',
  };
}

function probColor(p: number): string {
  if (p >= 70) return 'text-emerald-600';
  if (p >= 40) return 'text-amber-600';
  return 'text-red-500';
}
function sliderTrack(p: number): string {
  if (p >= 70) return 'accent-emerald-500';
  if (p >= 40) return 'accent-amber-500';
  return 'accent-red-500';
}

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';
const selectClass = `${inputClass} bg-white`;

export default function OfferFormModal({
  open, onClose, onSaved, offer, projectManagers, fundingCalls,
}: OfferFormModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setForm(offer ? fromOffer(offer) : emptyForm); setError(null); }
  }, [open, offer]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleFundingCallChange(code: string) {
    const fc = fundingCalls.find((f) => f.code === code);
    setForm((f) => ({
      ...f,
      funding_call: code,
      ...(fc?.probability != null ? { probability: fc.probability } : {}),
      ...(fc?.deadline ? { deadline: toDateInputValue(fc.deadline) } : {}),
    }));
  }

  function handleStatusChange(status: OfferStatus) {
    setForm((f) => ({
      ...f,
      status,
      ...(status === 'presentata' && f.deadline ? { submitted_at: f.deadline } : {}),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (form.status === 'presentata' && !form.submitted_at) {
      setError('Per le offerte presentate è obbligatoria la data di presentazione.'); return;
    }
    if (form.outcome !== 'nessuno' && !form.decided_at) {
      setError("Per registrare un esito è obbligatoria la data dell'esito."); return;
    }
    if (form.type === 'financed' && !form.funding_call) {
      setError('Per le offerte finanziate è obbligatorio il bando.'); return;
    }
    if (form.type === 'consulting' && !form.client.trim()) {
      setError('Per le offerte di consulenza è obbligatorio il cliente.'); return;
    }
    const budget = Number(form.budget.replace(',', '.'));
    if (!Number.isFinite(budget) || budget < 0) {
      setError('Importo non valido.'); return;
    }

    setSaving(true); setError(null);
    try {
      const payload = {
        name: form.name.trim(), type: form.type,
        funding_call: form.type === 'financed' ? form.funding_call : null,
        client: form.type === 'consulting' ? form.client.trim() : null,
        deadline: form.deadline, budget,
        probability: form.probability,
        project_manager_id: form.project_manager_id || null,
        pi: form.pi.trim() || null,
        ente: form.ente.trim() || null,
        status: form.status, outcome: form.outcome,
        submitted_at: form.status === 'presentata' ? form.submitted_at : null,
        decided_at: form.outcome !== 'nessuno' ? form.decided_at : null,
        notes: form.notes.trim() || null,
      };
      if (offer) await offersService.update(offer.id, payload);
      else await offersService.create(payload, user.id);
      onSaved(); onClose();
    } catch (e) {
      // Gli errori Supabase non sono istanze di Error: estrai message + hint
      const msg = (e as { message?: string })?.message
        ?? (e instanceof Error ? e.message : null)
        ?? 'Errore nel salvataggio';
      const hint = (e as { hint?: string; details?: string })?.hint
        ?? (e as { details?: string })?.details;
      setError(hint ? `${msg} — ${hint}` : msg);
      console.error('Save offer failed:', e);
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={offer ? 'Modifica offerta' : 'Nuova offerta'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome progetto *</label>
          <input type="text" required value={form.name} onChange={(e) => update('name', e.target.value)} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipologia *</label>
            <select value={form.type} onChange={(e) => update('type', e.target.value as OfferType)} className={selectClass}>
              <option value="financed">Finanziata</option>
              <option value="consulting">Consulenza</option>
            </select>
          </div>
          {form.type === 'financed' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Bando *</label>
              <select required value={form.funding_call} onChange={(e) => handleFundingCallChange(e.target.value)} className={selectClass}>
                <option value="">Seleziona bando…</option>
                {fundingCalls.map((fc) => (
                  <option key={fc.id} value={fc.code}>{fc.code} — {fc.name}</option>
                ))}
              </select>
              {fundingCalls.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nessun bando. Aggiungine uno in Anagrafiche.</p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cliente *</label>
              <input type="text" required value={form.client} onChange={(e) => update('client', e.target.value)} className={inputClass} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Scadenza *</label>
            <input type="date" required value={form.deadline} onChange={(e) => update('deadline', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Importo (€) *</label>
            <input type="number" required min="0" step="0.01" value={form.budget} onChange={(e) => update('budget', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Project Manager</label>
            <select value={form.project_manager_id} onChange={(e) => update('project_manager_id', e.target.value)} className={selectClass}>
              <option value="">—</option>
              {projectManagers.map((pm) => (
                <option key={pm.id} value={pm.id}>{pm.name}{!pm.active ? ' (inattivo)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Principal Investigator (PI)</label>
            <input type="text" value={form.pi} onChange={(e) => update('pi', e.target.value)} className={inputClass} placeholder="Nome del PI…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ente di riferimento</label>
            <input type="text" value={form.ente} onChange={(e) => update('ente', e.target.value)} className={inputClass} placeholder="Es. Politecnico di Milano…" />
          </div>
        </div>

        {/* Probabilità di successo */}
        <div className="bg-slate-50 rounded-xl px-4 py-3.5 border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-slate-700">Probabilità di successo stimata</label>
            <span className={`text-lg font-bold tabular-nums ${probColor(form.probability)}`}>
              {form.probability}%
            </span>
          </div>
          <input
            type="range"
            min="0" max="100" step="5"
            value={form.probability}
            onChange={(e) => update('probability', Number(e.target.value))}
            className={`w-full h-2 rounded-full cursor-pointer ${sliderTrack(form.probability)}`}
          />
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0% — impossibile</span>
            <span>50% — incerto</span>
            <span>100% — certo</span>
          </div>
          {form.budget && Number(form.budget) > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Contributo atteso al fatturato:{' '}
              <strong className={probColor(form.probability)}>
                {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
                  .format(Number(form.budget.replace(',', '.')) * form.probability / 100)}
              </strong>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Stato *</label>
            <select value={form.status} onChange={(e) => handleStatusChange(e.target.value as OfferStatus)} className={selectClass}>
              {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Esito *</label>
            <select value={form.outcome} onChange={(e) => update('outcome', e.target.value as OfferOutcome)} className={selectClass}>
              {OUTCOME_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Data presentazione{form.status === 'presentata' ? ' *' : ''}
            </label>
            <input type="date" required={form.status === 'presentata'} disabled={form.status !== 'presentata'}
              value={form.submitted_at} onChange={(e) => update('submitted_at', e.target.value)}
              className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Data esito{form.outcome !== 'nessuno' ? ' *' : ''}
            </label>
            <input type="date" required={form.outcome !== 'nessuno'} disabled={form.outcome === 'nessuno'}
              value={form.decided_at} onChange={(e) => update('decided_at', e.target.value)}
              className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Note</label>
          <textarea rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)}
            className={`${inputClass} resize-none`} />
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
