import { NextRequest, NextResponse } from 'next/server';
import { getReferenceFiles, insertReferenceFile, getReferenceFileTags } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get('tag') || undefined;
  const search = req.nextUrl.searchParams.get('search') || undefined;
  const tagsOnly = req.nextUrl.searchParams.get('tags') === '1';
  const projectId = req.nextUrl.searchParams.get('projectId') || 'default';

  if (tagsOnly) {
    return NextResponse.json({ tags: getReferenceFileTags({ projectId }) });
  }

  const files = getReferenceFiles({ tag, search, projectId });
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, content, tags, projectId } = body;
  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  const id = insertReferenceFile({ title, content: content || '', tags: tags || [], projectId: projectId || 'default' });
  return NextResponse.json({ id }, { status: 201 });
}
