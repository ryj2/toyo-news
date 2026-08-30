import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { unstable_cache } from 'next/cache';

import { archiveFresh, articleKey, ArticleRecord, loadArchive, saveArchive } from './archive';

// 只允许本站 feed 里出现过的媒体域名。
// 这不是保守，是必须：没有白名单，/read 就是任意 URL 代理，/api/img 就是开放代理。
const ALLOWED_ROOTS = [
  'thepaper.cn',
  'ithome.com',
  'oschina.com',
  'oschina.net',
  'ifanr.com',
  'sspai.com',
  'dtnews.net',
  'nbd.com.cn',
  'zhihu.com',
  'bbci.co.uk',
  'bbc.com',
  '36kr.com',
  'huxiu.com',
  'huxiucdn.com',
  'people.com.cn',
  'chinanews.com.cn',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_ROOTS.some((root) => h === root || h.endsWith('.' + root));
}

/** 列表页的标题统一指向本站阅读视图 */
export function readHref(url: string): string {
  return `/read?u=${encodeURIComponent(url)}`;
}

/** 严格校验：协议、端口、IP 字面量、最终跳转后的域名都要在范围内 */
export function safeReadUrl(raw: string | null | undefined): { ok: true; url: URL } | { ok: false; reason: string } {
  if (!raw) return { ok: false, reason: '缺少 url 参数' };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'url 不是合法地址' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { ok: false, reason: '只允许 http/https' };
  if (u.port) return { ok: false, reason: '不允许非标准端口' };
  if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) || u.hostname === 'localhost' || u.hostname.endsWith('.local')) {
    return { ok: false, reason: '不允许直接访问主机地址' };
  }
  if (!hostAllowed(u.hostname)) return { ok: false, reason: `域名 ${u.hostname} 不在源站白名单内` };
  return { ok: true, url: u };
}

export type ReadMode = 'live' | 'archive' | 'stale';

export interface ReadResult {
  ok: boolean;
  reason?: string;
  /** live=本次实时抓取 archive=新鲜存档 stale=源站失败后回退的较早存档 */
  mode: ReadMode;
  url: string;
  host: string;
  title: string;
  byline: string;
  excerpt: string;
  siteName: string;
  publishedAt: string;
  /** 已清洗并改写过的正文 HTML */
  html: string;
  words: number;
  fetchedAt: number;
}

const DENY_TAGS = new Set([
  'script', 'style', 'noscript', 'iframe', 'frame', 'object', 'embed', 'link', 'meta',
  'form', 'input', 'button', 'select', 'textarea', 'svg', 'math', 'video', 'audio', 'canvas',
]);

function cleanAndRewrite(doc: Document, base: URL): string {
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    if (DENY_TAGS.has(el.tagName.toLowerCase())) el.remove();
  }

  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(attr.name);
      if ((n === 'href' || n === 'src' || n === 'srcset' || n === 'poster') && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  // 图片走本站代理：国内 CDN 普遍校验 Referer，直链在别的域下会 403
  for (const img of Array.from(doc.body.querySelectorAll('img'))) {
    const src = img.getAttribute('src') || img.getAttribute('data-src');
    if (!src) {
      img.remove();
      continue;
    }
    try {
      const abs = new URL(src, base);
      if (hostAllowed(abs.hostname)) {
        img.setAttribute('src', `/api/img?u=${encodeURIComponent(abs.href)}`);
      } else {
        img.remove();
      }
    } catch {
      img.remove();
    }
    img.setAttribute('loading', 'lazy');
    img.removeAttribute('srcset');
    img.removeAttribute('data-src');
  }

  for (const a of Array.from(doc.body.querySelectorAll('a'))) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer nofollow');
  }

  return doc.body.innerHTML;
}

