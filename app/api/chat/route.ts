import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

const GATEWAY_PORT = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10);
const MAX_QUESTION_LENGTH = 2000;
const MAX_HISTORY = 6;

const systemPrompt = [
  'You are an AI assistant embedded in the OpenClaw Dashboard.',
  'Help the user understand and manage their system. Be concise and direct.',
].join(' ');

function readTokenFromFile(): string | null {
  try {
    const envPath = path.join(os.homedir(), '.openclaw', 'secrets', '.env');
    const contents = fs.readFileSync(envPath, 'utf-8');
    for (const line of contents.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('OPENCLAW_GATEWAY_TOKEN=')) {
        return trimmed.slice('OPENCLAW_GATEWAY_TOKEN='.length).trim();
      }
    }
  } catch {
    // File not found or unreadable
  }
  return null;
}

function getToken(): string | null {
  return process.env.OPENCLAW_GATEWAY_TOKEN || readTokenFromFile() || null;
}

export async function POST(request: NextRequest) {
  let body: { question?: string; history?: { role: string; content: string }[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { question, history } = body;

  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid question' }, { status: 400 });
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `Question exceeds maximum length of ${MAX_QUESTION_LENGTH} characters` },
      { status: 400 },
    );
  }

  const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];

  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: 'Gateway token not configured' }, { status: 500 });
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory,
    { role: 'user', content: question },
  ];

  try {
    const response = await fetch(`http://localhost:${GATEWAY_PORT}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: '',
        messages,
        max_tokens: 512,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        { error: `Gateway returned ${response.status}`, detail: text },
        { status: 502 },
      );
    }

    const result = await response.json();
    const answer = result?.choices?.[0]?.message?.content ?? '';

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ error: 'Gateway unreachable' }, { status: 502 });
  }
}
