'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Upload, Search, X, Tag, FileText, Trash2, Save, Edit3, Eye,
} from 'lucide-react';
import { ErrorState } from '@/components/ErrorState';
import LoadingSkeleton from '@/components/shared/LoadingSkeleton';
import { useDashboardStore } from '@/store/dashboard';
import RichTextEditor from '@/components/RichTextEditor';

interface RefFile {
  id: string;
  title: string;
  content: string;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

export default function ReferenceFilesPage() {
  const activeProjectId = useDashboardStore(s => s.activeProjectId) || 'default';
  const [files, setFiles] = useState<RefFile[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<RefFile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(() => {
    const params = new URLSearchParams();
    if (activeTag) params.set('tag', activeTag);
    if (search) params.set('search', search);
    params.set('projectId', activeProjectId);
    setError(null);
    setLoading(true);
    fetch(`/api/reference-files?${params}`)
      .then(r => r.json())
      .then(d => setFiles(d.files || []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load reference files.'))
      .finally(() => setLoading(false));
  }, [activeTag, search, activeProjectId]);

  const loadTags = useCallback(() => {
    fetch(`/api/reference-files?tags=1&projectId=${activeProjectId}`).then(r => r.json()).then(d => setAllTags(d.tags || [])).catch(() => {});
  }, [activeProjectId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);
  useEffect(() => { loadTags(); }, [loadTags]);

  function parseTags(file: RefFile): string[] {
    try { return JSON.parse(file.tags_json || '[]'); }
    catch { return []; }
  }

  function startCreate() {
    setCreating(true);
    setEditing(true);
    setSelected(null);
    setEditTitle('');
    setEditContent('');
    setEditTags('');
  }

  function startEdit(file: RefFile) {
    setSelected(file);
    setEditing(true);
    setCreating(false);
    setEditTitle(file.title);
    setEditContent(file.content);
    setEditTags(parseTags(file).join(', '));
  }

  async function handleSave() {
    const tags = editTags.split(',').map(t => t.trim()).filter(Boolean);
    if (creating) {
      await fetch('/api/reference-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent, tags, projectId: activeProjectId }),
      });
    } else if (selected) {
      await fetch(`/api/reference-files/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent, tags, projectId: activeProjectId }),
      });
    }
    setEditing(false);
    setCreating(false);
    loadFiles();
    loadTags();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/reference-files/${id}?projectId=${activeProjectId}`, { method: 'DELETE' });
    if (selected?.id === id) { setSelected(null); setEditing(false); }
    loadFiles();
    loadTags();
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const title = file.name.replace(/\.(md|html|txt)$/, '');
    // Wrap plain text / markdown in paragraphs so it renders in the rich editor
    const content = file.name.endsWith('.html')
      ? text
      : text.split('\n').map(line => `<p>${line || '<br>'}</p>`).join('');
    await fetch('/api/reference-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, tags: [], projectId: activeProjectId }),
    });
    loadFiles();
    loadTags();
    e.target.value = '';
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => loadFiles()}
      />
    );
  }

  if (loading && files.length === 0) {
    return (
      <div className="flex h-full flex-col gap-4 p-6">
        <div className="flex items-center gap-4">
          <LoadingSkeleton variant="text" className="h-8 w-48" />
          <LoadingSkeleton variant="text" className="h-8 w-24" />
        </div>
        <div className="flex flex-1 gap-4">
          <div className="w-[280px] space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} variant="card" className="h-14 w-full" />
            ))}
          </div>
          <div className="flex-1">
            <LoadingSkeleton variant="card" className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 48px)' }}>
      {/* Page header */}
      <div className="page-header">
        <h1>Reference Files</h1>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={startCreate}
            className="btn-ghost"
            title="New file"
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
          >
            <Plus size={14} />
          </button>
          <label
            className="btn-ghost"
            title="Upload .md"
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', cursor: 'pointer' }}
          >
            <Upload size={14} />
            <input type="file" accept=".md,.html,.txt" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Sidebar - file list */}
      <div
        style={{
          width: '280px',
          flexShrink: 0,
          borderRight: '1px solid var(--separator)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
        }}
      >
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--separator)' }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-quaternary)' }} />
            <input
              className="apple-input"
              placeholder="Search files..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '28px', fontSize: '12px', height: '30px' }}
            />
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="page-filters" style={{ padding: '8px var(--space-4)', borderBottom: '1px solid var(--separator)' }}>
            {activeTag && (
              <button
                onClick={() => setActiveTag(null)}
                className="page-filter"
                style={{ background: 'var(--system-red)', color: '#fff', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <X size={8} /> Clear
              </button>
            )}
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={activeTag === tag ? 'page-filter-active' : 'page-filter'}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2)' }}>
          {files.map(file => {
            const isActive = selected?.id === file.id && !creating;
            const tags = parseTags(file);
            return (
              <button
                key={file.id}
                onClick={() => { setSelected(file); setEditing(false); setCreating(false); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  background: isActive ? 'var(--accent-fill)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 100ms ease-out',
                  marginBottom: '2px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--accent)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-quaternary)' }}>
                    {new Date(file.updated_at).toLocaleDateString()}
                  </span>
                  {tags.map(t => (
                    <span key={t} style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'var(--fill-quaternary)', color: 'var(--text-quaternary)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
          {files.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
              <FileText size={40} style={{ color: 'var(--text-quaternary)', marginBottom: '12px' }} />
              <div style={{ fontSize: 'var(--text-title3)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>No reference files yet</div>
              <div style={{ fontSize: 'var(--text-subheadline)', color: 'var(--text-tertiary)', maxWidth: 360 }}>Create reference documents to store knowledge for your team.</div>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {editing ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--space-4)' }}>
            {/* Edit header */}
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
              <input
                className="apple-input"
                placeholder="Document title..."
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                style={{ flex: 1, fontSize: '16px', fontWeight: 600, height: '38px' }}
              />
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={!editTitle.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, flexShrink: 0 }}
              >
                <Save size={14} /> Save
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setEditing(false); setCreating(false); }}
                style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '13px' }}
              >
                Cancel
              </button>
            </div>
            {/* Tags input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <Tag size={14} style={{ color: 'var(--text-quaternary)', flexShrink: 0 }} />
              <input
                className="apple-input"
                placeholder="Tags (comma separated)..."
                value={editTags}
                onChange={e => setEditTags(e.target.value)}
                style={{ flex: 1, fontSize: '12px', height: '30px' }}
              />
            </div>
            {/* Rich Text Editor */}
            <RichTextEditor
              content={editContent}
              onChange={setEditContent}
              placeholder="Start writing your document..."
            />
          </div>
        ) : selected ? (
          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-6)' }}>
            {/* View header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                {selected.title}
              </h1>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => startEdit(selected)}
                  className="btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px' }}
                >
                  <Edit3 size={12} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: 'var(--system-red)' }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
            {/* Tags */}
            {parseTags(selected).length > 0 && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--space-4)' }}>
                {parseTags(selected).map(t => (
                  <span key={t} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'var(--fill-quaternary)', color: 'var(--text-tertiary)' }}>
                    {t}
                  </span>
                ))}
              </div>
            )}
            {/* Content */}
            <div
              className="tiptap-view"
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.8,
              }}
              dangerouslySetInnerHTML={{ __html: selected.content || '<p style="color: var(--text-quaternary)">Empty document.</p>' }}
            />
            <style>{`
              .tiptap-view h1 { font-size: 24px; font-weight: 700; margin: 16px 0 8px; color: var(--text-primary); letter-spacing: -0.3px; }
              .tiptap-view h2 { font-size: 20px; font-weight: 600; margin: 14px 0 6px; color: var(--text-primary); letter-spacing: -0.2px; }
              .tiptap-view h3 { font-size: 16px; font-weight: 600; margin: 12px 0 4px; color: var(--text-primary); }
              .tiptap-view p { margin: 4px 0; }
              .tiptap-view ul, .tiptap-view ol { padding-left: 24px; margin: 4px 0; }
              .tiptap-view li { margin: 2px 0; }
              .tiptap-view blockquote { border-left: 3px solid var(--accent); padding-left: 12px; margin: 8px 0; color: var(--text-secondary); font-style: italic; }
              .tiptap-view code { background: var(--fill-quaternary); padding: 2px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.9em; color: var(--accent); }
              .tiptap-view pre { background: var(--fill-quaternary); padding: 12px 16px; border-radius: 6px; margin: 8px 0; overflow-x: auto; }
              .tiptap-view pre code { background: none; padding: 0; border-radius: 0; color: var(--text-primary); }
              .tiptap-view a { color: var(--accent); text-decoration: underline; }
              .tiptap-view img { max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0; }
              .tiptap-view hr { border: none; border-top: 1px solid var(--separator); margin: 16px 0; }
              .tiptap-view table { border-collapse: collapse; width: 100%; margin: 12px 0; }
              .tiptap-view th, .tiptap-view td { border: 1px solid var(--separator); padding: 8px 12px; text-align: left; font-size: 13px; }
              .tiptap-view th { background: var(--fill-quaternary); font-weight: 600; color: var(--text-primary); }
              .tiptap-view td { color: var(--text-secondary); }
            `}</style>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <FileText size={40} style={{ color: 'var(--text-quaternary)' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-quaternary)' }}>
              Select a file or create a new one
            </p>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
