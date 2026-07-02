import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockReadFileSync = vi.fn()
vi.mock('fs', () => {
  const mocked = {
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    existsSync: () => false,
  }
  return { ...mocked, default: mocked }
})

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
    const sessions = await lib.listSessions()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].id).toBe('s1')
  })

  it('returns [] when the daemon sends a non-array payload', async () => {
    const lib = await loadLib()
    mockFetchJson({ sessions: { oops: true } })
    expect(await lib.listSessions()).toEqual([])
  })

  it('caches results within the TTL (single fetch for two calls)', async () => {
    const lib = await loadLib()
    mockFetchJson({ projects: [{ id: 'p1', name: 'One' }] })
    await lib.listProjects()
    await lib.listProjects()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('throws a descriptive error on non-OK responses', async () => {
    const lib = await loadLib()
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('daemon down'),
    })
    await expect(lib.listSessions()).rejects.toThrow(/502/)
  })
})
