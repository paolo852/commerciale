import { useRef, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronRight, Circle,
  Download, FileCheck, Loader2, Lock, Save, Unlock, Upload,
} from 'lucide-react';
import { parseConceptDocx } from '../../lib/conceptParser';
import type { ConceptTemplateData } from '../../types';

interface Props {
  data: ConceptTemplateData | null;
  onSave: (data: ConceptTemplateData) => Promise<void>;
}

const EMPTY: ConceptTemplateData = {
  lead_organisation: '', authors: '', trl_current: '', version: '',
  tech_description: '', trl_justification: '', trl_evidence: '', trl_gaps: '', trl_next_milestone: '', ip: '',
  problem_statement: '',
  value_functional: '', value_economic: '', value_strategic: '', validation: '',
  tam: '', sam: '', som: '',
  roadmap: '',
  risk_assumptions: '',
  locked_fields: [],
};

type FieldKey = Exclude<keyof ConceptTemplateData, 'locked_fields'>;

type Section = {
  key: string;
  title: string;
  fields: { key: FieldKey; label: string; hint?: string; rows?: number }[];
};

const SECTIONS: Section[] = [
  {
    key: 'meta',
    title: 'Copertina',
    fields: [
      { key: 'lead_organisation', label: 'Lead organisation', rows: 1 },
      { key: 'authors', label: 'Author(s)', rows: 1 },
      { key: 'version', label: 'Version', rows: 1 },
      { key: 'trl_current', label: 'TRL corrente', rows: 1 },
    ],
  },
  {
    key: '1',
    title: '1. Technology Snapshot',
    fields: [
      { key: 'tech_description', label: '1.1 Description and novelty', hint: 'Descrivi il principio scientifico, il meccanismo e la novità (max 10–15 righe).', rows: 6 },
      { key: 'trl_justification', label: '1.2 TRL corrente — giustificazione', rows: 2 },
      { key: 'trl_evidence', label: '1.2 Key evidence', hint: 'Pubblicazioni, prototipi, dati di laboratorio, validazioni terze.', rows: 3 },
      { key: 'trl_gaps', label: '1.2 Maturity gaps', hint: 'Cosa resta ancora da dimostrare.', rows: 3 },
      { key: 'trl_next_milestone', label: '1.2 Next TRL milestone', rows: 2 },
      { key: 'ip', label: '1.3 Intellectual property', hint: 'Brevetti, applicazioni, know-how, segreti commerciali.', rows: 3 },
    ],
  },
  {
    key: '2',
    title: '2. Problem and Value Proposition',
    fields: [
      { key: 'problem_statement', label: '2.1 Problem statement', hint: 'Chi ha il problema, in quale contesto, quantificazione del pain.', rows: 5 },
      { key: 'value_functional', label: '2.2 Functional benefits', hint: 'Cosa fa il prodotto meglio degli incumbent.', rows: 3 },
      { key: 'value_economic', label: '2.2 Economic benefits', hint: 'Risparmi, produttività, incremento ricavi.', rows: 3 },
      { key: 'value_strategic', label: '2.2 Strategic benefits', hint: 'Compliance, sostenibilità, differenziazione.', rows: 3 },
      { key: 'validation', label: '2.3 Validation', hint: 'Evidenze di validazione problema/soluzione.', rows: 3 },
    ],
  },
  {
    key: '3',
    title: '3. Market and Competition',
    fields: [
      { key: 'tam', label: 'TAM — Total Addressable Market', hint: 'Domanda globale per la categoria di soluzione.', rows: 2 },
      { key: 'sam', label: 'SAM — Serviceable Available Market', hint: 'Segmento geografico/settoriale raggiungibile.', rows: 2 },
      { key: 'som', label: 'SOM — Serviceable Obtainable Market', hint: 'Quota ottenibile nei primi 3–5 anni.', rows: 2 },
    ],
  },
  {
    key: '4',
    title: '4. Development Roadmap',
    fields: [
      { key: 'roadmap', label: '4.1 From current TRL to market', hint: 'Fasi, milestone tecnici e di prodotto, decision gate, timeline.', rows: 7 },
    ],
  },
  {
    key: '5',
    title: '5. Risks and Critical Assumptions',
    fields: [
      { key: 'risk_assumptions', label: 'Assumptions to validate', hint: 'Lista delle 3–5 ipotesi più rischiose e gli esperimenti per testarle.', rows: 6 },
    ],
  },
];

