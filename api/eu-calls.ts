// Vercel Serverless Function (Edge runtime)
// Fonte primaria: file JSON statico pubblicato dal EU Funding & Tenders Portal.
// Contiene tutti i bandi aperti/forthcoming con scadenza futura.

export const config = { runtime: 'edge' };

export interface EUCall {
  identifier: string;
  title: string;
  programme: string;
  deadline: string | null;
  status: string;
  description: string | null;
  url: string;
}

// JSON statico pubblicato dal portale EU — aggiornato frequentemente.
const GRANTS_URL =
  'https://ec.europa.eu/info/funding-tenders/opportunities/data/referenceData/grantsTenders.json';

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

function toDateStr(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number') {
    // Unix ms timestamp
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof v === 'string') {
    const s = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) return str(v[0]);
  return null;
}

function programmeName(id: string, rawProgramme: string | null): string {
  const up = id.toUpperCase();
  const prog = (rawProgramme ?? '').toUpperCase();
  if (up.startsWith('HORIZON-') || up.startsWith('ERC-') || up.startsWith('MSCA-') || prog.includes('HORIZON')) return 'Horizon Europe';
  if (up.startsWith('H2020-') || prog.includes('H2020')) return 'Horizon 2020';
  if (up.startsWith('LIFE-') || prog.includes('LIFE')) return 'LIFE';
  if (up.startsWith('DIGITAL-') || prog.includes('DIGITAL')) return 'Digital Europe';
  if (up.startsWith('CEF-') || up.startsWith('CINEA-CEF')) return 'CEF';
  if (up.startsWith('ERASMUS-')) return 'Erasmus+';
  if (up.startsWith('EU4H-') || up.startsWith('EU4HEALTH')) return 'EU4Health';
  if (up.startsWith('AMIF-')) return 'AMIF';
  if (up.startsWith('ISF-')) return 'ISF';
  if (up.startsWith('EMFAF-')) return 'EMFAF';
  if (up.startsWith('CERV-')) return 'CERV';
  if (up.startsWith('JUST-')) return 'Justice';
  if (up.startsWith('SMP-')) return 'Single Market Programme';
  if (up.startsWith('UCPM-')) return 'Civil Protection';
  if (up.startsWith('EDF-')) return 'European Defence Fund';
  if (rawProgramme) return rawProgramme;
  return 'Altro';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCall(item: Record<string, any>): EUCall | null {
  // Prova vari nomi campo usati dal portale EU
  const id =
    str(item.identifier) ??
    str(item.callIdentifier) ??
    str(item.topicCode) ??
    str(item.id) ??
    null;
  const title =
    str(item.title) ??
    str(item.callTitle) ??
    str(item.name) ??
    null;
  if (!id || !title) return null;

  const deadline = toDateStr(item.deadlineDate ?? item.deadline ?? item.submissionDeadline ?? null);
  const rawProg = str(item.frameworkProgramme ?? item.programme ?? item.programmeAcronym ?? null);
  const prog = programmeName(id, rawProg);
  const desc = stripHtml(
    str(item.description ?? item.descriptionByte ?? item.abstract ?? item.summary ?? null),
  );
  const statusRaw = str(item.status ?? item.callStatus ?? null) ?? 'OPEN';
  const portalUrl =
    str(item.url ?? item.urlHref ?? null) ??
    `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent(id.toLowerCase())}`;

  return {
    identifier: id,
    title,
    programme: prog,
    deadline,
    status: statusRaw,
    description: desc ? desc.slice(0, 600) : null,
    url: portalUrl,
  } satisfies EUCall;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '100'), 200);
  const text = (searchParams.get('text') ?? '').trim().toLowerCase();
  const debug = searchParams.get('debug') === '1';

  let rawJson: unknown;
  try {
    const res = await fetch(GRANTS_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'commerciale-app/1.0' },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `grantsTenders.json ha risposto ${res.status}` }),
        { status: 502 },
      );
    }
    rawJson = await res.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Errore fetch grantsTenders.json', detail: String(e) }),
      { status: 502 },
    );
  }

  // Debug: mostra struttura raw per diagnosi
  if (debug) {
    const isArr = Array.isArray(rawJson);
    const keys = !isArr && typeof rawJson === 'object' && rawJson !== null
      ? Object.keys(rawJson as object)
      : [];
    // Prendi il primo elemento per capire i campi disponibili
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const arr: unknown[] = isArr ? rawJson as unknown[] : (rawJson as any)[keys[0]] ?? [];
    return new Response(
      JSON.stringify({
        isArray: isArr,
        topLevelKeys: keys,
        totalItems: arr.length,
        firstItem: arr[0],
        sampleKeys: arr[0] != null && typeof arr[0] === 'object' ? Object.keys(arr[0] as object) : [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Ricava l'array di bandi dalla struttura (array diretto o oggetto con una chiave)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: Record<string, any>[];
  if (Array.isArray(rawJson)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items = rawJson as Record<string, any>[];
  } else if (typeof rawJson === 'object' && rawJson !== null) {
    const obj = rawJson as Record<string, unknown>;
    // Cerca la prima chiave il cui valore è un array
    const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items = arrayKey ? (obj[arrayKey] as Record<string, any>[]) : [];
  } else {
    items = [];
  }

  const today = new Date().toISOString().slice(0, 10);

  const calls = items
    .map((item) => parseCall(item))
    .filter((c): c is EUCall => {
      if (!c) return false;
      // Filtro scadenza futura (o null = forthcoming senza data)
      if (c.deadline && c.deadline < today) return false;
      // Filtro testo libero
      if (text) {
        const haystack = `${c.identifier} ${c.title} ${c.programme} ${c.description ?? ''}`.toLowerCase();
        if (!haystack.includes(text)) return false;
      }
      return true;
    })
    .slice(0, pageSize);

  return new Response(
    JSON.stringify({ calls, total: calls.length, rawResultCount: items.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
