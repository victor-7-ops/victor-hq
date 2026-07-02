import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()
vi.mock('fs', () => {
  const mocked = {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  }
  return { ...mocked, default: mocked }
})
vi.mock('@/lib/db/queries', () => ({
  getConfig: () => ({ openclawDataDir: '~/.openclaw' }),
}))
vi.mock('@/lib/agents-registry', () => ({ loadRegistry: () => [] }))
vi.mock('@/lib/env', () => ({ requireEnv: () => 'openclaw' }))
vi.mock('child_process', () => {
  const mocked = { execSync: vi.fn() }
  return { ...mocked, default: mocked }
})

import { getCronJobsFromFile } from '@/lib/crons'

describe('getCronJobsFromFile()', () => {
  beforeEach(() => {
    mockExistsSync.mockReset()
    mockReadFileSync.mockReset()
  })

  it('returns [] when jobs.json does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    expect(getCronJobsFromFile()).toEqual([])
  })

  it('returns [] on malformed JSON', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('{{{not json')
    expect(getCronJobsFromFile()).toEqual([])
  })

  it('normalizes a cron-schedule job', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      jobs: [{
        id: 'job-1',
        name: 'Daily digest',
        agentId: 'pulse',
        schedule: { kind: 'cron', expr: '0 9 * * *', tz: 'Europe/Bucharest' },
        state: { lastRunAtMs: 1750000000000, nextRunAtMs: 1750086400000, lastStatus: 'ok', lastDurationMs: 1234 },
        payload: { message: 'Send the digest' },
      }],
    }))
    const [job] = getCronJobsFromFile()
    expect(job).toMatchObject({
      id: 'job-1',
      name: 'Daily digest',
      agent: 'pulse',
      enabled: true,
      schedule: '0 9 * * * (Europe/Bucharest)',
      lastStatus: 'ok',
      lastDurationMs: 1234,
      prompt: 'Send the digest',
    })
    expect(job.lastRun).toBe(new Date(1750000000000).toISOString())
    expect(job.nextRun).toBe(new Date(1750086400000).toISOString())
  })

  it('formats interval schedules and applies defaults', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify({
      jobs: [
        { schedule: { intervalMs: 30 * 60000 } },
        { schedule: { intervalMs: 2 * 3600000 }, enabled: false },
      ],
    }))
    const jobs = getCronJobsFromFile()
    expect(jobs[0]).toMatchObject({ name: 'Unnamed Job', agent: 'main', schedule: 'every 30m', enabled: true, prompt: '' })
    expect(jobs[1]).toMatchObject({ schedule: 'every 2h', enabled: false })
    expect(jobs[0].id).toBe('cron-0')
  })

  it('accepts a bare array of jobs', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue(JSON.stringify([{ id: 'a', name: 'A' }]))
    expect(getCronJobsFromFile()).toHaveLength(1)
  })
})
