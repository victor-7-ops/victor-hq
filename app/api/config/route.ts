import { NextRequest, NextResponse } from 'next/server';
import { getConfig, updateConfig } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    updateConfig(body);
    const config = getConfig();
    return NextResponse.json(config);
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
