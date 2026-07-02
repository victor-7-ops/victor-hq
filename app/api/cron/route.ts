import { NextResponse } from 'next/server';
import { getCronJobsFromFile } from '@/lib/crons';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ jobs: getCronJobsFromFile() });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), jobs: [] }, { status: 500 });
  }
}
