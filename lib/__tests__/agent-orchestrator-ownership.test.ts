import { describe, it, expect } from 'vitest'
import { rollupSessionsByAgent, rollupForHierarchy } from '@/lib/agent-orchestrator-ownership'
import type { AOProject, AOSession } from '@/lib/agent-orchestrator'
import type { Agent } from '@/lib/types'

function session(overrides: Partial<AOSession>): AOSession {
  return {
    id: 's1',
    projectId: 'p1',
    kind: 'worker',
    harness: 'claude',
    activity: { state: 'active', lastActivityAt: '2026-01-01T00:00:00Z' },
    isTerminated: false,
    status: 'working',
    ...overrides,
  }
}

function project(id: string): AOProject {
  return { id, path: `/repo/${id}`, name: id, kind: 'repo', sessionPrefix: id }
}

function agent(overrides: Partial<Agent>): Agent {
  return {
    id: 'a',
    name: 'A',
    title: '',
    reportsTo: null,
    directReports: [],
    soulPath: null,
    soul: null,
    voiceId: null,
    color: '#000',
    emoji: '🤖',
    avatarUrl: null,
    model: null,
    tools: [],
    crons: [],
    memoryPath: null,
    description: '',
    ...overrides,
  }
}

describe('rollupSessionsByAgent', () => {
  it('groups sessions by owning agent via project ownership', () => {
    const sessions = [
      session({ id: 's1', projectId: 'p1', status: 'working' }),
      session({ id: 's2', projectId: 'p1', status: 'pr_open' }),
      session({ id: 's3', projectId: 'p2', status: 'merged' }),
    ]
    const projects = [project('p1'), project('p2')]
    const owners = new Map([['p1', 'agent-ceo'], ['p2', 'agent-worker']])

    const result = rollupSessionsByAgent(sessions, projects, owners)

    expect(result.get('agent-ceo')?.total).toBe(2)
    expect(result.get('agent-ceo')?.byColumn.working).toBe(1)
    expect(result.get('agent-ceo')?.byColumn.in_review).toBe(1)
    expect(result.get('agent-worker')?.total).toBe(1)
    expect(result.get('agent-worker')?.byColumn.ready_to_merge).toBe(1)
  })

  it('ignores sessions with no owner', () => {
    const sessions = [session({ projectId: 'p1' })]
    const projects = [project('p1')]
    const result = rollupSessionsByAgent(sessions, projects, new Map())
    expect(result.size).toBe(0)
  })

  it('ignores sessions whose column-less status has no bucket (idle/terminated/no_signal)', () => {
    const sessions = [session({ projectId: 'p1', status: 'idle' })]
    const projects = [project('p1')]
    const owners = new Map([['p1', 'agent-ceo']])
    const result = rollupSessionsByAgent(sessions, projects, owners)
    expect(result.size).toBe(0)
  })

  it('ignores sessions whose project no longer exists', () => {
    const sessions = [session({ projectId: 'ghost' })]
    const owners = new Map([['ghost', 'agent-ceo']])
    const result = rollupSessionsByAgent(sessions, [], owners)
    expect(result.size).toBe(0)
  })
})

describe('rollupForHierarchy', () => {
  it('sums an agent with no descendants to just its own rollup', () => {
    const agents = [agent({ id: 'ceo', directReports: [] })]
    const per = rollupSessionsByAgent(
      [session({ projectId: 'p1', status: 'working' })],
      [project('p1')],
      new Map([['p1', 'ceo']])
    )
    const org = rollupForHierarchy('ceo', agents, per)
    expect(org.total).toBe(1)
  })

  it('sums descendants into an ancestor total (CEO -> manager -> worker)', () => {
    const agents = [
      agent({ id: 'ceo', directReports: ['manager'] }),
      agent({ id: 'manager', reportsTo: 'ceo', directReports: ['worker'] }),
      agent({ id: 'worker', reportsTo: 'manager', directReports: [] }),
    ]
    const sessions = [
      session({ id: 's1', projectId: 'p-ceo', status: 'working' }),
      session({ id: 's2', projectId: 'p-manager', status: 'pr_open' }),
      session({ id: 's3', projectId: 'p-worker', status: 'merged' }),
    ]
    const projects = [project('p-ceo'), project('p-manager'), project('p-worker')]
    const owners = new Map([
      ['p-ceo', 'ceo'],
      ['p-manager', 'manager'],
      ['p-worker', 'worker'],
    ])
    const per = rollupSessionsByAgent(sessions, projects, owners)

    const ceoOrg = rollupForHierarchy('ceo', agents, per)
    expect(ceoOrg.total).toBe(3)
    expect(ceoOrg.byColumn.working).toBe(1)
    expect(ceoOrg.byColumn.in_review).toBe(1)
    expect(ceoOrg.byColumn.ready_to_merge).toBe(1)

    const managerOrg = rollupForHierarchy('manager', agents, per)
    expect(managerOrg.total).toBe(2)

    const workerOrg = rollupForHierarchy('worker', agents, per)
    expect(workerOrg.total).toBe(1)
  })

  it('does not infinite-loop on a cyclic directReports graph', () => {
    const agents = [
      agent({ id: 'a', directReports: ['b'] }),
      agent({ id: 'b', reportsTo: 'a', directReports: ['a'] }),
    ]
    const org = rollupForHierarchy('a', agents, new Map())
    expect(org.total).toBe(0)
  })

  it('returns an empty rollup for an unknown agent id', () => {
    const org = rollupForHierarchy('ghost', [], new Map())
    expect(org.total).toBe(0)
  })
})
