import { NextRequest, NextResponse } from 'next/server';
import { getMarketSignals, getMarketSignalTypes, insertMarketSignal } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const fields = searchParams.get('fields');
    const projectId = searchParams.get('projectId') || 'default';
    const signals = getMarketSignals({ type, projectId });

    // Lightweight dedup mode: return only url + title (~90% smaller response)
    if (fields === 'dedup') {
      return NextResponse.json({
        signals: signals.map((s: any) => ({ url: s.url, title: s.title, date_iso: s.date_iso })),
      });
    }

    const types = getMarketSignalTypes({ projectId });
    return NextResponse.json({ signals, types });
  } catch (error: unknown) {
    console.error('[market-intel] GET error:', error);
    return NextResponse.json({ error: errorMessage(error), signals: [], types: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = Array.isArray(body) ? (body[0]?.projectId || 'default') : (body.projectId || 'default');
    const items = Array.isArray(body) ? body : [body];
    for (const item of items) {
      if (!item.url || !item.type || !item.title) {
        console.error('[market-intel] Validation failed: missing required fields', JSON.stringify(item, null, 2));
        return NextResponse.json(
          { error: 'Required fields: url, type, title' },
          { status: 400 },
        );
      }
      insertMarketSignal({ ...item, projectId: item.projectId || projectId });
    }
    return NextResponse.json({ inserted: items.length });
  } catch (error: unknown) {
    console.error('[market-intel] POST error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
