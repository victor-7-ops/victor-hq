import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

const { mockExistsSync, mockReadFileSync, mockWriteFileSync, mockExecSync, mockHomedir } =
  vi.hoisted(() => ({
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockExecSync: vi.fn(),
    mockHomedir: vi.fn(() => '/mock/home'),
  }))

vi.mock('fs', () => {
  const mod = {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  }
  return { ...mod, default: mod }
})

vi.mock('child_process', () => {
  const mod = { execSync: mockExecSync }
  return { ...mod, default: mod }
})

vi.mock('os', () => {
  const mod = { homedir: mockHomedir }
  return { ...mod, default: mod }
})

import { detectWorkspacePath, detectGatewayToken } from '../setup-detection'

beforeEach(() => {
  vi.clearAllMocks()
  mockHomedir.mockReturnValue('/mock/home')
})

describe('detectWorkspacePath()', () => {
  it('returns the path when the workspace directory exists', () => {
    mockExistsSync.mockReturnValue(true)
    const result = detectWorkspacePath()
    // path.join uses the OS separator, so build the expectation the same way
    expect(result).toBe(path.join('/mock/home', '.openclaw', 'workspace'))
  })

  it('returns null when the workspace directory does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const result = detectWorkspacePath()
    expect(result).toBeNull()
  })
})

describe('detectGatewayToken()', () => {
  it('returns null when the config file does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const result = detectGatewayToken()
    expect(result).toBeNull()
  })

  it('returns the token when config file exists and has a token', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(
      JSON.stringify({ gateway: { auth: { token: 'test-token-123' } } })
    )
    const result = detectGatewayToken()
    expect(result).toBe('test-token-123')
  })

  it('returns null when config file exists but has no token', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({ gateway: {} }))
    const result = detectGatewayToken()
    expect(result).toBeNull()
  })

  it('returns null when config file contains invalid JSON', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('not valid json')
    const result = detectGatewayToken()
    expect(result).toBeNull()
  })
})