async function doRead(raw: string): Promise<ReadResult> {
  const checked = safeReadUrl(raw);
  const base = checked.ok ? checked.url : null;
  const fail = (reason: string): ReadResult => ({
    ok: false, mode: 'live', reason, url: raw ?? '', host: base?.hostname ?? '—', title: '', byline: '', excerpt: '',
    siteName: '', publishedAt: '', html: '', words: 0, fetchedAt: Date.now(),
  });

  if (!checked.ok) return fail(checked.reason);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(checked.url.href, {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'accept-language': 'zh-CN,zh;q=0.9' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);

    // 跳转可能把人带出白名单，最终地址必须再校验一次
    const finalCheck = safeReadUrl(res.url || checked.url.href);
    if (!finalCheck.ok) return fail(`跳转后离开白名单：${finalCheck.reason}`);
    if (!res.ok) return fail(`源站返回 ${res.status}`);

    const html = await res.text();
    const dom = new JSDOM(html, { url: finalCheck.url.href });
    const parsed = new Readability(dom.window.document, { charThreshold: 400 }).parse();
    if (!parsed?.content) return fail('没能从该页面抽取到正文，可能是纯 JS 渲染页');

    const doc = new JSDOM(`<!doctype html><body>${parsed.content}</body>`);
    const body = doc.window.document;
    const cleaned = cleanAndRewrite(body, finalCheck.url);

    const published =
      body.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
      body.querySelector('time')?.getAttribute('datetime') ||
      '';

    const text = (parsed.textContent ?? '').replace(/\s+/g, ' ').trim();

    return {
      ok: true,
      mode: 'live',
      url: finalCheck.url.href,
      host: finalCheck.url.hostname,
      title: (parsed.title ?? '').trim() || text.slice(0, 40),
      byline: (parsed.byline ?? '').trim(),
      excerpt: (parsed.excerpt ?? '').trim().slice(0, 120),
      siteName: (parsed.siteName ?? '').trim(),
      publishedAt: published,
      html: cleaned,
      words: text.length,
      fetchedAt: Date.now(),
    };
  } catch (e) {
    return fail(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }
}

// 5 分钟短缓存：给读者的临时重排，长期存档由 archive 层负责
export const fetchArticle = unstable_cache(doRead, ['read'], { revalidate: 300 });

/** 兼容旧引用（read 页面等）：实时抓取，不经存档 */
export const readArticle = fetchArticle;

function recordToResult(rec: ArticleRecord, mode: ReadMode): ReadResult {
  return { ok: true, mode, ...rec };
}

/**
 * 混合读取：新鲜存档直接返回；否则实时抓取并写入存档；
 * 实时失败但有旧存档时用旧存档兜底。
 */
export async function readArticleWithArchive(raw: string): Promise<ReadResult> {
  const key = articleKey(raw ?? '');

  if (key) {
    const rec = await loadArchive(key);
    if (rec && archiveFresh(rec)) return recordToResult(rec, 'archive');
  }

  const live = await fetchArticle(raw);
  if (live.ok) {
    const record = {
      url: live.url, host: live.host, title: live.title, byline: live.byline,
      excerpt: live.excerpt, siteName: live.siteName, publishedAt: live.publishedAt,
      html: live.html, words: live.words, fetchedAt: live.fetchedAt,
    };
    // 源站重定向后 final URL 与入口 URL 的 key 可能不同：两个 key 都存，
    // 保证下次从任一入口进来都能命中
    if (key) await saveArchive(key, record);
    const finalKey = articleKey(live.url);
    if (finalKey && finalKey !== key) await saveArchive(finalKey, record);
    return live;
  }

  if (key) {
    const rec = await loadArchive(key);
    if (rec) return recordToResult(rec, 'stale');
  }
  return live;
}

export async function fetchImage(url: string): Promise<{ body: ReadableStream<Uint8Array> | null; type: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const res = await fetch(url, { headers: { 'user-agent': UA, referer: new URL(url).origin }, redirect: 'follow', signal: controller.signal });
  clearTimeout(timer);
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !/^image\//i.test(type)) return { body: null, type };
  return { body: res.body, type };
}
