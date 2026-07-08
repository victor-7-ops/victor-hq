import { describe, it, expect, vi, afterEach } from 'vitest'
import { normalizeAgents, fetchAgents } from '../agents-client'

describe('normalizeAgents()', () => {
  it('derives reportsTo from parentId when reportsTo is absent', () => {
    const result = normalizeAgents([{ id: 'child', parentId: 'root' }])
    expect(result[0].reportsTo).toBe('root')
  })

  it('treats a null parentId as a root (reportsTo: null)', () => {
    const result = normalizeAgents([{ id: 'root', parentId: null }])
    expect(result[0].reportsTo).toBeNull()
  })

  it('treats a missing parentId as a root (reportsTo: null)', () => {
    const result = normalizeAgents([{ id: 'root' }])
    expect(result[0].reportsTo).toBeNull()
  })

  it('derives directReports by scanning for children of each agent', () => {
    const result = normalizeAgents([
      { id: 'root', parentId: null },
      { id: 'a', parentId: 'root' },
      { id: 'b', parentId: 'root' },
    ])
    const root = result.find((a) => a.id === 'root')!
    expect(root.directReports.sort()).toEqual(['a', 'b'])
  })

  it('leaves an orphaned parentId (pointing at a non-existent agent) alone', () => {
    const result = normalizeAgents([{ id: 'ghost-child', parentId: 'does-not-exist' }])
    expect(result[0].reportsTo).toBe('does-not-exist')
    expect(result[0].directReports).toEqual([])
  })

  it('does not infinite-loop on a cyclic parentId graph', () => {
    const result = normalizeAgents([
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ])
    expect(result.find((a) => a.id === 'a')?.reportsTo).toBe('b')
    expect(result.find((a) => a.id === 'b')?.reportsTo).toBe('a')
    expect(result.find((a) => a.id === 'a')?.directReports).toEqual(['b'])
    expect(result.find((a) => a.id === 'b')?.directReports).toEqual(['a'])
  })

  it('preserves explicit reportsTo/directReports over parentId derivation', () => {
    const result = normalizeAgents([
      { id: 'x', parentId: 'ignored', reportsTo: 'explicit-parent', directReports: ['already-set'] },
    ])
    expect(result[0].reportsTo).toBe('explicit-parent')
    expect(result[0].directReports).toEqual(['already-set'])
  })
})

describe('fetchAgents()', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('unwraps a { agents: [...] } response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agents: [{ id: 'a', parentId: null }] }),
    }))
    const agents = await fetchAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].id).toBe('a')
  })

  it('accepts a bare array response for backward compatibility', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: 'a', parentId: null }]),
    }))
    const agents = await fetchAgents()
    expect(agents).toHaveLength(1)
  })

  it('returns [] when agents field is missing entirely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    }))
    expect(await fetchAgents()).toEqual([])
  })

  it('throws when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    await expect(fetchAgents()).rejects.toThrow('Failed to fetch agents')
  })
})
