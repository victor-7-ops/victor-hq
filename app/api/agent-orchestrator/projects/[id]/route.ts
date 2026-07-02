import { setProjectOwner, clearProjectOwner } from '@/lib/db/queries'
import { apiErrorResponse } from '@/lib/api-error'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json().catch(() => null)
    if (body === null || !('ownerAgentId' in body)) {
      return apiErrorResponse(new Error('body must include ownerAgentId (string or null)'), 'Invalid body', 400)
    }
    const { ownerAgentId } = body
    if (ownerAgentId === null) {
      clearProjectOwner(id)
    } else if (typeof ownerAgentId === 'string' && ownerAgentId.trim()) {
      setProjectOwner(id, ownerAgentId.trim())
    } else {
      return apiErrorResponse(new Error('ownerAgentId must be a non-empty string or null'), 'Invalid ownerAgentId', 400)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    return apiErrorResponse(err, 'Failed to update project owner')
  }
}
