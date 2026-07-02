'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Map, MessageSquare, Columns3, Clock, Brain, Mic,
  Check, Keyboard, AlertCircle, Loader2, CheckCircle2, XCircle,
  ArrowLeft, ArrowRight, Rocket, RotateCcw,
  FolderOpen, Wifi, Users, ToggleLeft, Palette,
  DollarSign, Bell, Github, Plug, Terminal,
  Shield, BarChart3, Globe, FileText,
} from 'lucide-react'
import { useSettings } from '@/app/settings-provider'
import { fetchOnboarded, syncOnboarded } from '@/lib/conversations'

// ---------------------------------------------------------------------------
// Accent color presets
// ---------------------------------------------------------------------------

const ACCENT_PRESETS = [
  { label: 'Red', value: '#EF4444' },
  { label: 'Gold', value: '#F5C518' },
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Green', value: '#22C55E' },
  { label: 'Orange', value: '#F97316' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Pink', value: '#EC4899' },
  { label: 'Teal', value: '#14B8A6' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'Lime', value: '#84CC16' },
]

// ---------------------------------------------------------------------------
// Feature modules for selection step
// ---------------------------------------------------------------------------

const FEATURE_MODULES = [
  { key: 'fleet', label: 'Agent Fleet', desc: 'Monitor all agents in real time', icon: Users, defaultOn: true },
  { key: 'chat', label: 'Chat', desc: 'Direct conversations with agents', icon: MessageSquare, defaultOn: true },
  { key: 'kanban', label: 'Kanban Board', desc: 'Task management & sprints', icon: Columns3, defaultOn: true },
  { key: 'crons', label: 'Cron Pipelines', desc: 'Scheduled jobs & DAG builder', icon: Clock, defaultOn: true },
  { key: 'memory', label: 'Memory Health', desc: 'Shared context & knowledge', icon: Brain, defaultOn: true },
  { key: 'costs', label: 'Cost Analytics', desc: 'Spend tracking & optimization', icon: BarChart3, defaultOn: true },
  { key: 'competitors', label: 'Competitor Intel', desc: 'Market intelligence tracking', icon: Globe, defaultOn: false },
  { key: 'refFiles', label: 'Reference Files', desc: 'Document management', icon: FileText, defaultOn: false },
  { key: 'security', label: 'Security Monitor', desc: 'Posture & audit tracking', icon: Shield, defaultOn: false },
]

// ---------------------------------------------------------------------------
// Tour feature cards
// ---------------------------------------------------------------------------

const TOUR_FEATURES = [
  { icon: Map, name: 'Agent Map', desc: 'Visual org chart of all your AI agents' },
  { icon: MessageSquare, name: 'Chat', desc: 'Direct conversations with any agent' },
  { icon: Columns3, name: 'Kanban', desc: 'Task board for agent work management' },
  { icon: Clock, name: 'Crons', desc: 'Scheduled jobs with DAG pipeline builder' },
  { icon: Brain, name: 'Memory', desc: 'Shared context, health monitoring & reindex' },
  { icon: BarChart3, name: 'Cost Analytics', desc: 'Spend tracking with optimization tips' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  if (!name.trim()) return '??'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SystemCheckAgent {
  id: string
  name: string
  emoji: string
  title: string
}

type CheckStatus = 'idle' | 'loading' | 'ok' | 'error'

interface DetectionResult {
  workspacePath: string | null
  openclawBin: string | null
  gatewayToken: string | null
  gatewayPort: number | null
  httpEndpointEnabled: boolean | null
  nodeVersion: string | null
  npmVersion: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface OnboardingWizardProps {
  forceOpen?: boolean
  onClose?: () => void
}

export function OnboardingWizard({ forceOpen, onClose }: OnboardingWizardProps) {
  const {
    settings,
    setPortalName,
    setPortalSubtitle,
    setOperatorName,
    setAccentColor,
  } = useSettings()

  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  // Local input values
  const [localName, setLocalName] = useState('')
  const [localSubtitle, setLocalSubtitle] = useState('')
  const [localOperator, setLocalOperator] = useState('')

  // Step 1: Prerequisites
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [detectStatus, setDetectStatus] = useState<CheckStatus>('idle')

  // Step 2: Workspace
  const [localWorkspacePath, setLocalWorkspacePath] = useState('~/.openclaw')

  // Step 3: Gateway
  const [gatewayStatus, setGatewayStatus] = useState<CheckStatus>('idle')
  const [gatewayError, setGatewayError] = useState<string | null>(null)

  // Step 4: Agent Discovery
  const [agentsStatus, setAgentsStatus] = useState<CheckStatus>('idle')
  const [agents, setAgents] = useState<SystemCheckAgent[]>([])
  const [agentsError, setAgentsError] = useState<string | null>(null)

  // Step 5: Feature Selection
  const [features, setFeatures] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    FEATURE_MODULES.forEach(f => { initial[f.key] = f.defaultOn })
    return initial
  })

  // Step 7: Notifications
  const [dailySpendLimit, setDailySpendLimit] = useState(15)
  const [keyRotationDays, setKeyRotationDays] = useState(30)
  const [costAlertsEnabled, setCostAlertsEnabled] = useState(true)
  const [securityAlertsEnabled, setSecurityAlertsEnabled] = useState(true)

  // Step 8: Integrations
  const [localGithubRepo, setLocalGithubRepo] = useState('')
  const [localGithubPat, setLocalGithubPat] = useState('')

  // ---------------------------------------------------------------------------
  // First-run detection
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (forceOpen) {
      setLocalName(settings.portalName ?? '')
      setLocalSubtitle(settings.portalSubtitle ?? '')
      setLocalOperator(settings.operatorName ?? '')
      setVisible(true)
      return
    }
    if (typeof window !== 'undefined') {
      if (localStorage.getItem('clawport-onboarded')) return
      fetchOnboarded().then(onboarded => {
        if (onboarded) {
          localStorage.setItem('clawport-onboarded', '1')
        } else {
          setVisible(true)
        }
      })
    }
  }, [forceOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Auto-detect prerequisites when reaching step 1
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (visible && step === 1 && detectStatus === 'idle') {
      runPrerequisiteCheck()
    }
  }, [visible, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-test gateway when reaching step 3
  useEffect(() => {
    if (visible && step === 3 && gatewayStatus === 'idle') {
      testGatewayConnection()
    }
  }, [visible, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-discover agents when reaching step 4
  useEffect(() => {
    if (visible && step === 4 && agentsStatus === 'idle') {
      discoverAgents()
    }
  }, [visible, step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Checks
  // ---------------------------------------------------------------------------

  function runPrerequisiteCheck() {
    setDetectStatus('loading')
    fetch('/api/setup/detect')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: DetectionResult) => {
        setDetection(data)
        setDetectStatus('ok')
        if (data.workspacePath) {
          setLocalWorkspacePath(data.workspacePath)
        }
      })
      .catch(() => {
        setDetectStatus('error')
      })
  }

  function testGatewayConnection() {
    setGatewayStatus('loading')
    setGatewayError(null)
    fetch('/api/crons')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(() => {
        setGatewayStatus('ok')
      })
      .catch(() => {
        setGatewayError('Could not reach OpenClaw gateway. Run: openclaw gateway run')
        setGatewayStatus('error')
      })
  }

  function discoverAgents() {
    setAgentsStatus('loading')
    setAgentsError(null)
    fetch('/api/agents')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          setAgents(data.map((a: Record<string, unknown>) => ({
            id: String(a.id ?? ''),
            name: String(a.name ?? ''),
            emoji: String(a.emoji ?? ''),
            title: String(a.title ?? ''),
          })))
          setAgentsStatus('ok')
        } else {
          setAgentsError('No agents found. Make sure your OpenClaw workspace has agents configured.')
          setAgentsStatus('error')
        }
      })
      .catch(() => {
        setAgentsError('Could not reach agent registry. Is the server running?')
        setAgentsStatus('error')
      })
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const TOTAL_STEPS = 10

  const saveConfig = useCallback(async () => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openclawDataDir: localWorkspacePath,
          githubRepo: localGithubRepo || null,
          dailySpendLimit,
          keyRotationDays,
          accentColor: settings.accentColor,
          setupComplete: true,
        }),
      })
    } catch {
      // Non-critical — settings are also in localStorage
    }
  }, [localWorkspacePath, localGithubRepo, dailySpendLimit, keyRotationDays, settings.accentColor])

  const handleNext = useCallback(() => {
    // Commit changes at each step boundary
    if (step === 6) {
      setPortalName(localName || null)
      setPortalSubtitle(localSubtitle || null)
      setOperatorName(localOperator || null)
    }

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
    } else {
      // Final step — save everything
      if (!forceOpen) {
        localStorage.setItem('clawport-onboarded', '1')
        syncOnboarded(true)
      }
      saveConfig()
      setVisible(false)
      onClose?.()
    }
  }, [step, localName, localSubtitle, localOperator, forceOpen, onClose, setPortalName, setPortalSubtitle, setOperatorName, saveConfig])

  const handleBack = useCallback(() => {
    if (step > 0) setStep(step - 1)
  }, [step])

  if (!visible) return null

  // ---------------------------------------------------------------------------
  // Shared styles
  // ---------------------------------------------------------------------------

  const headingStyle = {
    fontSize: 'var(--text-title1)',
    fontWeight: 'var(--weight-bold)' as const,
    letterSpacing: 'var(--tracking-tight)',
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-1)',
  }

  const subStyle = {
    fontSize: 'var(--text-subheadline)',
    color: 'var(--text-tertiary)',
    marginBottom: 'var(--space-4)',
  }

  const cardStyle = {
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--fill-quaternary)',
    border: '1px solid var(--separator)',
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--separator)',
  }

  const labelStyle = {
    display: 'block' as const,
    fontSize: 'var(--text-caption1)',
    color: 'var(--text-tertiary)',
    marginBottom: 'var(--space-1)',
  }

  // Status icon helper
  const StatusIcon = ({ status }: { status: CheckStatus }) => {
    if (status === 'loading') return <Loader2 size={18} style={{ color: 'var(--text-tertiary)', animation: 'spin 1s linear infinite' }} />
    if (status === 'ok') return <CheckCircle2 size={18} style={{ color: 'var(--system-green)' }} />
    if (status === 'error') return <XCircle size={18} style={{ color: 'var(--system-red)' }} />
    return <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--fill-tertiary)' }} />
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%',
          maxWidth: 540,
          margin: '0 var(--space-4)',
          background: 'var(--material-regular)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--separator)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Step indicator dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          padding: 'var(--space-4) var(--space-4) 0',
        }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 7,
                height: 7,
                borderRadius: 4,
                background: i === step ? 'var(--accent)' : i < step ? 'var(--accent)' : 'var(--fill-tertiary)',
                opacity: i < step ? 0.5 : 1,
                transition: 'all 200ms var(--ease-smooth)',
              }}
            />
          ))}
        </div>

        {/* Step content */}
        <div style={{
          padding: 'var(--space-5) var(--space-5) var(--space-4)',
          overflowY: 'auto',
          flex: 1,
        }}>

          {/* ================================================================
              Step 0: Welcome
              ================================================================ */}
          {step === 0 && (
            <div key="step-0" className="animate-fade-in" style={{ textAlign: 'center' }}>
              <img
                src="/ocd-logo-dark.png"
                alt="OpenClaw Dashboard"
                style={{ width: 64, height: 64, objectFit: 'contain', margin: '0 auto var(--space-3)' }}
              />
              <h2 style={{
                fontSize: 'var(--text-large-title)',
                fontWeight: 'var(--weight-bold)',
                letterSpacing: 'var(--tracking-tight)',
                color: 'var(--text-primary)',
                marginBottom: 'var(--space-2)',
              }}>
                Welcome to OpenClaw Dashboard
              </h2>
              <p style={{
                fontSize: 'var(--text-body)',
                color: 'var(--text-secondary)',
                lineHeight: 'var(--leading-relaxed)',
                maxWidth: 400,
                margin: '0 auto',
                marginBottom: 'var(--space-5)',
              }}>
                A visual command centre for your AI agent team.
                Built to give you direct, real-time access to every agent
                in your OpenClaw workspace.
              </p>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                textAlign: 'left',
              }}>
                {[
                  { emoji: '\ud83d\uddfa\ufe0f', title: 'Map & Chat', desc: 'Interactive agent org chart with direct messaging' },
                  { emoji: '\u26a1', title: 'Monitor', desc: 'Cron pipelines, memory health, cost analytics' },
                  { emoji: '\ud83c\udfa8', title: 'Personalize', desc: 'Accent colors, branding, and layout customization' },
                ].map(item => (
                  <div
                    key={item.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      ...cardStyle,
                    }}
                  >
                    <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{item.emoji}</span>
                    <div>
                      <div style={{
                        fontSize: 'var(--text-subheadline)',
                        fontWeight: 'var(--weight-semibold)',
                        color: 'var(--text-primary)',
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        fontSize: 'var(--text-caption1)',
                        color: 'var(--text-tertiary)',
                        lineHeight: 'var(--leading-normal)',
                      }}>
                        {item.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p style={{
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-quaternary)',
                marginTop: 'var(--space-4)',
              }}>
                Built with OpenClaw AI
              </p>
            </div>
          )}

          {/* ================================================================
              Step 1: Prerequisites Check
              ================================================================ */}
          {step === 1 && (
            <div key="step-1" className="animate-fade-in">
              <h2 style={headingStyle}>Prerequisites</h2>
              <p style={subStyle}>Auto-detecting your system environment...</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {/* Node.js */}
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <StatusIcon status={detectStatus === 'ok' && detection?.nodeVersion ? 'ok' : detectStatus} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                      Node.js
                    </div>
                    {detection?.nodeVersion && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                        {detection.nodeVersion}
                      </div>
                    )}
                  </div>
                </div>

                {/* OpenClaw Binary */}
                <div style={{
                  ...cardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  borderColor: detectStatus === 'ok' && !detection?.openclawBin ? 'var(--system-orange)' : undefined,
                }}>
                  <StatusIcon status={detectStatus === 'ok' ? (detection?.openclawBin ? 'ok' : 'error') : detectStatus} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                      OpenClaw CLI
                    </div>
                    {detectStatus === 'ok' && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: detection?.openclawBin ? 'var(--text-tertiary)' : 'var(--system-orange)' }}>
                        {detection?.openclawBin ? `Found at ${detection.openclawBin}` : 'Not found on PATH'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Workspace */}
                <div style={{
                  ...cardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}>
                  <StatusIcon status={detectStatus === 'ok' ? (detection?.workspacePath ? 'ok' : 'error') : detectStatus} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                      Workspace Directory
                    </div>
                    {detectStatus === 'ok' && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: detection?.workspacePath ? 'var(--text-tertiary)' : 'var(--system-orange)' }}>
                        {detection?.workspacePath || 'Not found — configure in the next step'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Gateway Token */}
                <div style={{
                  ...cardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}>
                  <StatusIcon status={detectStatus === 'ok' ? (detection?.gatewayToken ? 'ok' : 'error') : detectStatus} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                      Gateway Auth Token
                    </div>
                    {detectStatus === 'ok' && (
                      <div style={{ fontSize: 'var(--text-caption1)', color: detection?.gatewayToken ? 'var(--text-tertiary)' : 'var(--system-orange)' }}>
                        {detection?.gatewayToken ? 'Detected from openclaw.json' : 'Not configured yet'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {detectStatus === 'error' && (
                <button
                  onClick={() => { setDetectStatus('idle'); runPrerequisiteCheck() }}
                  style={{
                    marginTop: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--fill-tertiary)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--text-caption1)',
                    fontWeight: 'var(--weight-medium)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <RotateCcw size={16} />
                  Retry
                </button>
              )}

              <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', marginTop: 'var(--space-3)' }}>
                Missing items can be configured manually. You can continue regardless.
              </p>
            </div>
          )}

          {/* ================================================================
              Step 2: Workspace Setup
              ================================================================ */}
          {step === 2 && (
            <div key="step-2" className="animate-fade-in">
              <h2 style={headingStyle}>Workspace Setup</h2>
              <p style={subStyle}>Configure where OpenClaw stores its operational data.</p>

              <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={labelStyle}>
                  <FolderOpen size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                  Data directory path
                </label>
                <input
                  type="text"
                  className="apple-input"
                  placeholder="~/.openclaw"
                  value={localWorkspacePath}
                  onChange={e => setLocalWorkspacePath(e.target.value)}
                  style={inputStyle}
                />
                <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', marginTop: 'var(--space-2)' }}>
                  This directory contains gateway logs, agent sessions, and config files.
                </p>
              </div>

              {detection?.workspacePath && (
                <div style={{
                  ...cardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  borderColor: 'var(--system-green)',
                  background: 'rgba(52,199,89,0.06)',
                }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--system-green)', flexShrink: 0 }} />
                  <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)' }}>
                    Auto-detected workspace at <code style={{
                      fontSize: 'var(--text-caption2)',
                      background: 'var(--code-bg)',
                      padding: '1px 4px',
                      borderRadius: 3,
                      color: 'var(--code-text)',
                    }}>{detection.workspacePath}</code>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              Step 3: Gateway Connection
              ================================================================ */}
          {step === 3 && (
            <div key="step-3" className="animate-fade-in">
              <h2 style={headingStyle}>Gateway Connection</h2>
              <p style={subStyle}>Testing connectivity to the OpenClaw gateway...</p>

              <div style={{
                ...cardStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                borderColor: gatewayStatus === 'error' ? 'var(--system-red)' : gatewayStatus === 'ok' ? 'var(--system-green)' : undefined,
                marginBottom: 'var(--space-4)',
              }}>
                <StatusIcon status={gatewayStatus} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                    OpenClaw Gateway
                  </div>
                  {gatewayStatus === 'ok' && (
                    <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--system-green)' }}>
                      Connected successfully
                    </div>
                  )}
                  {gatewayError && (
                    <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--system-red)' }}>
                      {gatewayError}
                    </div>
                  )}
                  {gatewayStatus === 'loading' && (
                    <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                      Testing connection...
                    </div>
                  )}
                </div>
              </div>

              {detection?.gatewayPort && (
                <div style={{ ...cardStyle, marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)' }}>
                    Gateway port: <strong style={{ color: 'var(--text-secondary)' }}>{detection.gatewayPort}</strong>
                  </div>
                </div>
              )}

              {detection?.httpEndpointEnabled === true && (
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <CheckCircle2 size={16} style={{ color: 'var(--system-green)', flexShrink: 0 }} />
                  <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)' }}>
                    HTTP chat completions endpoint is enabled
                  </div>
                </div>
              )}

              {gatewayStatus === 'error' && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  <button
                    onClick={() => { setGatewayStatus('idle'); testGatewayConnection() }}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--fill-tertiary)',
                      color: 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'var(--text-caption1)',
                      fontWeight: 'var(--weight-medium)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={16} />
                    Retry
                  </button>
                </div>
              )}

              {gatewayStatus !== 'ok' && (
                <div style={{
                  marginTop: 'var(--space-4)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--fill-quaternary)',
                  border: '1px solid var(--separator)',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    marginBottom: 'var(--space-2)',
                  }}>
                    <Terminal size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', fontWeight: 'var(--weight-semibold)' }}>
                      Quick Start
                    </span>
                  </div>
                  <code style={{
                    display: 'block',
                    fontSize: 'var(--text-caption2)',
                    background: 'var(--code-bg)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--code-text)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    openclaw gateway run
                  </code>
                  <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', marginTop: 'var(--space-2)' }}>
                    Start the gateway in another terminal, then retry above.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              Step 4: Agent Discovery
              ================================================================ */}
          {step === 4 && (
            <div key="step-4" className="animate-fade-in">
              <h2 style={headingStyle}>Agent Discovery</h2>
              <p style={subStyle}>Scanning your workspace for registered agents...</p>

              <div style={{
                ...cardStyle,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                borderColor: agentsStatus === 'error' ? 'var(--system-red)' : agentsStatus === 'ok' ? 'var(--system-green)' : undefined,
                marginBottom: 'var(--space-4)',
              }}>
                <StatusIcon status={agentsStatus} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                    Agent Registry
                  </div>
                  {agentsStatus === 'ok' && (
                    <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--system-green)' }}>
                      {agents.length} agent{agents.length !== 1 ? 's' : ''} discovered
                    </div>
                  )}
                  {agentsError && (
                    <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--system-red)' }}>
                      {agentsError}
                    </div>
                  )}
                </div>
              </div>

              {/* Agent roster */}
              {agentsStatus === 'ok' && agents.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 'var(--text-caption2)',
                    color: 'var(--text-quaternary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: 600,
                    marginBottom: 'var(--space-2)',
                  }}>
                    Your Agent Team
                  </div>
                  <div style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--fill-quaternary)',
                    border: '1px solid var(--separator)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 'var(--space-2)',
                  }}>
                    {agents.map(a => (
                      <div
                        key={a.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--material-thin)',
                          border: '1px solid var(--separator)',
                          fontSize: 'var(--text-caption1)',
                        }}
                      >
                        <span>{a.emoji}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 'var(--weight-medium)' }}>{a.name}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{
                    fontSize: 'var(--text-caption1)',
                    color: 'var(--text-tertiary)',
                    marginTop: 'var(--space-2)',
                  }}>
                    Agents are auto-discovered from your workspace. You can customize avatars later in Settings.
                  </p>
                </div>
              )}

              {agentsStatus === 'error' && (
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={() => { setAgentsStatus('idle'); discoverAgents() }}
                    style={{
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--fill-tertiary)',
                      color: 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'var(--text-caption1)',
                      fontWeight: 'var(--weight-medium)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={16} />
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              Step 5: Feature Selection
              ================================================================ */}
          {step === 5 && (
            <div key="step-5" className="animate-fade-in">
              <h2 style={headingStyle}>Feature Selection</h2>
              <p style={subStyle}>Choose which modules to enable. You can change these anytime in Settings.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {FEATURE_MODULES.map(mod => {
                  const Icon = mod.icon
                  const enabled = features[mod.key]
                  return (
                    <button
                      key={mod.key}
                      onClick={() => setFeatures(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                      style={{
                        ...cardStyle,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 150ms var(--ease-smooth)',
                        borderColor: enabled ? 'var(--accent)' : undefined,
                        background: enabled ? 'rgba(var(--accent-rgb, 59,130,246), 0.06)' : 'var(--fill-quaternary)',
                      }}
                    >
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: enabled ? 'var(--accent-fill)' : 'var(--fill-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 150ms var(--ease-smooth)',
                      }}>
                        <Icon size={18} style={{ color: enabled ? 'var(--accent)' : 'var(--text-quaternary)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--text-subheadline)',
                          fontWeight: 'var(--weight-semibold)',
                          color: enabled ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        }}>
                          {mod.label}
                        </div>
                        <div style={{
                          fontSize: 'var(--text-caption1)',
                          color: 'var(--text-tertiary)',
                        }}>
                          {mod.desc}
                        </div>
                      </div>
                      <div style={{
                        width: 40,
                        height: 24,
                        borderRadius: 12,
                        background: enabled ? 'var(--accent)' : 'var(--fill-tertiary)',
                        position: 'relative',
                        transition: 'all 200ms var(--ease-smooth)',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          top: 2,
                          left: enabled ? 18 : 2,
                          transition: 'all 200ms var(--ease-smooth)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* ================================================================
              Step 6: Appearance (Name + Accent Color)
              ================================================================ */}
          {step === 6 && (
            <div key="step-6" className="animate-fade-in">
              <h2 style={headingStyle}>Appearance</h2>
              <p style={subStyle}>Personalize your command centre.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
                <div>
                  <label style={labelStyle}>Your Name</label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="Your Name"
                    value={localOperator}
                    onChange={e => setLocalOperator(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Dashboard Name</label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="OpenClaw Dashboard"
                    value={localName}
                    onChange={e => setLocalName(e.target.value)}
                    autoFocus
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Subtitle</label>
                  <input
                    type="text"
                    className="apple-input"
                    placeholder="Command Centre"
                    value={localSubtitle}
                    onChange={e => setLocalSubtitle(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Accent Color */}
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{
                  fontSize: 'var(--text-caption2)',
                  color: 'var(--text-quaternary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}>
                  Accent Color
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, 1fr)',
                  gap: 'var(--space-3)',
                  justifyItems: 'center',
                }}>
                  {ACCENT_PRESETS.map(preset => {
                    const isActive = settings.accentColor === preset.value
                    return (
                      <button
                        key={preset.value}
                        onClick={() => setAccentColor(preset.value)}
                        aria-label={preset.label}
                        title={preset.label}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: preset.value,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          outline: isActive ? `3px solid ${preset.value}` : 'none',
                          outlineOffset: 3,
                          transition: 'all 100ms var(--ease-smooth)',
                        }}
                      >
                        {isActive && <Check size={16} color="#000" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Mini preview */}
              <div style={{
                ...cardStyle,
              }}>
                <div style={{
                  fontSize: 'var(--text-caption2)',
                  color: 'var(--text-quaternary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 600,
                  marginBottom: 'var(--space-2)',
                }}>
                  Preview
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: settings.accentColor
                      ? `linear-gradient(135deg, ${settings.accentColor}, ${settings.accentColor}dd)`
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}>
                    <img src="/ocd-logo-dark.png" alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--text-subheadline)',
                      fontWeight: 'var(--weight-bold)',
                      color: 'var(--text-primary)',
                      letterSpacing: 'var(--tracking-tight)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {localName || 'OpenClaw Dashboard'}
                    </div>
                    <div style={{ fontSize: 'var(--text-caption2)', color: 'var(--text-tertiary)' }}>
                      {localSubtitle || 'Command Centre'}
                    </div>
                  </div>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 7,
                    background: 'var(--accent-fill)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    flexShrink: 0,
                    letterSpacing: '-0.02em',
                  }}>
                    {getInitials(localOperator)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              Step 7: Notifications
              ================================================================ */}
          {step === 7 && (
            <div key="step-7" className="animate-fade-in">
              <h2 style={headingStyle}>Notifications</h2>
              <p style={subStyle}>Configure alerts and reminders.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Cost alerts */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <DollarSign size={16} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                        Cost Alerts
                      </span>
                    </div>
                    <button
                      onClick={() => setCostAlertsEnabled(!costAlertsEnabled)}
                      style={{
                        width: 40,
                        height: 24,
                        borderRadius: 12,
                        background: costAlertsEnabled ? 'var(--accent)' : 'var(--fill-tertiary)',
                        position: 'relative',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 200ms var(--ease-smooth)',
                      }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: 2,
                        left: costAlertsEnabled ? 18 : 2,
                        transition: 'all 200ms var(--ease-smooth)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                  {costAlertsEnabled && (
                    <div style={{ ...cardStyle }}>
                      <label style={labelStyle}>Daily spend limit (USD)</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-subheadline)' }}>$</span>
                        <input
                          type="number"
                          className="apple-input"
                          value={dailySpendLimit}
                          onChange={e => setDailySpendLimit(parseFloat(e.target.value) || 0)}
                          min={1}
                          step={1}
                          style={{ ...inputStyle, width: 120 }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Security alerts */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <Shield size={16} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                        Security Alerts
                      </span>
                    </div>
                    <button
                      onClick={() => setSecurityAlertsEnabled(!securityAlertsEnabled)}
                      style={{
                        width: 40,
                        height: 24,
                        borderRadius: 12,
                        background: securityAlertsEnabled ? 'var(--accent)' : 'var(--fill-tertiary)',
                        position: 'relative',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 200ms var(--ease-smooth)',
                      }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: 2,
                        left: securityAlertsEnabled ? 18 : 2,
                        transition: 'all 200ms var(--ease-smooth)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </button>
                  </div>
                </div>

                {/* Key rotation */}
                <div style={{ ...cardStyle }}>
                  <label style={labelStyle}>API key rotation reminder (days)</label>
                  <input
                    type="number"
                    className="apple-input"
                    value={keyRotationDays}
                    onChange={e => setKeyRotationDays(parseInt(e.target.value) || 30)}
                    min={7}
                    step={1}
                    style={{ ...inputStyle, width: 120 }}
                  />
                  <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', marginTop: 'var(--space-2)' }}>
                    You&apos;ll see a reminder in the security dashboard when keys are due for rotation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              Step 8: Integrations
              ================================================================ */}
          {step === 8 && (
            <div key="step-8" className="animate-fade-in">
              <h2 style={headingStyle}>Integrations</h2>
              <p style={subStyle}>Optional connections to external services.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* GitHub */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                    <Github size={18} style={{ color: 'var(--text-primary)' }} />
                    <span style={{ fontSize: 'var(--text-subheadline)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
                      GitHub
                    </span>
                    <span style={{
                      fontSize: 'var(--text-caption2)',
                      color: 'var(--text-quaternary)',
                      background: 'var(--fill-tertiary)',
                      padding: '1px 6px',
                      borderRadius: 4,
                    }}>
                      Optional
                    </span>
                  </div>
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <label style={labelStyle}>Repository (owner/repo)</label>
                    <input
                      type="text"
                      className="apple-input"
                      placeholder="your-org/your-repo"
                      value={localGithubRepo}
                      onChange={e => setLocalGithubRepo(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Personal Access Token</label>
                    <input
                      type="password"
                      className="apple-input"
                      placeholder="ghp_..."
                      value={localGithubPat}
                      onChange={e => setLocalGithubPat(e.target.value)}
                      style={inputStyle}
                    />
                    <p style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-quaternary)', marginTop: 'var(--space-1)' }}>
                      For private repos. Add to <code style={{
                        fontSize: 'var(--text-caption2)',
                        background: 'var(--code-bg)',
                        padding: '1px 4px',
                        borderRadius: 3,
                        color: 'var(--code-text)',
                      }}>.env.local</code> as GITHUB_PAT for persistence.
                    </p>
                  </div>
                </div>

                {/* Additional integrations hint */}
                <div style={{
                  ...cardStyle,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)',
                }}>
                  <Plug size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-tertiary)', lineHeight: 'var(--leading-relaxed)' }}>
                    More integrations (Slack webhooks, email notifications, ElevenLabs voice) can be configured
                    in <code style={{
                      fontSize: 'var(--text-caption2)',
                      background: 'var(--code-bg)',
                      padding: '1px 4px',
                      borderRadius: 3,
                      color: 'var(--code-text)',
                    }}>.env.local</code> or Settings after setup.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================
              Step 9: Tour & Summary
              ================================================================ */}
          {step === 9 && (
            <div key="step-9" className="animate-fade-in">
              <h2 style={{
                ...headingStyle,
                fontSize: 'var(--text-title2)',
              }}>
                You&apos;re All Set
              </h2>
              <p style={subStyle}>
                Here&apos;s what you can do with your dashboard.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {TOUR_FEATURES.map(f => {
                  const Icon = f.icon
                  return (
                    <div
                      key={f.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-3)',
                        ...cardStyle,
                      }}
                    >
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'var(--accent-fill)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon size={18} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 'var(--text-subheadline)',
                          fontWeight: 'var(--weight-semibold)',
                          color: 'var(--text-primary)',
                        }}>
                          {f.name}
                        </div>
                        <div style={{
                          fontSize: 'var(--text-caption1)',
                          color: 'var(--text-tertiary)',
                        }}>
                          {f.desc}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Voice tip */}
              <div style={{
                ...cardStyle,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
              }}>
                <Keyboard size={16} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 'var(--text-caption1)', color: 'var(--text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
                  <strong>Tip:</strong> Use macOS Dictation (<strong>Fn Fn</strong>) in any chat input to talk to your agents by voice.
                </div>
              </div>

              <p style={{
                fontSize: 'var(--text-caption1)',
                color: 'var(--text-quaternary)',
                marginTop: 'var(--space-3)',
                textAlign: 'center',
              }}>
                You can re-run this wizard anytime from Settings.
              </p>
            </div>
          )}

        </div>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'var(--space-3) var(--space-5) var(--space-5)',
          gap: 'var(--space-3)',
        }}>
          {step > 0 ? (
            <button
              onClick={handleBack}
              style={{
                padding: 'var(--space-2) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--fill-tertiary)',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--text-subheadline)',
                fontWeight: 'var(--weight-medium)',
                transition: 'all 150ms var(--ease-smooth)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleNext}
            disabled={step === 1 && detectStatus === 'loading'}
            style={{
              padding: 'var(--space-2) var(--space-6)',
              borderRadius: 'var(--radius-md)',
              background: (step === 1 && detectStatus === 'loading') ? 'var(--fill-tertiary)' : 'var(--accent)',
              color: (step === 1 && detectStatus === 'loading') ? 'var(--text-quaternary)' : 'var(--accent-contrast)',
              border: 'none',
              cursor: (step === 1 && detectStatus === 'loading') ? 'wait' : 'pointer',
              fontSize: 'var(--text-subheadline)',
              fontWeight: 'var(--weight-semibold)',
              transition: 'all 150ms var(--ease-smooth)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {step === 0 ? 'Begin' : step === TOTAL_STEPS - 1 ? 'Get Started' : 'Next'}
            {step === TOTAL_STEPS - 1 ? <Rocket size={16} /> : <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
