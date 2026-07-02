import { NextRequest, NextResponse } from 'next/server';
import { DSRunReportSchema } from '@/lib/ds/validation';
import { insertDSRunReport, getDSRunReports } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DSRunReportSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, errors: parsed.error.issues },
        { status: 400 },
      );
    }

    insertDSRunReport(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const reports = getDSRunReports({
      component: url.searchParams.get('component') || undefined,
      batch: url.searchParams.get('batch') || undefined,
      status: url.searchParams.get('status') || undefined,
      phase: url.searchParams.get('phase') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
      runId: url.searchParams.get('runId') || undefined,
    });
    return NextResponse.json({ reports });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 },
    );
  }
}
