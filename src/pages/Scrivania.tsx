import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign, CalendarClock, CheckCircle2, CheckSquare,
  FlaskConical, Square, UserSearch,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import { useOffersData } from '../hooks/useOffersData';
import {
  tasksService, conceptsService, leadCandidatesService,
  conceptDeadlinesService,
} from '../lib/dataService';
import { formatDate } from '../lib/format';
import type { Concept, ConceptRevisionDeadline, LeadCandidate, Task } from '../types';

// ── helpers ─────────────────────────────────────────────────────

function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function deadlineBadge(iso: string) {
  const d = daysFromNow(iso);
  if (d < 0)   return { cls: 'bg-red-100 text-red-700',    label: `${Math.abs(d)} gg fa` };
  if (d === 0) return { cls: 'bg-red-100 text-red-700',    label: 'oggi!' };
  if (d <= 7)  return { cls: 'bg-amber-100 text-amber-700', label: `tra ${d} gg` };
  if (d <= 30) return { cls: 'bg-yellow-100 text-yellow-700', label: `tra ${d} gg` };
  return       { cls: 'bg-slate-100 text-slate-600',        label: `tra ${d} gg` };
}

function greeting(name: string) {
  const h = new Date().getHours();
  const saluto = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buona sera';
  return `${saluto}, ${name}!`;
}

// ── sub-components ───────────────────────────────────────────────

