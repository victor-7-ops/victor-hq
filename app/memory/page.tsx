"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Agent,
  MemoryFileInfo,
  MemoryConfig,
  MemoryStatus,
  MemoryStats,
  MemoryApiResponse,
  MemoryFileCategory,
  MemoryHealthSummary,
  MemoryHealthCheck,
  HealthSeverity,
  ReindexStatus,
  EditingHint,
} from "@/lib/types";
import { RefreshCw, BarChart3, FolderOpen, BookOpen } from "lucide-react";
import { renderMarkdown, colorizeJson } from "@/lib/sanitize";
import { generateId } from "@/lib/id";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { computeEditingHints } from "@/lib/memory-hints";
import {
  buildMemoryHealthPrompt,
  buildCheckFixPrompt,
} from "@/lib/memory-health-prompt";
import { formatBytes, wordCount, isJsonFile } from "./components/helpers";
import { GuideTab } from "./components/GuideTab";
import { OverviewTab } from "./components/OverviewTab";
import { BrowserTab } from "./components/BrowserTab";
import { fetchAgents } from "@/lib/api/agents-client";

/* ─── Types ──────────────────────────────────────────────────── */

type Tab = "overview" | "browser" | "guide";
type SortKey = "date" | "name" | "size";

interface HealthChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const TABS: { key: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { key: "overview", label: "Overview", Icon: BarChart3 },
  { key: "browser", label: "Browser", Icon: FolderOpen },
  { key: "guide", label: "Guide", Icon: BookOpen },
];

/* ─── Main Component ─────────────────────────────────────────── */

