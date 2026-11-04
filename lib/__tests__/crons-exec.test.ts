import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}))

vi.mock('child_process', () => {
  const mod = { execFileSync: mockExecFileSync }
  return { ...mod, default: mod }
})
vi.mock('@/lib/db/queries', () => ({ getConfig: () => ({ openclawDataDir: '~/.openclaw' }) }))
vi.mock('@/lib/agents-registry', () => ({ loadRegistry: () => [] }))
vi.mock('@/lib/env', () => ({ requireEnv: () => '/opt/homebrew/bin/openclaw' }))

import { getCrons } from '../crons'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCrons()', () => {
  it('calls execFileSync with the binary and args split out (no shell interpolation)', async () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({ jobs: [] }))
    await getCrons()
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/opt/homebrew/bin/openclaw',
      ['cron', 'list', '--json'],
      expect.objectContaining({ encoding: 'utf-8', timeout: 20000 })
    )
  })

  it('returns [] when the CLI call throws', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const result = await getCrons()
    expect(result).toEqual([])
  })
})
