import { type NextRequest, NextResponse } from 'next/server';
import { getConfig, getDailyCosts, upsertDailyCost } from '@/lib/db/queries';
import { computeCostSnapshot, computeDailyHistory, computeHourlyHistory } from '@/lib/parsers/session-cost';
import { errorMessage } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const config = getConfig();

    // --- Parse range query params ---
    const range = req.nextUrl.searchParams.get('range'); // '1h','6h','12h','1d','2d','5d','7d','14d','30d'
    const fromParam = req.nextUrl.searchParams.get('from'); // ISO string
    const toParam = req.nextUrl.searchParams.get('to'); // ISO string

    const RANGE_MAP: Record<string, { hours?: number; days?: number }> = {
      '1h': { hours: 1 }, '6h': { hours: 6 }, '12h': { hours: 12 },
      '1d': { days: 1 }, '2d': { days: 2 }, '5d': { days: 5 },
      '7d': { days: 7 }, '14d': { days: 14 }, '30d': { days: 30 },
    };

    let sinceMs: number | undefined;
    let untilMs: number | undefined;
    let historyDays = 30;
    let historyHours: number | undefined;

    if (fromParam) {
      sinceMs = new Date(fromParam).getTime();
      untilMs = toParam ? new Date(toParam).getTime() : undefined;
      historyDays = Math.ceil((Date.now() - sinceMs) / (24 * 60 * 60 * 1000));
    } else if (range && RANGE_MAP[range]) {
      const r = RANGE_MAP[range];
      if (r.hours) {
        sinceMs = Date.now() - r.hours * 60 * 60 * 1000;
        historyHours = r.hours;
      } else if (r.days) {
        sinceMs = Date.now() - r.days * 24 * 60 * 60 * 1000;
        historyDays = r.days;
      }
    }

    // --- Real cost data from session JSONL files (READ-ONLY from .openclaw) ---
    const snapshot = computeCostSnapshot(sinceMs ? { sinceMs, untilMs } : undefined);

    // --- Historical data ---
    let dailyHistory: { date: string; cost: number; tokens: number; byAgent?: Record<string, { cost: number; tokens: number }> }[] | undefined;
    let hourlyHistory: { hour: string; cost: number; tokens: number }[] | undefined;

    if (historyHours) {
      // Sub-day range: use hourly history (no DB merge needed — DB only has daily data)
      hourlyHistory = computeHourlyHistory(historyHours);
    } else {
      // Day-level range: merge DB history with session-computed history
      const dbHistory = getDailyCosts(historyDays).map((r: any) => ({
        date: r.date,
        cost: r.cost_usd || 0,
        tokens: (r.tokens_in || 0) + (r.tokens_out || 0),
      }));

      const sessionHistory = computeDailyHistory(historyDays, { includeAgentBreakdown: true });

      // Merge: prefer session data (real) over DB data (may be stale)
      const historyMap: Record<string, { cost: number; tokens: number; byAgent?: Record<string, { cost: number; tokens: number }> }> = {};
      for (const d of dbHistory) {
        historyMap[d.date] = { cost: d.cost, tokens: d.tokens };
      }
      for (const d of sessionHistory) {
        // Session data overrides DB when it has more data
        const existing = historyMap[d.date];
        if (!existing || d.cost > existing.cost) {
          historyMap[d.date] = { cost: d.cost, tokens: d.tokens, byAgent: d.byAgent };
        }
      }

      dailyHistory = Object.entries(historyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, data]) => ({ date, cost: data.cost, tokens: data.tokens, ...(data.byAgent ? { byAgent: data.byAgent } : {}) }));
    }

    // Also persist today's cost into the DB for future reference
    const todayDate = new Date().toISOString().slice(0, 10);
    if (snapshot.todaySpend > 0) {
      try {
        upsertDailyCost(todayDate, {
          totalCost: snapshot.todaySpend,
          totalTokens: snapshot.totalTokensIn + snapshot.totalTokensOut,
          costByProvider: snapshot.spendByProvider,
          costByAgent: snapshot.spendByAgent,
          cacheWriteCost: snapshot.cacheWriteCost,
          computeCost: snapshot.computeCost,
        });
      } catch {
        // Non-critical — don't fail the request
      }
    }

    // 7-day average (only meaningful with daily history)
    const historyForAvg = dailyHistory || [];
    const last7 = historyForAvg.slice(-7);
    const avg7d =
      last7.length > 0
        ? last7.reduce((s, d) => s + d.cost, 0) / last7.length
        : 0;

    // Anomalies: days where cost > 2x average
    const anomalies = historyForAvg
      .filter((d) => d.cost > avg7d * 2 && avg7d > 0)
      .map((d) => ({
        id: d.date,
        date: d.date,
        actualSpend: d.cost,
        expectedSpend: avg7d,
        probableCause: 'Daily spend exceeded 2x the 7-day average',
        createdAt: d.date,
      }));

    const totalTokens = snapshot.totalTokensIn + snapshot.totalTokensOut;

    return NextResponse.json({
      todaySpend: snapshot.todaySpend,
      dailyLimit: config.dailySpendLimit,
      spendByProvider: snapshot.spendByProvider,
      spendByAgent: snapshot.spendByAgent,
      cacheWriteCost: snapshot.cacheWriteCost,
      computeCost: snapshot.computeCost,
      ...(dailyHistory ? { dailyHistory } : {}),
      ...(hourlyHistory ? { hourlyHistory } : {}),
      anomalies,
      avg7d,
      totalTokens,
      granularity: historyHours ? 'hourly' : 'daily',
      range: range || '30d',
      // Metadata for "last updated" indicator
      _meta: {
        source: 'openclaw',
        computedAt: snapshot.computedAt,
        dataDir: snapshot.source,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
