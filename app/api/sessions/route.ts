import { NextResponse } from 'next/server';
import { getConfig } from '@/lib/db/queries';
import { resolveHomePath, safeJsonParse } from '@/lib/utils';
import fs from 'fs';
import path from 'path';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

interface SessionData {
  id: string;
  agentId: string;
  requesterSession?: string;
  channel?: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  tokensIn: number;
  tokensOut: number;
  costUSD: number;
  model: string;
  taskCount: number;
  errorCount: number;
  lastActiveAt: string;
}

interface SubagentRun {
  id: string;
  agent: string;
  requesterSession?: string;
  channel?: string;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

function readJsonIfExists<T>(filePath: string, fallback: T): T {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return safeJsonParse(content, fallback);
  } catch {
    return fallback;
  }
}

function getSessionsFromAgentDir(agentsDir: string, agentId: string): SessionData[] {
  const sessionsFile = path.join(agentsDir, agentId, 'sessions', 'sessions.json');
  const sessionsDir = path.join(agentsDir, agentId, 'sessions');
  const sessions: SessionData[] = [];

  const sessionsData = readJsonIfExists<Record<string, any>>(sessionsFile, {});
  const sessionEntries = Object.entries(sessionsData).filter(
    ([key]) => !key.startsWith('__') && key !== 'version'
  );

  for (const [sessionKey, sessionInfo] of sessionEntries) {
    if (!sessionInfo || typeof sessionInfo !== 'object') continue;

    const tokensIn = sessionInfo.inputTokens || Math.floor((sessionInfo.totalTokens || 0) * 0.3);
    const tokensOut = sessionInfo.outputTokens || Math.floor((sessionInfo.totalTokens || 0) * 0.7);

    // Try to get more details from session files
    let taskCount = 0;
    let errorCount = 0;
    let model = sessionInfo.model || 'claude-sonnet-4-6';

    try {
      const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
      for (const file of files.slice(0, 10)) {
        const content = fs.readFileSync(path.join(sessionsDir, file), 'utf-8');
        for (const line of content.split('\n').filter(Boolean)) {
          try {
            const entry = JSON.parse(line);
            if (entry.role === 'assistant') taskCount++;
            if (entry.error || entry.isError) errorCount++;
            if (entry.model) model = entry.model;
          } catch {}
        }
      }
    } catch {}

    sessions.push({
      id: sessionKey,
      agentId: `agent-${agentId}`,
      requesterSession: sessionKey.includes(':') ? sessionKey.split(':')[1] : undefined,
      channel: sessionKey.includes('telegram') ? 'telegram' : sessionKey.includes('discord') ? 'discord' : 'webchat',
      status: sessionInfo.errorCount > 0 ? 'failed' : sessionInfo.completedAt ? 'completed' : 'running',
      startedAt: sessionInfo.createdAt || new Date().toISOString(),
      completedAt: sessionInfo.completedAt,
      tokensIn,
      tokensOut,
      costUSD: sessionInfo.costUSD || 0,
      model,
      taskCount,
      errorCount: sessionInfo.errorCount || errorCount,
      lastActiveAt: sessionInfo.updatedAt || new Date().toISOString(),
    });
  }

  return sessions;
}

export async function GET() {
  try {
    const config = getConfig();
    const dataDir = resolveHomePath(config.openclawDataDir);

    // Read subagent runs
    const subagentsFile = path.join(dataDir, 'subagents', 'runs.json');
    const subagentRuns = readJsonIfExists<SubagentRun[]>(subagentsFile, []);

    // Read sessions from all agent directories
    const agentsDir = path.join(dataDir, 'agents');
    const sessions: SessionData[] = [];

    try {
      const agentDirs = fs.readdirSync(agentsDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.'))
        .map(d => d.name);

      for (const agentId of agentDirs) {
        sessions.push(...getSessionsFromAgentDir(agentsDir, agentId));
      }
    } catch {
      // Agents dir not readable
    }

    // Add subagent runs as sessions
    for (const run of subagentRuns) {
      const existingSession = sessions.find(s => s.id === run.id);
      if (!existingSession) {
        sessions.push({
          id: run.id,
          agentId: `agent-${run.agent}`,
          requesterSession: run.requesterSession,
          channel: run.channel,
          status: (run.status as 'running' | 'completed' | 'failed') || 'running',
          startedAt: run.startedAt || new Date().toISOString(),
          completedAt: run.completedAt,
          tokensIn: 0,
          tokensOut: 0,
          costUSD: 0,
          model: 'unknown',
          taskCount: 0,
          errorCount: run.error ? 1 : 0,
          lastActiveAt: run.completedAt || run.startedAt || new Date().toISOString(),
        });
      }
    }

    // Sort by lastActiveAt descending
    sessions.sort((a, b) => 
      new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    );

    return NextResponse.json({ sessions });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error), sessions: [] }, { status: 500 });
  }
}
