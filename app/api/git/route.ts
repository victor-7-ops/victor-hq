import { NextResponse } from 'next/server';
import { getGitInfo } from '@/lib/git/repo';
import { getConfig } from '@/lib/db/queries';
import { resolveHomePath } from '@/lib/utils';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getConfig();
    if (!config.projectRepoPath) {
      return NextResponse.json({ error: 'No repo path configured', git: null });
    }

    const repoPath = resolveHomePath(config.projectRepoPath);
    const gitInfo = await getGitInfo(repoPath);

    return NextResponse.json({ git: gitInfo });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), git: null }, { status: 500 });
  }
}
