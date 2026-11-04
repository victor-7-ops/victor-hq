import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}))

vi.mock('child_process', () => {
  const mod = { execFileSync: mockExecFileSync }
  return { ...mod, default: mod }
})

import { performSearch } from '../../scripts/researcher-run'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('performSearch()', () => {
  it('passes a query containing shell metacharacters as a plain arg, not an interpolated string', async () => {
    mockExecFileSync.mockReturnValue(JSON.stringify({ results: [] }))
    const dangerousQuery = '"; rm -rf ~ #'
    await performSearch(dangerousQuery, 'pw')

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'openclaw',
      ['web_search', '--query', dangerousQuery, '--freshness', 'pw', '--count', '5'],
      expect.objectContaining({ encoding: 'utf-8', timeout: 30000 })
    )
  })

  it('returns [] when the CLI call throws', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const result = await performSearch('test query')
    expect(result).toEqual([])
  })
})
