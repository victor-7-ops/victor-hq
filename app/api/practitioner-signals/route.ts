import { NextRequest, NextResponse } from 'next/server';
import { getPractitionerSignals, getPractitionerSignalTypes, insertPractitionerSignal } from '@/lib/db/queries';
import { practitionerSignalSchema } from '@/lib/types';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

// Canonical date handling: store as YYYY-MM-DD
function normalizeDateIso(dateIso?: string, date?: string): string {
  if (dateIso) {
    // If it's already YYYY-MM-DD, use it
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return dateIso;
    // Parse ISO timestamp and extract YYYY-MM-DD
    const parsed = new Date(dateIso);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  if (date) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const fields = searchParams.get('fields');
    const projectId = searchParams.get('projectId') || 'default';
    const signals = getPractitionerSignals({ type, projectId });

    // Lightweight dedup mode: return only url + title (~90% smaller response)
    if (fields === 'dedup') {
      return NextResponse.json({
        signals: signals.map((s: any) => ({ url: s.url, title: s.title, date_iso: s.date_iso })),
      });
    }

    const types = getPractitionerSignalTypes({ projectId });
    return NextResponse.json({ signals, types });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), signals: [], types: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const projectId = Array.isArray(body) ? (body[0]?.projectId || 'default') : (body.projectId || 'default');
    const items = Array.isArray(body) ? body : [body];

    for (const item of items) {
      // Runtime validation with Zod
      const parseResult = practitionerSignalSchema.safeParse(item);
      if (!parseResult.success) {
        const errors = parseResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        console.error('[practitioner-signals] Validation failed:', errors, JSON.stringify(item, null, 2));
        return NextResponse.json(
          { error: 'Validation failed', details: errors },
          { status: 400 },
        );
      }
      
      const validated = parseResult.data;
      
      // Normalize date_iso to canonical YYYY-MM-DD format
      const date_iso = normalizeDateIso(validated.date_iso, validated.date);
      
      insertPractitionerSignal({
        url: validated.url,
        type: validated.type,
        title: validated.title,
        platform: validated.platform,
        author: validated.author,
        verbatim: validated.verbatim,
        context: validated.context,
        relevance: validated.relevance,
        tags_json: JSON.stringify(validated.tags || []),
        date: validated.date,
        date_iso,
        projectId: item.projectId || projectId,
      });
    }
    return NextResponse.json({ inserted: items.length });
  } catch (error: unknown) {
    console.error('[practitioner-signals] Error:', error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
