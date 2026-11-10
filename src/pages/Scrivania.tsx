import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign, CalendarClock, CheckCircle2, CheckSquare, FileText, FolderOpen, Mail, Pencil,
  Send, Square, TrendingUp, Trophy,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOffersData } from '../hooks/useOffersData';
import {
  tasksService, findMentionsForPm, type MentionResult,
} from '../lib/dataService';
import { offerYear } from '../lib/analytics';
import { formatDate, formatEUR } from '../lib/format';
import type { FundingCall, Offer, Task } from '../types';

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

function compactEUR(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
  return formatEUR(value);
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
  const { currentPm, currentPmReady, user } = useAuth();
  const { fundingCalls, offers } = useOffersData();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [mentions, setMentions] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (pmName?: string) => {
    setLoading(true);
    try {
      const [t, m] = await Promise.all([
        tasksService.list(),
        pmName ? findMentionsForPm(pmName) : Promise.resolve<MentionResult[]>([]),
      ]);
      setTasks(t);
      setMentions(m);
    } finally {
      setLoading(false);
    }
  }, []);

  // Wait for currentPm to be resolved before loading so we can fetch mentions
  useEffect(() => {
    if (currentPmReady) void load(currentPm?.name);
  }, [currentPmReady, currentPm?.name, load]);

  // ── derived data ─────────────────────────────────────────────

  const pmId = currentPm?.id ?? null;
  const displayName = currentPm?.name ?? user?.email?.split('@')[0] ?? 'Utente';

  const myTasks = useMemo(
    () => tasks.filter((t) => t.pm_id === pmId),
    [tasks, pmId],
  );

  const myOpenTasks = useMemo(() => myTasks.filter((t) => !t.completed), [myTasks]);

  const fcById = useMemo(() => new Map(fundingCalls.map((fc) => [fc.id, fc])), [fundingCalls]);

  const currentYear = new Date().getFullYear();

  const myOffers = useMemo(
    () => offers.filter((o) => o.project_manager_id === pmId),
    [offers, pmId],
  );

  const approvedThisYear = useMemo(
    () => offers.filter((o) => o.outcome === 'approvato' && offerYear(o) === currentYear),
    [offers, currentYear],
  );
  const revenueThisYear = useMemo(
    () => approvedThisYear.reduce((s, o) => s + o.budget, 0),
    [approvedThisYear],
  );

  // Ricavo potenziale: offerte in attesa (status=presentata, outcome=nessuno) ponderato dalla probabilità
  const potentialRevenue = useMemo(
    () => myOffers
      .filter((o) => o.outcome === 'nessuno' && o.status === 'presentata')
      .reduce((s, o) => s + o.budget * (o.probability ?? 50) / 100, 0),
    [myOffers],
  );

  async function toggleTask(task: Task) {
    await tasksService.setCompleted(task.id, !task.completed);
    await load();
  }

  const entityPath: Record<string, string> = { offer: '/offerte' };

  if (currentPmReady && !currentPm) {
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
      label: 'Task in scadenza',
      value: myTasks.filter((t) => t.due_date && daysFromNow(t.due_date) <= 7 && !t.completed).length,
      sub: `${myTasks.filter((t) => t.due_date && daysFromNow(t.due_date) < 0 && !t.completed).length} scaduti`,
      color: 'bg-amber-50 text-amber-700 border-amber-100',
      iconColor: 'text-amber-500',
      Icon: CalendarClock,
    },
    {
      label: 'Ricavo potenziale',
      value: compactEUR(potentialRevenue),
      sub: 'dalle offerte in attesa (ponderate)',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      iconColor: 'text-emerald-500',
      Icon: TrendingUp,
    },
    {
      label: 'Menzioni recenti',
      value: mentions.length,
      sub: mentions.length === 1 ? '1 commento' : `${mentions.length} commenti`,
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
          {/* Risultati anno — banner prominente */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-4 flex-1 min-w-[160px]">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 opacity-80">Approvate {currentYear}</p>
                <p className="text-4xl font-black tabular-nums text-emerald-700 leading-tight">{approvedThisYear.length}</p>
                <p className="text-xs text-emerald-600 opacity-70">progetti vinti</p>
              </div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-emerald-200 shrink-0" />
            <div className="flex items-center gap-4 flex-1 min-w-[160px]">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-teal-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 opacity-80">Ricavo {currentYear}</p>
                <p className="text-4xl font-black tabular-nums text-teal-700 leading-tight">{compactEUR(revenueThisYear)}</p>
                <p className="text-xs text-teal-600 opacity-70">da offerte approvate</p>
              </div>
            </div>
          </div>

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

          {/* ── Portafoglio: Le mie offerte ────────────────────── */}
          <MyOffersPortfolio
            offers={myOffers}
            fcById={fcById}
            onOpen={(id) => navigate(`/offerte/${id}`)}
          />

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
                            Offerta →
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

            {/* ── Menzioni ─────────────────────────────────────── */}
            <Section title="Menzioni recenti" icon={AtSign} count={mentions.filter((m) => m.entity_type !== 'concept' && m.entity_type !== 'lead').length} empty="Nessuna menzione recente nei commenti.">
              {mentions.filter((m) => m.entity_type !== 'concept' && m.entity_type !== 'lead').map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`${entityPath[m.entity_type]}/${m.entity_id}`)}
                  className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition cursor-pointer"
                >
                  <AtSign className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">{m.author_name} · {formatDate(m.created_at)}</p>
                    <p className="text-sm text-slate-700 leading-snug line-clamp-2">{m.body}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    Offerta
                  </span>
                </div>
              ))}
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

