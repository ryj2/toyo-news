import { NextResponse } from 'next/server';
import { fetchImage, safeReadUrl } from '@/lib/reader';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// 只代理白名单源站的图片：国内 CDN 普遍校验 Referer，直链在本域下会 403。
// 必须复用同一套 URL 校验，否则这里就是开放代理。
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u');
  const checked = safeReadUrl(raw);
  if (!checked.ok) return new NextResponse(checked.reason, { status: 403 });

  try {
    const { body, type } = await fetchImage(checked.url.href);
    if (!body) return new NextResponse('upstream not an image', { status: 502 });
    return new NextResponse(body, {
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) {
    return new NextResponse(e instanceof Error ? e.message : 'proxy failed', { status: 502 });
  }
}
