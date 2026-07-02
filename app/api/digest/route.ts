import { NextResponse } from 'next/server';
import { generateDailyDigest } from '@/lib/scheduler/digest';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const entryId = await generateDailyDigest();
    return NextResponse.json({ success: true, entryId });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
