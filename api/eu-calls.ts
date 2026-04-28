// Vercel Serverless Function (Edge runtime)
// Proxy verso l'API pubblica del EU Funding & Tenders Portal.
// Restituisce i bandi aperti (deadline futura) con i campi normalizzati.

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

interface EUApiMetadata {
  identifier?: string[];
  title?: Array<{ value?: string } | string>;
  deadlineDate?: string[];
  programmePeriod?: string[];
  frameworkProgramme?: string[];
  status?: string[];
  description?: Array<{ value?: string } | string>;
}

interface EUApiResult {
  metadata?: EUApiMetadata;
}

interface EUApiResponse {
  results?: EUApiResult[];
  totalCount?: number;
}

const EU_API = 'https://api.tech.ec.europa.eu/search-api/get-results';

function first(arr: unknown[] | undefined): string | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const v = arr[0];
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v !== null && 'value' in v) {
    return String((v as Record<string, unknown>).value ?? '');
  }
  return null;
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

  // Fetch più risultati per compensare il filtraggio lato server
  const fetchSize = Math.min(pageSize * 2, 100);

  const params = new URLSearchParams({
    apiKey: 'SEDIA',
    text,
    pageSize: String(fetchSize),
    pageNumber: String(pageNumber),
    order: 'ASC',
    sortBy: 'deadlineDate',
    output: 'json',
  });

  // Filtro per programma (semplice, solo se specificato)
  if (programme) {
    params.set('freeTextSearchLanguage', 'en');
    params.set('query', JSON.stringify({ bool: { must: [{ term: { frameworkProgramme: programme } }] } }));
  }

  const fullUrl = `${EU_API}?${params.toString()}`;

  let euRes: Response;
  try {
    euRes = await fetch(fullUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'commerciale-app/1.0',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Errore di rete verso EU Portal', detail: String(e) }), { status: 502 });
  }

  if (!euRes.ok) {
    const txt = await euRes.text().catch(() => '');
    return new Response(
      JSON.stringify({
        error: `EU Portal ha risposto ${euRes.status}`,
        detail: txt.slice(0, 500),
        url: fullUrl.replace(/apiKey=[^&]+/, 'apiKey=***'),
      }),
      { status: 502 },
    );
  }

  const raw = await euRes.json() as EUApiResponse;
  const results: EUApiResult[] = raw.results ?? [];

  const today = new Date().toISOString().slice(0, 10);

  const calls: EUCall[] = results
    .map((r) => {
      const m = r.metadata ?? {};
      const id = first(m.identifier);
      const title = first(m.title);
      if (!id || !title) return null;
      const prog = first(m.frameworkProgramme) ?? first(m.programmePeriod) ?? '';
      const rawDeadline = first(m.deadlineDate);
      const deadline = rawDeadline ? rawDeadline.slice(0, 10) : null;
      const description = first(m.description);
      const url = `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${encodeURIComponent(id.toLowerCase())}`;
      return {
        identifier: id,
        title,
        programme: prog,
        deadline,
        status: first(m.status) ?? 'OPEN',
        description,
        url,
      } satisfies EUCall;
    })
    .filter((c): c is EUCall => c !== null)
    // Filtra scaduti lato server
    .filter((c) => !c.deadline || c.deadline >= today)
    .slice(0, pageSize);

  return new Response(
    JSON.stringify({ calls, total: raw.totalCount ?? calls.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
