import { NextResponse } from 'next/server';
import { getDSSummary, getDSDistinctComponents, getDSDistinctBatches } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = getDSSummary();
    const components = getDSDistinctComponents();
    const batches = getDSDistinctBatches();
    return NextResponse.json({ ...summary, availableComponents: components, availableBatches: batches });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 },
    );
  }
}
