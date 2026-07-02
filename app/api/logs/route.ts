import { getLogEntries, computeLogSummary } from '@/lib/logs'
import { apiErrorResponse } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const source = request.nextUrl.searchParams.get('source') ?? undefined
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : undefined

    const entries = getLogEntries({ source, limit })
    const summary = computeLogSummary(entries)

    return NextResponse.json({ entries, summary })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to load logs')
  }
}
