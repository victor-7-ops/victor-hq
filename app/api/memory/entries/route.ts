import { NextRequest, NextResponse } from 'next/server';
import { getMemoryEntries, createMemoryEntry, markMemoryRead, getUnreadCount } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const entries = getMemoryEntries({ type, search, limit, offset });
    const unreadCount = getUnreadCount();

    return NextResponse.json({ entries, unreadCount });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), entries: [], unreadCount: 0 }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.action === 'markRead') {
      markMemoryRead(body.id);
      return NextResponse.json({ success: true });
    }

    const entry = createMemoryEntry({
      type: body.type || 'note',
      title: body.title || 'Untitled',
      content: body.content || '',
      agentId: body.agentId || null,
      tags: body.tags || [],
      isRead: false,
      metadata: body.metadata || {},
    });

    return NextResponse.json({ entry });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
