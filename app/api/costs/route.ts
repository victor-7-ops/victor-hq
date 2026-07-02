import { getCronRuns, getJobNames } from '@/lib/cron-runs'
import { computeCostSummary } from '@/lib/costs'
import { apiErrorResponse } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const runs = getCronRuns()
    const summary = computeCostSummary(runs)
    const jobNames = getJobNames()
    const res = NextResponse.json({ ...summary, jobNames })
    res.headers.set('Cache-Control', 'public, max-age=60')
    return res
  } catch (err) {
    return apiErrorResponse(err, 'Failed to compute costs')
  }
}
