// Vercel Serverless Function (Edge runtime)
// Proxy verso l'API pubblica del EU Funding & Tenders Portal (SEDIA).
// Restituisce i bandi aperti (status Open o Forthcoming) ordinati per scadenza.

export const config = { runtime: 'edge' };

export interface EUCall {
  identifier: string;
  title: string;
  programme: string; // periodo programma, es. "2021 - 2027"
  deadline: string | null;
  status: string;
  description: string | null;
  url: string;
}

interface EUApiMetadata {
  identifier?: unknown;
  title?: unknown;
  deadlineDate?: unknown;
  programmePeriod?: unknown;
  frameworkProgramme?: unknown;
  status?: unknown;
  description?: unknown;
  callTitle?: unknown;
  callIdentifier?: unknown;
  topicCode?: unknown;
  descriptionByte?: unknown;
}

interface EUApiResult {
  metadata?: EUApiMetadata;
  reference?: string;
  url?: string | string[];
  summary?: string;
  title?: string;
}

interface EUApiResponse {
  results?: EUApiResult[];
  totalResults?: number;
  totalCount?: number;
}

const EU_API = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';

// Mappa di alcuni programmi noti (ID numerici frameworkProgramme)
const PROGRAMME_NAMES: Record<string, string> = {
  '43108390': 'Horizon Europe',
  '31045243': 'Horizon 2020',
  '43251567': 'Digital Europe',
  '43152860': 'EU4Health',
  '43298916': 'LIFE',
  '43251882': 'CEF',
};

