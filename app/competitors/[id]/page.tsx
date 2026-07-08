'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, ExternalLink, Globe, Loader2, Trash2,
  Shield, AlertTriangle, Lightbulb, Target, RefreshCw,
  Sparkles, DollarSign, Zap, MessageSquare,
} from 'lucide-react';
import { ErrorState } from '@/components/ErrorState';
import { useDashboardStore } from '@/store/dashboard';

interface Competitor {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  last_updated: string | null;
  swot_json: string | null;
  updates_json: string | null;
  feedback_json: string | null;
  created_at: string;
}

interface SwotData {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  generatedAt: string;
}

interface FetchedUpdate {
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
}

interface FetchedFeedback {
  positiveThemes: string[];
  complaints: string[];
  quotes: string[];
  fetchedAt: string;
}

interface ResearchResult {
  pricing?: string;
  funding?: string;
  keyDifferentiators?: string[];
}

// ---------------------------------------------------------------------------
// Main Page — Everything visible, no tabs
// ---------------------------------------------------------------------------

export default function CompetitorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const activeProjectId = useDashboardStore(s => s.activeProjectId) || 'default';
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [researching, setResearching] = useState(false);
  const [researchExtra, setResearchExtra] = useState<ResearchResult | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [fetchingUpdates, setFetchingUpdates] = useState(false);
  const [fetchingFeedback, setFetchingFeedback] = useState(false);

  const loadCompetitor = useCallback(() => {
    setError(null);
    setLoading(true);
    fetch(`/api/competitors/${id}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load competitor');
        return r.json();
      })
      .then(data => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setCompetitor(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load competitor');
        setLoading(false);
      });
  }, [id]);

  useEffect(() => { loadCompetitor(); }, [loadCompetitor]);

  function parseJSON<T>(json: string | null, fallback: T): T {
    if (!json) return fallback;
    try { return JSON.parse(json); }
    catch { return fallback; }
  }

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error && !competitor) {
    return <ErrorState message={error} onRetry={loadCompetitor} />;
  }

  if (!competitor) {
    return (
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Competitor not found
      </div>
    );
  }

  const swot = parseJSON<SwotData | null>(competitor.swot_json, null);
  const updates = parseJSON<FetchedUpdate[]>(competitor.updates_json, []);
  const feedback = parseJSON<FetchedFeedback | null>(competitor.feedback_json, null);

  let faviconUrl: string | null = null;
  try {
    faviconUrl = competitor.url ? `https://www.google.com/s2/favicons?domain=${new URL(competitor.url).hostname}&sz=64` : null;
  } catch { /* invalid url */ }

  // Run the researcher agent on this competitor
  async function handleResearch() {
    setResearching(true);
    setResearchError(null);
    try {
      const res = await fetch(`/api/competitors/${id}/research`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setResearchError(data.error + (data.details ? `: ${data.details}` : ''));
      } else {
        // Save extra fields that don't go in the DB
        if (data.research) {
          setResearchExtra({
            pricing: data.research.pricing,
            funding: data.research.funding,
            keyDifferentiators: data.research.keyDifferentiators,
          });
        }
        // Reload competitor to get updated DB data
        loadCompetitor();
      }
    } catch (e: unknown) {
      setResearchError(e instanceof Error && e.message ? e.message : 'Failed to reach researcher agent');
    } finally {
      setResearching(false);
    }
  }

  async function handleFetchUpdates() {
    if (!competitor) return;
    setFetchingUpdates(true);
    try {
      const res = await fetch(`/api/market-intel?limit=100&projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items || data.signals || [];
      const name = competitor.name.toLowerCase();
      const relevant: FetchedUpdate[] = items
        .filter((s: any) => {
          const text = `${s.competitor || ''} ${s.title || ''}`.toLowerCase();
          return text.includes(name);
        })
        .slice(0, 10)
        .map((s: any) => ({ title: s.title, summary: s.context || '', source: s.source || '', url: s.url || '', date: s.date || '' }));

      await fetch(`/api/competitors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates_json: JSON.stringify(relevant), last_updated: new Date().toISOString().split('T')[0] }),
      });
      loadCompetitor();
    } catch { /* silent */ } finally {
      setFetchingUpdates(false);
    }
  }

  async function handleFetchFeedback() {
    if (!competitor) return;
    setFetchingFeedback(true);
    try {
      const res = await fetch(`/api/practitioner-signals?limit=100&projectId=${activeProjectId}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items || data.signals || [];
      const name = competitor.name.toLowerCase();
      const relevant = items.filter((s: any) => {
        const text = `${s.title || ''} ${s.verbatim || ''} ${s.context || ''}`.toLowerCase();
        return text.includes(name);
      });

      const fb: FetchedFeedback = {
        positiveThemes: relevant.filter((s: any) => s.type === 'positive' || s.type === 'tool-review').slice(0, 5).map((s: any) => s.title),
        complaints: relevant.filter((s: any) => s.type === 'pain-point' || s.type === 'frustration' || s.type === 'tool-switch').slice(0, 5).map((s: any) => s.title),
        quotes: relevant.filter((s: any) => s.verbatim).slice(0, 5).map((s: any) => s.verbatim),
        fetchedAt: new Date().toISOString(),
      };

      await fetch(`/api/competitors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback_json: JSON.stringify(fb) }),
      });
      loadCompetitor();
    } catch { /* silent */ } finally {
      setFetchingFeedback(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove ${competitor?.name} from tracking?`)) return;
    await fetch(`/api/competitors/${id}`, { method: 'DELETE' });
    window.location.href = '/competitors';
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      {/* Back link */}
      <Link
        href="/competitors"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: 'var(--space-4)' }}
      >
        <ArrowLeft size={14} /> Competitor Intelligence
      </Link>

      {/* ================================================================== */}
      {/* HEADER CARD */}
      {/* ================================================================== */}
      <div
        style={{
          padding: 'var(--space-5)',
          borderRadius: '12px',
          border: '1px solid var(--separator)',
          background: 'var(--bg-secondary)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '52px', height: '52px', borderRadius: '12px',
              background: 'var(--fill-quaternary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
            }}
          >
            {faviconUrl ? (
              <img src={faviconUrl} alt="" width={34} height={34} style={{ borderRadius: '4px' }} />
            ) : (
              <Globe size={26} style={{ color: 'var(--text-tertiary)' }} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {competitor.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: 'var(--fill-quaternary)', color: 'var(--text-tertiary)' }}>
                {competitor.category}
              </span>
              {competitor.url && (
                <a href={competitor.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
                  {(() => { try { return new URL(competitor.url).hostname; } catch { return competitor.url; } })()}
                  <ExternalLink size={11} />
                </a>
              )}
              {competitor.last_updated && (
                <span style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>
                  Last updated: {competitor.last_updated}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
            <button
              className="btn-primary"
              onClick={handleResearch}
              disabled={researching}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
            >
              {researching ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
              {researching ? 'Researching...' : 'Research'}
            </button>
            <button
              className="btn-ghost"
              onClick={handleDelete}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', color: 'var(--system-red)' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {competitor.description && (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 'var(--space-4) 0 0 0' }}>
            {competitor.description}
          </p>
        )}
      </div>

      {/* Research error */}
      {researchError && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--system-red)', background: 'rgba(255,69,58,0.08)', marginBottom: 'var(--space-4)', fontSize: '13px', color: 'var(--system-red)' }}>
          {researchError}
        </div>
      )}

      {/* ================================================================== */}
      {/* KEY INSIGHTS (from research extra) */}
      {/* ================================================================== */}
      {(researchExtra?.pricing || researchExtra?.funding || researchExtra?.keyDifferentiators) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {researchExtra.pricing && (
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <DollarSign size={13} style={{ color: 'var(--system-green)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Pricing</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{researchExtra.pricing}</div>
            </div>
          )}
          {researchExtra.funding && (
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Zap size={13} style={{ color: 'var(--system-orange)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Funding</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{researchExtra.funding}</div>
            </div>
          )}
          {researchExtra.keyDifferentiators && researchExtra.keyDifferentiators.length > 0 && (
            <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Target size={13} style={{ color: 'var(--system-blue)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)' }}>Differentiators</span>
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                {researchExtra.keyDifferentiators.map((d, i) => (
                  <li key={i} style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* SWOT ANALYSIS */}
      {/* ================================================================== */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>SWOT Analysis</h2>
          {swot?.generatedAt && (
            <span style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>
              Generated {new Date(swot.generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        {swot && (swot.strengths.length > 0 || swot.weaknesses.length > 0 || swot.opportunities.length > 0 || swot.threats.length > 0) ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {[
              { title: 'Strengths', items: swot.strengths, icon: Shield, color: 'var(--system-green)' },
              { title: 'Weaknesses', items: swot.weaknesses, icon: AlertTriangle, color: 'var(--system-orange)' },
              { title: 'Opportunities', items: swot.opportunities, icon: Lightbulb, color: 'var(--system-blue)' },
              { title: 'Threats', items: swot.threats, icon: Target, color: 'var(--system-red)' },
            ].map(s => {
              const SIcon = s.icon;
              return (
                <div key={s.title} style={{ padding: 'var(--space-4)', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-3)' }}>
                    <SIcon size={15} style={{ color: s.color }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: s.color }}>{s.title}</span>
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {s.items.map((item, i) => (
                      <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-5)', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-quaternary)', margin: 0 }}>
              No SWOT analysis yet. Click <strong>Research</strong> above to generate one.
            </p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* LATEST UPDATES */}
      {/* ================================================================== */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>Latest Updates</h2>
          <button
            className="btn-ghost"
            onClick={handleFetchUpdates}
            disabled={fetchingUpdates}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}
          >
            {fetchingUpdates ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
            Pull from Market Intel
          </button>
        </div>
        {updates.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {updates.map((u, i) => (
              <div key={i} style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{u.title}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-quaternary)', flexShrink: 0 }}>{u.date}</span>
                </div>
                {u.summary && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.6, margin: '6px 0 0 0' }}>{u.summary}</p>}
                {u.source && (
                  <div style={{ fontSize: '11px', color: 'var(--text-quaternary)', marginTop: '4px' }}>
                    Source: {u.source}
                    {u.url && (
                      <a href={u.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', marginLeft: '6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        Link <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-5)', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-quaternary)', margin: 0 }}>
              No updates yet. Click <strong>Research</strong> or <strong>Pull from Market Intel</strong>.
            </p>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* USER FEEDBACK */}
      {/* ================================================================== */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>User Feedback</h2>
          <button
            className="btn-ghost"
            onClick={handleFetchFeedback}
            disabled={fetchingFeedback}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}
          >
            {fetchingFeedback ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
            Pull from Signals
          </button>
        </div>
        {feedback && (feedback.positiveThemes.length > 0 || feedback.complaints.length > 0 || feedback.quotes.length > 0) ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {/* Positive */}
            {feedback.positiveThemes.length > 0 && (
              <div style={{ padding: 'var(--space-4)', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-2)' }}>
                  <Shield size={13} style={{ color: 'var(--system-green)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--system-green)' }}>What Users Love</span>
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {feedback.positiveThemes.map((t, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Complaints */}
            {feedback.complaints.length > 0 && (
              <div style={{ padding: 'var(--space-4)', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-2)' }}>
                  <AlertTriangle size={13} style={{ color: 'var(--system-red)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--system-red)' }}>Complaints</span>
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {feedback.complaints.map((c, i) => (
                    <li key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            {/* Quotes — full width */}
            {feedback.quotes.length > 0 && (
              <div style={{ gridColumn: '1 / -1', padding: 'var(--space-4)', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: 'var(--space-3)' }}>
                  <MessageSquare size={13} style={{ color: 'var(--text-primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Notable Quotes</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {feedback.quotes.map((q, i) => (
                    <blockquote
                      key={i}
                      style={{
                        fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.6,
                        padding: 'var(--space-3) var(--space-4)', borderLeft: '3px solid var(--accent)',
                        background: 'var(--fill-quaternary)', borderRadius: '0 6px 6px 0', margin: 0,
                      }}
                    >
                      &ldquo;{q}&rdquo;
                    </blockquote>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 'var(--space-5)', borderRadius: '10px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-quaternary)', margin: 0 }}>
              No feedback data yet. Click <strong>Research</strong> or <strong>Pull from Signals</strong>.
            </p>
          </div>
        )}
        {feedback?.fetchedAt && (
          <p style={{ fontSize: '11px', color: 'var(--text-quaternary)', marginTop: 'var(--space-2)' }}>
            Last fetched: {new Date(feedback.fetchedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
    </div>
  );
}
