import { NextRequest, NextResponse } from 'next/server';
import { getMemoryFiles, getMemoryConfig, getMemoryStatus, computeMemoryStats } from '@/lib/memory';
import { computeMemoryHealth } from '@/lib/memory-health';
import { getMem0Config, getMem0Memories } from '@/lib/mem0';
import { writeMemoryFile, PathValidationError } from '@/lib/memory-write';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const files = await getMemoryFiles();
    const config = getMemoryConfig();
    const status = getMemoryStatus();
    const stats = computeMemoryStats(files);
    const health = computeMemoryHealth(files, config, status, stats);

    const mem0Config = getMem0Config();
    const mem0 = mem0Config
      ? {
          enabled: mem0Config.enabled,
          userId: mem0Config.userId,
          memories: await getMem0Memories(),
          count: 0,
        }
      : null;
    if (mem0) mem0.count = mem0.memories.length;

    return NextResponse.json({ files, config, status, stats, health, mem0 });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { relativePath, content, expectedLastModified } = body;

    if (typeof relativePath !== 'string' || typeof content !== 'string') {
      return NextResponse.json({ error: 'relativePath and content are required' }, { status: 400 });
    }

    const result = writeMemoryFile(relativePath, content, expectedLastModified);
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof PathValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') {
      return NextResponse.json({ error: errorMessage(error) }, { status: 404 });
    }
    if (code === 'ECONFLICT') {
      return NextResponse.json({ error: errorMessage(error) }, { status: 409 });
    }
    if (code === 'EINVAL' || code === 'E2BIG') {
      return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
