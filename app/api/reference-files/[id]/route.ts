import { NextRequest, NextResponse } from 'next/server';
import { getReferenceFile, updateReferenceFile, deleteReferenceFile } from '@/lib/db/queries';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const file = getReferenceFile(id);
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(file);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  updateReferenceFile(id, body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  deleteReferenceFile(id);
  return NextResponse.json({ ok: true });
}
