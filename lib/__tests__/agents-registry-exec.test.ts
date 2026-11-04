import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}))

vi.mock('child_process', () => {
  const mod = { execFileSync: mockExecFileSync }
  return { ...mod, default: mod }
})

import { listCliAgents } from '../agents-registry'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listCliAgents()', () => {
  it('calls execFileSync with the binary and args split out (no shell interpolation)', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify([{ id: 'pulse' }]))
    listCliAgents('/opt/homebrew/bin/openclaw')
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/opt/homebrew/bin/openclaw',
      ['agents', 'list', '--json'],
      expect.objectContaining({ encoding: 'utf-8', timeout: 10000 })
    )
  })

  it('tolerates a binary path containing spaces (would have broken template-string execSync)', () => {
    mockExecFileSync.mockReturnValue(JSON.stringify([{ id: 'pulse' }]))
    const result = listCliAgents('/Program Files/openclaw/bin/openclaw.exe')
    expect(mockExecFileSync).toHaveBeenCalledWith(
      '/Program Files/openclaw/bin/openclaw.exe',
      ['agents', 'list', '--json'],
      expect.anything()
    )
    expect(result).toEqual([{ id: 'pulse' }])
  })

  it('returns null when the CLI call throws', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    expect(listCliAgents('openclaw')).toBeNull()
  })

  it('returns null when output is an empty array', () => {
    mockExecFileSync.mockReturnValue('[]')
    expect(listCliAgents('openclaw')).toBeNull()
  })
})
