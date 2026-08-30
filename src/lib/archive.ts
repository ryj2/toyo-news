import crypto from 'node:crypto';

import { get, put } from '@vercel/blob';

/**
 * 文章存档层（Vercel Blob）。
 *
 * 没有配置 BLOB_READ_WRITE_TOKEN 时 archiveEnabled() 返回 false，
 * 所有读写静默跳过，站点退回纯实时抓取模式——本地开发零配置可跑。
 */

const PREFIX = 'article/';
const MAX_BYTES = 2 * 1024 * 1024; // 正文 JSON 超过 2MB 视为异常，不存档
// 存的转载正文不宜公开可下载；且新版 Vercel 控制台创建的 Blob store 默认就是 private，
// 用 public 会被直接拒绝（"Cannot use public access on a private store"）
const ACCESS = 'private' as const;
const RECORD_VERSION = 2;

export interface ArticleRecord {
  /** 存档格式版本：清洗规则升级时 +1，旧版本读取时视为未命中自动重抓 */
  v?: number;
  url: string;
  host: string;
  title: string;
  byline: string;
  excerpt: string;
  siteName: string;
  publishedAt: string;
  html: string;
  words: number;
  fetchedAt: number;
}

/**
 * 存档开关：经典模式注入 BLOB_READ_WRITE_TOKEN；新版控制台"连接 store"模式只注入
 * BLOB_STORE_ID（SDK 在 Vercel 运行时内免 token 访问）。任一存在即认为已接通 Blob。
 * 两者都没有就整体禁用存档，读写静默跳过——本地开发零配置可跑。
 */
export function archiveEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/** URL 归一化后取哈希做存储 key：剥 utm 追踪参数、统一 https 与尾斜杠 */
export function articleKey(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    u.protocol = 'https:';
    u.hash = '';
    for (const p of [...u.searchParams.keys()]) {
      if (p.startsWith('utm_')) u.searchParams.delete(p);
    }
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.replace(/\/+$/, '');
    return crypto.createHash('sha256').update(u.href).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

/** 诊断用：最近一次存档读/写失败的原因（正常情况下调用方不需要关心） */
export let lastArchiveReadError = '';
export let lastArchiveWriteError = '';

export async function loadArchive(key: string): Promise<ArticleRecord | null> {
  if (!archiveEnabled()) return null;
  try {
    const res = await get(`${PREFIX}${key}.json`, { access: ACCESS });
    if (!res) { lastArchiveReadError = 'get() returned null'; return null; }
    if (!res.stream) { lastArchiveReadError = 'get() returned no stream'; return null; }
    const reader = res.stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    if (buf.byteLength === 0) { lastArchiveReadError = 'blob body is empty'; return null; }
    if (buf.byteLength > MAX_BYTES) { lastArchiveReadError = `blob too large: ${buf.byteLength}`; return null; }
    const rec = JSON.parse(buf.toString('utf-8')) as ArticleRecord;
    if (!rec || typeof rec.html !== 'string' || !rec.html) return null;
    if (rec.v !== RECORD_VERSION) return null; // 旧清洗规则的存档，弃用重抓
    lastArchiveReadError = '';
    return rec;
  } catch (e) {
    // 404（首读）或网络抖动都视为未命中，由调用方回退到实时抓取
    lastArchiveReadError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return null;
  }
}

export async function saveArchive(key: string, record: ArticleRecord): Promise<boolean> {
  if (!archiveEnabled()) return false;
  if (!record.url || !record.html || record.html.length < 200) {
    lastArchiveWriteError = `record rejected: html length ${record.html.length}`;
    return false;
  }
  const body = JSON.stringify({ ...record, v: RECORD_VERSION });
  if (body.length > MAX_BYTES) {
    lastArchiveWriteError = `body too large: ${body.length}`;
    return false;
  }
  try {
    await put(`${PREFIX}${key}.json`, body, {
      access: ACCESS,
      contentType: 'application/json; charset=utf-8',
      allowOverwrite: true,
    });
    lastArchiveWriteError = '';
    return true;
  } catch (e) {
    lastArchiveWriteError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    return false;
  }
}

/** 存档新鲜度：24 小时内的存档直接展示，过期的只做兜底 */
export function archiveFresh(rec: ArticleRecord, now = Date.now()): boolean {
  return now - rec.fetchedAt < 24 * 60 * 60 * 1000;
}

// ---- 新闻快照（首页秒开用）：结构上校验，不 import news.ts 以免循环依赖 ----

const SNAPSHOT_PATH = 'news/snapshot.json';
const SNAPSHOT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 超过一周的快照视为无效

export interface NewsSnapshot {
  items: unknown[];
  failed: unknown[];
  fetchedAt: number;
}

export async function loadNewsSnapshot(): Promise<NewsSnapshot | null> {
  if (!archiveEnabled()) return null;
  try {
    const res = await get(SNAPSHOT_PATH, { access: ACCESS });
    if (!res || !res.stream) return null;
    const reader = res.stream.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const snap = JSON.parse(buf.toString('utf-8')) as NewsSnapshot;
    if (!snap || !Array.isArray(snap.items) || typeof snap.fetchedAt !== 'number') return null;
    if (Date.now() - snap.fetchedAt > SNAPSHOT_MAX_AGE) return null;
    return snap;
  } catch {
    return null;
  }
}

export async function saveNewsSnapshot(report: NewsSnapshot): Promise<void> {
  if (!archiveEnabled()) return;
  if (!Array.isArray(report.items) || report.items.length === 0) return;
  try {
    await put(SNAPSHOT_PATH, JSON.stringify(report), {
      access: ACCESS,
      contentType: 'application/json; charset=utf-8',
      allowOverwrite: true,
    });
  } catch {
    // 快照写失败只影响下次冷启动速度，不影响本次
  }
}
