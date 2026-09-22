import Avatar from '../Avatar';
import type { OfferAssignee, ProjectManager } from '../../types';

// ── Cella per ruolo singolo (Responsabile / Fundraising): un solo nome ────────
interface SingleRoleCellProps {
  assignee: OfferAssignee | undefined;
  pmById: Map<string, ProjectManager>;
  fallbackPm?: ProjectManager | null;
  fallbackItalic?: boolean;   // true = mostra fallback in corsivo (PM legacy)
}

export function TeamRoleCell({ assignee, pmById, fallbackPm, fallbackItalic }: SingleRoleCellProps) {
  const pm = assignee
    ? assignee.project_manager ?? pmById.get(assignee.project_manager_id) ?? null
    : fallbackPm ?? null;

  if (!pm) return <span className="text-slate-300 text-xs">—</span>;

  return (
    <div className="flex items-center gap-1.5 min-w-0" title={pm.email ?? pm.name}>
      <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
      <span className={`text-xs truncate ${
        fallbackItalic && !assignee ? 'italic text-slate-400' : 'text-slate-700'
      }`}>
        {pm.name}
      </span>
    </div>
  );
}

// ── Cella per team members (multi-nome) ──────────────────────────────────────
interface TeamMembersCellProps {
  assignees: OfferAssignee[];
  pmById: Map<string, ProjectManager>;
  maxVisible?: number;
}

export function TeamMembersCell({ assignees, pmById, maxVisible = 3 }: TeamMembersCellProps) {
  if (assignees.length === 0) return <span className="text-slate-300 text-xs">—</span>;

  const pms = assignees
    .map((a) => a.project_manager ?? pmById.get(a.project_manager_id) ?? null)
    .filter((p): p is ProjectManager => p != null)
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));

  const visible = pms.slice(0, maxVisible);
  const extra = pms.length - visible.length;
  const fullList = pms.map((p) => p.name).join(', ');

  return (
    <div className="flex flex-col gap-0.5 min-w-0" title={fullList}>
      {visible.map((pm) => (
        <div key={pm.id} className="flex items-center gap-1.5 min-w-0">
          <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
          <span className="text-xs text-slate-700 truncate">{pm.name}</span>
        </div>
      ))}
      {extra > 0 && (
        <span className="text-[10px] text-slate-400 pl-1 tabular-nums">
          + altri {extra}
        </span>
      )}
    </div>
  );
}
