import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Mail, Phone, Plus, Star, Trash2, User, X } from 'lucide-react';
import Modal from '../Modal';
import { offerContactsService } from '../../lib/dataService';
import type { OfferContact } from '../../types';

interface Props {
  offerId: string;
}

const COMMON_ROLES = [
  'Principal Investigator',
  'Partner',
  'Coordinator',
  'Funder officer',
  'Project officer',
  'Technical lead',
  'Admin / Financial',
  'Altro',
];

interface FormState {
  name: string;
  role: string;
  organization: string;
  email: string;
  phone: string;
  notes: string;
  is_primary: boolean;
}

const emptyForm: FormState = {
  name: '', role: '', organization: '', email: '', phone: '', notes: '', is_primary: false,
};

export default function OfferContactsPanel({ offerId }: Props) {
  const [contacts, setContacts] = useState<OfferContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<OfferContact | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setContacts(await offerContactsService.list(offerId)); }
    finally { setLoading(false); }
  }, [offerId]);

  useEffect(() => { void reload(); }, [reload]);

  function openNew() {
    setEditingContact(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(c: OfferContact) {
    setEditingContact(c);
    setForm({
      name: c.name,
      role: c.role ?? '',
      organization: c.organization ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      notes: c.notes ?? '',
      is_primary: c.is_primary,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const maxPos = contacts.reduce((m, c) => Math.max(m, c.position), -1);
      const payload = {
        name: form.name.trim(),
        role: form.role.trim() || null,
        organization: form.organization.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        notes: form.notes.trim() || null,
        is_primary: form.is_primary,
      };
      if (editingContact) {
        await offerContactsService.update(editingContact.id, payload);
      } else {
        await offerContactsService.create({
          offer_id: offerId,
          ...payload,
          position: maxPos + 1,
        });
      }
      setFormOpen(false);
      await reload();
    } finally { setSaving(false); }
  }

  async function handleRemove(id: string) {
    const c = contacts.find((x) => x.id === id);
    if (!confirm(`Rimuovere ${c?.name ?? 'questo contatto'}?`)) return;
    setBusyId(id);
    try {
      await offerContactsService.remove(id);
      setContacts((prev) => prev.filter((x) => x.id !== id));
    } finally { setBusyId(null); }
  }

  async function togglePrimary(c: OfferContact) {
    setBusyId(c.id);
    try {
      const updated = await offerContactsService.update(c.id, { is_primary: !c.is_primary });
      setContacts((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
    } finally { setBusyId(null); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Contatti progetto</p>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {contacts.length === 0 ? 'Nessun contatto' : `${contacts.length} ${contacts.length === 1 ? 'contatto' : 'contatti'}`}
          </p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); openNew(); }}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
          <Plus className="w-3 h-3" /> Aggiungi
        </button>
        {open
          ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {loading ? (
            <p className="text-xs text-slate-400 italic text-center py-6">Caricamento…</p>
          ) : contacts.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-slate-400 italic mb-3">
                Nessun contatto. Aggiungi PI, partner, funding officer…
              </p>
              <button type="button" onClick={openNew}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition">
                <Plus className="w-3.5 h-3.5" /> Nuovo contatto
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {contacts.map((c) => (
                <li key={c.id} className={`flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60 group ${busyId === c.id ? 'opacity-50' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                    c.is_primary ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`} title={c.is_primary ? 'Contatto principale' : ''}>
                    {c.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button type="button" onClick={() => openEdit(c)}
                        className="text-sm font-semibold text-slate-900 hover:text-indigo-700 text-left truncate">
                        {c.name}
                      </button>
                      {c.is_primary && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                      {c.role && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100">
                          {c.role}
                        </span>
                      )}
                    </div>
                    {c.organization && (
                      <p className="text-xs text-slate-500 truncate">{c.organization}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      {c.email && (
                        <a href={`mailto:${c.email}`}
                          className="flex items-center gap-1 text-indigo-600 hover:underline">
                          <Mail className="w-3 h-3" /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone}`}
                          className="flex items-center gap-1 text-slate-600 hover:underline">
                          <Phone className="w-3 h-3" /> {c.phone}
                        </a>
                      )}
                    </div>
                    {c.notes && (
                      <p className="mt-1 text-xs text-slate-500 italic whitespace-pre-wrap leading-snug">{c.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button type="button" onClick={() => void togglePrimary(c)}
                      title={c.is_primary ? 'Rimuovi preferito' : 'Segna come principale'}
                      className="text-slate-300 hover:text-amber-500 p-1 transition">
                      <Star className={`w-3.5 h-3.5 ${c.is_primary ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>
                    <button type="button" onClick={() => void handleRemove(c.id)}
                      className="text-slate-300 hover:text-red-500 p-1 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Form modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingContact ? 'Modifica contatto' : 'Nuovo contatto'} size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nome *</label>
            <input type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Nome e cognome" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ruolo</label>
              <input type="text" list="contact-roles" value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Es. Principal Investigator" />
              <datalist id="contact-roles">
                {COMMON_ROLES.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Organizzazione</label>
              <input type="text" value={form.organization}
                onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Es. TU Delft" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
              <input type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="nome@dominio" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Telefono</label>
              <input type="tel" value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="+39 …" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Note</label>
            <textarea rows={2} value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Riferimenti, orari, note…" />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={form.is_primary}
              onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <Star className="w-3.5 h-3.5 text-amber-500" />
            Segna come contatto principale
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setFormOpen(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
              <X className="w-3 h-3" /> Annulla
            </button>
            <button type="button" onClick={() => void handleSave()} disabled={!form.name.trim() || saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition">
              {saving ? 'Salvo…' : editingContact ? 'Aggiorna' : 'Aggiungi'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
