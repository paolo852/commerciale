import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronRight,
  Download, FileCheck, HelpCircle, Loader2, MessageSquare, Save, Send, Trash2, Unlock, Upload,
} from 'lucide-react';
import { parseConceptDocx } from '../../lib/conceptParser';
import { conceptFieldCommentsService } from '../../lib/dataService';
import MentionTextarea from '../MentionTextarea';
import { sendMentionNotifications } from '../../lib/mentionNotify';
import type { ConceptFieldComment, ConceptTemplateData, ProjectManager } from '../../types';

interface Props {
  conceptId: string;
  data: ConceptTemplateData | null;
  onSave: (data: ConceptTemplateData) => Promise<void>;
  projectManagers?: ProjectManager[];
  currentUserName?: string;
}

const EMPTY: ConceptTemplateData = {
  project_name: '', lead_organisation: '', authors: '', trl_current: '', version: '',
  tech_description: '', product_description: '',
  trl_justification: '', trl_evidence: '', trl_gaps: '', trl_next_milestone: '', ip: '',
  problem_statement: '', value_proposition: '',
  tam: '', sam: '', som: '',
  roadmap: '',
  risk_assumptions: '',
  locked_fields: [],
  validation_status: {},
  validation_how: {},
};

type FieldKey = Exclude<keyof ConceptTemplateData, 'locked_fields' | 'validation_status' | 'validation_how'>;

type Section = {
  key: string;
  title: string;
  fields: { key: FieldKey; label: string; hint?: string; rows?: number; showValidation?: boolean }[];
};

const SECTIONS: Section[] = [
  {
    key: 'meta',
    title: 'Copertina',
    fields: [
      { key: 'project_name', label: 'Project / Technology name', rows: 1 },
      { key: 'lead_organisation', label: 'Lead organisation', rows: 1 },
      { key: 'trl_current', label: 'Current TRL', rows: 1 },
    ],
  },
  {
    key: '1',
    title: '1. Product Snapshot',
    fields: [
      { key: 'tech_description', label: '1.1 Technology', hint: 'Principio scientifico, meccanismo e novità (max 10–15 righe).', rows: 6 },
      { key: 'product_description', label: '1.2 Product', hint: 'Descrivi il prodotto previsto: cosa è, come funziona, i benefici ad alto livello.', rows: 5 },
      { key: 'trl_justification', label: '1.3 Current TRL — giustificazione', rows: 2 },
      { key: 'trl_evidence', label: '1.3 Key evidence', hint: 'Pubblicazioni, prototipi, dati lab, validazioni terze.', rows: 3 },
      { key: 'trl_gaps', label: '1.3 Maturity gaps', hint: 'Cosa resta ancora da dimostrare.', rows: 3 },
      { key: 'trl_next_milestone', label: '1.3 Next TRL milestone', rows: 2 },
      { key: 'ip', label: '1.4 Intellectual property', hint: 'Brevetti, applicazioni, know-how, segreti commerciali.', rows: 3 },
    ],
  },
  {
    key: '2',
    title: '2. Problem and Value Proposition',
    fields: [
      { key: 'problem_statement', label: '2.1 Application Scenario — Problem statement', hint: 'Chi, contesto, quantificazione del pain (costo, tempo, gap). Perché le soluzioni esistenti non bastano.', rows: 6, showValidation: true },
      { key: 'value_proposition', label: '2.2 Application Scenario — Value Proposition', hint: 'Come cambierebbe lo scenario applicativo con il prodotto.', rows: 6, showValidation: true },
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

// ── Utilities ────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  return `${Math.floor(hrs / 24)}g fa`;
}

// ── CommentForm ──────────────────────────────────────────────────────────────

function CommentForm({
  authorName, setAuthorName, placeholder, onSubmit, onCancel, submitting, projectManagers,
}: {
  authorName: string;
  setAuthorName: (v: string) => void;
  placeholder?: string;
  onSubmit: (body: string, mentions: string[]) => Promise<void>;
  onCancel?: () => void;
  submitting: boolean;
  projectManagers?: ProjectManager[];
}) {
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !authorName.trim()) return;
    await onSubmit(body.trim(), mentions);
    setBody('');
    setMentions([]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder="Il tuo nome"
        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white placeholder-slate-300"
      />
      {projectManagers && projectManagers.length > 0 ? (
        <MentionTextarea
          rows={2}
          value={body}
          onChange={setBody}
          mentions={mentions}
          onMentionsChange={setMentions}
          projectManagers={projectManagers}
          placeholder={placeholder ?? 'Scrivi un commento… (usa @ per menzionare)'}
          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white resize-none placeholder-slate-300"
        />
      ) : (
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder ?? 'Scrivi un commento…'}
          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white resize-none placeholder-slate-300"
        />
      )}
      <div className="flex items-center gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            Annulla
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || !body.trim() || !authorName.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {submitting
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Send className="w-3 h-3" />}
          Invia
        </button>
      </div>
    </form>
  );
}

