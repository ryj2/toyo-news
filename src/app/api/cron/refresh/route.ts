import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Vercel Cron 会带上 Authorization: Bearer $CRON_SECRET（在 Project Settings → Environment Variables 里设置）
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const { getCachedNews } = await import('@/lib/news');
  const { items, failed } = await getCachedNews();
  revalidateTag('news');

  // 同步刷新首页用的 Blob 快照，保证"旧数据秒开"总是热的
  const { saveNewsSnapshot } = await import('@/lib/archive');
  await saveNewsSnapshot({ items, failed, fetchedAt: Date.now() });

  // 预存档：把首页前几条正文提前抓回来存到 Blob，读者点开时直接命中存档。
  // readArticleWithArchive 内部完成存档写入；未接通 Blob 时整段跳过。
  const archiveMod = await import('@/lib/archive');
  const { readArticleWithArchive } = await import('@/lib/reader');

  let archived = 0;
  let attempted = 0;
  let modes: Record<string, number> = {};
  if (archiveMod.archiveEnabled()) {
    const urls = [...new Set(items.map((i) => i.url).filter((u) => archiveMod.articleKey(u)))].slice(0, 10);
    attempted = urls.length;
    const results = await Promise.allSettled(urls.map((u) => readArticleWithArchive(u)));
    archived = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
    modes = results.reduce<Record<string, number>>((acc, r) => {
      if (r.status === 'fulfilled') acc[r.value.mode] = (acc[r.value.mode] ?? 0) + 1;
      else acc['rejected'] = (acc['rejected'] ?? 0) + 1;
      return acc;
    }, {});
  }

  return NextResponse.json({
    ok: failed.length === 0,
    items: items.length,
    failed: failed.map((f) => `${f.id}: ${f.error}`),
    prearchive: {
      enabled: archiveMod.archiveEnabled(),
      attempted,
      archived,
      modes,
      // 经模块命名空间实时读取；解构会拷贝调用前的旧值
      lastReadError: archiveMod.lastArchiveReadError,
      lastWriteError: archiveMod.lastArchiveWriteError,
    },
    at: new Date().toISOString(),
  });
}
