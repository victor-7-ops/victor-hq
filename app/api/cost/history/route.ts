import { NextRequest, NextResponse } from 'next/server';
import { computeDailyHistoryDetailed } from '@/lib/parsers/session-cost';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const days = parseInt(req.nextUrl.searchParams.get('days') || '30', 10);
    const history = computeDailyHistoryDetailed(Math.min(days, 90));

    return NextResponse.json({
      history,
      _meta: {
        source: 'openclaw',
        computedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