function FieldEditor({
  label, hint, rows, value, locked, onToggleLock, onChange,
}: {
  label: string;
  hint?: string;
  rows: number;
  value: string;
  locked: boolean;
  onToggleLock: () => void;
  onChange: (val: string) => void;
}) {
  return (
    <div className={`rounded-xl border transition-all ${locked ? 'border-emerald-200 bg-emerald-50/40' : 'border-transparent bg-white'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {locked && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            <label className={`block text-xs font-semibold uppercase tracking-wide ${locked ? 'text-emerald-700' : 'text-slate-600'}`}>
              {label}
            </label>
          </div>
          {hint && <p className="text-xs text-slate-400 mt-0.5 leading-snug">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={onToggleLock}
          title={locked ? 'Campo approvato — clicca per sbloccare' : 'Approva questo campo'}
          className={`shrink-0 mt-0.5 p-1 rounded-lg transition ${
            locked
              ? 'text-emerald-600 bg-emerald-100 hover:bg-emerald-200'
              : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
          }`}
        >
          {locked ? <Lock className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
        </button>
      </div>
      {locked ? (
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed px-1 py-1 min-h-[2rem]">
          {value || <span className="text-slate-300 italic">—</span>}
        </p>
      ) : (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y bg-white"
          placeholder="—"
        />
      )}
    </div>
  );
}

function SectionPanel({ section, form, locked, onToggleLock, onChange }: {
  section: Section;
  form: ConceptTemplateData;
  locked: Set<string>;
  onToggleLock: (key: string) => void;
  onChange: (key: FieldKey, val: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const approvedCount = section.fields.filter((f) => locked.has(f.key)).length;
  const hasContent = section.fields.some((f) => form[f.key]);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          {section.title}
          {hasContent && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
        </span>
        {approvedCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            {approvedCount}/{section.fields.length} approvati
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 py-4 space-y-4 bg-white">
          {section.fields.map((f) => (
            <FieldEditor
              key={f.key}
              label={f.label}
              hint={f.hint}
              rows={f.rows ?? 3}
              value={form[f.key] as string}
              locked={locked.has(f.key)}
              onToggleLock={() => onToggleLock(f.key)}
              onChange={(val) => onChange(f.key, val)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConceptTemplatePanel({ data, onSave }: Props) {
  const [form, setForm] = useState<ConceptTemplateData>({ ...EMPTY, ...data, locked_fields: data?.locked_fields ?? [] });
  const [locked, setLocked] = useState<Set<string>>(new Set(data?.locked_fields ?? []));
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseMsg, setParseMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function update(key: FieldKey, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function toggleLock(key: string) {
    setLocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.docx')) {
      setParseMsg({ type: 'err', text: 'Carica un file .docx (Word).' });
      return;
    }
    setParsing(true); setParseMsg(null);
    try {
      const parsed = await parseConceptDocx(file);
      setForm((prev) => ({ ...prev, ...parsed }));
      setParseMsg({ type: 'ok', text: 'Documento importato. Verifica i campi e salva.' });
    } catch (err) {
      setParseMsg({ type: 'err', text: (err as { message?: string }).message ?? 'Errore parsing documento.' });
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ ...form, locked_fields: Array.from(locked) });
    } finally {
      setSaving(false);
    }
  }

  const totalFields = SECTIONS.reduce((n, s) => n + s.fields.length, 0);
  const totalLocked = locked.size;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-indigo-500" />
            Product Concept Template
          </h3>
          {totalLocked > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <Lock className="w-3 h-3" />
              {totalLocked}/{totalFields} approvati
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalLocked > 0 && (
            <button
              type="button"
              onClick={() => setLocked(new Set())}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            >
              <Unlock className="w-3.5 h-3.5" />
              Sblocca tutti
            </button>
          )}
          <a
            href="/Product_Concept_Template.docx"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            Scarica template
          </a>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-60 transition"
          >
            {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {parsing ? 'Importazione…' : 'Importa documento compilato'}
          </button>
          <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {parseMsg && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${parseMsg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {parseMsg.text}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <SectionPanel
            key={s.key}
            section={s}
            form={form}
            locked={locked}
            onToggleLock={toggleLock}
            onChange={update}
          />
        ))}
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  );
}
