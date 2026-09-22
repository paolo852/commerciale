import { Crown, Handshake } from 'lucide-react';
import Avatar from '../Avatar';
import type { OfferAssignee, OfferAssigneeRole, ProjectManager } from '../../types';

interface Props {
  assignees: OfferAssignee[];
  pmById: Map<string, ProjectManager>;
  fallbackPm?: ProjectManager | null;   // PM legacy sull'offerta se manca il team
  maxVisible?: number;
}

const ROLE_ORDER: Record<OfferAssigneeRole, number> = {
  responsabile: 0,
  fundraising: 1,
  membro: 2,
};

const ROLE_LABEL: Record<OfferAssigneeRole, string> = {
  responsabile: 'Responsabile',
  fundraising: 'Fundraising',
  membro: 'Team member',
};

export default function TeamAvatarStack({ assignees, pmById, fallbackPm, maxVisible = 4 }: Props) {
  // Fallback: nessun team assegnato ma esiste un PM sull'offerta
  if (assignees.length === 0) {
    if (fallbackPm) {
      return (
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar name={fallbackPm.name} url={fallbackPm.avatar_url} size="xs" />
          <span className="text-xs text-slate-500 truncate italic">{fallbackPm.name}</span>
        </div>
      );
    }
    return <span className="text-slate-300 text-xs">—</span>;
  }

  const sorted = [...assignees].sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
  );

  const visible = sorted.slice(0, maxVisible);
  const extra = sorted.length - visible.length;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((a) => {
        const pm = a.project_manager ?? pmById.get(a.project_manager_id);
        if (!pm) return null;
        const isLead = a.role === 'responsabile';
        const isFund = a.role === 'fundraising';
        return (
          <div
            key={a.project_manager_id}
            className="relative"
            title={`${pm.name} · ${ROLE_LABEL[a.role]}`}
          >
            <div className={`rounded-full ring-2 ${
              isLead ? 'ring-indigo-500'
              : isFund ? 'ring-emerald-500'
              : 'ring-white'
            }`}>
              <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
            </div>
            {isLead && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border border-white flex items-center justify-center">
                <Crown className="w-2 h-2 text-white" />
              </span>
            )}
            {isFund && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-600 border border-white flex items-center justify-center">
                <Handshake className="w-2 h-2 text-white" />
              </span>
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 border-2 border-white text-[10px] font-bold tabular-nums text-slate-600"
          title={`Altri ${extra} membri`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
