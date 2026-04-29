// Vercel Serverless Function (Edge runtime)
// Proxy verso l'API pubblica EU Funding & Tenders Portal (SEDIA).
// Nota: l'indice SEDIA include sia bandi storici sia correnti; usare la
// ricerca per keyword (es. "HORIZON 2026") per trovare bandi recenti.

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

interface EUMeta {
  identifier?: unknown;
  callIdentifier?: unknown;
  topicCode?: unknown;
  title?: unknown;
  callTitle?: unknown;
  deadlineDate?: unknown;
  programmePeriod?: unknown;
  frameworkProgramme?: unknown;
  status?: unknown;
  description?: unknown;
  descriptionByte?: unknown;
}

interface EUResult {
  metadata?: EUMeta;
  reference?: string;
  url?: string | string[];
  summary?: string;
  title?: string;
}

interface EUResponse {
  results?: EUResult[];
  totalResults?: number;
  totalCount?: number;
}

const EU_API = 'https://api.tech.ec.europa.eu/search-api/prod/rest/search';

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
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) return first(v[0]);
  if (typeof v === 'object' && 'value' in (v as object))
    return String((v as Record<string, unknown>).value ?? '') || null;
  return null;
}

function stripHtml(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

function inferProgramme(id: string, fwProgId: string, periodo: string): string {
  const label = PROGRAMME_NAMES[fwProgId];
  if (label) return label;
  const u = id.toUpperCase();
  if (u.startsWith('HORIZON-') || u.startsWith('ERC-') || u.startsWith('MSCA-')) return 'Horizon Europe';
  if (u.startsWith('H2020-')) return 'Horizon 2020';
  if (u.startsWith('LIFE-')) return 'LIFE';
  if (u.startsWith('DIGITAL-')) return 'Digital Europe';
  if (u.startsWith('CEF-') || u.startsWith('CINEA-CEF')) return 'CEF';
  if (u.startsWith('ERASMUS-')) return 'Erasmus+';
  if (u.startsWith('EU4H-') || u.startsWith('EU4HEALTH')) return 'EU4Health';
  if (u.startsWith('AMIF-')) return 'AMIF';
  if (u.startsWith('ISF-')) return 'ISF';
  if (u.startsWith('EMFAF-')) return 'EMFAF';
  if (u.startsWith('CERV-')) return 'CERV';
  if (u.startsWith('JUST-')) return 'Justice';
  if (u.startsWith('SMP-')) return 'Single Market Programme';
  if (u.startsWith('UCPM-')) return 'Civil Protection';
  if (u.startsWith('EDF-')) return 'European Defence Fund';
  return periodo ? `Programma ${periodo}` : 'Altro';
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '100'), 200);
  const pageNumber = Number(searchParams.get('pageNumber') ?? '1');
  const text = searchParams.get('text')?.trim() || '*';
  const debug = searchParams.get('debug') === '1';

  const fetchSize = Math.min(pageSize * 3, 300);
  const url = `${EU_API}?apiKey=SEDIA&text=${encodeURIComponent(text)}&pageSize=${fetchSize}&pageNumber=${pageNumber}`;

  const formBody = new URLSearchParams({
    languages: 'en',
    query: JSON.stringify({ bool: { must: [{ terms: { status: ['31094501', '31094502'] } }] } }),
    sort: JSON.stringify([{ field: 'startDate', order: 'DESC' }]),
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
    return new Response(JSON.stringify({ error: 'Errore rete EU Portal', detail: String(e) }), { status: 502 });
  }

  if (!euRes.ok) {
    const txt = await euRes.text().catch(() => '');
    return new Response(
      JSON.stringify({ error: `EU Portal ha risposto ${euRes.status}`, detail: txt.slice(0, 600) }),
      { status: 502 },
    );
  }

  const rawText = await euRes.text();
  let raw: EUResponse;
  try {
    raw = JSON.parse(rawText) as EUResponse;
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Risposta non JSON', detail: rawText.slice(0, 400), parseError: String(e) }),
      { status: 502 },
    );
  }

  const results: EUResult[] = raw.results ?? [];

  const calls: EUCall[] = results
    .map((r) => {
      const m = r.metadata ?? {};
      const callId = first(m.callIdentifier);
      const topicId = first(m.identifier) ?? first(m.topicCode) ?? r.reference ?? null;
      const id = callId ?? topicId;
      const title = first(m.title) ?? first(m.callTitle) ?? r.title ?? null;
      if (!id || !title) return null;

      const programme = inferProgramme(id, first(m.frameworkProgramme) ?? '', first(m.programmePeriod) ?? '');
      const deadline = (() => { const d = first(m.deadlineDate); return d ? d.slice(0, 10) : null; })();
      const description = stripHtml(first(m.descriptionByte) ?? first(m.description) ?? r.summary ?? null);
      const portalUrl =
        (typeof r.url === 'string' ? r.url : Array.isArray(r.url) ? r.url[0] : null) ??
        `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent((topicId ?? id).toLowerCase())}`;

      return {
        identifier: id,
        title,
        programme,
        deadline,
        status: first(m.status) ?? 'OPEN',
        description: description ? description.slice(0, 600) : null,
        url: portalUrl,
      } satisfies EUCall;
    })
    .filter((c): c is EUCall => c !== null);

  const body: Record<string, unknown> = {
    calls,
    total: raw.totalResults ?? raw.totalCount ?? calls.length,
    rawResultCount: results.length,
  };
  if (debug) body.firstRaw = results[0] ?? null;

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
