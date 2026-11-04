import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}))

vi.mock('child_process', () => {
  const mod = { execFileSync: mockExecFileSync }
  return { ...mod, default: mod }
})

import { snapshotFile } from '../memory-write'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('snapshotFile()', () => {
  it('passes the path as a separate arg instead of shell-interpolating it', () => {
    const dangerousPath = '/workspace/memory/"; rm -rf ~; echo "pwned.md'
    snapshotFile(dangerousPath, '/workspace')

    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['add', dangerousPath],
      expect.objectContaining({ cwd: '/workspace' })
    )
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-m', 'dashboard: snapshot before edit', '--allow-empty'],
      expect.objectContaining({ cwd: '/workspace' })
    )
  })

  it('does not throw when git is unavailable (non-fatal by design)', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('git not found')
    })
    expect(() => snapshotFile('/workspace/MEMORY.md', '/workspace')).not.toThrow()
  })
})
