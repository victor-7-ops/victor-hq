import { NextRequest, NextResponse } from 'next/server';
import { getCompetitors, insertCompetitor, seedDefaultCompetitors } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId') || 'default';
  seedDefaultCompetitors();
  const competitors = getCompetitors({ projectId });
  return NextResponse.json({ competitors });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, url, description, category, projectId } = body;
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const id = insertCompetitor({ name, url, description, category, projectId: projectId || 'default' });
  return NextResponse.json({ id }, { status: 201 });
}
