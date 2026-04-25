import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { offersService } from '../../lib/dataService';
import { toDateInputValue } from '../../lib/format';
import { STATUS_OPTIONS, OUTCOME_OPTIONS } from '../Badges';
import type {
  Offer,
  OfferStatus,
  OfferOutcome,
  OfferType,
  ProjectManager,
  FundingCall,
} from '../../types';

interface OfferFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  offer: Offer | null; // null = nuova offerta
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
  project_manager_id: string;
  status: OfferStatus;
  outcome: OfferOutcome;
  submitted_at: string;
  decided_at: string;
  notes: string;
}

const emptyForm: FormState = {
  name: '',
  type: 'financed',
  funding_call: '',
  client: '',
  deadline: '',
  budget: '',
  project_manager_id: '',
  status: 'in_lavorazione',
  outcome: 'nessuno',
  submitted_at: '',
  decided_at: '',
  notes: '',
};

function fromOffer(o: Offer): FormState {
  return {
    name: o.name,
    type: o.type,
    funding_call: o.funding_call ?? '',
    client: o.client ?? '',
    deadline: toDateInputValue(o.deadline),
    budget: String(o.budget),
    project_manager_id: o.project_manager_id ?? '',
    status: o.status,
    outcome: o.outcome,
    submitted_at: toDateInputValue(o.submitted_at),
    decided_at: toDateInputValue(o.decided_at),
    notes: o.notes ?? '',
  };
}

export default function OfferFormModal({
  open,
  onClose,
  onSaved,
  offer,
  projectManagers,
  fundingCalls,
}: OfferFormModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(offer ? fromOffer(offer) : emptyForm);
      setError(null);
    }
  }, [open, offer]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;

    // Validazioni client-side allineate ai CHECK del DB
    if (form.status === 'presentata' && !form.submitted_at) {
      setError('Per le offerte presentate è obbligatoria la data di presentazione.');
      return;
    }
    if (form.outcome !== 'nessuno' && !form.decided_at) {
      setError("Per registrare un esito è obbligatoria la data dell'esito.");
      return;
    }
    if (form.type === 'financed' && !form.funding_call) {
      setError('Per le offerte finanziate è obbligatorio il bando.');
      return;
    }
    if (form.type === 'consulting' && !form.client.trim()) {
      setError('Per le offerte di consulenza è obbligatorio il cliente.');
      return;
    }
    const budget = Number(form.budget.replace(',', '.'));
    if (!Number.isFinite(budget) || budget < 0) {
      setError('Importo non valido.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        funding_call: form.type === 'financed' ? form.funding_call : null,
        client: form.type === 'consulting' ? form.client.trim() : null,
        deadline: form.deadline,
        budget,
        project_manager_id: form.project_manager_id || null,
        status: form.status,
        outcome: form.outcome,
        submitted_at: form.status === 'presentata' ? form.submitted_at : null,
        decided_at: form.outcome !== 'nessuno' ? form.decided_at : null,
        notes: form.notes.trim() || null,
      };

      if (offer) {
        await offersService.update(offer.id, payload);
      } else {
        await offersService.create(payload, user.id);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={offer ? 'Modifica offerta' : 'Nuova offerta'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome progetto *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipologia *</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value as OfferType)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="financed">Finanziata</option>
              <option value="consulting">Consulenza</option>
            </select>
          </div>

          {form.type === 'financed' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bando *</label>
              <select
                required
                value={form.funding_call}
                onChange={(e) => update('funding_call', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Seleziona bando…</option>
                {fundingCalls.map((fc) => (
                  <option key={fc.id} value={fc.code}>
                    {fc.code} — {fc.name}
                  </option>
                ))}
              </select>
              {fundingCalls.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Nessun bando in anagrafica. Aggiungine uno in Anagrafiche → Funding Calls.
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente *</label>
              <input
                type="text"
                required
                value={form.client}
                onChange={(e) => update('client', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Scadenza offerta *</label>
            <input
              type="date"
              required
              value={form.deadline}
              onChange={(e) => update('deadline', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Importo (€) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={form.budget}
              onChange={(e) => update('budget', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Project manager</label>
            <select
              value={form.project_manager_id}
              onChange={(e) => update('project_manager_id', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">—</option>
              {projectManagers.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                  {!pm.active ? ' (inattivo)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stato *</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as OfferStatus)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Esito *</label>
            <select
              value={form.outcome}
              onChange={(e) => update('outcome', e.target.value as OfferOutcome)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {OUTCOME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data presentazione
              {form.status === 'presentata' ? ' *' : ''}
            </label>
            <input
              type="date"
              required={form.status === 'presentata'}
              disabled={form.status !== 'presentata'}
              value={form.submitted_at}
              onChange={(e) => update('submitted_at', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data esito
              {form.outcome !== 'nessuno' ? ' *' : ''}
            </label>
            <input
              type="date"
              required={form.outcome !== 'nessuno'}
              disabled={form.outcome === 'nessuno'}
              value={form.decided_at}
              onChange={(e) => update('decided_at', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Note</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
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
  );
}
