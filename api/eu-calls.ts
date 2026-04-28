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

// Tipi interni per la risposta dell'API EU
interface EUApiMetadata {
  identifier?: string[];
  title?: Array<{ value?: string }>;
  deadlineDate?: string[];
  programmePeriod?: string[];
  frameworkProgramme?: string[];
  type?: string[];
  status?: string[];
  description?: Array<{ value?: string }>;
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
  if (typeof v === 'object' && v !== null && 'value' in v) return String((v as Record<string, unknown>).value ?? '');
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const { searchParams } = new URL(req.url);
  const pageSize = Math.min(Number(searchParams.get('pageSize') ?? '50'), 100);
  const pageNumber = Number(searchParams.get('pageNumber') ?? '1');
  const text = searchParams.get('text') ?? '*';
  const programme = searchParams.get('programme') ?? '';

  // Filtro: solo bandi con deadline futura
  const today = new Date().toISOString().split('T')[0];
  const mustClauses: object[] = [
    { range: { deadlineDate: { gte: today } } },
  ];
  if (programme) {
    mustClauses.push({ term: { frameworkProgramme: programme } });
  }
  const query = JSON.stringify({ bool: { must: mustClauses } });

  const params = new URLSearchParams({
    apiKey: 'SEDIA',
    text,
    pageSize: String(pageSize),
    pageNumber: String(pageNumber),
    order: 'ASC',
    sortBy: 'deadlineDate',
    output: 'json',
    query,
  });

  let euRes: Response;
  try {
    euRes = await fetch(`${EU_API}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Errore di rete verso EU Portal', detail: String(e) }), { status: 502 });
  }

  if (!euRes.ok) {
    const txt = await euRes.text();
    return new Response(JSON.stringify({ error: `EU Portal ha risposto ${euRes.status}`, detail: txt }), { status: 502 });
  }

  const raw = await euRes.json() as EUApiResponse;
  const results: EUApiResult[] = raw.results ?? [];

  const calls: EUCall[] = results
    .map((r) => {
      const m = r.metadata ?? {};
      const id = first(m.identifier);
      const title = first(m.title as unknown[]);
      if (!id || !title) return null;
      const programme = first(m.frameworkProgramme) ?? first(m.programmePeriod) ?? '';
      const deadline = first(m.deadlineDate);
      const description = first(m.description as unknown[]);
      const url = `https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/topic-details/${id.toLowerCase()}`;
      return {
        identifier: id,
        title,
        programme,
        deadline: deadline ? deadline.slice(0, 10) : null,
        status: first(m.status) ?? 'OPEN',
        description,
        url,
      } satisfies EUCall;
    })
    .filter((c): c is EUCall => c !== null);

  return new Response(
    JSON.stringify({ calls, total: raw.totalCount ?? calls.length }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
