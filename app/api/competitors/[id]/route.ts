import { NextRequest, NextResponse } from 'next/server';
import { getCompetitor, updateCompetitor, deleteCompetitor } from '@/lib/db/queries';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comp = getCompetitor(id);
  if (!comp) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(comp);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  updateCompetitor(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteCompetitor(id);
  return NextResponse.json({ ok: true });
}