function first(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return first(v[0]);
  if (typeof v === 'object' && v !== null && 'value' in v) {
    return String((v as Record<string, unknown>).value ?? '');
  }
  return null;
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '50'), 100);
  const pageNumber = Number(searchParams.get('pageNumber') ?? '1');
  const text = searchParams.get('text')?.trim() || '*';
  const programme = searchParams.get('programme') ?? '';
  const debug = searchParams.get('debug') === '1';

  // Programma filtrato lato client (vedi EUCallsImportModal.tsx) perché il campo
  // frameworkProgramme nell'indice EU non risponde affidabilmente al filtro
  // server-side. Qui ignoriamo `programme` ma teniamo il parametro per retrocompat.
  void programme;
  // Aumentiamo pageSize per dare margine al filtro client
  const fetchSize = Math.min(pageSize * 3, 250);
  const url = `${EU_API}?apiKey=SEDIA&text=${encodeURIComponent(text)}&pageSize=${fetchSize}&pageNumber=${pageNumber}`;

  // Filtro per data server-side: solo bandi con scadenza futura.
  // Il filtro per status non è affidabile nell'indice SEDIA (restituisce bandi
  // del 2016-2020 ancora marcati come Open). Il range su deadlineDate è più preciso.
  const nowISO = new Date().toISOString();
  const formBody = new URLSearchParams({
    languages: 'en',
    query: JSON.stringify({
      bool: {
        must: [
          { range: { deadlineDate: { gte: nowISO } } },
        ],
      },
    }),
    sort: JSON.stringify([{ field: 'deadlineDate', order: 'ASC' }]),
  });

  let euRes: Response;
  try {
    euRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'commerciale-app/1.0',
      },
      body: formBody.toString(),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Errore di rete verso EU Portal', detail: String(e) }), { status: 502 });
  }

  if (!euRes.ok) {
    const txt = await euRes.text().catch(() => '');
    return new Response(
      JSON.stringify({
        error: `EU Portal ha risposto ${euRes.status}`,
        detail: txt.slice(0, 800),
        url: url.replace(/apiKey=[^&]+/, 'apiKey=***'),
        body: formBody.toString().slice(0, 500),
      }),
      { status: 502 },
    );
  }

  const rawText = await euRes.text();
  let raw: EUApiResponse;
  try {
    raw = JSON.parse(rawText) as EUApiResponse;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Risposta EU Portal non è JSON', detail: rawText.slice(0, 500), parseError: String(e) }),
      { status: 502 },
    );
  }

  const results: EUApiResult[] = raw.results ?? [];

  const calls: EUCall[] = results
    .map((r) => {
      const m = r.metadata ?? {};
      // PREFERIAMO callIdentifier (es. "HORIZON-CL3-2024-CIVSEC-01") perché contiene
      // il prefisso del programma; usiamo identifier (es. "CIVSEC-01-01") solo come fallback
      const callId = first(m.callIdentifier);
      const topicId = first(m.identifier) ?? first(m.topicCode) ?? r.reference;
      const id = callId ?? topicId ?? null;
      const title = first(m.title) ?? first(m.callTitle) ?? r.title ?? null;
      if (!id || !title) return null;
      const fwProgId = first(m.frameworkProgramme) ?? '';
      const periodo = first(m.programmePeriod) ?? '';
      // Inferenza del nome programma: 1) ID numerico noto, 2) prefisso identifier, 3) periodo
      const idUpper = id.toUpperCase();
      let programmeLabel = PROGRAMME_NAMES[fwProgId] ?? '';
      if (!programmeLabel) {
        if (idUpper.startsWith('HORIZON-') || idUpper.startsWith('ERC-') || idUpper.startsWith('MSCA-')) programmeLabel = 'Horizon Europe';
        else if (idUpper.startsWith('H2020-')) programmeLabel = 'Horizon 2020';
        else if (idUpper.startsWith('LIFE-')) programmeLabel = 'LIFE';
        else if (idUpper.startsWith('DIGITAL-')) programmeLabel = 'Digital Europe';
        else if (idUpper.startsWith('CEF-') || idUpper.startsWith('CINEA-CEF')) programmeLabel = 'CEF';
        else if (idUpper.startsWith('ERASMUS-')) programmeLabel = 'Erasmus+';
        else if (idUpper.startsWith('EU4H-') || idUpper.startsWith('EU4HEALTH')) programmeLabel = 'EU4Health';
        else if (idUpper.startsWith('AMIF-')) programmeLabel = 'AMIF';
        else if (idUpper.startsWith('ISF-')) programmeLabel = 'ISF';
        else if (idUpper.startsWith('EMFAF-')) programmeLabel = 'EMFAF';
        else if (idUpper.startsWith('CERV-')) programmeLabel = 'CERV';
        else if (idUpper.startsWith('JUST-')) programmeLabel = 'Justice';
        else if (idUpper.startsWith('I3-')) programmeLabel = 'Interregional Innovation';
        else if (idUpper.startsWith('SMP-')) programmeLabel = 'Single Market Programme';
        else if (idUpper.startsWith('UCPM-')) programmeLabel = 'Civil Protection';
        else if (idUpper.startsWith('EDF-')) programmeLabel = 'European Defence Fund';
        else programmeLabel = periodo ? `Programma ${periodo}` : 'Altro';
      }
      const rawDeadline = first(m.deadlineDate);
      const deadline = rawDeadline ? rawDeadline.slice(0, 10) : null;
      const description = stripHtml(first(m.descriptionByte) ?? first(m.description) ?? r.summary ?? null);
      const portalUrl = (typeof r.url === 'string' ? r.url : Array.isArray(r.url) ? r.url[0] : '') ?? '';
      return {
        identifier: id,
        title,
        programme: programmeLabel,
        deadline,
        status: first(m.status) ?? 'OPEN',
        description: description ? description.slice(0, 600) : null,
        url: portalUrl || `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent((topicId ?? id).toLowerCase())}`,
      } satisfies EUCall;
    })
    .filter((c): c is EUCall => c !== null);

  const responseBody: Record<string, unknown> = {
    calls,
    total: raw.totalResults ?? raw.totalCount ?? calls.length,
    rawResultCount: results.length,
  };

  if (debug && results.length > 0) {
    responseBody.firstRaw = results[0];
  } else if (debug && results.length === 0) {
    responseBody.rawText = rawText.slice(0, 1500);
  }

  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
