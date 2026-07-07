import { NextRequest, NextResponse } from 'next/server';
import { getCompetitors, insertCompetitor, seedDefaultCompetitors } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || 'default';
    seedDefaultCompetitors();
    const competitors = getCompetitors({ projectId });
    return NextResponse.json({ competitors });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, url, description, category, projectId } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const id = insertCompetitor({ name, url, description, category, projectId: projectId || 'default' });
    return NextResponse.json({ id }, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
