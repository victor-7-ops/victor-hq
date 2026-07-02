import { describe, it, expect } from 'vitest'
import { apiErrorResponse, errorMessage } from '@/lib/api-error'

describe('errorMessage()', () => {
  it('returns the message from an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns the fallback for non-Error values', () => {
    expect(errorMessage('boom')).toBe('Unknown error')
    expect(errorMessage(null)).toBe('Unknown error')
    expect(errorMessage(undefined, 'custom')).toBe('custom')
  })
})

describe('apiErrorResponse()', () => {
  it('serializes an Error message with default status 500', async () => {
    const res = apiErrorResponse(new Error('kaput'))
    expect(res.status).toBe(500)
    expect(res.headers.get('Content-Type')).toBe('application/json')
    expect(await res.json()).toEqual({ error: 'kaput' })
  })

  it('uses the fallback message for non-Error values and honors status', async () => {
    const res = apiErrorResponse('nope', 'Custom fallback', 400)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Custom fallback' })
  })
})
