import { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, Handshake, Trash2, UserPlus, Users, X } from 'lucide-react';
import Avatar from '../Avatar';
import Modal from '../Modal';
import { offerAssigneesService } from '../../lib/dataService';
import type { OfferAssignee, OfferAssigneeRole, ProjectManager } from '../../types';

interface Props {
  offerId: string;
  projectManagers: ProjectManager[];
}

const ROLE_META: Record<OfferAssigneeRole, {
  label: string; short: string; Icon: typeof Crown;
  cardCls: string; badgeCls: string; iconWrap: string;
}> = {
  responsabile: {
    label: 'Responsabile',
    short: 'Responsabile del progetto',
    Icon: Crown,
    cardCls: 'bg-indigo-50/50 border-indigo-200',
    badgeCls: 'bg-indigo-600 text-white',
    iconWrap: 'bg-indigo-100 text-indigo-600',
  },
  membro: {
    label: 'Team member',
    short: 'Team member',
    Icon: Users,
    cardCls: 'bg-slate-50 border-slate-200',
    badgeCls: 'bg-slate-500 text-white',
    iconWrap: 'bg-slate-100 text-slate-500',
  },
  fundraising: {
    label: 'Referente fundraising',
    short: 'Fundraising',
    Icon: Handshake,
    cardCls: 'bg-emerald-50/50 border-emerald-200',
    badgeCls: 'bg-emerald-600 text-white',
    iconWrap: 'bg-emerald-100 text-emerald-600',
  },
};

const ORDER: OfferAssigneeRole[] = ['responsabile', 'fundraising', 'membro'];

