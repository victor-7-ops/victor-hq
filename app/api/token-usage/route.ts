import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/db/queries';
import { resolveHomePath } from '@/lib/utils';
import { computeTokenUsage } from '@/lib/parsers/token-usage';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getConfig();
    const openclawPath = resolveHomePath(config.openclawDataDir);
    const data = computeTokenUsage(openclawPath);
    return NextResponse.json(data);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
