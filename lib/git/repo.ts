import simpleGit, { SimpleGit } from 'simple-git';
import fs from 'fs';
import path from 'path';

export interface GitInfo {
  branch: string;
  lastCommit: { hash: string; message: string; date: string; author: string } | null;
  commitHistory: { hash: string; message: string; date: string; author: string }[];
  isDirty: boolean;
  remoteUrl: string | null;
}

export async function getGitInfo(repoPath: string): Promise<GitInfo> {
  if (!fs.existsSync(repoPath)) {
    return { branch: '', lastCommit: null, commitHistory: [], isDirty: false, remoteUrl: null };
  }

  const git: SimpleGit = simpleGit(repoPath);

  try {
    const [status, log, remotes] = await Promise.all([
      git.status().catch(() => null),
      git.log({ maxCount: 20 }).catch(() => null),
      git.getRemotes(true).catch(() => []),
    ]);

    const branch = status?.current || '';
    const isDirty = status ? (status.modified.length + status.not_added.length + status.staged.length) > 0 : false;

    const commitHistory = (log?.all || []).map(c => ({
      hash: c.hash.slice(0, 7),
      message: c.message,
      date: c.date,
      author: c.author_name,
    }));

    const remoteUrl = remotes.length > 0 ? (remotes[0].refs?.fetch || null) : null;

    return {
      branch,
      lastCommit: commitHistory[0] || null,
      commitHistory,
      isDirty,
      remoteUrl,
    };
  } catch {
    return { branch: '', lastCommit: null, commitHistory: [], isDirty: false, remoteUrl: null };
  }
}

export async function getCommitsForTask(repoPath: string, taskId: string): Promise<{ hash: string; message: string; date: string }[]> {
  if (!fs.existsSync(repoPath)) return [];

  const git: SimpleGit = simpleGit(repoPath);

  try {
    const log = await git.log({ maxCount: 100 });
    return (log.all || [])
      .filter(c => c.message.toLowerCase().includes(taskId.toLowerCase()))
      .map(c => ({
        hash: c.hash.slice(0, 7),
        message: c.message,
        date: c.date,
      }));
  } catch {
    return [];
  }
}

export function findTaskFiles(repoPath: string): string[] {
  const candidates = [
    'ops/board/backlog.md',
    'ops/sprints',
    'ops/board/done',
    'TASKS.md',
    'TODO.md',
    'backlog.md',
  ];

  const found: string[] = [];
  for (const candidate of candidates) {
    const fullPath = path.join(repoPath, candidate);
    if (fs.existsSync(fullPath)) found.push(fullPath);
  }
  return found;
}