// ── FieldComments ────────────────────────────────────────────────────────────

function FieldComments({
  comments, authorName, setAuthorName, onAdd, onDelete, projectManagers,
}: {
  comments: ConceptFieldComment[];
  authorName: string;
  setAuthorName: (v: string) => void;
  onAdd: (parentId: string | null, body: string, mentions: string[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  projectManagers?: ProjectManager[];
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const topLevel = comments.filter((c) => c.parent_id === null);
  const replies = (parentId: string) => comments.filter((c) => c.parent_id === parentId);

  async function handleAdd(parentId: string | null, body: string, mentions: string[]) {
    setSubmitting(true);
    try {
      await onAdd(parentId, body, mentions);
      if (parentId) setReplyingTo(null);
      else setShowNewForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
    const sz = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-5 h-5 text-[8px]';
    const bg = size === 'sm' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500';
    return (
      <div className={`${sz} ${bg} rounded-full flex items-center justify-center shrink-0 font-bold mt-0.5`}>
        {initials(name || '?')}
      </div>
    );
  }

  function CommentRow({
    comment, isReply = false,
  }: {
    comment: ConceptFieldComment;
    isReply?: boolean;
  }) {
    return (
      <div className="flex gap-2 group">
        <Avatar name={comment.author_name} size={isReply ? 'xs' : 'sm'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-800">{comment.author_name}</span>
            <span className="text-[10px] text-slate-400">{timeAgo(comment.created_at)}</span>
            <button
              onClick={() => onDelete(comment.id)}
              className="ml-auto opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition"
              title="Elimina commento"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap leading-relaxed">{comment.body}</p>
          {!isReply && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="text-[10px] text-slate-400 hover:text-indigo-500 mt-1 transition font-medium"
            >
              {replyingTo === comment.id ? 'Annulla' : 'Rispondi'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      {/* Thread */}
      {topLevel.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <CommentRow comment={comment} />

          {/* Replies */}
          {replies(comment.id).length > 0 && (
            <div className="ml-8 space-y-2 border-l-2 border-slate-100 pl-3">
              {replies(comment.id).map((reply) => (
                <CommentRow key={reply.id} comment={reply} isReply />
              ))}
            </div>
          )}

          {/* Reply form */}
          {replyingTo === comment.id && (
            <div className="ml-8">
              <CommentForm
                authorName={authorName}
                setAuthorName={setAuthorName}
                placeholder="Scrivi una risposta… (usa @ per menzionare)"
                onSubmit={(body, mentions) => handleAdd(comment.id, body, mentions)}
                onCancel={() => setReplyingTo(null)}
                submitting={submitting}
                projectManagers={projectManagers}
              />
            </div>
          )}
        </div>
      ))}

      {/* New top-level comment */}
      {showNewForm ? (
        <CommentForm
          authorName={authorName}
          setAuthorName={setAuthorName}
          onSubmit={(body, mentions) => handleAdd(null, body, mentions)}
          onCancel={() => setShowNewForm(false)}
          submitting={submitting}
          projectManagers={projectManagers}
        />
      ) : (
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-500 transition font-medium"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Aggiungi commento
        </button>
      )}
    </div>
  );
}

// ── ValidationIndicator ──────────────────────────────────────────────────────

function ValidationIndicator({
  status, how, onStatusChange, onHowChange,
}: {
  status: 'ipotesi' | 'validato' | undefined;
  how: string;
  onStatusChange: (s: 'ipotesi' | 'validato') => void;
  onHowChange: (v: string) => void;
}) {
  return (
    <div className="mx-4 mb-3 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Toggle bar */}
      <div className="flex">
        <button
          type="button"
          onClick={() => onStatusChange('ipotesi')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition ${
            !status || status === 'ipotesi'
              ? 'bg-amber-500 text-white'
              : 'bg-white text-slate-400 hover:bg-amber-50 hover:text-amber-600'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
          Ipotesi
        </button>
        <div className="w-px bg-slate-200" />
        <button
          type="button"
          onClick={() => onStatusChange('validato')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold transition ${
            status === 'validato'
              ? 'bg-emerald-500 text-white'
              : 'bg-white text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Validato
        </button>
      </div>

      {/* "Come?" field, shown only when validato */}
      {status === 'validato' && (
        <div className="px-3 pb-3 pt-2 bg-emerald-50/60 border-t border-emerald-200">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 mb-1.5">
            Come è stato validato?
          </p>
          <textarea
            rows={3}
            value={how}
            onChange={(e) => onHowChange(e.target.value)}
            placeholder="Descrivi metodologia, esperimento, evidenze raccolte…"
            className="w-full text-xs px-2.5 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white resize-y placeholder-slate-300"
          />
        </div>
      )}
    </div>
  );
}

// ── FieldEditor ──────────────────────────────────────────────────────────────

function FieldEditor({
  fieldKey, label, hint, rows, value, locked, onToggleLock, onChange,
  showValidation, validationStatus, validationHow, onValidationStatusChange, onValidationHowChange,
  comments, authorName, setAuthorName, onAddComment, onDeleteComment,
}: {
  fieldKey: string;
  label: string;
  hint?: string;
  rows: number;
  value: string;
  locked: boolean;
  onToggleLock: () => void;
  onChange: (val: string) => void;
  showValidation?: boolean;
  validationStatus: 'ipotesi' | 'validato' | undefined;
  validationHow: string;
  onValidationStatusChange: (s: 'ipotesi' | 'validato') => void;
  onValidationHowChange: (v: string) => void;
  comments: ConceptFieldComment[];
  authorName: string;
  setAuthorName: (v: string) => void;
  onAddComment: (parentId: string | null, body: string, mentions: string[]) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  projectManagers?: ProjectManager[];
}) {
  const [hoveringLock, setHoveringLock] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // auto-open comments if there are some
  useEffect(() => {
    if (comments.length > 0) setShowComments(true);
  }, [comments.length]);

  return (
    <div
      id={`field-${fieldKey}`}
      className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        locked ? 'border-emerald-200 shadow-sm shadow-emerald-100/60' : 'border-slate-200 shadow-sm'
      }`}
    >
      {/* Field header */}
      <div className={`flex items-start justify-between gap-3 px-4 pt-3 pb-2 ${
        locked ? 'bg-emerald-50/70' : 'bg-slate-50/80'
      }`}>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-extrabold uppercase tracking-wider ${
            locked ? 'text-emerald-800' : 'text-slate-700'
          }`}>
            {label}
          </p>
          {hint && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{hint}</p>
          )}
        </div>

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
      <div className="px-4 pb-3 pt-2 bg-white">
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

      {/* Validation indicator (section 2 only) */}
      {showValidation && (
        <ValidationIndicator
          status={validationStatus}
          how={validationHow}
          onStatusChange={onValidationStatusChange}
          onHowChange={onValidationHowChange}
        />
      )}

      {/* Comments toggle */}
      <div className="border-t border-slate-100 bg-slate-50/40">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-indigo-500 hover:bg-slate-50 transition text-left"
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          {comments.length > 0
            ? <span className="font-medium">{comments.length} {comments.length === 1 ? 'commento' : 'commenti'}</span>
            : <span>Commenta</span>
          }
          {showComments
            ? <ChevronDown className="w-3 h-3 ml-auto" />
            : <ChevronRight className="w-3 h-3 ml-auto" />
          }
        </button>

        {showComments && (
          <div className="px-4 pb-4 bg-white border-t border-slate-100">
            <div className="pt-3">
              <FieldComments
                comments={comments}
                authorName={authorName}
                setAuthorName={setAuthorName}
                onAdd={onAddComment}
                onDelete={onDeleteComment}
                projectManagers={projectManagers}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SectionPanel ─────────────────────────────────────────────────────────────

function SectionPanel({
  section, form, locked, onToggleLock, onChange,
  validationStatus, validationHow, onValidationStatusChange, onValidationHowChange,
  comments, authorName, setAuthorName, onAddComment, onDeleteComment,
}: {
  section: Section;
  form: ConceptTemplateData;
  locked: Set<string>;
  onToggleLock: (key: string) => void;
  onChange: (key: FieldKey, val: string) => void;
  validationStatus: Record<string, 'ipotesi' | 'validato'>;
  validationHow: Record<string, string>;
  onValidationStatusChange: (fieldKey: string, s: 'ipotesi' | 'validato') => void;
  onValidationHowChange: (fieldKey: string, v: string) => void;
  comments: Record<string, ConceptFieldComment[]>;
  authorName: string;
  setAuthorName: (v: string) => void;
  onAddComment: (fieldKey: string, parentId: string | null, body: string, mentions: string[]) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
  projectManagers?: ProjectManager[];
}) {
  const [open, setOpen] = useState(true);
  const approvedCount = section.fields.filter((f) => locked.has(f.key)).length;
  const total = section.fields.length;
  const allApproved = approvedCount === total && total > 0;

  return (
    <div className={`rounded-xl overflow-hidden border transition-colors ${
      allApproved ? 'border-emerald-400' : 'border-indigo-300'
    }`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition text-left ${
          allApproved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
        }`}
      >
        <span className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-4 h-4 text-white/70 shrink-0" />
            : <ChevronRight className="w-4 h-4 text-white/70 shrink-0" />
          }
          <span className="text-sm font-semibold text-white">{section.title}</span>
        </span>

        {approvedCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 text-white">
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
              fieldKey={f.key}
              label={f.label}
              hint={f.hint}
              rows={f.rows ?? 3}
              value={form[f.key] as string}
              locked={locked.has(f.key)}
              onToggleLock={() => onToggleLock(f.key)}
              onChange={(val) => onChange(f.key, val)}
              showValidation={f.showValidation}
              validationStatus={validationStatus[f.key]}
              validationHow={validationHow[f.key] ?? ''}
              onValidationStatusChange={(s) => onValidationStatusChange(f.key, s)}
              onValidationHowChange={(v) => onValidationHowChange(f.key, v)}
              comments={comments[f.key] ?? []}
              authorName={authorName}
              setAuthorName={setAuthorName}
              onAddComment={(parentId, body, mentions) => onAddComment(f.key, parentId, body, mentions)}
              onDeleteComment={onDeleteComment}
              projectManagers={projectManagers}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function ConceptTemplatePanel({ conceptId, data, onSave, projectManagers = [], currentUserName }: Props) {
  const [form, setForm] = useState<ConceptTemplateData>({
    ...EMPTY,
    ...(data ?? {}),
    locked_fields: data?.locked_fields ?? [],
    validation_status: data?.validation_status ?? {},
    validation_how: data?.validation_how ?? {},
  });
  const [locked, setLocked] = useState<Set<string>>(new Set(data?.locked_fields ?? []));
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseMsg, setParseMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<Record<string, ConceptFieldComment[]>>({});
  const [authorName, setAuthorName] = useState(() => localStorage.getItem('concept_comment_author') ?? '');

  const loadComments = useCallback(async () => {
    const list = await conceptFieldCommentsService.list(conceptId);
    setComments(
      list.reduce<Record<string, ConceptFieldComment[]>>((acc, c) => {
        (acc[c.field_key] ??= []).push(c);
        return acc;
      }, {}),
    );
  }, [conceptId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  function updateAuthorName(v: string) {
    setAuthorName(v);
    localStorage.setItem('concept_comment_author', v);
  }

  async function addComment(fieldKey: string, parentId: string | null, body: string, mentions: string[] = []) {
    await conceptFieldCommentsService.create(conceptId, {
      field_key: fieldKey,
      parent_id: parentId,
      author_name: authorName,
      body,
    });
    await loadComments();
    if (mentions.length > 0) {
      const pmById = new Map(projectManagers.map((p) => [p.id, p]));
      void sendMentionNotifications(mentions, pmById, currentUserName ?? authorName, body, window.location.href);
    }
  }

  async function deleteComment(id: string) {
    await conceptFieldCommentsService.remove(id);
    await loadComments();
  }

  function update(key: FieldKey, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function updateValidationStatus(fieldKey: string, s: 'ipotesi' | 'validato') {
    setForm((prev) => ({
      ...prev,
      validation_status: { ...prev.validation_status, [fieldKey]: s },
    }));
  }

  function updateValidationHow(fieldKey: string, v: string) {
    setForm((prev) => ({
      ...prev,
      validation_how: { ...prev.validation_how, [fieldKey]: v },
    }));
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
            validationStatus={form.validation_status}
            validationHow={form.validation_how}
            onValidationStatusChange={updateValidationStatus}
            onValidationHowChange={updateValidationHow}
            comments={comments}
            authorName={authorName}
            setAuthorName={updateAuthorName}
            onAddComment={addComment}
            onDeleteComment={deleteComment}
            projectManagers={projectManagers}
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
