import { useNavigate } from 'react-router-dom';
import { ArrowRight, FlaskConical, Plus, Users } from 'lucide-react';

interface PipelineEntity {
  id: string;
  label: string;
}

interface Props {
  current: 'lead' | 'concept' | 'offer';
  lead: PipelineEntity | null;
  concept: PipelineEntity | null;
  offer: PipelineEntity | null;
  onCreateConcept?: () => void;
  onCreateOffer?: () => void;
}

const STAGE_META = {
  lead:    { label: 'Lead',    path: '/leads',    color: 'sky',     Icon: Users },
  concept: { label: 'Concept', path: '/concepts', color: 'indigo',  Icon: FlaskConical },
  offer:   { label: 'Offerta', path: '/offerte',  color: 'emerald', Icon: ArrowRight },
} as const;

type Stage = keyof typeof STAGE_META;

const COLOR = {
  sky:     { ring: 'ring-sky-200',     bg: 'bg-sky-50',     text: 'text-sky-700',     btnBg: 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100' },
  indigo:  { ring: 'ring-indigo-200',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  btnBg: 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100' },
  emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', btnBg: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
} as const;

export default function ProjectPipelineCard({ current, lead, concept, offer, onCreateConcept, onCreateOffer }: Props) {
  const navigate = useNavigate();

  const entities: Record<Stage, PipelineEntity | null> = { lead, concept, offer };

  function StageNode({ stage }: { stage: Stage }) {
    const meta = STAGE_META[stage];
    const entity = entities[stage];
    const isCurrent = stage === current;
    const col = COLOR[meta.color];

    if (isCurrent) {
      return (
        <div className={`flex-1 rounded-xl border-2 ${col.ring} ${col.bg} px-3 py-2.5 text-center`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${col.text} mb-1`}>{meta.label}</p>
          <p className="text-xs font-semibold text-slate-700 truncate">— corrente —</p>
        </div>
      );
    }

    if (entity) {
      return (
        <button
          onClick={() => navigate(`${meta.path}/${entity.id}`)}
          className={`flex-1 rounded-xl border ${col.ring} ${col.bg} px-3 py-2.5 text-center hover:ring-2 transition group`}
        >
          <p className={`text-[10px] font-bold uppercase tracking-widest ${col.text} mb-1`}>{meta.label}</p>
          <p className="text-xs font-semibold text-slate-800 truncate group-hover:underline">{entity.label}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Vai →</p>
        </button>
      );
    }

    const canCreate = (stage === 'concept' && onCreateConcept) || (stage === 'offer' && onCreateOffer);

    return (
      <div className="flex-1 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2.5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{meta.label}</p>
        {canCreate ? (
          <button
            onClick={stage === 'concept' ? onCreateConcept : onCreateOffer}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition mt-0.5"
          >
            <Plus className="w-3 h-3" /> Crea
          </button>
        ) : (
          <p className="text-[11px] text-slate-300">—</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pipeline del progetto</p>
      <div className="flex items-center gap-2">
        <StageNode stage="lead" />
        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
        <StageNode stage="concept" />
        <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
        <StageNode stage="offer" />
      </div>
    </div>
  );
}