export default function OfferTeamPanel({ offerId, projectManagers }: Props) {
  const [assignees, setAssignees] = useState<OfferAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const pmById = useMemo(() => new Map(projectManagers.map((p) => [p.id, p])), [projectManagers]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await offerAssigneesService.list(offerId);
      setAssignees(list);
    } finally { setLoading(false); }
  }, [offerId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleAdd(pmId: string, role: OfferAssigneeRole) {
    setBusyKey(`add:${pmId}`);
    try {
      // Se ruolo "responsabile" o "fundraising": rimuovi eventuale precedente detentore del ruolo
      if (role === 'responsabile' || role === 'fundraising') {
        const holder = assignees.find((a) => a.role === role);
        if (holder && holder.project_manager_id !== pmId) {
          await offerAssigneesService.setRole(offerId, holder.project_manager_id, 'membro');
        }
      }
      await offerAssigneesService.add(offerId, pmId, role);
      await reload();
      setAddOpen(false);
    } finally { setBusyKey(null); }
  }

  async function handleChangeRole(a: OfferAssignee, role: OfferAssigneeRole) {
    if (a.role === role) return;
    setBusyKey(`role:${a.project_manager_id}`);
    try {
      // Se il nuovo ruolo è responsabile o fundraising: prima libera il vecchio detentore
      if (role === 'responsabile' || role === 'fundraising') {
        const holder = assignees.find((x) => x.role === role && x.project_manager_id !== a.project_manager_id);
        if (holder) await offerAssigneesService.setRole(offerId, holder.project_manager_id, 'membro');
      }
      await offerAssigneesService.setRole(offerId, a.project_manager_id, role);
      await reload();
    } finally { setBusyKey(null); }
  }

  async function handleRemove(a: OfferAssignee) {
    if (!confirm(`Rimuovere ${a.project_manager?.name ?? 'questo membro'} dal team?`)) return;
    setBusyKey(`del:${a.project_manager_id}`);
    try {
      await offerAssigneesService.remove(offerId, a.project_manager_id);
      await reload();
    } finally { setBusyKey(null); }
  }

  // Raggruppa per ruolo
  const grouped = useMemo(() => {
    const m: Record<OfferAssigneeRole, OfferAssignee[]> = { responsabile: [], membro: [], fundraising: [] };
    for (const a of assignees) m[a.role].push(a);
    for (const key of Object.keys(m) as OfferAssigneeRole[]) {
      m[key].sort((a, b) => {
        const na = a.project_manager?.name ?? pmById.get(a.project_manager_id)?.name ?? '';
        const nb = b.project_manager?.name ?? pmById.get(b.project_manager_id)?.name ?? '';
        return na.localeCompare(nb, 'it');
      });
    }
    return m;
  }, [assignees, pmById]);

  const assignedIds = new Set(assignees.map((a) => a.project_manager_id));
  const available = projectManagers.filter((p) => p.active && !assignedIds.has(p.id));

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          Team di lavoro
          {assignees.length > 0 && (
            <span className="text-xs font-medium text-slate-400">
              ({assignees.length} {assignees.length === 1 ? 'persona' : 'persone'})
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          disabled={available.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 border border-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Aggiungi
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 italic text-center py-4">Caricamento…</p>
      ) : assignees.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">
          Nessun membro assegnato. Clicca "Aggiungi" per definire responsabile, team e referente fundraising.
        </p>
      ) : (
        <div className="space-y-3">
          {ORDER.map((role) => {
            const items = grouped[role];
            if (items.length === 0) return null;
            const meta = ROLE_META[role];
            const Icon = meta.Icon;
            return (
              <div key={role} className={`rounded-xl border p-3 ${meta.cardCls}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${meta.iconWrap}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{meta.label}</span>
                  {items.length > 1 && (
                    <span className="text-[10px] text-slate-500 tabular-nums">· {items.length}</span>
                  )}
                </div>

                <ul className="space-y-1.5">
                  {items.map((a) => {
                    const pm = a.project_manager ?? pmById.get(a.project_manager_id) ?? null;
                    if (!pm) return null;
                    const isBusy = busyKey?.endsWith(a.project_manager_id) ?? false;
                    return (
                      <li key={a.project_manager_id} className="flex items-center gap-3 px-2.5 py-2 bg-white/80 rounded-lg border border-white">
                        <Avatar name={pm.name} url={pm.avatar_url} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{pm.name}</p>
                          {pm.email && <p className="text-[11px] text-slate-400 truncate">{pm.email}</p>}
                        </div>

                        {/* Selettore ruolo compatto */}
                        <select
                          disabled={isBusy}
                          value={a.role}
                          onChange={(e) => void handleChangeRole(a, e.target.value as OfferAssigneeRole)}
                          className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                        >
                          <option value="responsabile">Responsabile</option>
                          <option value="fundraising">Fundraising</option>
                          <option value="membro">Team member</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => void handleRemove(a)}
                          disabled={isBusy}
                          className="text-slate-300 hover:text-red-500 transition shrink-0 disabled:opacity-50"
                          title="Rimuovi dal team"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <AddMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        available={available}
        hasResponsabile={grouped.responsabile.length > 0}
        hasFundraising={grouped.fundraising.length > 0}
        onAdd={handleAdd}
        busyKey={busyKey}
      />
    </div>
  );
}

// ── Modale di aggiunta ────────────────────────────────────────────────────────
interface AddMemberModalProps {
  open: boolean;
  onClose: () => void;
  available: ProjectManager[];
  hasResponsabile: boolean;
  hasFundraising: boolean;
  onAdd: (pmId: string, role: OfferAssigneeRole) => Promise<void>;
  busyKey: string | null;
}

function AddMemberModal({
  open, onClose, available, hasResponsabile, hasFundraising, onAdd, busyKey,
}: AddMemberModalProps) {
  const [selectedPmId, setSelectedPmId] = useState<string | null>(null);
  const [role, setRole] = useState<OfferAssigneeRole>('membro');

  useEffect(() => {
    if (open) { setSelectedPmId(null); setRole('membro'); }
  }, [open]);

  async function submit() {
    if (!selectedPmId) return;
    await onAdd(selectedPmId, role);
  }

  return (
    <Modal open={open} onClose={onClose} title="Aggiungi al team" size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Persona</label>
          {available.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Tutti i PM attivi sono già nel team.</p>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
              {available.map((pm) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setSelectedPmId(pm.id)}
                  className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border text-xs font-medium transition-all ${
                    selectedPmId === pm.id
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  <Avatar name={pm.name} url={pm.avatar_url} size="xs" />
                  {pm.name}
                  {selectedPmId === pm.id && <X className="w-3 h-3 opacity-70" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Ruolo</label>
          <div className="flex flex-wrap gap-2">
            <RoleChip
              role="responsabile" active={role === 'responsabile'} onSelect={setRole}
              hint={hasResponsabile ? 'sostituirà l\'attuale responsabile' : undefined}
            />
            <RoleChip
              role="fundraising" active={role === 'fundraising'} onSelect={setRole}
              hint={hasFundraising ? 'sostituirà l\'attuale referente' : undefined}
            />
            <RoleChip role="membro" active={role === 'membro'} onSelect={setRole} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
            Annulla
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!selectedPmId || busyKey !== null}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-60 transition"
          >
            {busyKey ? 'Aggiungo…' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RoleChip({
  role, active, onSelect, hint,
}: {
  role: OfferAssigneeRole; active: boolean; onSelect: (r: OfferAssigneeRole) => void; hint?: string;
}) {
  const meta = ROLE_META[role];
  const Icon = meta.Icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(role)}
      className={`flex flex-col items-start gap-1 px-3 py-2 rounded-xl border-2 transition text-left min-w-32 ${
        active ? meta.cardCls.replace('/50', '') + ' shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-xs font-semibold text-slate-800">{meta.label}</span>
      </div>
      {hint && <span className="text-[10px] text-amber-700">⚠ {hint}</span>}
    </button>
  );
}
