import { describe, it, expect } from 'vitest'
import { validateEnv, formatEnvIssues } from '@/lib/env'

const FULL_ENV = {
  OPENCLAW_HOME: '~/.openclaw',
  WORKSPACE_PATH: '/home/victor/workspace',
  OPENCLAW_BIN: 'openclaw',
  OPENCLAW_GATEWAY_TOKEN: 'abc123',
}

describe('validateEnv()', () => {
  it('is ok with all vars set', () => {
    const result = validateEnv(FULL_ENV as NodeJS.ProcessEnv)
    expect(result.ok).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('fails when OPENCLAW_HOME is missing (hard requirement)', () => {
    const { OPENCLAW_HOME, ...rest } = FULL_ENV
    const result = validateEnv(rest as NodeJS.ProcessEnv)
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ variable: 'OPENCLAW_HOME', severity: 'error' }),
    )
  })

  it('stays ok (degraded mode) when only optional vars are missing', () => {
    const result = validateEnv({ OPENCLAW_HOME: '~/.openclaw' } as NodeJS.ProcessEnv)
    expect(result.ok).toBe(true)
    expect(result.issues).toHaveLength(3)
    expect(result.issues.every((i) => i.severity === 'warning')).toBe(true)
  })

  it('reports missing WORKSPACE_PATH, OPENCLAW_BIN, and OPENCLAW_GATEWAY_TOKEN as warnings', () => {
    const result = validateEnv({ OPENCLAW_HOME: '~/.openclaw' } as NodeJS.ProcessEnv)
    const vars = result.issues.map((i) => i.variable).sort()
    expect(vars).toEqual(['OPENCLAW_BIN', 'OPENCLAW_GATEWAY_TOKEN', 'WORKSPACE_PATH'])
  })
})

describe('formatEnvIssues()', () => {
  it('formats each issue as a single prefixed line', () => {
    const result = validateEnv({} as NodeJS.ProcessEnv)
    const lines = formatEnvIssues(result)
    expect(lines.length).toBe(result.issues.length)
    expect(lines[0]).toMatch(/^\[env\] (ERROR|WARNING) /)
  })
})
