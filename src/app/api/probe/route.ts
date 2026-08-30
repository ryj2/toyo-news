import { NextResponse } from 'next/server';
import { runProbe } from '@/lib/probe';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const results = await runProbe();
  return NextResponse.json(
    {
      region: process.env.VERCEL_REGION ?? 'local',
      checkedAt: new Date().toISOString(),
      usable: results.filter((r) => r.ok).length,
      total: results.length,
      results,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
}
