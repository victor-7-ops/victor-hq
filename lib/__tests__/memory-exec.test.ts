import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}))

vi.mock('child_process', () => {
  const mod = { execFileSync: mockExecFileSync }
  return { ...mod, default: mod }
})
vi.mock('@/lib/env', () => ({ requireEnv: () => '/opt/homebrew/bin/openclaw' }))

import { getMemoryStatus } from '../memory'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getMemoryStatus()', () => {
  it('calls execFileSync with the binary and args split out (no shell interpolation)', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({ indexed: true }))
    getMemoryStatus()
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/opt/homebrew/bin/openclaw',
      ['memory', 'status', '--deep'],
      expect.objectContaining({ encoding: 'utf-8', timeout: 15000 })
    )
  })

  it('returns defaults when the CLI call throws', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const result = getMemoryStatus()
    expect(result.indexed).toBe(false)
    expect(result.raw).toBe('Memory status unavailable')
  })
})
