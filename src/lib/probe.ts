import { SOURCES } from './sources';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export interface ProbeResult {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  status: number;
  ms: number;
  items: number;
  error?: string;
}

export async function probeUrl(id: string, name: string, url: string, timeoutMs = 12000): Promise<ProbeResult> {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const body = await res.text();
    const looksXml = /<rss|<feed|<\?xml/i.test(body.slice(0, 400));
    const items = (body.match(/<item[\s>]/g) || []).length + (body.match(/<entry[\s>]/g) || []).length;
    return {
      id,
      name,
      url,
      ok: res.ok && looksXml && items > 0,
      status: res.status,
      ms: Date.now() - t0,
      items,
      error: !looksXml ? 'response is not XML' : items === 0 ? 'no <item> found' : undefined,
    };
  } catch (e) {
    return { id, name, url, ok: false, status: 0, ms: Date.now() - t0, items: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runProbe(): Promise<ProbeResult[]> {
  const tasks = SOURCES.flatMap((s) => [s.url, ...(s.fallbacks ?? [])].map((url, i) => ({ s, url, i })));
  const results = await Promise.all(tasks.map(({ s, url, i }) => probeUrl(i === 0 ? s.id : `${s.id}#mirror`, s.name, url)));
  return results.sort((a, b) => Number(b.ok) - Number(a.ok) || b.items - a.items);
}
