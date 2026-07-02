import { NextRequest, NextResponse } from 'next/server';
import { getCompetitor, updateCompetitor } from '@/lib/db/queries';
import { errorMessage } from '@/lib/api-error';

// Configure your product context here for competitive analysis
const PRODUCT_CONTEXT = process.env.COMPETITOR_PRODUCT_CONTEXT || `Your product is a software platform. Update this context in environment variable COMPETITOR_PRODUCT_CONTEXT or edit this file to describe your product for better competitive analysis.`;

function gatewayPort(): number {
  return parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10);
}

function gatewayToken(): string {
  return process.env.OPENCLAW_GATEWAY_TOKEN || '';
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comp = getCompetitor(id);
  if (!comp) {
    return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
  }

  const prompt = `You are a competitive intelligence analyst.

${PRODUCT_CONTEXT}

Your task: Provide a comprehensive competitive analysis of "${comp.name}" (${comp.url || 'no URL available'}).
Category: ${comp.category}
Current description: ${comp.description || 'none'}

Research this competitor thoroughly and return a JSON object with EXACTLY this structure:

{
  "description": "A 2-3 sentence description of what they do, their target audience, and their value proposition",
  "swot": {
    "strengths": ["strength 1", "strength 2", "strength 3", "strength 4"],
    "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
    "opportunities": ["opportunity vs this competitor 1", "opportunity 2", "opportunity 3"],
    "threats": ["threat from this competitor 1", "threat 2", "threat 3"]
  },
  "updates": [
    {"title": "Recent development title", "summary": "Brief summary", "date": "2025-XX-XX", "source": "where you found this"},
    {"title": "Another development", "summary": "Brief summary", "date": "2025-XX-XX", "source": "source"}
  ],
  "feedback": {
    "positiveThemes": ["What users love about them 1", "What users love 2"],
    "complaints": ["Common complaint 1", "Common complaint 2"],
    "quotes": ["A representative user quote or paraphrase about their experience"]
  },
  "pricing": "Brief pricing summary if known, otherwise 'Unknown'",
  "funding": "Brief funding/stage info if known, otherwise 'Unknown'",
  "keyDifferentiators": ["differentiator 1", "differentiator 2", "differentiator 3"]
}

Be specific with real information. For updates, include the most recent news, product launches, funding rounds, partnerships, or feature releases you know of. For SWOT, analyze specifically in relation to your product's positioning.

Return ONLY the JSON object, no other text.`;

  try {
    const res = await fetch(`http://localhost:${gatewayPort()}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(gatewayToken() ? { 'Authorization': `Bearer ${gatewayToken()}` } : {}),
      },
      body: JSON.stringify({
        model: 'kilocode/x-ai/grok-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Gateway error: ${res.status}`, details: text }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Extract JSON object from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse response', raw: content }, { status: 500 });
    }

    const research = JSON.parse(jsonMatch[0]);

    // Update competitor in DB with research results
    const updateData: Record<string, string> = {
      last_updated: new Date().toISOString().split('T')[0],
    };

    if (research.description) {
      updateData.description = research.description;
    }

    if (research.swot) {
      updateData.swot_json = JSON.stringify({
        ...research.swot,
        generatedAt: new Date().toISOString(),
      });
    }

    if (research.updates) {
      updateData.updates_json = JSON.stringify(research.updates);
    }

    if (research.feedback) {
      updateData.feedback_json = JSON.stringify({
        ...research.feedback,
        fetchedAt: new Date().toISOString(),
      });
    }

    updateCompetitor(id, updateData);

    // Return the full research + updated competitor
    const updated = getCompetitor(id);
    return NextResponse.json({ research, competitor: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Failed to reach researcher agent', details: errorMessage(err) },
      { status: 503 },
    );
  }
}