function Section({ title, icon: Icon, count, children, empty }: {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
  empty?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100">
        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
        <h2 className="text-sm font-semibold text-slate-900 flex-1">{title}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold tabular-nums">{count}</span>
      </div>
      {count === 0
        ? <p className="px-5 py-8 text-xs text-slate-400 italic text-center">{empty ?? 'Niente da mostrare.'}</p>
        : <div className="divide-y divide-slate-100">{children}</div>
      }
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────

export default function Scrivania() {
  const navigate = useNavigate();
  const { currentPm, user } = useAuth();
  const { notifications } = useNotifications();
  const { fundingCalls } = useOffersData();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [leads, setLeads] = useState<LeadCandidate[]>([]);
  const [revDeadlines, setRevDeadlines] = useState<ConceptRevisionDeadline[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, c, l, rd] = await Promise.all([
        tasksService.list(),
        conceptsService.list(),
        leadCandidatesService.list(),
        conceptDeadlinesService.listAll(),
      ]);
      setTasks(t);
      setConcepts(c);
      setLeads(l);
      setRevDeadlines(rd);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── derived data ─────────────────────────────────────────────

  const pmId = currentPm?.id ?? null;
  const displayName = currentPm?.name ?? user?.email?.split('@')[0] ?? 'Utente';

  const myTasks = useMemo(
    () => tasks.filter((t) => t.pm_id === pmId),
    [tasks, pmId],
  );

  const myOpenTasks = useMemo(() => myTasks.filter((t) => !t.completed), [myTasks]);

  const myConcepts = useMemo(
    () => concepts.filter((c) =>
      (c.assignees ?? []).some((a) => a.project_manager_id === pmId && a.role !== 'Panelist'),
    ),
    [concepts, pmId],
  );

  const myLeads = useMemo(
    () => leads.filter((l) => l.pm_id === pmId),
    [leads, pmId],
  );

  const myConceptIds = useMemo(() => new Set(myConcepts.map((c) => c.id)), [myConcepts]);

  const fcById = useMemo(() => new Map(fundingCalls.map((fc) => [fc.id, fc])), [fundingCalls]);

  // all upcoming deadlines relevant to me
  const upcomingDeadlines = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const items: Array<{
      id: string;
      label: string;
      conceptName: string;
      conceptId: string;
      due_date: string;
      completed: boolean;
    }> = [];

    // concept main deadlines
    myConcepts.forEach((c) => {
      if (c.deadline) {
        items.push({
          id: `concept-${c.id}`,
          label: 'Scadenza concept',
          conceptName: c.name,
          conceptId: c.id,
          due_date: c.deadline,
          completed: false,
        });
      }
    });

    // revision deadlines
    revDeadlines
      .filter((d) => myConceptIds.has(d.concept_id))
      .forEach((d) => {
        const c = myConcepts.find((x) => x.id === d.concept_id);
        items.push({
          id: d.id,
          label: d.label,
          conceptName: c?.name ?? '—',
          conceptId: d.concept_id,
          due_date: d.due_date,
          completed: d.completed,
        });
      });

    return items
      .filter((d) => !d.completed && d.due_date >= today)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 20);
  }, [myConcepts, revDeadlines, myConceptIds]);

  const overdueDeadlines = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const items: typeof upcomingDeadlines = [];
    myConcepts.forEach((c) => {
      if (c.deadline && c.deadline < today) {
        items.push({ id: `concept-${c.id}`, label: 'Scadenza concept', conceptName: c.name, conceptId: c.id, due_date: c.deadline, completed: false });
      }
    });
    revDeadlines
      .filter((d) => myConceptIds.has(d.concept_id) && !d.completed && d.due_date < today)
      .forEach((d) => {
        const c = myConcepts.find((x) => x.id === d.concept_id);
        items.push({ id: d.id, label: d.label, conceptName: c?.name ?? '—', conceptId: d.concept_id, due_date: d.due_date, completed: false });
      });
    return items.sort((a, b) => b.due_date.localeCompare(a.due_date));
  }, [myConcepts, revDeadlines, myConceptIds]);

  const allDeadlines = [...overdueDeadlines, ...upcomingDeadlines];

  const mentionNotifs = useMemo(
    () => notifications.filter((n) => n.type === 'comment_mention').slice(0, 10),
    [notifications],
  );

  async function toggleTask(task: Task) {
    await tasksService.setCompleted(task.id, !task.completed);
    await load();
  }

  const entityPath: Record<string, string> = { lead: '/leads', concept: '/concepts', offer: '/offerte' };

  if (!currentPm && !loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center">
        <p className="text-sm text-slate-500">
          Nessun profilo PM collegato a questo account. Chiedi a un amministratore di associare il tuo indirizzo email a un membro del team.
        </p>
      </div>
    );
  }

  // ── summary kpi chips ──────────────────────────────────────

  const kpis = [
    {
      label: 'Task aperti',
      value: myOpenTasks.length,
      sub: `${myTasks.filter((t) => t.due_date && daysFromNow(t.due_date) <= 7 && !t.completed).length} in scadenza`,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      iconColor: 'text-indigo-500',
      Icon: CheckSquare,
    },
    {
      label: 'Scadenze imminenti',
      value: upcomingDeadlines.filter((d) => daysFromNow(d.due_date) <= 14).length,
      sub: `${overdueDeadlines.length} scadute`,
      color: overdueDeadlines.length > 0 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100',
      iconColor: overdueDeadlines.length > 0 ? 'text-red-500' : 'text-amber-500',
      Icon: CalendarClock,
    },
    {
      label: 'Miei progetti',
      value: myLeads.filter((l) => l.status === 'attivo').length + myConcepts.filter((c) => c.status === 'in_valutazione').length,
      sub: 'lead attivi + concept',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      iconColor: 'text-emerald-500',
      Icon: FlaskConical,
    },
    {
      label: 'Menzioni non lette',
      value: mentionNotifs.filter((n) => !n.read).length,
      sub: `${mentionNotifs.length} recenti`,
      color: 'bg-violet-50 text-violet-700 border-violet-100',
      iconColor: 'text-violet-500',
      Icon: AtSign,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          {loading ? 'Scrivania' : greeting(displayName)}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-12 text-center text-sm text-slate-400">Caricamento…</div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(({ label, value, sub, color, iconColor, Icon }) => (
              <div key={label} className={`rounded-2xl border px-4 py-3.5 flex items-center gap-3 ${color}`}>
                <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70 truncate">{label}</p>
                  <p className="text-2xl font-extrabold tabular-nums leading-tight">{value}</p>
                  <p className="text-[11px] opacity-60 truncate">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

            {/* ── Task ─────────────────────────────────────────── */}
            <Section title="I miei task" icon={CheckSquare} count={myOpenTasks.length} empty="Nessun task aperto — ottimo lavoro!">
              {myOpenTasks
                .sort((a, b) => {
                  if (!a.due_date && !b.due_date) return 0;
                  if (!a.due_date) return 1;
                  if (!b.due_date) return -1;
                  return a.due_date.localeCompare(b.due_date);
                })
                .map((task) => {
                  const badge = task.due_date ? deadlineBadge(task.due_date) : null;
                  const entityLink = task.entity_id && task.entity_type
                    ? `${entityPath[task.entity_type]}/${task.entity_id}`
                    : null;
                  return (
                    <div key={task.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition group">
                      <button
                        onClick={() => void toggleTask(task)}
                        className="mt-0.5 shrink-0 text-slate-300 hover:text-indigo-600 transition"
                        title="Segna come completato"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 leading-snug">{task.title}</p>
                        {task.body && <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{task.body}</p>}
                        {entityLink && (
                          <button
                            onClick={() => navigate(entityLink)}
                            className="text-xs text-indigo-500 hover:underline mt-0.5"
                          >
                            {task.entity_type === 'lead' ? 'Lead' : task.entity_type === 'concept' ? 'Concept' : 'Offerta'} →
                          </button>
                        )}
                      </div>
                      {badge && (
                        <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-lg tabular-nums ${badge.cls}`}>
                          {task.due_date && formatDate(task.due_date)} · {badge.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              {myTasks.filter((t) => t.completed).length > 0 && (
                <div className="px-5 py-2 bg-slate-50 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    {myTasks.filter((t) => t.completed).length} task completati (nascosti)
                  </p>
                </div>
              )}
            </Section>

            {/* ── Scadenze ─────────────────────────────────────── */}
            <Section title="Scadenze" icon={CalendarClock} count={allDeadlines.length} empty="Nessuna scadenza nei prossimi 30 giorni.">
              {allDeadlines.map((d) => {
                const badge = deadlineBadge(d.due_date);
                const overdue = daysFromNow(d.due_date) < 0;
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition cursor-pointer"
                    onClick={() => navigate(`/concepts/${d.conceptId}`)}
                  >
                    <CalendarClock className={`w-4 h-4 shrink-0 ${overdue ? 'text-red-400' : 'text-amber-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{d.label}</p>
                      <p className="text-xs text-slate-500 truncate">{d.conceptName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">{formatDate(d.due_date)}</p>
                      <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${badge.cls}`}>{badge.label}</span>
                    </div>
                  </div>
                );
              })}
            </Section>

            {/* ── I miei progetti ──────────────────────────────── */}
            <Section
              title="I miei progetti"
              icon={FlaskConical}
              count={myConcepts.length + myLeads.filter((l) => l.status !== 'archiviato').length}
              empty="Nessun progetto assegnato."
            >
              {/* Concepts */}
              {myConcepts.map((c) => {
                const ispm = (c.assignees ?? []).find((a) => a.project_manager_id === pmId)?.role === 'Project Manager';
                const fc = c.funding_call_id ? fcById.get(c.funding_call_id) : null;
                const statusCls = c.status === 'promosso'
                  ? 'bg-emerald-100 text-emerald-700'
                  : c.status === 'rifiutato'
                  ? 'bg-slate-100 text-slate-500'
                  : 'bg-amber-100 text-amber-700';
                const statusLabel = c.status === 'promosso' ? 'Promosso' : c.status === 'rifiutato' ? 'Rifiutato' : 'In valutazione';
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/concepts/${c.id}`)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <FlaskConical className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {ispm && <span className="text-indigo-600 font-semibold">PM · </span>}
                        {fc ? fc.code : 'Nessun bando'}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                  </div>
                );
              })}
              {/* Leads */}
              {myLeads.filter((l) => l.status !== 'archiviato').map((l) => {
                const statusCls = l.status === 'promosso' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700';
                const statusLabel = l.status === 'promosso' ? 'Promosso' : 'Attivo';
                return (
                  <div
                    key={l.id}
                    onClick={() => navigate(`/leads/${l.id}`)}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <UserSearch className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{l.researcher_name}</p>
                      <p className="text-xs text-slate-400 truncate">Lead · {l.institution ?? 'Nessuna istituzione'}</p>
                    </div>
                    <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
                  </div>
                );
              })}
            </Section>

            {/* ── Menzioni ─────────────────────────────────────── */}
            <Section title="Menzioni recenti" icon={AtSign} count={mentionNotifs.length} empty="Nessuna menzione recente.">
              {mentionNotifs.map((n) => {
                const entityLink = n.entity_type && n.entity_id
                  ? `${entityPath[n.entity_type]}/${n.entity_id}`
                  : null;
                return (
                  <div
                    key={n.id}
                    onClick={() => entityLink && navigate(entityLink)}
                    className={`flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition ${entityLink ? 'cursor-pointer' : ''} ${!n.read ? 'bg-violet-50/40' : ''}`}
                  >
                    <AtSign className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-2">{n.body ?? n.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-violet-500 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </Section>

          </div>

          {/* Completed tasks (collapsed section at bottom) */}
          {myTasks.filter((t) => t.completed).length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <h2 className="text-sm font-semibold text-slate-700 flex-1">Task completati</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">{myTasks.filter((t) => t.completed).length}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {myTasks.filter((t) => t.completed).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-2.5 opacity-50">
                    <button
                      onClick={() => void toggleTask(task)}
                      className="shrink-0 text-emerald-500"
                      title="Riapri task"
                    >
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <p className="text-sm text-slate-500 line-through flex-1 truncate">{task.title}</p>
                    {task.due_date && <span className="text-xs text-slate-400 shrink-0">{formatDate(task.due_date)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