// ── Portafoglio offerte del PM ────────────────────────────────────────────────

type OffersTab = 'lavorazione' | 'presentate';

function MyOffersPortfolio({
  offers, fcById, onOpen,
}: {
  offers: Offer[];
  fcById: Map<string, FundingCall>;
  onOpen: (id: string) => void;
}) {
  const [tab, setTab] = useState<OffersTab>('lavorazione');

  const preparing = offers.filter((o) => o.outcome === 'nessuno' && o.status === 'in_lavorazione');
  const presented = offers.filter((o) => o.outcome === 'nessuno' && o.status === 'presentata');
  const won       = offers.filter((o) => o.outcome === 'approvato');

  const sorted = (tab === 'lavorazione' ? preparing : presented)
    .slice()
    .sort((a, b) => a.deadline.localeCompare(b.deadline));

  // Se non ci sono in lavorazione ma ce ne sono presentate, apri direttamente quella tab
  useEffect(() => {
    if (preparing.length === 0 && presented.length > 0 && tab === 'lavorazione') {
      setTab('presentate');
    }
  }, [preparing.length, presented.length, tab]);

  if (offers.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-10 text-center">
        <FileText className="w-10 h-10 text-slate-200 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Nessuna offerta assegnata a te come PM.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header + tab */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Le mie offerte</p>
            <p className="text-xs text-slate-500 tabular-nums mt-0.5">
              <strong className="text-emerald-600">{won.length}</strong> approvate quest'anno
            </p>
          </div>
        </div>

        {/* Tab interni */}
        <div className="inline-flex gap-1 bg-slate-100 p-1 rounded-xl">
          <TabButton
            active={tab === 'lavorazione'}
            onClick={() => setTab('lavorazione')}
            Icon={Pencil}
            label="In lavorazione"
            count={preparing.length}
            activeColor="bg-white text-indigo-700"
            badgeActive="bg-indigo-100 text-indigo-700"
          />
          <TabButton
            active={tab === 'presentate'}
            onClick={() => setTab('presentate')}
            Icon={Send}
            label="Presentate"
            count={presented.length}
            activeColor="bg-white text-amber-700"
            badgeActive="bg-amber-100 text-amber-700"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-slate-400 italic">
            {tab === 'lavorazione' ? 'Nessuna offerta in lavorazione.' : 'Nessuna offerta presentata in attesa.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sorted.map((o) => <OfferPortfolioCard key={o.id} offer={o} fcById={fcById} onOpen={onOpen} />)}
        </ul>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, Icon, label, count, activeColor, badgeActive,
}: {
  active: boolean;
  onClick: () => void;
  Icon: typeof Pencil;
  label: string;
  count: number;
  activeColor: string;
  badgeActive: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all ${
        active ? `${activeColor} shadow-sm` : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-md tabular-nums ${
        active ? badgeActive : 'bg-slate-200/70 text-slate-500'
      }`}>
        {count}
      </span>
    </button>
  );
}

function OfferPortfolioCard({
  offer, fcById, onOpen,
}: {
  offer: Offer;
  fcById: Map<string, FundingCall>;
  onOpen: (id: string) => void;
}) {
  const days = Math.ceil((new Date(offer.deadline).getTime() - Date.now()) / 86_400_000);
  const overdue = days < 0;
  const urgent = !overdue && days <= 14;
  const soon = !overdue && !urgent && days <= 30;

  const bandoLabel = offer.type === 'financed'
    ? offer.funding_call ?? '—'
    : (offer.client ?? '—') + (offer.consulting_call_id ? ` · rif. ${fcById.get(offer.consulting_call_id)?.code ?? ''}` : '');

  const progress = offer.document_progress ?? 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(offer.id)}
        className="w-full flex items-center gap-4 px-5 py-3 hover:bg-indigo-50/20 transition text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 truncate">{offer.name}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md shrink-0 ${
              offer.status === 'presentata' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}>
              {offer.status === 'presentata' ? 'In attesa' : 'In preparazione'}
            </span>
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">{bandoLabel}</p>

          {/* Mini quick-link icons se presenti */}
          <div className="flex items-center gap-2 mt-1.5">
            {offer.drive_url && (
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <FolderOpen className="w-2.5 h-2.5" /> Drive
              </span>
            )}
            {offer.gmail_query && (
              <span className="text-[10px] text-red-700 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Mail className="w-2.5 h-2.5" /> Gmail
              </span>
            )}
            {offer.ideas && (
              <span className="text-[10px] text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                <Pencil className="w-2.5 h-2.5" /> Note
              </span>
            )}
          </div>
        </div>

        {/* Avanzamento */}
        <div className="w-24 shrink-0">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-xs font-semibold tabular-nums text-slate-600">{progress}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
            <div className={`h-full transition-all ${
              progress >= 80 ? 'bg-emerald-500'
              : progress >= 40 ? 'bg-indigo-500'
              : progress > 0 ? 'bg-slate-400' : 'bg-slate-200'
            }`} style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Scadenza */}
        <div className="w-28 text-right shrink-0">
          <p className="text-xs text-slate-500 tabular-nums">{offer.deadline}</p>
          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums mt-0.5 ${
            overdue ? 'bg-red-100 text-red-700'
            : urgent ? 'bg-amber-100 text-amber-700'
            : soon ? 'bg-yellow-100 text-yellow-800'
            : 'bg-slate-100 text-slate-500'
          }`}>
            {overdue ? `${Math.abs(days)}gg fa` : days === 0 ? 'oggi!' : `tra ${days}gg`}
          </span>
        </div>
      </button>
    </li>
  );
}