export default function MemoryPage() {
  const [files, setFiles] = useState<MemoryFileInfo[]>([]);
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [selected, setSelected] = useState<MemoryFileInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [copied, setCopied] = useState(false);
  const [mobileShowContent, setMobileShowContent] = useState(false);

  // Health & hints state
  const [health, setHealth] = useState<MemoryHealthSummary | null>(null);
  const [reindexStatus, setReindexStatus] = useState<ReindexStatus>("idle");
  const [editingHints, setEditingHints] = useState<EditingHint[]>([]);
  const [showReindex, setShowReindex] = useState(false);

  // Editing state
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<MemoryFileInfo | null>(null);

  // mem0 state
  const [mem0Data, setMem0Data] = useState<{ enabled: boolean; userId: string | null; memories: { id: string; memory: string; created_at: string; updated_at: string; categories: string[] }[]; count: number } | null>(null);

  // AI Memory Advisor state
  const [agents, setAgents] = useState<Agent[]>([]);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisStreaming, setAnalysisStreaming] = useState(false);
  const [analysisContent, setAnalysisContent] = useState("");
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatMessages, setChatMessages] = useState<HealthChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  const isEditing = editingContent !== null;
  const isDirty = editingContent !== null && editingContent !== selected?.content;

  const rootAgent = useMemo(
    () => agents.find((a) => a.reportsTo === null) || agents[0] || null,
    [agents],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/memory")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load memory files");
        return r.json();
      })
      .then((data: MemoryApiResponse | MemoryFileInfo[]) => {
        // Backward compat: handle old array response or new object response
        if (Array.isArray(data)) {
          const mapped: MemoryFileInfo[] = data.map((f) => ({
            ...f,
            relativePath: f.path.split("/").slice(-2).join("/"),
            sizeBytes: new Blob([f.content]).size,
            category: "evergreen" as const,
          }));
          setFiles(mapped);
          setConfig(null);
          setStatus(null);
          setStats(null);
          setHealth(null);
        } else {
          setFiles(data.files);
          setConfig(data.config);
          setStatus(data.status);
          setStats(data.stats);
          setHealth(data.health);
          if ('mem0' in data && (data as unknown as { mem0: unknown }).mem0) {
            setMem0Data((data as unknown as { mem0: typeof mem0Data }).mem0);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Fetch agents for AI advisor
  useEffect(() => {
    fetchAgents()
      .then(setAgents)
      .catch(() => {});
  }, []);

  // Auto-select first file when switching to browser tab with no selection
  useEffect(() => {
    if (tab === "browser" && !selected && files.length > 0) {
      setSelected(files[0]);
    }
  }, [tab, selected, files]);

  /* Debounced editing hints */
  useEffect(() => {
    if (!isEditing || !selected || editingContent === null) {
      setEditingHints([]);
      return;
    }

    const timer = setTimeout(() => {
      setEditingHints(computeEditingHints(selected, editingContent, config));
    }, 500);

    return () => clearTimeout(timer);
  }, [editingContent, selected, config, isEditing]);

  /* Reset showReindex on file switch or entering edit mode */
  useEffect(() => {
    setShowReindex(false);
  }, [selected, isEditing]);

  /* Reindex handler */
  async function handleReindex() {
    setReindexStatus("running");
    try {
      const res = await fetch("/api/memory/reindex", { method: "POST" });
      const data = await res.json();
      if (res.status === 503) {
        setReindexStatus("unavailable");
      } else if (data.status === "success") {
        setReindexStatus("success");
        // Refresh data to pick up new index status
        setTimeout(() => refresh(), 1000);
      } else {
        setReindexStatus("failed");
      }
    } catch {
      setReindexStatus("failed");
    }
  }

  /* ─── AI Memory Advisor callbacks ─────────────────────────── */

  const runAnalysis = useCallback(async () => {
    if (!rootAgent || analysisStreaming || !config || !status || !stats || !health) return;
    setAnalysisOpen(true);
    setAnalysisStreaming(true);
    setAnalysisContent("");
    setChatMessages([]);

    const prompt = buildMemoryHealthPrompt(files, config, status, stats, health);

    try {
      const res = await fetch(`/api/chat/${rootAgent.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const chunk = JSON.parse(line.slice(6));
              if (chunk.content) {
                fullContent += chunk.content;
                setAnalysisContent(fullContent);
              }
            } catch {
              /* skip */
            }
          }
        }
      }
    } catch {
      setAnalysisContent(
        (prev) => prev + "\n\n[Error: Failed to connect to agent]",
      );
    } finally {
      setAnalysisStreaming(false);
    }
  }, [rootAgent, analysisStreaming, files, config, status, stats, health]);

  const sendChatMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? chatInput).trim();
      if (!text || chatStreaming || !rootAgent || !config || !status || !stats || !health) return;
      if (!overrideText) setChatInput("");

      const userMsg: HealthChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
      };
      const assistantMsgId = generateId();
      const assistantMsg: HealthChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
      setChatStreaming(true);

      const prompt = buildMemoryHealthPrompt(files, config, status, stats, health);
      const allMessages = [...chatMessages, userMsg];
      const apiMessages = [
        { role: "user" as const, content: prompt },
        ...(analysisContent
          ? [{ role: "assistant" as const, content: analysisContent }]
          : []),
        ...allMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      try {
        const res = await fetch(`/api/chat/${rootAgent.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });
        if (!res.ok || !res.body) throw new Error("Stream failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const chunk = JSON.parse(line.slice(6));
                if (chunk.content) {
                  fullContent += chunk.content;
                  const captured = fullContent;
                  setChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId
                        ? { ...m, content: captured, isStreaming: true }
                        : m,
                    ),
                  );
                }
              } catch {
                /* skip */
              }
            }
          }
        }

        const finalContent = fullContent;
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: finalContent, isStreaming: false }
              : m,
          ),
        );
      } catch {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: "Error getting response. Check API connection.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      } finally {
        setChatStreaming(false);
        chatTextareaRef.current?.focus();
      }
    },
    [chatInput, chatStreaming, rootAgent, chatMessages, analysisContent, files, config, status, stats, health],
  );

  const handleCheckAction = useCallback(
    (check: MemoryHealthCheck) => {
      if (!analysisOpen) setAnalysisOpen(true);
      const prompt = buildCheckFixPrompt(check, files);
      if (!analysisContent && !analysisStreaming) {
        runAnalysis();
        return;
      }
      sendChatMessage(prompt);
    },
    [analysisOpen, analysisContent, analysisStreaming, runAnalysis, sendChatMessage, files],
  );

  const handleViewFile = useCallback(
    (relativePath: string) => {
      const file = files.find((f) => f.relativePath === relativePath);
      if (file) {
        setSelected(file);
        setTab("browser");
      }
    },
    [files],
  );

  /* Content match count for search badges */
  function contentMatchCount(content: string, query: string): number {
    if (!query) return 0;
    const q = query.toLowerCase();
    const text = content.toLowerCase();
    let count = 0;
    let idx = 0;
    while ((idx = text.indexOf(q, idx)) !== -1) {
      count++;
      idx += q.length;
    }
    return count;
  }

  /* Sorted + filtered files */
  const q = search.toLowerCase();
  const sortedFiles = [...files]
    .filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.relativePath.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q)
    )
    .sort((a, b) => {
      if (sort === "name") return a.label.localeCompare(b.label);
      if (sort === "size") return b.sizeBytes - a.sizeBytes;
      // date: most recent first
      return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
    });

  /* Keyboard navigation in file list */
  function handleListKeyDown(e: React.KeyboardEvent) {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]'
    );
    if (!items || items.length === 0) return;

    const currentIdx = Array.from(items).findIndex(
      (el) => el.getAttribute("aria-selected") === "true"
    );

    let nextIdx = currentIdx;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      nextIdx = Math.min(currentIdx + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      nextIdx = Math.max(currentIdx - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentIdx >= 0) {
        items[currentIdx].click();
        setMobileShowContent(true);
      }
      return;
    } else if (e.key === "Escape") {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }

    if (nextIdx !== currentIdx && nextIdx >= 0) {
      items[nextIdx].click();
      items[nextIdx].focus();
    }
  }

  /* Copy content */
  function copyContent() {
    if (!selected) return;
    navigator.clipboard.writeText(selected.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  /* Download content */
  function downloadContent() {
    if (!selected) return;
    const blob = new Blob([selected.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selected.path.split("/").pop() || "file.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* Select file and show content on mobile */
  function selectFile(file: MemoryFileInfo) {
    if (isDirty) {
      setPendingFile(file);
      return;
    }
    setEditingContent(null);
    setSaveError(null);
    setSelected(file);
    setMobileShowContent(true);
  }

  /* Discard edits and switch to pending file */
  function discardAndSwitch() {
    const file = pendingFile;
    setEditingContent(null);
    setSaveError(null);
    setPendingFile(null);
    if (file) {
      setSelected(file);
      setMobileShowContent(true);
    }
  }

  /* Enter edit mode */
  function startEditing() {
    if (!selected) return;
    setEditingContent(selected.content);
    setSaveError(null);
  }

  /* Cancel editing */
  function cancelEditing() {
    setEditingContent(null);
    setSaveError(null);
  }

  /* Save edited content */
  async function saveContent() {
    if (!selected || editingContent === null) return;

    // JSON validation for .json files
    if (isJsonFile(selected)) {
      try {
        JSON.parse(editingContent);
      } catch {
        setSaveError("Invalid JSON syntax");
        return;
      }
    }

    setSaving(true);
    setSaveError(null);

    try {
      const res = await fetch("/api/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          relativePath: selected.relativePath,
          content: editingContent,
          expectedLastModified: selected.lastModified,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }));
        setSaveError(data.error || `Save failed (${res.status})`);
        return;
      }

      const data = await res.json();

      // Update local state with new content/metadata
      const updated: MemoryFileInfo = {
        ...selected,
        content: editingContent,
        lastModified: data.lastModified,
        sizeBytes: data.sizeBytes,
      };
      setFiles((prev) =>
        prev.map((f) => (f.path === selected.path ? updated : f))
      );
      setSelected(updated);
      setEditingContent(null);
      // Show reindex button if vector search is enabled
      if (config?.memorySearch.enabled) {
        setShowReindex(true);
        setReindexStatus("idle");
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  /* When editing ends and there's a pending file, switch to it */
  useEffect(() => {
    if (!isEditing && pendingFile) {
      setSelected(pendingFile);
      setMobileShowContent(true);
      setPendingFile(null);
    }
  }, [isEditing, pendingFile]);

  /* Computed for selected file */
  const isJson = selected ? isJsonFile(selected) : false;
  const lineCount = selected ? selected.content.split("\n").length : 0;
  const words = selected ? wordCount(selected.content) : 0;
  const breadcrumb = selected?.relativePath.split("/") ?? [];

  /* Scroll to first match when opening a file from search */
  useEffect(() => {
    if (search && selected && contentRef.current) {
      const mark = contentRef.current.querySelector("mark");
      if (mark) {
        setTimeout(() => mark.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
      }
    }
  }, [selected, search]);

  /* Error state */
  if (error && files.length === 0) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  /* ─── Search highlighting helper ─────────────────────────── */
  function highlightMatches(html: string, query: string): string {
    if (!query) return html;
    // Escape special regex characters in query
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    // Only highlight text outside of HTML tags
    return html.replace(/(<[^>]*>)|([^<]+)/g, (_, tag, text) => {
      if (tag) return tag;
      return text.replace(
        re,
        '<mark style="background:var(--accent);opacity:0.25;color:inherit;border-radius:2px;padding:0 1px">$1</mark>'
      );
    });
  }

  /* ─── Rendered content (for browser tab) ─────────────────── */
  let renderedContent: React.ReactNode = null;
  if (selected) {
    if (isJson) {
      try {
        const pretty = JSON.stringify(JSON.parse(selected.content), null, 2);
        const lines = pretty.split("\n");
        const colorized = colorizeJson(pretty);
        const highlighted = search ? highlightMatches(colorized, search) : colorized;
        renderedContent = (
          <div
            style={{
              background: "var(--code-bg)",
              border: "1px solid var(--code-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
              overflow: "auto",
            }}
          >
            <div className="flex">
              <div
                className="flex-shrink-0 select-none"
                style={{
                  paddingRight: "var(--space-4)",
                  marginRight: "var(--space-4)",
                  borderRight: "1px solid var(--separator)",
                }}
              >
                {lines.map((_, i) => (
                  <div
                    key={i}
                    className="font-mono text-right"
                    style={{
                      fontSize: "var(--text-caption2)",
                      lineHeight: "var(--leading-relaxed)",
                      color: "var(--text-tertiary)",
                      minWidth: "2.5ch",
                    }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <pre
                className="font-mono flex-1"
                style={{
                  fontSize: "var(--text-footnote)",
                  lineHeight: "var(--leading-relaxed)",
                  color: "var(--code-text)",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
                dangerouslySetInnerHTML={{
                  __html: highlighted,
                }}
              />
            </div>
          </div>
        );
      } catch {
        renderedContent = (
          <div
            style={{
              background: "var(--code-bg)",
              border: "1px solid var(--code-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
            }}
          >
            <pre
              className="font-mono"
              style={{
                fontSize: "var(--text-footnote)",
                color: "var(--system-red)",
                whiteSpace: "pre-wrap",
                margin: 0,
              }}
            >
              {selected.content}
            </pre>
          </div>
        );
      }
    } else {
      const md = renderMarkdown(selected.content);
      const highlighted = search ? highlightMatches(md, search) : md;
      renderedContent = (
        <div
          style={{
            fontSize: "var(--text-subheadline)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--text-secondary)",
          }}
          dangerouslySetInnerHTML={{
            __html: `<p class="mb-3" style="color:var(--text-secondary)">${highlighted}</p>`,
          }}
        />
      );
    }
  }

  return (
    <div
      className="h-full flex flex-col animate-fade-in"
      style={{ background: "var(--bg)" }}
    >
      {/* ── Sticky header ──────────────────────────────────────── */}
      <div className="page-header">
        <div style={{ flex: 1 }}>
          <h1>Memory</h1>
          {!loading && stats && (
            <p>
              {stats.totalFiles} file{stats.totalFiles !== 1 ? "s" : ""}
              {" \u00b7 "}
              {formatBytes(stats.totalSizeBytes)}
              {stats.dailyLogCount > 0 && (
                <>
                  {" \u00b7 "}
                  {stats.dailyLogCount} daily log{stats.dailyLogCount !== 1 ? "s" : ""}
                </>
              )}
            </p>
          )}
        </div>
        <button
          onClick={refresh}
          className="focus-ring"
          aria-label="Refresh memory data"
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "transparent",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            transition: "color 150ms var(--ease-smooth)",
          }}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* ── Tab navigation ─────────────────────────────────── */}
      <div className="page-tabs">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`page-tab ${isActive ? "page-tab-active" : ""}`}
            >
              <t.Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Scrollable content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div
            style={{
              padding: "var(--space-4) var(--space-6) var(--space-6)",
              overflow: "auto",
              height: "100%",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "var(--space-3)",
                marginBottom: "var(--space-4)",
              }}
              className="overview-cards-grid"
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    background: "var(--material-regular)",
                    border: "1px solid var(--separator)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-4)",
                  }}
                >
                  <Skeleton style={{ width: 60, height: 10, marginBottom: 8 }} />
                  <Skeleton style={{ width: 80, height: 18 }} />
                </div>
              ))}
            </div>
            <div
              style={{
                background: "var(--material-regular)",
                border: "1px solid var(--separator)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
              }}
            >
              <Skeleton style={{ width: 160, height: 10, marginBottom: 16 }} />
              <Skeleton style={{ width: "100%", height: 80 }} />
            </div>
          </div>
        ) : (
          <>
            {/* ─── OVERVIEW TAB ─────────────────────────────── */}
            {tab === "overview" && (
              <OverviewTab
                mem0Data={mem0Data}
                health={health}
                stats={stats}
                status={status}
                config={config}
                rootAgent={rootAgent}
                analysisOpen={analysisOpen}
                analysisStreaming={analysisStreaming}
                analysisContent={analysisContent}
                chatMessages={chatMessages}
                chatInput={chatInput}
                chatStreaming={chatStreaming}
                chatTextareaRef={chatTextareaRef}
                setAnalysisOpen={setAnalysisOpen}
                setChatInput={setChatInput}
                runAnalysis={runAnalysis}
                sendChatMessage={sendChatMessage}
                handleCheckAction={handleCheckAction}
                handleViewFile={handleViewFile}
                handleReindex={handleReindex}
              />
            )}

            {/* ─── BROWSER TAB ──────────────────────────────── */}
            {tab === "browser" && (
              <BrowserTab
                mobileShowContent={mobileShowContent}
                setMobileShowContent={setMobileShowContent}
                selected={selected}
                search={search}
                setSearch={setSearch}
                searchRef={searchRef}
                sort={sort}
                setSort={setSort}
                listRef={listRef}
                handleListKeyDown={handleListKeyDown}
                sortedFiles={sortedFiles}
                contentMatchCount={contentMatchCount}
                q={q}
                selectFile={selectFile}
                health={health}
                breadcrumb={breadcrumb}
                isDirty={isDirty}
                lineCount={lineCount}
                isJson={isJson}
                words={words}
                isEditing={isEditing}
                cancelEditing={cancelEditing}
                saveContent={saveContent}
                saving={saving}
                copyContent={copyContent}
                copied={copied}
                downloadContent={downloadContent}
                startEditing={startEditing}
                showReindex={showReindex}
                reindexStatus={reindexStatus}
                handleReindex={handleReindex}
                pendingFile={pendingFile}
                discardAndSwitch={discardAndSwitch}
                contentRef={contentRef}
                editingContent={editingContent}
                setEditingContent={setEditingContent}
                saveError={saveError}
                editingHints={editingHints}
                renderedContent={renderedContent}
              />
            )}

            {/* ─── GUIDE TAB ────────────────────────────────── */}
            {tab === "guide" && <GuideTab config={config} />}
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .overview-cards-grid {
            grid-template-columns: 1fr !important;
          }
          .guide-config-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @media (min-width: 641px) and (max-width: 1023px) {
          .overview-cards-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
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
      `}</style>
    </div>
  );
}
