import RSSParser from 'rss-parser';
import { unstable_cache } from 'next/cache';
import { after } from 'next/server';

import { loadNewsSnapshot, saveNewsSnapshot } from './archive';
import { REVALIDATE_SECONDS, SOURCES, type SectionId, type SourceDef } from './sources';

export interface NewsItem {
  key: string;
  title: string;
  url: string;
  sourceId: string;
  sourceName: string;
  section: SectionId;
  weight: number;
  time: number | null;
  /** RSS 里能提取到的配图（走 /api/img 代理显示），可能没有 */
  image?: string;
  /** 只保留极短摘要 */
  snippet: string;
}

export interface LoadReport {
  items: NewsItem[];
  /** 失败的源，页面上要显式说明，不能装作没有 */
  failed: { id: string; name: string; error: string }[];
  fetchedAt: number;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const parser = new RSSParser({
  timeout: 12000,
  headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml, */*' },
  customFields: {
    item: [
      ['pubDate'],
      ['dc:date', 'creator'],
      ['content:encoded', 'contentEncoded'],
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
    ],
  },
});

function stripHtml(html: string): string {
  // 刻意只留很短一段：列表页不承载正文，正文在阅读视图
  const text = html
    .replace(/<\!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 64 ? text.slice(0, 64).trimEnd() + '…' : text;
}

/** 从 RSS item 的各种位置提取一张配图：enclosure → media:content → media:thumbnail → 正文首个 <img> */
function pickImage(it: Record<string, unknown>): string | undefined {
  const cands: unknown[] = [
    (it.enclosure as { url?: string } | undefined)?.url,
    (it.mediaContent as { $?: { url?: string } } | undefined)?.$?.url,
    ...(Array.isArray(it.mediaContent)
      ? (it.mediaContent as { $?: { url?: string } }[]).map((m) => m?.$?.url)
      : []),
    (it.mediaThumbnail as { $?: { url?: string } } | undefined)?.$?.url,
    ...(Array.isArray(it.mediaThumbnail)
      ? (it.mediaThumbnail as { $?: { url?: string } }[]).map((m) => m?.$?.url)
      : []),
  ];
  const html = `${(it.contentEncoded as string) ?? ''} ${(it.content as string) ?? ''}`;
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (m) cands.push(m[1]);

  // 候选都来自图片专属字段或 <img> 标签，只需校验协议与形态
  for (const c of cands) {
    if (typeof c !== 'string' || !c) continue;
    if (/^data:|^blob:/i.test(c)) continue;
    try {
      const u = new URL(c, 'https://example.invalid');
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
      return u.href;
    } catch {
      continue;
    }
  }
  return undefined;
}

async function fetchOne(source: SourceDef): Promise<NewsItem[]> {
  const urls = [source.url, ...(source.fallbacks ?? [])];
  let lastError = 'unknown';

  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      const items = (feed.items ?? []).slice(0, 25);
      if (!items.length) throw new Error('empty feed');

      return items.map((it, i) => {
        const link = (it.link ?? '').trim();
        const dateRaw = it.isoDate ?? it.pubDate ?? '';
        const ts = dateRaw ? Date.parse(dateRaw) : NaN;
        return {
          key: `${source.id}-${i}`,
          title: stripHtml(it.title ?? '(无标题)'),
          url: link,
          sourceId: source.id,
          sourceName: source.name,
          section: source.section,
          weight: source.weight,
          time: Number.isFinite(ts) ? ts : null,
          image: pickImage(it as unknown as Record<string, unknown>),
          snippet: it.contentSnippet || it.content ? stripHtml(it.contentSnippet ?? it.content ?? '') : '',
        };
      });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError);
}

export async function loadAll(): Promise<LoadReport> {
  const settled = await Promise.allSettled(SOURCES.map((s) => fetchOne(s)));
  const items: NewsItem[] = [];
  const failed: LoadReport['failed'] = [];

  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') items.push(...res.value);
    else failed.push({ id: SOURCES[i].id, name: SOURCES[i].name, error: String(res.reason?.message ?? res.reason) });
  });

  items.sort((a, b) => (b.time ?? 0) - (a.time ?? 0) || b.weight - a.weight);
  return { items, failed, fetchedAt: Date.now() };
}

export const getCachedNews = unstable_cache(loadAll, ['news'], {
  revalidate: REVALIDATE_SECONDS,
  tags: ['news'],
});

// 快照也要短缓存，避免每次请求都打一次 Blob
const getCachedSnapshot = unstable_cache(loadNewsSnapshot, ['news-snapshot'], { revalidate: 60 });

/**
 * 页面渲染入口：优先 Blob 快照（毫秒级）；
 * 快照过期就先返回旧数据、用 after() 后台刷新，冷启动不再阻塞首屏。
 */
export async function getNewsForRender(): Promise<LoadReport> {
  const snap = await getCachedSnapshot();
  if (snap && Date.now() - snap.fetchedAt < REVALIDATE_SECONDS) return snap as LoadReport;

  if (snap) {
    after(async () => {
      try {
        await saveNewsSnapshot(await getCachedNews());
      } catch {
        // 后台刷新失败不影响本次响应
      }
    });
    return snap as LoadReport;
  }

  // 完全没有快照（首次部署/清空 Blob）：老老实实同步抓
  const fresh = await getCachedNews();
  await saveNewsSnapshot(fresh);
  return fresh;
}

export function bySection(items: NewsItem[], section: SectionId): NewsItem[] {
  return items.filter((it) => it.section === section);
}

const TZ = 'Asia/Shanghai';
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function parts(ts: number) {
  const d = new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ts));
  const get = (t: string) => d.find((p) => p.type === t)?.value ?? '';
  return { month: get('month'), day: get('day'), weekday: get('weekday'), hour: get('hour'), minute: get('minute') };
}

/** 列表项精确时间：「8月30日 8:05」 */
export function fmtTimeFull(ts: number | null, tz = TZ): string {
  if (!ts) return '';
  const p = parts(ts);
  return `${p.month}月${p.day}日 ${Number(p.hour)}:${p.minute}`;
}

/** 列表项短时间：「8:05」 */
export function fmtTime(ts: number | null, tz = TZ): string {
  if (!ts) return '';
  const p = parts(ts);
  return `${Number(p.hour)}:${p.minute}`;
}

/** 相对时间：「3分钟前」「5小时前」「2天前」 */
export function fmtAgo(ts: number | null, now = Date.now()): string {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 90) return '刚刚';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}

/** 报头日期：「8月30日 周日」 */
export function fmtToday(now = Date.now()): string {
  const p = parts(now);
  return `${p.month}月${p.day}日 ${p.weekday}`;
}

/** 朝刊 4:00–15:00，其余为晚报；note 是各自的更新时刻说明 */
export function currentEdition(now = Date.now()): { name: string; note: string } {
  const hour = Number(parts(now).hour);
  return hour >= 4 && hour < 15
    ? { name: '朝刊', note: '凌晨 4 点更新' }
    : { name: '晚报', note: '下午 4 点更新' };
}

export function fmtStamp(ts: number, tz = TZ): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(ts);
}
