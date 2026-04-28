import { useEffect, useState } from 'react';
import { ExternalLink, Globe, Loader2, Search } from 'lucide-react';
import type { EUCall } from '../../../api/eu-calls';
import Modal from '../Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (calls: EUCall[]) => Promise<void>;
}

const PROGRAMMES = [
  { value: '', label: 'Tutti i programmi' },
  { value: '43108390', label: 'Horizon Europe (2021-2027)' },
  { value: '31045243', label: 'Horizon 2020 (2014-2020)' },
  { value: '43251567', label: 'Digital Europe' },
  { value: '43152860', label: 'EU4Health' },
  { value: '43298916', label: 'LIFE' },
  { value: '43251882', label: 'CEF (Connecting Europe)' },
];

const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition';

export default function EUCallsImportModal({ open, onClose, onImport }: Props) {
  const [calls, setCalls] = useState<EUCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [programme, setProgramme] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [total, setTotal] = useState(0);

  async function fetchCalls() {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '50', pageNumber: '1' });
      if (search.trim()) params.set('text', search.trim());
      if (programme) params.set('programme', programme);
      const res = await fetch(`/api/eu-calls?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string; detail?: string; url?: string };
        const lines = [err.error ?? `HTTP ${res.status}`];
        if (err.url) lines.push(`URL: ${err.url}`);
        if (err.detail) lines.push(`Dettaglio: ${err.detail.slice(0, 200)}`);
        throw new Error(lines.join('\n'));
      }
      const json = await res.json() as { calls: EUCall[]; total: number; rawResultCount?: number };
      setCalls(json.calls);
      setTotal(json.total);
      setSelected(new Set());
      // Diagnostica: se il portale ha restituito risultati ma la nostra logica di parsing
      // li ha tutti scartati, mostra un avviso
      if ((json.rawResultCount ?? 0) > 0 && json.calls.length === 0) {
        setError(`Il portale ha restituito ${json.rawResultCount} risultati ma nessuno aveva i campi attesi (id+titolo). Apri /api/eu-calls?debug=1 in una nuova tab per vedere la struttura grezza.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento bandi EU');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) { void fetchCalls(); }
    else { setCalls([]); setSelected(new Set()); setSearch(''); setProgramme(''); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleAll() {
    if (selected.size === calls.length) setSelected(new Set());
    else setSelected(new Set(calls.map((c) => c.identifier)));
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleImport() {
    const toImport = calls.filter((c) => selected.has(c.identifier));
    if (toImport.length === 0) return;
    setImporting(true);
    try {
      await onImport(toImport);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante l\'importazione');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Importa bandi da EU Participant Portal">
      <div className="space-y-4">
        {/* Filtri */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca per parola chiave…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchCalls()}
              className={`${inputClass} pl-8`}
            />
          </div>
          <select
            value={programme}
            onChange={(e) => setProgramme(e.target.value)}
            className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            {PROGRAMMES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchCalls}
            disabled={loading}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cerca'}
          </button>
        </div>

        {error && (
          <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-pre-wrap break-all font-sans">{error}</pre>
        )}

        {/* Lista bandi */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Caricamento bandi EU…
            </div>
          ) : calls.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nessun bando trovato.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={selected.size === calls.length && calls.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                  Seleziona tutti ({calls.length}{total > calls.length ? ` di ${total}` : ''})
                </label>
                {selected.size > 0 && (
                  <span className="text-xs font-medium text-indigo-600">{selected.size} selezionat{selected.size === 1 ? 'o' : 'i'}</span>
                )}
              </div>
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {calls.map((c) => (
                  <li
                    key={c.identifier}
                    onClick={() => toggle(c.identifier)}
                    className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition ${selected.has(c.identifier) ? 'bg-indigo-50/60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.identifier)}
                      onChange={() => toggle(c.identifier)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 rounded shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="text-sm font-medium text-slate-900 leading-snug">{c.title}</p>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 text-slate-400 hover:text-indigo-500 transition mt-0.5"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {c.identifier}
                        </span>
                        {c.programme && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {c.programme}
                          </span>
                        )}
                        {c.deadline && (
                          <span className="text-[10px] text-slate-500">
                            Scadenza: {new Date(c.deadline).toLocaleDateString('it-IT')}
                          </span>
                        )}
                      </div>
                      {c.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{c.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex justify-between items-center pt-1">
          <p className="text-xs text-slate-400">
            Fonte: <a href="https://ec.europa.eu/info/funding-tenders/opportunities/portal/" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">EU Funding & Tenders Portal</a>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {importing ? 'Importazione…' : `Importa ${selected.size > 0 ? selected.size : ''} band${selected.size === 1 ? 'o' : 'i'}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
