'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Globe, Loader2, Search, Sparkles, X, ExternalLink,
  Activity, Clock, Shield, Eye, EyeOff, Pencil, Trash2, MoreHorizontal, Check,
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
  watched: number;
  created_at: string;
}

interface Discovered {
  name: string;
  url: string;
  description: string;
  category: string;
}

// ---------------------------------------------------------------------------
// Add Competitor Modal
// ---------------------------------------------------------------------------

function AddCompetitorModal({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string, url: string, description: string, category: string) => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="apple-card animate-scale-up" style={{ position: 'relative', width: '420px', maxWidth: '90vw', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          Add Competitor
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input className="apple-input" placeholder="Company name" value={name} onChange={e => setName(e.target.value)} autoFocus style={{ fontSize: '14px' }} />
          <input className="apple-input" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} style={{ fontSize: '14px' }} />
          <input className="apple-input" placeholder="Category (e.g. Research Repository)" value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: '14px' }} />
          <textarea className="apple-input" placeholder="Description..." value={desc} onChange={e => setDesc(e.target.value)} rows={2} style={{ fontSize: '14px', resize: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
          <button className="btn-ghost" onClick={onClose} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px' }}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { if (name.trim()) onAdd(name.trim(), url.trim(), desc.trim(), category.trim() || 'Uncategorized'); }}
            disabled={!name.trim()}
            style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px' }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discover Results Modal
// ---------------------------------------------------------------------------

function DiscoverModal({ results, onClose, onAdd }: {
  results: Discovered[];
  onClose: () => void;
  onAdd: (d: Discovered) => void;
}) {
  const [added, setAdded] = useState<Set<string>>(new Set());

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="apple-card animate-scale-up" style={{ position: 'relative', width: '600px', maxWidth: '90vw', maxHeight: '80vh', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>Discovered Competitors</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>AI researcher found {results.length} new competitors</p>
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {results.map((d, i) => (
            <div key={i} style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'var(--fill-quaternary)', color: 'var(--text-tertiary)' }}>{d.category}</span>
                </div>
                <button
                  className={added.has(d.name) ? 'btn-ghost' : 'btn-primary'}
                  disabled={added.has(d.name)}
                  onClick={() => { onAdd(d); setAdded(prev => new Set(prev).add(d.name)); }}
                  style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}
                >
                  {added.has(d.name) ? 'Added' : '+ Add'}
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{d.description}</p>
              {d.url && (
                <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px', display: 'inline-block' }}>
                  {d.url}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hasRecentUpdate(comp: Competitor): boolean {
  if (!comp.last_updated) return false;
  const updated = new Date(comp.last_updated).getTime();
  const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
  return updated > threeDaysAgo;
}

function hasSwot(comp: Competitor): boolean {
  if (!comp.swot_json) return false;
  try { const s = JSON.parse(comp.swot_json); return s.strengths?.length > 0; }
  catch { return false; }
}

function getUpdateCount(comp: Competitor): number {
  if (!comp.updates_json) return 0;
  try { return JSON.parse(comp.updates_json).length; }
  catch { return 0; }
}

function getFaviconUrl(url: string): string | null {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; }
  catch { return null; }
}

// ---------------------------------------------------------------------------
// Competitor Card (shared between watched list and grid)
// ---------------------------------------------------------------------------

function EditCompetitorModal({ comp, onClose, onSave }: {
  comp: Competitor;
  onClose: () => void;
  onSave: (id: string, data: { name: string; url: string; description: string; category: string }) => void;
}) {
  const [name, setName] = useState(comp.name);
  const [url, setUrl] = useState(comp.url);
  const [desc, setDesc] = useState(comp.description);
  const [category, setCategory] = useState(comp.category);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
      <div className="apple-card animate-scale-up" style={{ position: 'relative', width: '420px', maxWidth: '90vw', padding: 'var(--space-6)' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          Edit Competitor
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <input className="apple-input" placeholder="Company name" value={name} onChange={e => setName(e.target.value)} autoFocus style={{ fontSize: '14px' }} />
          <input className="apple-input" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} style={{ fontSize: '14px' }} />
          <input className="apple-input" placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} style={{ fontSize: '14px' }} />
          <textarea className="apple-input" placeholder="Description..." value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ fontSize: '14px', resize: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-5)' }}>
          <button className="btn-ghost" onClick={onClose} style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px' }}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => { if (name.trim()) onSave(comp.id, { name: name.trim(), url: url.trim(), description: desc.trim(), category: category.trim() || 'Uncategorized' }); }}
            disabled={!name.trim()}
            style={{ padding: '6px 16px', borderRadius: '6px', fontSize: '13px' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function CompetitorCard({ comp, onToggleWatch, onEdit, onDelete }: {
  comp: Competitor;
  onToggleWatch: (id: string, watched: boolean) => void;
  onEdit: (comp: Competitor) => void;
  onDelete: (comp: Competitor) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const favicon = comp.url ? getFaviconUrl(comp.url) : null;
  const recent = hasRecentUpdate(comp);
  const analyzed = hasSwot(comp);
  const updateCount = getUpdateCount(comp);
  const isWatched = comp.watched === 1;

  return (
    <div
      style={{
        padding: 'var(--space-4)',
        borderRadius: '10px',
        border: recent ? '1px solid var(--accent)' : '1px solid var(--separator)',
        background: 'var(--bg-secondary)',
        transition: 'all 150ms ease-out',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Update ping */}
      {recent && (
        <span
          style={{
            position: 'absolute', top: '12px', right: '12px',
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--system-green)', boxShadow: '0 0 6px var(--system-green)',
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <Link href={`/competitors/${comp.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: '36px', height: '36px', borderRadius: '8px',
              background: 'var(--fill-quaternary)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
            }}
          >
            {favicon ? (
              <img src={favicon} alt="" width={22} height={22} style={{ borderRadius: '3px' }} />
            ) : (
              <Globe size={18} style={{ color: 'var(--text-tertiary)' }} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {comp.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-quaternary)' }}>
              {comp.category}
            </div>
          </div>
        </Link>

        {/* Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          {/* Watch toggle */}
          <button
            onClick={(e) => { e.preventDefault(); onToggleWatch(comp.id, !isWatched); }}
            title={isWatched ? 'Unwatch' : 'Watch closely'}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
              borderRadius: '4px', display: 'flex', alignItems: 'center',
              color: isWatched ? 'var(--accent)' : 'var(--text-quaternary)',
              transition: 'color 150ms ease-out',
            }}
          >
            {isWatched ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>

          {/* More menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); setConfirmDelete(false); }}
              title="Actions"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                borderRadius: '4px', display: 'flex', alignItems: 'center',
                color: menuOpen ? 'var(--text-primary)' : 'var(--text-quaternary)',
                transition: 'color 150ms ease-out',
              }}
            >
              <MoreHorizontal size={15} />
            </button>

            {menuOpen && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => { setMenuOpen(false); setConfirmDelete(false); }} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: '4px', zIndex: 51,
                  background: 'var(--bg-secondary)', border: '1px solid var(--separator)',
                  borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  minWidth: '140px', overflow: 'hidden',
                }}>
                  <button
                    onClick={(e) => { e.preventDefault(); setMenuOpen(false); onEdit(comp); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '13px', color: 'var(--text-primary)', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--fill-quaternary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <Pencil size={13} style={{ color: 'var(--text-tertiary)' }} /> Edit
                  </button>
                  {!confirmDelete ? (
                    <button
                      onClick={(e) => { e.preventDefault(); setConfirmDelete(true); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '13px', color: 'var(--system-red)', textAlign: 'left',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--fill-quaternary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); setMenuOpen(false); setConfirmDelete(false); onDelete(comp); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 12px', background: 'rgba(255,69,58,0.1)', border: 'none', cursor: 'pointer',
                        fontSize: '13px', color: 'var(--system-red)', textAlign: 'left', fontWeight: 600,
                      }}
                    >
                      <Check size={13} /> Confirm delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description (clickable) */}
      <Link href={`/competitors/${comp.id}`} style={{ textDecoration: 'none' }}>
        <p style={{
          fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 var(--space-3) 0',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          cursor: 'pointer',
        }}>
          {comp.description || 'No description yet — run researcher agent to populate.'}
        </p>
      </Link>

      {/* Footer: status indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {analyzed && (
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(175,82,222,0.1)', color: 'var(--system-purple)', fontWeight: 600 }}>
            SWOT
          </span>
        )}
        {updateCount > 0 && (
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0,122,255,0.1)', color: 'var(--system-blue)', fontWeight: 600 }}>
            {updateCount} update{updateCount !== 1 ? 's' : ''}
          </span>
        )}
        {comp.last_updated && (
          <span style={{ fontSize: '10px', color: 'var(--text-quaternary)', marginLeft: 'auto' }}>
            {comp.last_updated}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CompetitorsPage() {
  const activeProjectId = useDashboardStore(s => s.activeProjectId) || 'default';
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Competitor | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<Discovered[] | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCompetitors = useCallback(() => {
    setError(null);
    setLoading(true);
    fetch(`/api/competitors?projectId=${activeProjectId}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load competitors');
        return r.json();
      })
      .then(d => {
        setCompetitors(d.competitors || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load competitors');
        setLoading(false);
      });
  }, [activeProjectId]);

  useEffect(() => { loadCompetitors(); }, [loadCompetitors]);

  const categories = useMemo(() =>
    Array.from(new Set(competitors.map(c => c.category))).sort(),
  [competitors]);

  const filtered = useMemo(() => {
    let list = competitors;
    if (activeCategory) list = list.filter(c => c.category === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [competitors, activeCategory, search]);

  const watched = useMemo(() => filtered.filter(c => c.watched === 1), [filtered]);
  const unwatched = useMemo(() => filtered.filter(c => c.watched !== 1), [filtered]);

  const withUpdates = competitors.filter(c => hasRecentUpdate(c)).length;
  const withSwot = competitors.filter(c => hasSwot(c)).length;
  const watchedTotal = competitors.filter(c => c.watched === 1).length;

  async function handleToggleWatch(id: string, watch: boolean) {
    // Optimistic update
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, watched: watch ? 1 : 0 } : c));
    await fetch(`/api/competitors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watched: watch ? 1 : 0 }),
    });
  }

  async function handleEditSave(id: string, data: { name: string; url: string; description: string; category: string }) {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    setEditingComp(null);
    await fetch(`/api/competitors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    loadCompetitors();
  }

  async function handleDelete(comp: Competitor) {
    setCompetitors(prev => prev.filter(c => c.id !== comp.id));
    await fetch(`/api/competitors/${comp.id}`, { method: 'DELETE' });
    loadCompetitors();
  }

  async function handleAdd(name: string, url: string, description: string, category: string) {
    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, description, category, projectId: activeProjectId }),
    });
    loadCompetitors();
    setShowAddModal(false);
  }

  async function handleDiscover() {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      // Load project details from localStorage for context
      let projectName = 'this product';
      let projectDescription = '';
      try {
        const stored = JSON.parse(localStorage.getItem('mc-projects') || '[]');
        const proj = stored.find((p: any) => p.id === activeProjectId);
        if (proj) {
          projectName = proj.label || projectName;
          projectDescription = proj.description || '';
        }
      } catch { /* ignore */ }

      const res = await fetch('/api/competitors/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProjectId, projectName, projectDescription }),
      });
      const data = await res.json();
      if (data.error) {
        setDiscoverError(data.error + (data.details ? `: ${data.details}` : ''));
      } else if (data.discovered) {
        setDiscovered(data.discovered);
      }
    } catch (e: unknown) {
      setDiscoverError(e instanceof Error && e.message ? e.message : 'Failed to reach researcher agent');
    } finally {
      setDiscovering(false);
    }
  }

  async function handleAddDiscovered(d: Discovered) {
    await fetch('/api/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name, url: d.url, description: d.description, category: d.category, projectId: activeProjectId }),
    });
    loadCompetitors();
  }

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-tertiary)' }} />
      </div>
    );
  }

  if (error && competitors.length === 0) {
    return <ErrorState message={error} onRetry={loadCompetitors} />;
  }

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Competitor Intelligence</h1>
          <p>Monitoring {competitors.length} competitors across {categories.length} categories</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="btn-ghost"
            onClick={handleDiscover}
            disabled={discovering}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            }}
          >
            {discovering ? (
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Sparkles size={14} style={{ color: 'var(--system-purple)' }} />
            )}
            {discovering ? 'Researching...' : 'Discover New'}
          </button>
          <button
            className="btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {[
          { label: 'Total Tracked', value: competitors.length, icon: Globe, color: 'var(--accent)' },
          { label: 'Watching', value: watchedTotal, icon: Eye, color: 'var(--system-orange)' },
          { label: 'Categories', value: categories.length, icon: Activity, color: 'var(--system-blue)' },
          { label: 'Recently Updated', value: withUpdates, icon: Clock, color: 'var(--system-green)' },
          { label: 'SWOT Analyzed', value: withSwot, icon: Shield, color: 'var(--system-purple)' },
        ].map(s => {
          const SIcon = s.icon;
          return (
            <div key={s.label} style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--separator)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <SIcon size={16} style={{ color: s.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search + category filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-quaternary)' }} />
          <input
            className="apple-input"
            placeholder="Search competitors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '13px', height: '32px', width: '240px' }}
          />
        </div>
        <div className="page-filters">
          <button
            onClick={() => setActiveCategory(null)}
            className={!activeCategory ? 'page-filter-active' : 'page-filter'}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={activeCategory === cat ? 'page-filter-active' : 'page-filter'}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Error display */}
      {discoverError && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: '8px', border: '1px solid var(--system-red)', background: 'rgba(255,69,58,0.08)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span style={{ fontSize: '13px', color: 'var(--system-red)', flex: 1 }}>{discoverError}</span>
          <button onClick={() => setDiscoverError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--system-red)' }}><X size={14} /></button>
        </div>
      )}

      {/* ── WATCHING CLOSELY ────────────────────────────── */}
      {watched.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <Eye size={14} style={{ color: 'var(--system-orange)' }} />
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--system-orange)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Watching Closely
            </h3>
            <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-quaternary)', padding: '1px 6px', borderRadius: '4px', background: 'var(--fill-quaternary)' }}>
              {watched.length}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            {watched.map(comp => (
              <CompetitorCard key={comp.id} comp={comp} onToggleWatch={handleToggleWatch} onEdit={setEditingComp} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {/* ── ALL COMPETITORS ─────────────────────────────── */}
      {unwatched.length > 0 && (
        <div>
          {watched.length > 0 && (
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
              All Competitors
            </h3>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            {unwatched.map(comp => (
              <CompetitorCard key={comp.id} comp={comp} onToggleWatch={handleToggleWatch} onEdit={setEditingComp} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
          <Eye size={40} style={{ color: 'var(--text-quaternary)', marginBottom: '12px' }} />
          <div style={{ fontSize: 'var(--text-title3)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            {search || activeCategory ? 'No competitors match your filter' : 'No competitors tracked yet'}
          </div>
          <div style={{ fontSize: 'var(--text-subheadline)', color: 'var(--text-tertiary)', maxWidth: 360 }}>
            {search || activeCategory ? 'Try adjusting your search or category filter.' : 'Add competitors to track your competitive landscape.'}
          </div>
        </div>
      )}

      {showAddModal && <AddCompetitorModal onClose={() => setShowAddModal(false)} onAdd={handleAdd} />}
      {editingComp && <EditCompetitorModal comp={editingComp} onClose={() => setEditingComp(null)} onSave={handleEditSave} />}
      {discovered && <DiscoverModal results={discovered} onClose={() => setDiscovered(null)} onAdd={handleAddDiscovered} />}
    </div>
    </div>
  );
}
