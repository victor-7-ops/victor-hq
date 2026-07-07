import { describe, it, expect } from 'vitest'
import { redactSecrets, redactJsonString } from '@/lib/sanitize'

describe('redactSecrets()', () => {
  it('masks credential-shaped string values, keeping last 4 chars', () => {
    expect(redactSecrets({ apiToken: 'sk-1234567890abcdef' })).toEqual({
      apiToken: '****cdef',
    })
  })

  it('fully masks short credential-shaped values (<=4 chars)', () => {
    expect(redactSecrets({ secret: 'abcd' })).toEqual({ secret: '****' })
    expect(redactSecrets({ password: 'ab' })).toEqual({ password: '****' })
  })

  it('recurses into nested objects', () => {
    const input = { provider: { name: 'anthropic', apiKey: '1234567890' } }
    expect(redactSecrets(input)).toEqual({
      provider: { name: 'anthropic', apiKey: '****7890' },
    })
  })

  it('recurses into arrays', () => {
    const input = [{ token: 'abcdefgh' }, { token: 'zzzzzzzz' }]
    expect(redactSecrets(input)).toEqual([
      { token: '****efgh' },
      { token: '****zzzz' },
    ])
  })

  it('leaves non-matching keys untouched', () => {
    const input = { username: 'victor', model: 'claude-sonnet-5', count: 3 }
    expect(redactSecrets(input)).toEqual(input)
  })

  it('does not touch non-string values even on matching keys', () => {
    const input = { credentialCount: 3, authEnabled: true, secretData: null }
    expect(redactSecrets(input)).toEqual(input)
  })
})

describe('redactJsonString()', () => {
  it('redacts secrets in a JSON string and pretty-prints', () => {
    const raw = JSON.stringify({ token: 'abcdefghij' })
    const result = redactJsonString(raw)
    expect(result).toContain('****ghij')
    expect(result).not.toContain('abcdefghij')
  })

  it('passes through invalid JSON unchanged', () => {
    const raw = '{ not valid json'
    expect(redactJsonString(raw)).toBe(raw)
  })
})
