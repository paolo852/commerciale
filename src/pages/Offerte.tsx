import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, CheckCircle2, ChevronDown, ChevronUp, Clock, Pencil, Plus, Search, Send, TrendingUp, X, XCircle } from 'lucide-react';
import { useOffersData } from '../hooks/useOffersData';
import { offersService, activityLogService, offerAssigneesService } from '../lib/dataService';
import { TeamRoleCell, TeamMembersCell } from '../components/offerte/TeamAvatarStack';
import { useAuth } from '../contexts/AuthContext';
import { offerYear } from '../lib/analytics';
import YearSelector from '../components/YearSelector';
import { formatDate, formatEUR } from '../lib/format';
import { TypeBadge } from '../components/Badges';
import OfferFormModal from '../components/offerte/OfferFormModal';
import OffersInPreparationSummary from '../components/offerte/OffersInPreparationSummary';
import ConfirmDialog from '../components/ConfirmDialog';
import type { Offer, OfferAssignee, OfferStatus, OfferType, PartnerRole } from '../types';

type SortBy = 'deadline' | 'budget' | 'created_at' | 'name';
type SortDir = 'asc' | 'desc';
type ViewTab = 'in_lavorazione' | 'presentata' | 'approvata' | 'riserva' | 'rifiutata';
const VALID_VIEWS: ViewTab[] = ['in_lavorazione', 'presentata', 'approvata', 'riserva', 'rifiutata'];

interface Filters {
  search: string;
  type: OfferType | 'all';
  partnerRole: PartnerRole | 'all';
  projectManagerId: string | 'all';
  fundingCall: string | 'all';
  year: number | 'all';
  deadlineSoon: boolean;   // quick filter: deadline entro 30gg
}

const selectClass =
  'px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

function sp(params: URLSearchParams, key: string, fallback: string): string {
  return params.get(key) ?? fallback;
}

function filtersFromParams(params: URLSearchParams): Filters {
  const year = params.get('year');
  return {
    search: sp(params, 'q', ''),
    type: sp(params, 'type', 'all') as Filters['type'],
    partnerRole: sp(params, 'role', 'all') as Filters['partnerRole'],
    projectManagerId: sp(params, 'pm', 'all'),
    fundingCall: sp(params, 'call', 'all'),
    year: year && year !== 'all' ? Number(year) : 'all',
    deadlineSoon: params.get('soon') === '1',
  };
}

function applyFilters(params: URLSearchParams, f: Filters): URLSearchParams {
  const next = new URLSearchParams(params);
  f.search ? next.set('q', f.search) : next.delete('q');
  f.type !== 'all' ? next.set('type', f.type) : next.delete('type');
  f.partnerRole !== 'all' ? next.set('role', f.partnerRole) : next.delete('role');
  f.projectManagerId !== 'all' ? next.set('pm', f.projectManagerId) : next.delete('pm');
  f.fundingCall !== 'all' ? next.set('call', f.fundingCall) : next.delete('call');
  f.year !== 'all' ? next.set('year', String(f.year)) : next.delete('year');
  f.deadlineSoon ? next.set('soon', '1') : next.delete('soon');
  return next;
}

