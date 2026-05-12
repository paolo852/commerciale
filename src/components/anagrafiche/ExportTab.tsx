import { useRef, useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { offersService, projectManagersService, fundingCallsService } from '../../lib/dataService';
import { getAvailableYears } from '../../lib/analytics';
import type { FundingCall, Offer, ProjectManager } from '../../types';

// ----------------------------------------------------------------
// CSV helpers
// ----------------------------------------------------------------

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

function offersToCSV(offers: Offer[], pmById: Map<string, string>): string {
  const headers = [
    'Nome', 'Tipo', 'Bando / Cliente', 'PI', 'Ente', 'Scadenza',
    'Importo (€)', 'Probabilità %', 'Project Manager',
    'Stato', 'Esito', 'Data presentazione', 'Data esito', 'Note',
  ];
  const rows = offers.map((o) => [
    o.name,
    o.type === 'financed' ? 'Finanziata' : 'Consulenza',
    o.type === 'financed' ? (o.funding_call ?? '') : (o.client ?? ''),
    o.pi ?? '',
    o.ente ?? '',
    o.deadline,
    o.budget,
    o.probability,
    o.project_manager_id ? (pmById.get(o.project_manager_id) ?? '') : '',
    o.status,
    o.outcome,
    o.submitted_at ?? '',
    o.decided_at ?? '',
    o.notes ?? '',
  ]);
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

// ----------------------------------------------------------------
// Download helper
// ----------------------------------------------------------------

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function todaySlug() {
  return new Date().toISOString().slice(0, 10);
}

// ----------------------------------------------------------------
// Backup JSON shape
// ----------------------------------------------------------------

interface BackupJSON {
  version: 2;
  exportedAt: string;
  offers: Offer[];
  projectManagers: ProjectManager[];
  fundingCalls: FundingCall[];
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export default function ExportTab() {
  const { user } = useAuth();
  const [yearFilter, setYearFilter] = useState<number | 'all'>('all');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupJSON | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadYears() {
    const offers = await offersService.list();
    setAvailableYears(getAvailableYears(offers));
  }

  // chiamato al mount tramite onClick sul selettore
  const [yearsLoaded, setYearsLoaded] = useState(false);
  async function ensureYears() {
    if (yearsLoaded) return;
    await loadYears();
    setYearsLoaded(true);
  }

  async function exportCSV() {
    setBusy('csv'); setMsg(null);
    try {
      const [offers, pms] = await Promise.all([offersService.list(), projectManagersService.list()]);
      const filtered = yearFilter === 'all'
        ? offers
        : offers.filter((o) => o.deadline?.startsWith(String(yearFilter)));
      const pmById = new Map(pms.map((p) => [p.id, p.name]));
      const csv = offersToCSV(filtered, pmById);
      const suffix = yearFilter === 'all' ? 'tutte' : String(yearFilter);
      download(csv, `offerte_${suffix}_${todaySlug()}.csv`, 'text/csv;charset=utf-8;');
      setMsg({ type: 'ok', text: `${filtered.length} offerte esportate.` });
    } catch (e) {
      setMsg({ type: 'error', text: (e as { message?: string })?.message ?? 'Errore esportazione' });
    } finally { setBusy(null); }
  }

  async function exportBackup() {
    setBusy('backup'); setMsg(null);
    try {
      const [offers, projectManagers, fundingCalls] = await Promise.all([
        offersService.list(),
        projectManagersService.list(),
        fundingCallsService.list(),
      ]);
      const backup: BackupJSON = {
        version: 2,
        exportedAt: new Date().toISOString(),
        offers, projectManagers, fundingCalls,
      };
      download(JSON.stringify(backup, null, 2), `backup_commerciale_${todaySlug()}.json`, 'application/json');
      setMsg({ type: 'ok', text: `Backup eseguito: ${offers.length} offerte, ${projectManagers.length} PM, ${fundingCalls.length} bandi.` });
    } catch (e) {
      setMsg({ type: 'error', text: (e as { message?: string })?.message ?? 'Errore backup' });
    } finally { setBusy(null); }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as BackupJSON;
        if (parsed.version !== 2 || !Array.isArray(parsed.offers)) {
          setMsg({ type: 'error', text: 'File non valido o versione non supportata.' });
          return;
        }
        setPendingBackup(parsed);
        setRestoreConfirm(true);
      } catch {
        setMsg({ type: 'error', text: 'File JSON non valido.' });
      }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file);
  }

  async function confirmRestore() {
    if (!pendingBackup || !user) return;
    setBusy('restore'); setRestoreConfirm(false); setMsg(null);
    try {
      // Inserisce PM, bandi e offerte. Usa create per ciascuno.
      // Esistenti vengono saltati (errore silenzioso) oppure duplicati con nuovo ID.
      // Strategia: importa solo quelli con ID non ancora presenti.
      const [existingOffers, existingPMs, existingFCs] = await Promise.all([
        offersService.list(),
        projectManagersService.list(),
        fundingCallsService.list(),
      ]);
      const existingOfferIds = new Set(existingOffers.map((o) => o.id));
      const existingPMIds = new Set(existingPMs.map((p) => p.id));
      const existingFCIds = new Set(existingFCs.map((f) => f.id));

      const newPMs = pendingBackup.projectManagers.filter((p) => !existingPMIds.has(p.id));
      const newFCs = pendingBackup.fundingCalls.filter((f) => !existingFCIds.has(f.id));
      const newOffers = pendingBackup.offers.filter((o) => !existingOfferIds.has(o.id));

      await Promise.all(newPMs.map((p) => projectManagersService.create({ name: p.name, email: p.email, active: p.active }, user.id)));
      await Promise.all(newFCs.map((f) => fundingCallsService.create({ code: f.code, name: f.name, body: f.body, deadline: f.deadline, description: (f as { description?: string | null }).description ?? null, notes: f.notes, probability: f.probability ?? 50, source_url: (f as { source_url?: string | null }).source_url ?? null }, user.id)));
      await Promise.all(newOffers.map((o) => offersService.create({
        name: o.name, type: o.type, funding_call: o.funding_call, client: o.client, consulting_call_id: o.consulting_call_id ?? null,
        deadline: o.deadline, budget: o.budget, probability: o.probability ?? 50,
        project_manager_id: o.project_manager_id, pi: o.pi ?? null, ente: o.ente ?? null,
        status: o.status, outcome: o.outcome,
        submitted_at: o.submitted_at, decided_at: o.decided_at, notes: o.notes,
      }, user.id)));

      setMsg({ type: 'ok', text: `Ripristino completato: +${newOffers.length} offerte, +${newPMs.length} PM, +${newFCs.length} bandi importati (duplicati ignorati).` });
    } catch (e) {
      setMsg({ type: 'error', text: (e as { message?: string })?.message ?? 'Errore ripristino' });
    } finally { setBusy(null); setPendingBackup(null); }
  }

  const btnClass = 'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition disabled:opacity-50';

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`px-4 py-3 rounded-xl border text-sm ${msg.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      {/* Esporta CSV */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Esporta offerte (CSV)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Compatibile con Excel e Google Sheets.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={yearFilter === 'all' ? 'all' : String(yearFilter)}
            onFocus={ensureYears}
            onChange={(e) => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tutti gli anni</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={exportCSV} disabled={busy === 'csv'}
            className={`${btnClass} bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200`}>
            <Download className="w-4 h-4" />
            {busy === 'csv' ? 'Esportazione…' : 'Scarica CSV'}
          </button>
        </div>
      </div>

      {/* Backup JSON */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileJson className="w-4 h-4 text-indigo-600" /> Backup completo (JSON)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Esporta tutte le offerte, i PM e i bandi in un file JSON.</p>
        </div>
        <button onClick={exportBackup} disabled={busy === 'backup'}
          className={`${btnClass} bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200`}>
          <Download className="w-4 h-4" />
          {busy === 'backup' ? 'Elaborazione…' : 'Scarica backup JSON'}
        </button>
      </div>

      {/* Ripristino */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-600" /> Ripristina da backup
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Importa un file JSON esportato in precedenza. I record già presenti (stesso ID) vengono ignorati.
          </p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".json" onChange={handleFileChange}
            className="block text-sm text-slate-600 file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer" />
        </div>
      </div>

      {/* Dialog conferma ripristino */}
      {restoreConfirm && pendingBackup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">Conferma ripristino</h3>
            <p className="text-sm text-slate-600">
              Stai per importare <strong>{pendingBackup.offers.length} offerte</strong>,{' '}
              <strong>{pendingBackup.projectManagers.length} PM</strong> e{' '}
              <strong>{pendingBackup.fundingCalls.length} bandi</strong> dal backup del{' '}
              <strong>{new Date(pendingBackup.exportedAt).toLocaleDateString('it-IT')}</strong>.
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              I record già presenti (stesso ID) verranno ignorati. Questa operazione non elimina dati esistenti.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setRestoreConfirm(false); setPendingBackup(null); }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                Annulla
              </button>
              <button onClick={confirmRestore} disabled={busy === 'restore'}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:opacity-60 transition">
                {busy === 'restore' ? 'Ripristino…' : 'Importa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
