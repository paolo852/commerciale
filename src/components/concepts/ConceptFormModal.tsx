import { useEffect, useState, type FormEvent } from 'react';
import Modal from '../Modal';
import { useAuth } from '../../contexts/AuthContext';
import { conceptsService } from '../../lib/dataService';
import type { Concept, ConceptStatus } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (created: Concept | null) => void;
  concept: Concept | null;
}

interface FormState {
  name: string;
  pi: string;
  ente: string;
  description: string;
  status: ConceptStatus;
  notes: string;
}

const emptyForm: FormState = {
  name: '', pi: '', ente: '', description: '', status: 'in_valutazione', notes: '',
};

function fromConcept(c: Concept): FormState {
  return {
    name: c.name,
    pi: c.pi ?? '',
    ente: c.ente ?? '',
    description: c.description ?? '',
    status: c.status,
    notes: c.notes ?? '',
  };
}

const inputClass =
  'w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

const STATUS_OPTIONS: { value: ConceptStatus; label: string }[] = [
  { value: 'in_valutazione', label: 'In valutazione' },
  { value: 'promosso', label: 'Promosso a offerta' },
  { value: 'rifiutato', label: 'Rifiutato' },
];

export default function ConceptFormModal({ open, onClose, onSaved, concept }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(concept ? fromConcept(concept) : emptyForm);
    setError(null);
  }, [open, concept]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) { setError('Il nome del concept è obbligatorio.'); return; }

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
      let saved: Concept;
      if (concept) saved = await conceptsService.update(concept.id, payload);
      else saved = await conceptsService.create(payload, user.id);
      onSaved(saved);
      onClose();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Errore nel salvataggio');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={concept ? 'Modifica concept' : 'Nuovo concept'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome concept *</label>
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
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrizione sintetica</label>
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Descrivi il concept, principio funzionante, TRL e potenziali applicazioni…"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Stato</label>
          <select value={form.status} onChange={(e) => update('status', e.target.value as ConceptStatus)} className={inputClass}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
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