export default function Offerte() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { offers, projectManagers, fundingCalls, loading, error, reload } = useOffersData();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawView = sp(searchParams, 'view', 'in_lavorazione') as ViewTab;
  const view: ViewTab = VALID_VIEWS.includes(rawView) ? rawView : 'in_lavorazione';
  const sortBy = sp(searchParams, 'sort', 'deadline') as SortBy;
  const sortDir = sp(searchParams, 'dir', 'asc') as SortDir;
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);

  function setView(v: ViewTab) {
    setSearchParams((p) => { const n = new URLSearchParams(p); n.set('view', v); return n; }, { replace: true });
  }
  function setFilters(f: Filters) {
    setSearchParams(applyFilters(searchParams, f), { replace: true });
  }
  function clearFilters() {
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      ['q', 'type', 'role', 'pm', 'call', 'year', 'soon'].forEach((k) => n.delete(k));
      return n;
    }, { replace: true });
  }
  function toggleSort(col: SortBy) {
    setSearchParams((p) => {
      const n = new URLSearchParams(p);
      if (sp(p, 'sort', 'deadline') === col) {
        n.set('dir', sp(p, 'dir', 'asc') === 'asc' ? 'desc' : 'asc');
      } else {
        n.set('sort', col);
        n.set('dir', col === 'budget' || col === 'created_at' ? 'desc' : 'asc');
      }
      return n;
    }, { replace: true });
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [toDelete, setToDelete] = useState<Offer | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<OfferStatus | ''>('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [assigneesByOffer, setAssigneesByOffer] = useState<Map<string, OfferAssignee[]>>(new Map());

  useEffect(() => {
    offerAssigneesService.listAllByOffer()
      .then(setAssigneesByOffer)
      .catch(() => setAssigneesByOffer(new Map()));
  }, [offers.length]);

  const pmById = useMemo(() => new Map(projectManagers.map((p) => [p.id, p])), [projectManagers]);

  function compactEUR(value: number): string {
    if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (value >= 1_000) return `€${Math.round(value / 1_000)}K`;
    return formatEUR(value);
  }

  const isFiltered =
    !!filters.search ||
    filters.type !== 'all' ||
    filters.partnerRole !== 'all' ||
    filters.projectManagerId !== 'all' ||
    filters.fundingCall !== 'all' ||
    filters.deadlineSoon;

  const yearScopedOffers = useMemo(
    () => filters.year === 'all' ? offers : offers.filter((o) => offerYear(o) === filters.year),
    [offers, filters.year],
  );

  const tabCounts = useMemo(() => ({
    in_lavorazione: yearScopedOffers.filter((o) => o.status === 'in_lavorazione' && o.outcome === 'nessuno').length,
    presentata: yearScopedOffers.filter((o) => o.status === 'presentata').length,
    approvata: yearScopedOffers.filter((o) => o.outcome === 'approvato').length,
    riserva: yearScopedOffers.filter((o) => o.outcome === 'riserva').length,
    rifiutata: yearScopedOffers.filter((o) => o.outcome === 'rifiutato').length,
  }), [yearScopedOffers]);

  // Sottoinsiemi del pannello stats:
  // - approvate/rifiutate: filtrano solo per outcome (senza vincolo su status)
  // - inAttesa: status=presentata e outcome=nessuno
  // - totale mostrato = inAttesa + approvate + rifiutate (matematicamente garantito)
  const inAttesa = useMemo(
    () => yearScopedOffers.filter((o) => o.status === 'presentata' && o.outcome === 'nessuno').length,
    [yearScopedOffers],
  );
  const approvedRevenue = useMemo(
    () => yearScopedOffers.filter((o) => o.outcome === 'approvato').reduce((s, o) => s + o.budget, 0),
    [yearScopedOffers],
  );

  const visibleOffers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const filtered = offers.filter((o) => {
      if (view === 'approvata') {
        if (o.outcome !== 'approvato') return false;
      } else if (view === 'rifiutata') {
        if (o.outcome !== 'rifiutato') return false;
      } else if (view === 'riserva') {
        if (o.outcome !== 'riserva') return false;
      } else {
        if (o.status !== view) return false;
        if (o.outcome !== 'nessuno') return false;
      }
      if (filters.year !== 'all' && offerYear(o) !== filters.year) return false;
      if (search && !o.name.toLowerCase().includes(search)) return false;
      if (filters.type !== 'all' && o.type !== filters.type) return false;
      if (filters.partnerRole !== 'all' && (o.partner_role ?? 'leader') !== filters.partnerRole) return false;
      if (filters.projectManagerId !== 'all') {
        // Il PM può essere agganciato come project_manager_id legacy oppure
        // come membro del team (offer_assignees). Considera entrambi.
        const teamPmIds = (assigneesByOffer.get(o.id) ?? []).map((a) => a.project_manager_id);
        const allPmIds = new Set<string>(teamPmIds);
        if (o.project_manager_id) allPmIds.add(o.project_manager_id);

        if (filters.projectManagerId === '__none__') {
          if (allPmIds.size > 0) return false;
        } else if (!allPmIds.has(filters.projectManagerId)) {
          return false;
        }
      }
      if (filters.fundingCall !== 'all' && o.funding_call !== filters.fundingCall) return false;
      if (filters.deadlineSoon) {
        if (!o.deadline) return false;
        const daysToDeadline = (new Date(o.deadline).getTime() - Date.now()) / 86_400_000;
        if (daysToDeadline < 0 || daysToDeadline > 30) return false;
      }
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'deadline') cmp = a.deadline.localeCompare(b.deadline);
      else if (sortBy === 'budget') cmp = a.budget - b.budget;
      else if (sortBy === 'created_at') cmp = a.created_at.localeCompare(b.created_at);
      else cmp = a.name.localeCompare(b.name, 'it');
      return cmp * dir;
    });
  }, [offers, filters, view, sortBy, sortDir, assigneesByOffer]);

  function SortIcon({ col }: { col: SortBy }) {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-slate-700" />
      : <ChevronDown className="w-3 h-3 text-slate-700" />;
  }

  function openNew() { setEditing(null); setFormOpen(true); }

  async function handleDelete() {
    if (!toDelete) return;
    await offersService.remove(toDelete.id);
    void activityLogService.add({
      user_email: user?.email ?? '',
      user_name: null,
      action: 'deleted',
      entity_type: 'offer',
      entity_id: toDelete.id,
      entity_name: toDelete.name,
    });
    setToDelete(null);
    setSelected((p) => { const n = new Set(p); n.delete(toDelete.id); return n; });
    await reload();
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(visibleOffers.map((o) => o.id)) : new Set());
  }
  function toggleOne(id: string) {
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function applyBulkStatus() {
    if (!bulkStatus || selected.size === 0) return;
    setBulkBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    await Promise.all(Array.from(selected).map((id) => {
      const o = offers.find((x) => x.id === id);
      if (!o) return Promise.resolve();
      const patch: Partial<Offer> = { status: bulkStatus };
      if (bulkStatus === 'presentata' && !o.submitted_at) patch.submitted_at = today;
      return offersService.update(id, patch);
    }));
    setSelected(new Set()); setBulkStatus(''); setBulkBusy(false);
    await reload();
  }

  const allSelected = visibleOffers.length > 0 && visibleOffers.every((o) => selected.has(o.id));
  const thClass = 'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider';

  const STATUS_OPTIONS_BULK: { value: OfferStatus; label: string }[] = [
    { value: 'in_lavorazione', label: 'In lavorazione' },
    { value: 'presentata', label: 'Presentata' },
    { value: 'ferma', label: 'Ferma' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Offerte</h1>
          <p className="text-sm text-slate-500 mt-0.5">{offers.length} offerte totali</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition"
        >
          <Plus className="w-4 h-4" />
          Nuova offerta
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Stats strip */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-5 py-4">
        <div className="flex items-start gap-5 flex-wrap">
          {/* Totale presentate */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Presentate{filters.year !== 'all' ? ` · ${filters.year}` : ''}
              </p>
              <p className="text-3xl font-black tabular-nums text-slate-900 leading-none">{inAttesa + tabCounts.approvata + tabCounts.riserva + tabCounts.rifiutata}</p>
            </div>
          </div>

          <div className="hidden sm:block w-px self-stretch bg-slate-100 shrink-0" />

          {/* Sottoinsiemi */}
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 opacity-80">In attesa</p>
                <p className="text-lg font-bold tabular-nums text-amber-700">{inAttesa}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 opacity-80">Approvate</p>
                <p className="text-lg font-bold tabular-nums text-emerald-700">{tabCounts.approvata}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 opacity-80">Reserve list</p>
                <p className="text-lg font-bold tabular-nums text-amber-800">{tabCounts.riserva}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">
              <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 opacity-80">Rifiutate</p>
                <p className="text-lg font-bold tabular-nums text-rose-700">{tabCounts.rifiutata}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-100 px-3 py-2">
              <TrendingUp className="w-3.5 h-3.5 text-teal-500 shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600 opacity-80">Ricavo approvate</p>
                <p className="text-lg font-bold tabular-nums text-teal-700">{compactEUR(approvedRevenue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sommario offerte in preparazione per bando */}
      <OffersInPreparationSummary
        offers={yearScopedOffers}
        fundingCalls={fundingCalls}
        onSelectCall={(code) => {
          setView('in_lavorazione');
          setFilters({ ...filters, fundingCall: code ?? 'all' });
        }}
      />

      {/* Status toggle buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* In lavorazione */}
        <button
          onClick={() => setView('in_lavorazione')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'in_lavorazione'
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
          }`}
        >
          <Pencil className="w-4 h-4 shrink-0" />
          <span className="font-semibold">In lavorazione</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'in_lavorazione' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.in_lavorazione}
          </span>
        </button>

        {/* Presentata */}
        <button
          onClick={() => setView('presentata')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'presentata'
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
          }`}
        >
          <Send className="w-4 h-4 shrink-0" />
          <span className="font-semibold">In attesa</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'presentata' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {inAttesa}
          </span>
        </button>

        {/* Approvate */}
        <button
          onClick={() => setView('approvata')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'approvata'
              ? 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Approvate</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'approvata' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.approvata}
          </span>
        </button>

        {/* Reserve list */}
        <button
          onClick={() => setView('riserva')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'riserva'
              ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-700'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Reserve list</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'riserva' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.riserva}
          </span>
        </button>

        {/* Rifiutate */}
        <button
          onClick={() => setView('rifiutata')}
          className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 transition-all font-medium text-sm ${
            view === 'rifiutata'
              ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-200'
              : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-700'
          }`}
        >
          <XCircle className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Rifiutate</span>
          <span className={`text-sm font-bold px-2 py-0.5 rounded-full min-w-[1.5rem] text-center tabular-nums ${
            view === 'rifiutata' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {tabCounts.rifiutata}
          </span>
        </button>

        <div className="ml-auto">
          <YearSelector
            offers={offers}
            value={filters.year}
            onChange={(year) => setFilters({ ...filters, year })}
          />
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Cerca per nome…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
        />
      </div>

      {/* Filtri sempre visibili */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick chips: Tipo */}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pr-1">Tipo</span>
          <QuickChip
            active={filters.type === 'financed'}
            color="violet"
            onClick={() => setFilters({ ...filters, type: filters.type === 'financed' ? 'all' : 'financed' })}
          >
            Finanziata
          </QuickChip>
          <QuickChip
            active={filters.type === 'consulting'}
            color="cyan"
            onClick={() => setFilters({ ...filters, type: filters.type === 'consulting' ? 'all' : 'consulting' })}
          >
            Consulenza
          </QuickChip>

          <span className="w-px h-5 bg-slate-200 mx-1" aria-hidden="true" />

          {/* Quick chips: Ruolo */}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 pr-1">Ruolo</span>
          <QuickChip
            active={filters.partnerRole === 'leader'}
            color="indigo"
            onClick={() => setFilters({ ...filters, partnerRole: filters.partnerRole === 'leader' ? 'all' : 'leader' })}
          >
            Leader
          </QuickChip>
          <QuickChip
            active={filters.partnerRole === 'invited'}
            color="amber"
            onClick={() => setFilters({ ...filters, partnerRole: filters.partnerRole === 'invited' ? 'all' : 'invited' })}
          >
            Invitato
          </QuickChip>

          <span className="w-px h-5 bg-slate-200 mx-1" aria-hidden="true" />

          {/* Quick chip: Scadenza vicina */}
          <QuickChip
            active={filters.deadlineSoon}
            color="rose"
            onClick={() => setFilters({ ...filters, deadlineSoon: !filters.deadlineSoon })}
          >
            <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />
            Scadenza ≤ 30gg
          </QuickChip>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Select PM e Bando */}
            <select
              value={filters.projectManagerId}
              onChange={(e) => setFilters({ ...filters, projectManagerId: e.target.value })}
              className={selectClass + ' text-xs py-1.5'}
            >
              <option value="all">Tutti i PM</option>
              <option value="__none__">— Nessun PM</option>
              {projectManagers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select
              value={filters.fundingCall}
              onChange={(e) => setFilters({ ...filters, fundingCall: e.target.value })}
              className={selectClass + ' text-xs py-1.5'}
            >
              <option value="all">Tutti i bandi</option>
              {fundingCalls.map((f) => <option key={f.id} value={f.code}>{f.code}</option>)}
            </select>

            {isFiltered && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md hover:bg-slate-100 transition"
              >
                <X className="w-3 h-3" /> Pulisci
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-indigo-900">{selected.size} selezionate</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as OfferStatus | '')} className="px-3 py-1.5 text-sm border border-indigo-200 rounded-lg bg-white">
            <option value="">Cambia stato in…</option>
            {STATUS_OPTIONS_BULK.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={applyBulkStatus} disabled={!bulkStatus || bulkBusy} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {bulkBusy ? 'Aggiornamento…' : 'Applica'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-indigo-700 ml-auto">Deseleziona tutto</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                <th className={thClass}>
                  <button onClick={() => toggleSort('name')} className="inline-flex items-center gap-1.5">Nome <SortIcon col="name" /></button>
                </th>
                <th className={thClass}>Tipo</th>
                <th className={thClass}>Bando / Cliente</th>
                <th className={thClass}>Responsabile</th>
                <th className={thClass}>Fundraising</th>
                <th className={thClass}>Team</th>
                <th className={thClass}>
                  <button onClick={() => toggleSort('deadline')} className="inline-flex items-center gap-1.5">Scadenza <SortIcon col="deadline" /></button>
                </th>
                <th className={`${thClass} text-right`}>
                  <button onClick={() => toggleSort('budget')} className="inline-flex items-center gap-1.5 ml-auto">Importo <SortIcon col="budget" /></button>
                </th>
                <th className={thClass}>Avanzamento</th>
                <th className={`${thClass} text-right`}>Prob.</th>
                <th className={`${thClass} text-right`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={12} className="text-center py-12 text-slate-400 text-sm">Caricamento…</td></tr>
              ) : visibleOffers.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-12 text-slate-400 text-sm">
                  {offers.length === 0
                    ? 'Nessuna offerta. Clicca "+ Nuova offerta" per iniziare.'
                    : `Nessuna offerta ${
                        view === 'in_lavorazione' ? 'in lavorazione'
                        : view === 'presentata' ? 'in attesa'
                        : view === 'approvata' ? 'approvata'
                        : view === 'riserva' ? 'in reserve list'
                        : 'rifiutata'
                      }${isFiltered ? ' corrisponde ai filtri' : ''}.`}
                </td></tr>
              ) : visibleOffers.map((o) => {
                const pm = o.project_manager_id ? pmById.get(o.project_manager_id) : undefined;
                const sel = selected.has(o.id);
                return (
                  <tr key={o.id} onClick={() => navigate(`/offerte/${o.id}`)}
                    className={`cursor-pointer transition-colors ${sel ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'}`}>
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={sel} onChange={() => toggleOne(o.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="px-4 py-3.5 max-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{o.name}</span>
                        {(o.partner_role ?? 'leader') === 'leader' ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                            Leader
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                            Invitato
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><TypeBadge value={o.type} /></td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 max-w-[160px] truncate">
                      {o.type === 'financed' ? o.funding_call : o.client}
                    </td>
                    {(() => {
                      const teamRows = assigneesByOffer.get(o.id) ?? [];
                      const lead = teamRows.find((a) => a.role === 'responsabile');
                      const fund = teamRows.find((a) => a.role === 'fundraising');
                      const members = teamRows.filter((a) => a.role === 'membro');
                      return (
                        <>
                          <td className="px-4 py-3.5">
                            <TeamRoleCell assignee={lead} pmById={pmById} fallbackPm={pm ?? null} fallbackItalic />
                          </td>
                          <td className="px-4 py-3.5">
                            <TeamRoleCell assignee={fund} pmById={pmById} />
                          </td>
                          <td className="px-4 py-3.5">
                            <TeamMembersCell assignees={members} pmById={pmById} maxVisible={3} />
                          </td>
                        </>
                      );
                    })()}
                    <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums">{formatDate(o.deadline)}</td>
                    <td className="px-4 py-3.5 text-sm text-right tabular-nums font-medium text-slate-900">{formatEUR(o.budget)}</td>
                    <td className="px-4 py-3.5 min-w-[140px]">
                      {(() => {
                        const p = Math.max(0, Math.min(100, o.document_progress ?? 0));
                        const barColor = p >= 80 ? 'bg-emerald-500' : p >= 40 ? 'bg-indigo-500' : p > 0 ? 'bg-slate-400' : 'bg-slate-200';
                        const textColor = p >= 80 ? 'text-emerald-600' : p >= 40 ? 'text-indigo-600' : 'text-slate-500';
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${p}%` }} />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums w-9 text-right shrink-0 ${textColor}`}>{p}%</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-sm font-semibold tabular-nums ${
                        (o.probability ?? 50) >= 70 ? 'text-emerald-600' :
                        (o.probability ?? 50) >= 40 ? 'text-amber-600' : 'text-red-500'
                      }`}>{o.probability ?? 50}%</span>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setToDelete(o)} className="text-xs text-slate-400 hover:text-red-600 transition">Elimina</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {!loading && visibleOffers.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/70">
                  <td />
                  <td colSpan={7} className="px-4 py-4 text-xs text-slate-400">
                    {visibleOffers.length} di {tabCounts[view]} offerte {
                      view === 'in_lavorazione' ? 'in lavorazione'
                      : view === 'presentata' ? 'in attesa'
                      : view === 'approvata' ? 'approvate'
                      : view === 'riserva' ? 'in reserve list'
                      : 'rifiutate'
                    }
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Totale</p>
                    <p className="text-lg font-bold tabular-nums text-slate-900">
                      {formatEUR(visibleOffers.reduce((s, o) => s + o.budget, 0))}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    {view === 'in_lavorazione' && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Avanz. medio</p>
                        <p className="text-lg font-bold tabular-nums text-indigo-600">
                          {Math.round(visibleOffers.reduce((s, o) => s + (o.document_progress ?? 0), 0) / visibleOffers.length)}%
                        </p>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {view !== 'approvata' && view !== 'rifiutata' && view !== 'riserva' && (
                      <>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Atteso</p>
                        <p className="text-lg font-bold tabular-nums text-amber-600">
                          {formatEUR(visibleOffers.reduce((s, o) => s + o.budget * (o.probability ?? 50) / 100, 0))}
                        </p>
                      </>
                    )}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <OfferFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={async (saved) => {
          if (saved) {
            void activityLogService.add({
              user_email: user?.email ?? '',
              user_name: null,
              action: editing ? 'updated' : 'created',
              entity_type: 'offer',
              entity_id: saved.id,
              entity_name: saved.name,
            });
          }
          await reload();
        }}
        offer={editing}
        projectManagers={projectManagers}
        fundingCalls={fundingCalls}
        offers={offers}
      />
      <ConfirmDialog open={!!toDelete} title="Eliminare l'offerta?"
        message={toDelete ? `"${toDelete.name}" verrà rimossa definitivamente.` : ''}
        confirmLabel="Elimina" variant="danger"
        onConfirm={handleDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}

// ── Quick filter chip ────────────────────────────────────────────────────────
type ChipColor = 'indigo' | 'violet' | 'cyan' | 'amber' | 'rose' | 'emerald';

const CHIP_ACTIVE: Record<ChipColor, string> = {
  indigo:  'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100',
  violet:  'bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-100',
  cyan:    'bg-cyan-600 text-white border-cyan-600 shadow-sm shadow-cyan-100',
  amber:   'bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-100',
  rose:    'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-100',
  emerald: 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100',
};

const CHIP_INACTIVE: Record<ChipColor, string> = {
  indigo:  'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-700',
  violet:  'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-700',
  cyan:    'bg-white text-slate-600 border-slate-200 hover:border-cyan-400 hover:text-cyan-700',
  amber:   'bg-white text-slate-600 border-slate-200 hover:border-amber-400 hover:text-amber-700',
  rose:    'bg-white text-slate-600 border-slate-200 hover:border-rose-300 hover:text-rose-700',
  emerald: 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700',
};

function QuickChip({
  active, color, onClick, children,
}: {
  active: boolean; color: ChipColor; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${
        active ? CHIP_ACTIVE[color] : CHIP_INACTIVE[color]
      }`}
    >
      {children}
      {active && <X className="w-3 h-3 opacity-80 ml-0.5" />}
    </button>
  );
}
