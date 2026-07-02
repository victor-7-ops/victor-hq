import { NextRequest, NextResponse } from 'next/server';
import { getTechUpdates, getTechUpdateCategories, insertTechUpdate } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const fields = searchParams.get('fields');
    const projectId = searchParams.get('projectId') || 'default';

    const updates = getTechUpdates({ category, limit, projectId });

    // Lightweight dedup mode: return only url + title (~90% smaller response)
    if (fields === 'dedup') {
      return NextResponse.json({
        updates: updates.map((u: any) => ({ url: u.url, title: u.title, date_iso: u.date_iso })),
      });
    }

    const categories = getTechUpdateCategories({ projectId });
    return NextResponse.json({ updates, categories });
  } catch (error: unknown) {
    console.error('[tech-updates] GET error:', error);
    return NextResponse.json({ error: errorMessage(error), updates: [], categories: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = Array.isArray(body) ? (body[0]?.projectId || 'default') : (body.projectId || 'default');
    const items = Array.isArray(body) ? body : [body];
    for (const item of items) {
      if (!item.url || !item.category_id || !item.category_label || !item.title) {
        console.error('[tech-updates] Validation failed: missing required fields', JSON.stringify(item, null, 2));
        return NextResponse.json(
          { error: 'Required fields: url, category_id, category_label, title' },
          { status: 400 },
        );
      }
      insertTechUpdate({ ...item, projectId: item.projectId || projectId });
    }
    return NextResponse.json({ inserted: items.length });
  } catch (error: unknown) {
    console.error('[tech-updates] POST error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
