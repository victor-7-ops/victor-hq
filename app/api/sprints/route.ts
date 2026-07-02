import { NextResponse } from 'next/server';
import { parseAllSprints } from '@/lib/parsers/sprint-markdown';
import { getConfig } from '@/lib/db/queries';
import { resolveHomePath } from '@/lib/utils';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getConfig();
    let sprints: any[] = [];

    if (config.projectRepoPath) {
      const repoPath = resolveHomePath(config.projectRepoPath);
      sprints = parseAllSprints(repoPath);
    }

    return NextResponse.json({ sprints });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), sprints: [] }, { status: 500 });
  }
}
