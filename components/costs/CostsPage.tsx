'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Agent, CostSummary, CronJob, RunCost, ClaudeCodeUsage } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, TrendingDown, TrendingUp, Activity, MessageSquare, ChevronDown, DollarSign } from 'lucide-react'
import { generateId } from '@/lib/id'
import { buildCostAnalysisPrompt } from '@/lib/costs'
import { renderMarkdown } from '@/lib/sanitize'
import { fmtCost, fmtTokens } from './formatters'
import { SummaryCard } from './SummaryCard'
import { DailyCostChart } from './DailyCostChart'
import { TokenDonut } from './TokenDonut'
import { TopCrons } from './TopCrons'
import { RunDetailTable } from './RunDetailTable'
import { OptimizationCard } from './OptimizationPanel'
import { ClaudeUsageRow } from './ClaudeUsageRow'

/* ── Chat message type ───────────────────────────────────────── */

interface CostChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

/* ── CostsPage ───────────────────────────────────────────────── */

export function CostsPage() {
  const [data, setData] = useState<CostSummary | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [jobNames, setJobNames] = useState<Record<string, string>>({})
  const [jobAgentMap, setJobAgentMap] = useState<Record<string, string>>({})
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [costPeriod, setCostPeriod] = useState<string>('total')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // AI Cost Analysis state
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisStreaming, setAnalysisStreaming] = useState(false)
  const [analysisContent, setAnalysisContent] = useState('')
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [chatMessages, setChatMessages] = useState<CostChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatStreaming, setChatStreaming] = useState(false)

  // Claude Code usage state
  const [claudeUsage, setClaudeUsage] = useState<ClaudeCodeUsage | null>(null)

  const rootAgent = useMemo(
    () => agents.find(a => a.reportsTo === null) || agents[0] || null,
    [agents],
  )

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch('/api/costs').then(r => {
        if (!r.ok) throw new Error('Failed to load costs')
        return r.json()
      }),
      fetch('/api/crons').then(r => {
        if (!r.ok) throw new Error('Failed to load crons')
        return r.json()
      }),
      fetch('/api/agents').then(r => {
        if (!r.ok) throw new Error('Failed to load agents')
        return r.json()
      }),
    ])
      .then(([costData, cronData, agentData]: [CostSummary & { jobNames?: Record<string, string> }, { crons: CronJob[] }, Agent[]]) => {
        setData(costData)
        setAgents(agentData)
        // Merge server-side job names (includes deleted jobs) with active cron names
        const names: Record<string, string> = { ...(costData.jobNames ?? {}) }
        const agentMap: Record<string, string> = {}
        for (const c of cronData.crons) {
          names[c.id] = c.name
          if (c.agentId) agentMap[c.id] = c.agentId
        }
        setJobNames(names)
        setJobAgentMap(agentMap)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      })
  }, [])

  // Claude Code usage SSE stream
  useEffect(() => {
    const es = new EventSource('/api/usage/stream')
    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data)
        if (parsed.type === 'usage' && parsed.data) {
          const d = parsed.data
          // Only show when we have real utilization data
          if (d.fiveHour?.utilization > 0 || d.sevenDay?.utilization > 0) {
            setClaudeUsage(d)
          }
        }
      } catch { /* skip */ }
    }
    es.onerror = () => { /* keep last good value */ }
    return () => es.close()
  }, [])


  const jobName = (id: string) => jobNames[id] || id

  // Filtered data based on selected agents
  const filteredData = useMemo(() => {
    if (!data) return null
    if (selectedAgents.size === 0) return data

    const matchesAgent = (jobId: string) => {
      const agentId = jobAgentMap[jobId]
      return agentId ? selectedAgents.has(agentId) : false
    }

    const filteredRunCosts = data.runCosts.filter(rc => matchesAgent(rc.jobId))
    const filteredJobCosts = data.jobCosts.filter(jc => matchesAgent(jc.jobId))
    const filteredAnomalies = data.anomalies.filter(a => matchesAgent(a.jobId))

    const filteredTotalCost = filteredRunCosts.reduce((sum, rc) => sum + rc.minCost, 0)

    return {
      ...data,
      runCosts: filteredRunCosts,
      jobCosts: filteredJobCosts,
      anomalies: filteredAnomalies,
      totalCost: filteredTotalCost,
    }
  }, [data, selectedAgents, jobAgentMap])

  // Date range from run costs
  const dateRange = filteredData && filteredData.runCosts.length > 0
    ? {
        oldest: new Date(Math.min(...filteredData.runCosts.map(r => r.ts))),
        newest: new Date(Math.max(...filteredData.runCosts.map(r => r.ts))),
      }
    : null

  // Estimated cost for selected period
  const periodCost = useMemo(() => {
    if (!filteredData || !dateRange || costPeriod === 'total') return null
    const rangeMs = dateRange.newest.getTime() - dateRange.oldest.getTime()
    const rangeDays = Math.max(rangeMs / (1000 * 60 * 60 * 24), 1)
    const dailyRate = filteredData.totalCost / rangeDays

    const multipliers: Record<string, number> = {
      '3h': 3 / 24,
      '6h': 6 / 24,
      '24h': 1,
      'day': 1,
      'week': 7,
      'year': 365,
    }
    return dailyRate * (multipliers[costPeriod] ?? 1)
  }, [filteredData, dateRange, costPeriod])

  // Total projected savings from all insights
  const totalProjectedSavings = useMemo(
    () => filteredData?.insights.reduce((s, i) => s + (i.projectedSavings ?? 0), 0) ?? 0,
    [filteredData],
  )

  // Run AI cost analysis
  const runAnalysis = useCallback(async () => {
    if (!rootAgent || analysisStreaming || !data) return
    setAnalysisOpen(true)
    setAnalysisStreaming(true)
    setAnalysisContent('')
    setChatMessages([])

    const prompt = buildCostAnalysisPrompt(data, jobNames)

    try {
      const res = await fetch(`/api/chat/${rootAgent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                setAnalysisContent(fullContent)
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      setAnalysisContent(prev => prev + '\n\n[Error: Failed to connect to agent]')
    } finally {
      setAnalysisStreaming(false)
    }
  }, [rootAgent, analysisStreaming, data, jobNames])

  // Send follow-up chat message
  const sendChatMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim()
    if (!text || chatStreaming || !rootAgent || !data) return
    if (!overrideText) setChatInput('')

    const userMsg: CostChatMessage = { id: generateId(), role: 'user', content: text }
    const assistantMsgId = generateId()
    const assistantMsg: CostChatMessage = { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true }

    setChatMessages(prev => [...prev, userMsg, assistantMsg])
    setChatStreaming(true)

    const prompt = buildCostAnalysisPrompt(data, jobNames)
    const allMessages = [...chatMessages, userMsg]
    const apiMessages = [
      { role: 'user' as const, content: prompt },
      ...(analysisContent ? [{ role: 'assistant' as const, content: analysisContent }] : []),
      ...allMessages.map(m => ({ role: m.role, content: m.content })),
    ]

    try {
      const res = await fetch(`/api/chat/${rootAgent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const chunk = JSON.parse(line.slice(6))
              if (chunk.content) {
                fullContent += chunk.content
                const captured = fullContent
                setChatMessages(prev =>
                  prev.map(m => m.id === assistantMsgId ? { ...m, content: captured, isStreaming: true } : m)
                )
              }
            } catch { /* skip */ }
          }
        }
      }

      const finalContent = fullContent
      setChatMessages(prev =>
        prev.map(m => m.id === assistantMsgId ? { ...m, content: finalContent, isStreaming: false } : m)
      )
    } catch {
      setChatMessages(prev =>
        prev.map(m => m.id === assistantMsgId ? { ...m, content: 'Error getting response. Check API connection.', isStreaming: false } : m)
      )
    } finally {
      setChatStreaming(false)
      chatTextareaRef.current?.focus()
    }
  }, [chatInput, chatStreaming, rootAgent, chatMessages, analysisContent, data, jobNames])

  // Handle insight action -- open analysis if needed, then send
  const handleInsightAction = useCallback((prompt: string) => {
    if (!analysisOpen) setAnalysisOpen(true)
    // If no analysis has been run, run it first then the user's action will be available in chat
    if (!analysisContent && !analysisStreaming) {
      runAnalysis()
      return
    }
    sendChatMessage(prompt)
  }, [analysisOpen, analysisContent, analysisStreaming, runAnalysis, sendChatMessage])

  return (
    <div className="h-full flex flex-col overflow-hidden animate-fade-in" style={{ background: 'var(--bg)' }}>
      {/* ── Sticky header ──────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>Costs & Optimization</h1>
          {!loading && filteredData && (
            <p>
              {dateRange
                ? `${dateRange.oldest.toLocaleDateString()} - ${dateRange.newest.toLocaleDateString()}`
                : 'No data'}
              {' \u00b7 '}
              {filteredData.runCosts.length} run{filteredData.runCosts.length !== 1 ? 's' : ''} with cost data
              {selectedAgents.size > 0 && ` (filtered by ${selectedAgents.size} agent${selectedAgents.size !== 1 ? 's' : ''})`}
            </p>
          )}
        </div>
      </div>

      {/* ── Agent filter bar ───────────────────────────────────── */}
      {!loading && agents.length > 0 && (
        <div className="page-filters" style={{ alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-medium)', flexShrink: 0, marginRight: 'var(--space-1)' }}>
            Agents
          </span>
          <button
            onClick={() => setSelectedAgents(new Set())}
            className={`page-filter ${selectedAgents.size === 0 ? 'page-filter-active' : ''}`}
          >
            All
          </button>
          {agents.map(agent => {
            const isActive = selectedAgents.has(agent.id)
            return (
              <button
                key={agent.id}
                onClick={() => {
                  setSelectedAgents(prev => {
                    const next = new Set(prev)
                    if (next.has(agent.id)) {
                      next.delete(agent.id)
                    } else {
                      next.add(agent.id)
                    }
                    return next
                  })
                }}
                className={`page-filter flex items-center ${isActive ? 'page-filter-active' : ''}`}
              >
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isActive ? 'white' : (agent.color || 'var(--text-tertiary)'),
                  flexShrink: 0,
                }} />
                {agent.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 'var(--space-4) var(--space-6) var(--space-6)', minHeight: 0 }}>
        {error && (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-8)',
            color: 'var(--system-red)',
            fontSize: 'var(--text-footnote)',
          }}>
            {error}
          </div>
        )}

        {loading && (
          <div>
            <div className="costs-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                  <Skeleton style={{ width: 100, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 60, height: 20 }} />
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--material-regular)', border: '1px solid var(--separator)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center" style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: i < 4 ? '1px solid var(--separator)' : undefined, gap: 'var(--space-3)' }}>
                  <Skeleton style={{ width: 140, height: 14 }} />
                  <Skeleton style={{ width: 60, height: 14, flex: 1 }} />
                  <Skeleton style={{ width: 80, height: 14 }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (!filteredData || filteredData.runCosts.length === 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
            <DollarSign size={40} style={{ color: 'var(--text-quaternary)', marginBottom: '12px' }} />
            <div style={{ fontSize: 'var(--text-title3)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No cost data yet</div>
            <div style={{ fontSize: 'var(--text-subheadline)', color: 'var(--text-tertiary)', maxWidth: 360 }}>Cost analytics will appear here once your agents start running.</div>
          </div>
        )}

        {!loading && !error && filteredData && filteredData.runCosts.length > 0 && (
          <>
            {/* ── Anomaly banner ─────────────────────────────────── */}
            {filteredData.anomalies.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'rgba(255, 149, 0, 0.08)',
                border: '1px solid rgba(255, 149, 0, 0.25)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-footnote)',
                color: 'var(--system-orange)',
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <strong>{filteredData.anomalies.length} anomal{filteredData.anomalies.length === 1 ? 'y' : 'ies'}</strong>
                  {' -- '}
                  {filteredData.anomalies.slice(0, 3).map((a, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {jobName(a.jobId)} ({a.ratio.toFixed(1)}x median)
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Claude Code Usage (only shown when detected) ──── */}
            {claudeUsage && filteredData.modelBreakdown.some(m => m.model.startsWith('claude')) && (
              <ClaudeUsageRow usage={claudeUsage} />
            )}

            {/* ── Summary cards ────────────────────────────────── */}
            <div className="costs-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {/* Total Estimated Cost */}
              <SummaryCard label={costPeriod === 'total' ? 'Total Estimated Cost' : `Est. Cost / ${costPeriod}`}>
                <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtCost(costPeriod === 'total' ? filteredData.totalCost : (periodCost ?? 0))}
                  </span>
                  {costPeriod === 'total' && filteredData.weekOverWeek.changePct !== null && (
                    <span className="flex items-center" style={{
                      fontSize: 'var(--text-caption1)',
                      fontWeight: 'var(--weight-semibold)',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: filteredData.weekOverWeek.changePct <= 0 ? 'rgba(48,209,88,0.12)' : 'rgba(255,69,58,0.12)',
                      color: filteredData.weekOverWeek.changePct <= 0 ? 'var(--system-green)' : 'var(--system-red)',
                      gap: 2,
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}>
                      {filteredData.weekOverWeek.changePct <= 0
                        ? <TrendingDown size={10} />
                        : <TrendingUp size={10} />}
                      {Math.abs(filteredData.weekOverWeek.changePct).toFixed(0)}%
                    </span>
                  )}
                  {costPeriod !== 'total' && (
                    <span style={{
                      fontSize: 'var(--text-caption1)',
                      color: 'var(--text-tertiary)',
                      fontWeight: 'var(--weight-medium)',
                    }}>
                      projected
                    </span>
                  )}
                </div>
              </SummaryCard>

              {/* This Week vs Last Week */}
              <SummaryCard label="This Week">
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--text-primary)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(filteredData.weekOverWeek.thisWeek)}
                </div>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  last week: {fmtCost(filteredData.weekOverWeek.lastWeek)}
                </div>
              </SummaryCard>

              {/* Cache Savings */}
              <SummaryCard label="Cache Savings">
                <div style={{ fontSize: 'var(--text-title2)', color: 'var(--system-green)', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtCost(filteredData.cacheSavings.estimatedSavings)}
                </div>
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {fmtTokens(filteredData.cacheSavings.cacheTokens)} cache tokens
                </div>
              </SummaryCard>

              {/* Anomalies */}
              <SummaryCard label="Anomalies">
                <div className="flex items-center" style={{ gap: 'var(--space-2)' }}>
                  {filteredData.anomalies.length > 0 && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--system-orange)', flexShrink: 0 }} />
                  )}
                  <span style={{
                    fontSize: 'var(--text-title2)',
                    fontWeight: 'var(--weight-bold)',
                    color: filteredData.anomalies.length > 0 ? 'var(--system-orange)' : 'var(--system-green)',
                  }}>
                    {filteredData.anomalies.length}
                  </span>
                </div>
              </SummaryCard>
            </div>

            {/* ── Time period selector ─────────────────────────── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              marginBottom: 'var(--space-4)',
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              padding: '3px',
              width: 'fit-content',
            }}>
              {[
                { key: 'total', label: 'Total' },
                { key: '3h', label: '3h' },
                { key: '6h', label: '6h' },
                { key: '24h', label: '24h' },
                { key: 'day', label: 'Day' },
                { key: 'week', label: 'Week' },
                { key: 'year', label: 'Year' },
              ].map(opt => {
                const isActive = costPeriod === opt.key
                return (
                  <button
                    key={opt.key}
                    onClick={() => setCostPeriod(opt.key)}
                    className="focus-ring"
                    style={{
                      padding: '4px 12px',
                      borderRadius: 'calc(var(--radius-md) - 2px)',
                      fontSize: 'var(--text-caption1)',
                      fontWeight: 'var(--weight-medium)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                      ...(isActive
                        ? {
                            background: 'var(--accent)',
                            color: 'white',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                          }
                        : {
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                          }),
                    }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {/* ── Optimization Score + Insights ─────────────────── */}
            <OptimizationCard
              score={filteredData.optimizationScore}
              insights={filteredData.insights}
              totalSavings={totalProjectedSavings}
              jobName={jobName}
              onAction={handleInsightAction}
            />

            {/* ── Agent Optimizer ─────────────────────────────────── */}
            <div style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 12,
              marginBottom: 'var(--space-4)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: analysisOpen ? '1px solid var(--separator)' : undefined,
              }}>
                <Activity size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Agent Optimizer
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    AI-powered analysis of your agent costs and throughput
                  </div>
                </div>
                {analysisStreaming && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, color: 'var(--accent)', fontWeight: 500,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
                      animation: 'pulse 1.2s infinite',
                    }} />
                    Analyzing...
                  </span>
                )}
                {!analysisOpen && !analysisContent && !analysisStreaming && (
                  <button
                    onClick={() => { setAnalysisOpen(true); runAnalysis() }}
                    className="btn-ghost focus-ring"
                    style={{
                      padding: '6px 16px', borderRadius: 8,
                      fontSize: 13, fontWeight: 600,
                      background: 'var(--accent)', color: 'white',
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    Analyze
                  </button>
                )}
                {(analysisOpen || analysisContent) && (
                  <button
                    onClick={() => setAnalysisOpen(!analysisOpen)}
                    className="focus-ring"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                  >
                    <ChevronDown
                      size={16}
                      style={{
                        color: 'var(--text-tertiary)',
                        transform: analysisOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 200ms ease',
                      }}
                    />
                  </button>
                )}
              </div>

              {analysisOpen && (
                <div>
                  {/* Loading skeleton */}
                  {analysisStreaming && !analysisContent && (
                    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[180, 240, 160, 220, 140].map((w, i) => (
                        <div key={i} style={{
                          width: w, maxWidth: '100%', height: 12, borderRadius: 4,
                          background: 'var(--fill-tertiary)',
                          animation: `shimmer 1.6s ease-in-out ${i * 0.15}s infinite`,
                        }} />
                      ))}
                    </div>
                  )}

                  {/* Analysis content */}
                  {analysisContent && (
                    <div
                      className="markdown-body"
                      style={{
                        padding: '16px 20px',
                        maxHeight: 520,
                        overflowY: 'auto',
                        fontSize: 14,
                        lineHeight: 1.65,
                        color: 'var(--text-primary)',
                      }}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisContent) }}
                    />
                  )}

                  {/* Suggested actions (before first analysis or after completion) */}
                  {!analysisContent && !analysisStreaming && (
                    <div style={{ padding: '12px 20px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                        Ask about
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {[
                          'Which agents should switch to Haiku?',
                          'How do I reduce my 5-hour window usage?',
                          'Show me my most expensive agent and how to fix it',
                          'What thinking effort should each agent use?',
                        ].map(q => (
                          <button
                            key={q}
                            onClick={() => { setAnalysisOpen(true); runAnalysis(); }}
                            className="btn-ghost focus-ring"
                            style={{
                              padding: '5px 12px', borderRadius: 14,
                              fontSize: 12, fontWeight: 500,
                              background: 'var(--fill-secondary)',
                              border: '1px solid var(--separator)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inline chat (after analysis complete) */}
                  {analysisContent && !analysisStreaming && (
                    <>
                      <div style={{ height: 1, background: 'var(--separator)' }} />

                      {/* Chat messages */}
                      {chatMessages.length > 0 && (
                        <div style={{ maxHeight: 320, overflowY: 'auto', padding: '12px 20px' }}>
                          {chatMessages.map(msg => (
                            <div key={msg.id} style={{
                              marginBottom: 12,
                              display: 'flex',
                              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            }}>
                              <div style={{
                                maxWidth: '85%',
                                padding: '8px 14px',
                                borderRadius: 12,
                                fontSize: 14,
                                lineHeight: 1.55,
                                ...(msg.role === 'user' ? {
                                  background: 'var(--accent)',
                                  color: 'white',
                                } : {
                                  background: 'var(--fill-secondary)',
                                  color: 'var(--text-primary)',
                                }),
                              }}>
                                {msg.role === 'assistant' ? (
                                  <div
                                    className="markdown-body"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || '...') }}
                                  />
                                ) : (
                                  msg.content
                                )}
                                {msg.isStreaming && (
                                  <span style={{
                                    display: 'inline-block', width: 6, height: 14,
                                    background: 'var(--text-tertiary)', borderRadius: 1,
                                    marginLeft: 2, animation: 'blink 1s step-end infinite',
                                  }} />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Follow-up suggestions */}
                      {chatMessages.length === 0 && (
                        <div style={{ padding: '8px 20px 4px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {[
                            'Show me the config changes',
                            'Which agents need less thinking effort?',
                            'How do I trim agent context?',
                          ].map(q => (
                            <button
                              key={q}
                              onClick={() => sendChatMessage(q)}
                              className="btn-ghost focus-ring"
                              style={{
                                padding: '4px 10px', borderRadius: 12,
                                fontSize: 11, fontWeight: 500,
                                background: 'var(--fill-secondary)',
                                border: '1px solid var(--separator)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Chat input */}
                      <div style={{
                        display: 'flex', alignItems: 'flex-end', gap: 8,
                        padding: '10px 20px 16px',
                      }}>
                        <textarea
                          ref={chatTextareaRef}
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              sendChatMessage()
                            }
                          }}
                          placeholder="Ask a follow-up..."
                          disabled={chatStreaming}
                          rows={1}
                          style={{
                            flex: 1, resize: 'none',
                            background: 'var(--fill-tertiary)',
                            border: '1px solid var(--separator)',
                            borderRadius: 8,
                            padding: '8px 12px',
                            fontSize: 13,
                            color: 'var(--text-primary)',
                            outline: 'none',
                            lineHeight: 1.4,
                            fontFamily: 'inherit',
                          }}
                        />
                        <button
                          onClick={() => sendChatMessage()}
                          disabled={chatStreaming || !chatInput.trim()}
                          className="btn-ghost focus-ring"
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            fontSize: 13,
                            fontWeight: 600,
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            cursor: chatStreaming || !chatInput.trim() ? 'not-allowed' : 'pointer',
                            opacity: chatStreaming || !chatInput.trim() ? 0.5 : 1,
                          }}
                        >
                          Send
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Most Expensive Crons ───────────────────────────── */}
            <TopCrons jobCosts={filteredData.jobCosts} jobName={jobName} />

            {/* ── Charts row: daily cost + token donut ────────────── */}
            <div className="charts-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
              <DailyCostChart dailyCosts={filteredData.dailyCosts} />
              <TokenDonut data={filteredData} />
            </div>

            {/* ── Job cost table ──────────────────────────────────── */}
            <div style={{
              background: 'var(--material-regular)',
              border: '1px solid var(--separator)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div className="flex items-center" style={{
                padding: 'var(--space-2) var(--space-4)',
                borderBottom: '1px solid var(--separator)',
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-tertiary)',
                fontWeight: 'var(--weight-medium)',
                gap: 'var(--space-3)',
              }}>
                <span style={{ flex: 2, minWidth: 0 }}>Job</span>
                <span style={{ width: 50, textAlign: 'right' }}>Runs</span>
                <span style={{ width: 80, textAlign: 'right' }}>Input</span>
                <span style={{ width: 80, textAlign: 'right' }}>Output</span>
                <span className="hidden-mobile" style={{ width: 80, textAlign: 'right' }}>Cache</span>
                <span style={{ width: 80, textAlign: 'right' }}>Est. Cost</span>
              </div>

              {filteredData.jobCosts.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-footnote)' }}>
                  No jobs with cost data
                </div>
              ) : (
                filteredData.jobCosts.map((job, i) => (
                  <div
                    key={job.jobId}
                    className="flex items-center"
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: i < filteredData.jobCosts.length - 1 ? '1px solid var(--separator)' : undefined,
                      fontSize: 'var(--text-footnote)',
                      color: 'var(--text-primary)',
                      gap: 'var(--space-3)',
                    }}
                  >
                    <span style={{ flex: 2, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'var(--weight-medium)' }}>
                      {jobName(job.jobId)}
                    </span>
                    <span style={{ width: 50, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {job.runs}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalInputTokens)}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalOutputTokens)}
                    </span>
                    <span className="hidden-mobile" style={{ width: 80, textAlign: 'right', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTokens(job.totalCacheTokens)}
                    </span>
                    <span style={{ width: 80, textAlign: 'right', fontWeight: 'var(--weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCost(job.totalCost)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* ── Cost by Model ────────────────────────────────────── */}
            {filteredData.modelBreakdown.length > 0 && (
              <div style={{
                marginTop: 'var(--space-4)',
                background: 'var(--material-regular)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderBottom: '1px solid var(--separator)',
                  fontSize: 'var(--text-footnote)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text-primary)',
                }}>
                  Cost by Model
                </div>
                {filteredData.modelBreakdown.map((m, i) => {
                  const barWidth = filteredData.totalCost > 0 ? Math.max(2, (m.cost / filteredData.totalCost) * 100) : 0
                  return (
                    <div
                      key={m.model}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderBottom: i < filteredData.modelBreakdown.length - 1 ? '1px solid var(--separator)' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div className="flex items-center" style={{ gap: 'var(--space-3)' }}>
                        <span style={{
                          flex: 2,
                          minWidth: 0,
                          fontSize: 'var(--text-footnote)',
                          fontWeight: 'var(--weight-medium)',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {m.model}
                        </span>
                        <span style={{
                          width: 80,
                          textAlign: 'right',
                          fontSize: 'var(--text-footnote)',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text-secondary)',
                        }}>
                          {fmtTokens(m.tokens)}
                        </span>
                        <span style={{
                          width: 50,
                          textAlign: 'right',
                          fontSize: 'var(--text-caption1)',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text-tertiary)',
                        }}>
                          {m.pct.toFixed(0)}%
                        </span>
                        <span style={{
                          width: 80,
                          textAlign: 'right',
                          fontSize: 'var(--text-footnote)',
                          fontWeight: 'var(--weight-semibold)',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text-primary)',
                        }}>
                          {fmtCost(m.cost)}
                        </span>
                      </div>
                      <div style={{
                        height: 4,
                        borderRadius: 2,
                        background: 'var(--fill-secondary)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          borderRadius: 2,
                          background: 'var(--accent)',
                          transition: 'width 400ms ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Per-run detail table ────────────────────────────── */}
            <RunDetailTable runCosts={filteredData.runCosts} jobName={jobName} />
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes blink {
          50% { opacity: 0; }
        }
        .summary-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }
        @media (max-width: 768px) {
          .top-crons-grid {
            grid-template-columns: 1fr !important;
          }
          .usage-row {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
