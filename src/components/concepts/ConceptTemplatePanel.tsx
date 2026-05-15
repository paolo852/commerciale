import { useRef, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronRight,
  Download, FileCheck, Loader2, Save, Unlock, Upload,
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
      { key: 'tech_description', label: '1.1 Description and novelty', hint: 'Principio scientifico, meccanismo e novità (max 10–15 righe).', rows: 6 },
      { key: 'trl_justification', label: '1.2 TRL — giustificazione', rows: 2 },
      { key: 'trl_evidence', label: '1.2 Key evidence', hint: 'Pubblicazioni, prototipi, dati lab, validazioni terze.', rows: 3 },
      { key: 'trl_gaps', label: '1.2 Maturity gaps', hint: 'Cosa resta ancora da dimostrare.', rows: 3 },
      { key: 'trl_next_milestone', label: '1.2 Next TRL milestone', rows: 2 },
      { key: 'ip', label: '1.3 Intellectual property', hint: 'Brevetti, applicazioni, know-how, segreti commerciali.', rows: 3 },
    ],
  },
  {
    key: '2',
    title: '2. Problem and Value Proposition',
    fields: [
      { key: 'problem_statement', label: '2.1 Problem statement', hint: 'Chi, contesto, quantificazione del pain (costo, tempo, gap di performance).', rows: 5 },
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
      { key: 'roadmap', label: '4.1 From current TRL to market', hint: 'Fasi, milestone tecnici, decision gate, timeline indicativa.', rows: 7 },
    ],
  },
  {
    key: '5',
    title: '5. Risks and Critical Assumptions',
    fields: [
      { key: 'risk_assumptions', label: 'Riskiest assumptions to validate', hint: 'Le 3–5 ipotesi più rischiose con esperimento associato e kill-criterion.', rows: 6 },
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
  const [hoveringLock, setHoveringLock] = useState(false);

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
      locked
        ? 'border-emerald-200 shadow-sm shadow-emerald-100/60'
        : 'border-slate-200 shadow-sm'
    }`}>
      {/* Field header */}
      <div className={`flex items-start justify-between gap-3 px-4 pt-3 pb-2 ${
        locked ? 'bg-emerald-50/70' : 'bg-slate-50/80'
      }`}>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-widest ${
            locked ? 'text-emerald-700' : 'text-slate-500'
          }`}>
            {label}
          </p>
          {hint && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{hint}</p>
          )}
        </div>

        {/* Approve / approved button */}
        {locked ? (
          <button
            type="button"
            onClick={onToggleLock}
            onMouseEnter={() => setHoveringLock(true)}
            onMouseLeave={() => setHoveringLock(false)}
            title="Campo approvato — clicca per sbloccare"
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 ${
              hoveringLock
                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                : 'bg-emerald-500 text-white border border-emerald-600'
            }`}
          >
            {hoveringLock
              ? <><Unlock className="w-3 h-3" /> Sblocca</>
              : <><CheckCircle2 className="w-3 h-3" /> Approvato</>
            }
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleLock}
            title="Approva questo campo"
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 border border-dashed border-slate-300 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-150"
          >
            <CheckCircle2 className="w-3 h-3" />
            Approva
          </button>
        )}
      </div>

      {/* Field body */}
      <div className={`px-4 pb-3 pt-2 ${locked ? 'bg-white' : 'bg-white'}`}>
        {locked ? (
          <div className="border-l-2 border-emerald-300 pl-3">
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {value || <span className="text-slate-300 italic">—</span>}
            </p>
          </div>
        ) : (
          <textarea
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white resize-y placeholder-slate-300"
            placeholder="Inserisci qui il contenuto…"
          />
        )}
      </div>
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
  const total = section.fields.length;
  const allApproved = approvedCount === total && total > 0;

  return (
    <div className={`rounded-xl overflow-hidden border transition-colors ${
      allApproved ? 'border-emerald-200' : 'border-slate-200'
    }`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition text-left ${
          allApproved ? 'bg-emerald-50/60 hover:bg-emerald-50' : 'bg-slate-50 hover:bg-slate-100'
        }`}
      >
        <span className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          }
          <span className={`text-sm font-semibold ${allApproved ? 'text-emerald-800' : 'text-slate-800'}`}>
            {section.title}
          </span>
        </span>

        {approvedCount > 0 && (
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            allApproved
              ? 'bg-emerald-500 text-white'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            <CheckCircle2 className="w-3 h-3" />
            {allApproved ? 'Completato' : `${approvedCount}/${total}`}
          </span>
        )}
      </button>

      {open && (
        <div className="px-5 py-4 space-y-4 bg-white">
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
  const allDone = totalLocked === totalFields;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <FileCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Product Concept Template</h3>
            {totalLocked > 0 && (
              <p className={`text-xs mt-0.5 font-medium ${allDone ? 'text-emerald-600' : 'text-slate-500'}`}>
                {allDone ? '✓ Tutti i campi approvati' : `${totalLocked} di ${totalFields} campi approvati`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
            {parsing ? 'Importazione…' : 'Importa documento'}
          </button>
          <input ref={fileInputRef} type="file" accept=".docx" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {parseMsg && (
        <div className={`mx-6 mt-4 text-xs px-3.5 py-2.5 rounded-lg border ${
          parseMsg.type === 'ok'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {parseMsg.text}
        </div>
      )}

      {/* Sections */}
      <div className="p-6 space-y-3">
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

      {/* Footer / save */}
      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          {totalLocked > 0
            ? `${totalLocked}/${totalFields} campi approvati`
            : 'Approva i campi quando il contenuto è definitivo.'}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition shadow-sm shadow-indigo-200"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  );
}
