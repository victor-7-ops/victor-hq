import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockReadFileSync = vi.fn()
vi.mock('fs', () => {
  const mocked = {
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    existsSync: () => false,
  }
  return { ...mocked, default: mocked }
})

const aoCacheStore = new Map<string, unknown>()
vi.mock('@/lib/db/queries', () => ({
  getAOCache: (key: string) =>
    aoCacheStore.has(key) ? { data: aoCacheStore.get(key), cachedAt: '2026-01-01T00:00:00Z' } : null,
  setAOCache: (key: string, data: unknown) => {
    aoCacheStore.set(key, data)
  },
}))

// Fresh module per test: the lib keeps a module-level TTL cache.
async function loadLib() {
  vi.resetModules()
  return import('@/lib/agent-orchestrator')
}

describe('getAOBaseUrl()', () => {
  it('uses the port from ~/.ao/running.json', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ port: 4567 }))
    const lib = await loadLib()
    expect(lib.getAOBaseUrl()).toBe('http://127.0.0.1:4567')
  })

  it('falls back to port 3001 when running.json is missing', async () => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
    const lib = await loadLib()
    expect(lib.getAOBaseUrl()).toBe('http://127.0.0.1:3001')
  })

  it('falls back to port 3001 on malformed JSON', async () => {
    mockReadFileSync.mockReturnValue('not json')
    const lib = await loadLib()
    expect(lib.getAOBaseUrl()).toBe('http://127.0.0.1:3001')
  })
})

describe('listSessions() / listProjects()', () => {
  beforeEach(() => {
    mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT') })
    vi.stubGlobal('fetch', vi.fn())
    aoCacheStore.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockFetchJson(body: unknown) {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(body)),
      json: () => Promise.resolve(body),
    })
  }

  it('filters out malformed session entries', async () => {
    const lib = await loadLib()
    mockFetchJson({
      sessions: [
        { id: 's1', status: 'working', projectId: 'p1' },
        { id: 42, status: 'working', projectId: 'p1' }, // bad id
        { status: 'working' }, // missing fields
        null,
        'garbage',
      ],
    })
    const result = await lib.listSessions()
    expect(result.items).toHaveLength(1)
    expect(result.items[0].id).toBe('s1')
    expect(result.stale).toBe(false)
  })

  it('returns [] when the daemon sends a non-array payload', async () => {
    const lib = await loadLib()
    mockFetchJson({ sessions: { oops: true } })
    expect((await lib.listSessions()).items).toEqual([])
  })

  it('caches results within the TTL (single fetch for two calls)', async () => {
    const lib = await loadLib()
    mockFetchJson({ projects: [{ id: 'p1', name: 'One' }] })
    await lib.listProjects()
    await lib.listProjects()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws when the daemon errors and there is no cached data', async () => {
    const lib = await loadLib()
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('daemon down'),
    })
    await expect(lib.listSessions()).rejects.toThrow(/502/)
  })

  it('falls back to cached data (marked stale) when the daemon errors', async () => {
    const lib = await loadLib()
    mockFetchJson({ sessions: [{ id: 's1', status: 'working', projectId: 'p1' }] })
    const first = await lib.listSessions()
    expect(first.stale).toBe(false)

    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('daemon down'),
    })
    // Bypass the in-process TTL cache so the failing fetch actually runs.
    vi.resetModules()
    const lib2 = await import('@/lib/agent-orchestrator')
    const second = await lib2.listSessions()
    expect(second.stale).toBe(true)
    expect(second.items).toHaveLength(1)
    expect(second.cachedAt).toBe('2026-01-01T00:00:00Z')
  })
})
