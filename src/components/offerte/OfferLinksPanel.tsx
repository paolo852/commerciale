import { useEffect, useState } from 'react';
import { Check, ExternalLink, FolderOpen, Lightbulb, Mail, Pencil, Save, X } from 'lucide-react';
import { offersService } from '../../lib/dataService';
import { RichTextArea } from '../RichText';
import type { Offer } from '../../types';

interface Props {
  offer: Offer;
  onUpdate: (patch: Partial<Offer>) => void;  // notifica al genitore così aggiorna lo state
}

// Costruisce l'URL Gmail per aprire la ricerca. Se la query sembra un ID thread (lungo esadecimale),
// tenta l'apertura diretta del thread; altrimenti usa il search filter.
function buildGmailUrl(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return 'https://mail.google.com/';
  // Thread id Gmail: solitamente 16 caratteri esadecimali
  if (/^[0-9a-f]{12,20}$/i.test(trimmed)) {
    return `https://mail.google.com/mail/u/0/#inbox/${trimmed}`;
  }
  return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(trimmed)}`;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export default function OfferLinksPanel({ offer, onUpdate }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <DriveBox offer={offer} onUpdate={onUpdate} />
      <GmailBox offer={offer} onUpdate={onUpdate} />
      <IdeasBox offer={offer} onUpdate={onUpdate} />
    </div>
  );
}

// ── Drive box ────────────────────────────────────────────────────────────────
function DriveBox({ offer, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(offer.drive_url ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(offer.drive_url ?? ''); }, [offer.drive_url]);

  async function save() {
    setSaving(true);
    try {
      const url = value.trim() ? normalizeUrl(value) : null;
      await offersService.update(offer.id, { drive_url: url });
      onUpdate({ drive_url: url });
      setEditing(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center">
          <FolderOpen className="w-4 h-4 text-amber-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 flex-1">Cartella condivisa</h3>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            {offer.drive_url ? 'Modifica' : 'Imposta'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="url"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setValue(offer.drive_url ?? ''); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
              <X className="w-3 h-3" /> Annulla
            </button>
            <button type="button" onClick={() => void save()} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition">
              <Save className="w-3 h-3" /> {saving ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </div>
      ) : offer.drive_url ? (
        <a
          href={offer.drive_url}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-800 hover:bg-amber-100 transition group"
        >
          <FolderOpen className="w-4 h-4 shrink-0" />
          <span className="truncate flex-1" title={offer.drive_url}>Apri cartella Drive</span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-100 transition" />
        </a>
      ) : (
        <p className="text-xs text-slate-400 italic text-center py-2">
          Nessuna cartella impostata.
        </p>
      )}
    </div>
  );
}

// ── Gmail box ────────────────────────────────────────────────────────────────
function GmailBox({ offer, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(offer.gmail_query ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(offer.gmail_query ?? ''); }, [offer.gmail_query]);

  async function save() {
    setSaving(true);
    try {
      const q = value.trim() || null;
      await offersService.update(offer.id, { gmail_query: q });
      onUpdate({ gmail_query: q });
      setEditing(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
          <Mail className="w-4 h-4 text-red-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 flex-1">Email con il consorzio</h3>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            {offer.gmail_query ? 'Modifica' : 'Imposta'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder='Es. label:erc-sac3  oppure  from:caroline@tudelft.nl'
            className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-[11px] text-slate-400 leading-snug">
            Filtro di ricerca Gmail. Esempi:
            <code className="ml-1 px-1 bg-slate-100 rounded">label:nome-label</code>,
            <code className="ml-1 px-1 bg-slate-100 rounded">from:nome@dominio</code>,
            <code className="ml-1 px-1 bg-slate-100 rounded">subject:parola</code>.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setEditing(false); setValue(offer.gmail_query ?? ''); }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition">
              <X className="w-3 h-3" /> Annulla
            </button>
            <button type="button" onClick={() => void save()} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition">
              <Save className="w-3 h-3" /> {saving ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </div>
      ) : offer.gmail_query ? (
        <div className="space-y-2">
          <p className="text-xs font-mono text-slate-500 truncate" title={offer.gmail_query}>
            {offer.gmail_query}
          </p>
          <a
            href={buildGmailUrl(offer.gmail_query)}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800 hover:bg-red-100 transition group"
          >
            <Mail className="w-4 h-4 shrink-0" />
            <span className="flex-1">Apri conversazione in Gmail</span>
            <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-100 transition" />
          </a>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic text-center py-2">
          Nessuna query Gmail impostata.
        </p>
      )}
    </div>
  );
}

// ── Note / idee box ──────────────────────────────────────────────────────────
function IdeasBox({ offer, onUpdate }: Props) {
  const [value, setValue] = useState(offer.ideas ?? '');
  const [savedValue, setSavedValue] = useState(offer.ideas ?? '');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setValue(offer.ideas ?? '');
    setSavedValue(offer.ideas ?? '');
  }, [offer.ideas]);

  const dirty = value !== savedValue;

  async function save() {
    setSaving(true);
    try {
      const v = value.trim() || null;
      await offersService.update(offer.id, { ideas: v });
      onUpdate({ ideas: v });
      setSavedValue(v ?? '');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 md:col-span-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-violet-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 flex-1">Note e idee</h3>
        {dirty && (
          <button type="button" onClick={() => void save()} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition">
            <Save className="w-3 h-3" /> {saving ? 'Salvo…' : 'Salva'}
          </button>
        )}
        {justSaved && !dirty && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="w-3 h-3" /> Salvato
          </span>
        )}
      </div>

      <RichTextArea
        rows={6}
        value={value}
        onChange={setValue}
        placeholder="Idee, appunti, promemoria per questo progetto… **Grassetto**, *corsivo*, - liste, [link](url)."
      />
    </div>
  );
}
