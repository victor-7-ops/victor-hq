"use client";

import type { ReactNode, RefObject, KeyboardEvent as ReactKeyboardEvent } from "react";
import { Copy, Check, Download, Pencil, Save, X } from "lucide-react";
import type { MemoryFileInfo, MemoryHealthSummary, EditingHint, ReindexStatus } from "@/lib/types";

export type SortKey = "date" | "name" | "size";
import { fileHealthSeverity } from "@/lib/memory-health";
import { timeAgo } from "@/lib/cron-utils";
import { formatBytes, isJsonFile, FileIcon, FolderIcon, BackArrow } from "./helpers";
import { CategoryBadge, HealthBadge, ReindexButton, EditingHintsPanel } from "./browser-panels";

export interface BrowserTabProps {
  mobileShowContent: boolean;
  setMobileShowContent: (show: boolean) => void;
  selected: MemoryFileInfo | null;
  search: string;
  setSearch: (value: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  sort: SortKey;
  setSort: (sort: SortKey) => void;
  listRef: RefObject<HTMLDivElement | null>;
  handleListKeyDown: (e: ReactKeyboardEvent) => void;
  sortedFiles: MemoryFileInfo[];
  contentMatchCount: (content: string, query: string) => number;
  q: string;
  selectFile: (file: MemoryFileInfo) => void;
  health: MemoryHealthSummary | null;
  breadcrumb: string[];
  isDirty: boolean;
  lineCount: number;
  isJson: boolean;
  words: number;
  isEditing: boolean;
  cancelEditing: () => void;
  saveContent: () => void;
  saving: boolean;
  copyContent: () => void;
  copied: boolean;
  downloadContent: () => void;
  startEditing: () => void;
  showReindex: boolean;
  reindexStatus: ReindexStatus;
  handleReindex: () => void;
  pendingFile: MemoryFileInfo | null;
  discardAndSwitch: () => void;
  contentRef: RefObject<HTMLDivElement | null>;
  editingContent: string | null;
  setEditingContent: (value: string) => void;
  saveError: string | null;
  editingHints: EditingHint[];
  renderedContent: ReactNode;
}

export function BrowserTab({
  mobileShowContent,
  setMobileShowContent,
  selected,
  search,
  setSearch,
  searchRef,
  sort,
  setSort,
  listRef,
  handleListKeyDown,
  sortedFiles,
  contentMatchCount,
  q,
  selectFile,
  health,
  breadcrumb,
  isDirty,
  lineCount,
  isJson,
  words,
  isEditing,
  cancelEditing,
  saveContent,
  saving,
  copyContent,
  copied,
  downloadContent,
  startEditing,
  showReindex,
  reindexStatus,
  handleReindex,
  pendingFile,
  discardAndSwitch,
  contentRef,
  editingContent,
  setEditingContent,
  saveError,
  editingHints,
  renderedContent,
}: BrowserTabProps) {
  return (
    <div className="flex h-full" style={{ background: "var(--bg)" }}>
      {/* File list sidebar */}
      <aside
        className={`browser-sidebar flex-shrink-0 flex flex-col ${
          mobileShowContent && selected ? "hidden md:flex" : "flex"
        }`}
        style={{
          width: "100%",
          background: "var(--material-regular)",
          backdropFilter: "var(--sidebar-backdrop)",
          WebkitBackdropFilter: "var(--sidebar-backdrop)",
          borderRight: "1px solid var(--separator)",
        }}
      >
        <style>{`@media (min-width: 768px) { .browser-sidebar { width: 280px !important; min-width: 280px !important; } }`}</style>

        {/* Search + sort */}
        <div
          className="browser-sidebar"
          style={{
            padding: "var(--space-2) var(--space-3)",
            borderBottom: "1px solid var(--separator)",
          }}
        >
          <input
            ref={searchRef}
            type="search"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="apple-input focus-ring"
            aria-label="Search memory files"
            style={{
              width: "100%",
              height: 32,
              fontSize: "var(--text-footnote)",
              padding: "0 var(--space-3)",
              borderRadius: "var(--radius-sm)",
              marginBottom: "var(--space-2)",
            }}
          />
          <div className="flex items-center" style={{ gap: "var(--space-1)" }}>
            {(["date", "name", "size"] as SortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className="focus-ring"
                style={{
                  padding: "2px 8px",
                  fontSize: "var(--text-caption2)",
                  fontWeight:
                    sort === s
                      ? "var(--weight-semibold)"
                      : "var(--weight-medium)",
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  background:
                    sort === s
                      ? "var(--accent-fill)"
                      : "var(--fill-secondary)",
                  color:
                    sort === s
                      ? "var(--accent)"
                      : "var(--text-tertiary)",
                  textTransform: "capitalize",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* File list */}
        <div
          ref={listRef}
          role="listbox"
          aria-label="Memory files"
          onKeyDown={handleListKeyDown}
          className="flex-1 overflow-y-auto browser-sidebar"
        >
          {sortedFiles.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{
                height: 120,
                fontSize: "var(--text-footnote)",
                color: "var(--text-tertiary)",
              }}
            >
              No files match
            </div>
          ) : (
            sortedFiles.map((file) => {
              const isActive = selected?.path === file.path;
              const json = isJsonFile(file);
              const matches = search ? contentMatchCount(file.content, search) : 0;
              const nameMatch = search
                ? file.label.toLowerCase().includes(q) || file.relativePath.toLowerCase().includes(q)
                : true;
              return (
                <button
                  key={file.path}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => selectFile(file)}
                  className="w-full text-left hover-bg focus-ring"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-2)",
                    padding: "var(--space-3) var(--space-3)",
                    border: "none",
                    cursor: "pointer",
                    background: isActive
                      ? "var(--fill-secondary)"
                      : "transparent",
                    borderLeft: isActive
                      ? "3px solid var(--accent)"
                      : "3px solid transparent",
                  }}
                >
                  <FileIcon isJson={json} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                      <span
                        className="truncate"
                        style={{
                          fontSize: "var(--text-footnote)",
                          fontWeight: "var(--weight-semibold)",
                          color: "var(--text-primary)",
                          lineHeight: "var(--leading-snug)",
                        }}
                      >
                        {file.label}
                      </span>
                      <CategoryBadge category={file.category} />
                      {health && (
                        <HealthBadge
                          severity={fileHealthSeverity(file, health.checks)}
                        />
                      )}
                    </div>
                    <div
                      className="flex items-center justify-between"
                      style={{ marginTop: 2 }}
                    >
                      <span
                        style={{
                          fontSize: "var(--text-caption2)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {formatBytes(file.sizeBytes)} {"·"}{" "}
                        {timeAgo(file.lastModified)}
                      </span>
                      {search && matches > 0 && !nameMatch && (
                        <span
                          style={{
                            fontSize: "var(--text-caption2)",
                            color: "var(--text-tertiary)",
                            flexShrink: 0,
                            marginLeft: "var(--space-2)",
                          }}
                        >
                          {matches} match{matches !== 1 ? "es" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Content view */}
      <main
        className={`flex-1 flex flex-col overflow-y-auto ${
          !mobileShowContent || !selected ? "hidden md:flex" : "flex"
        }`}
        style={{ background: "var(--bg)" }}
      >
        {selected ? (
          <>
            {/* Content header */}
            <div
              className="flex-shrink-0"
              style={{
                padding: "var(--space-3) var(--space-6)",
                borderBottom: "1px solid var(--separator)",
                background: "var(--material-regular)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {/* Mobile back button */}
              <button
                onClick={() => setMobileShowContent(false)}
                className="md:hidden btn-ghost focus-ring"
                aria-label="Back to file list"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-1)",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "var(--text-footnote)",
                  color: "var(--system-blue)",
                  marginBottom: "var(--space-2)",
                  marginLeft: "-8px",
                }}
              >
                <BackArrow />
                Files
              </button>

              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  {/* Breadcrumb + category */}
                  <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                    <span
                      className="truncate"
                      style={{
                        fontSize: "var(--text-footnote)",
                        fontWeight: "var(--weight-semibold)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {breadcrumb.map((part, i) => (
                        <span key={i}>
                          {i > 0 && (
                            <span
                              style={{
                                color: "var(--text-tertiary)",
                                margin: "0 4px",
                              }}
                            >
                              /
                            </span>
                          )}
                          <span
                            style={{
                              color:
                                i === breadcrumb.length - 1
                                  ? "var(--text-primary)"
                                  : "var(--text-tertiary)",
                            }}
                          >
                            {part}
                          </span>
                        </span>
                      ))}
                    </span>
                    <CategoryBadge category={selected.category} />
                    {isDirty && (
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--system-orange)",
                          flexShrink: 0,
                        }}
                        title="Unsaved changes"
                      />
                    )}
                  </div>

                  {/* Metadata */}
                  <div
                    style={{
                      fontSize: "var(--text-caption2)",
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    {lineCount} line{lineCount !== 1 ? "s" : ""}
                    {!isJson && (
                      <>
                        {" "}
                        {"·"} {words.toLocaleString()} words
                      </>
                    )}
                    {" · "}
                    {formatBytes(selected.sizeBytes)}
                    {" · "}
                    {timeAgo(selected.lastModified)}
                  </div>
                </div>

                {/* Action buttons */}
                <div
                  className="flex items-center flex-shrink-0"
                  style={{ gap: "var(--space-2)" }}
                >
                  {isEditing ? (
                    <>
                      <button
                        onClick={cancelEditing}
                        className="btn-ghost focus-ring"
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--text-caption1)",
                          fontWeight: "var(--weight-medium)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <X size={14} />
                        Cancel
                      </button>
                      <button
                        onClick={saveContent}
                        disabled={saving || !isDirty}
                        className="focus-ring"
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--text-caption1)",
                          fontWeight: "var(--weight-medium)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          background: "var(--accent)",
                          color: "white",
                          border: "none",
                          cursor: saving || !isDirty ? "not-allowed" : "pointer",
                          opacity: saving || !isDirty ? 0.5 : 1,
                        }}
                      >
                        <Save size={14} />
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={copyContent}
                        className="btn-ghost focus-ring"
                        aria-label="Copy file content"
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--text-caption1)",
                          fontWeight: "var(--weight-medium)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <button
                        onClick={downloadContent}
                        className="btn-ghost focus-ring"
                        aria-label="Download file"
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--text-caption1)",
                          fontWeight: "var(--weight-medium)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <button
                        onClick={startEditing}
                        className="btn-ghost focus-ring"
                        aria-label="Edit file"
                        style={{
                          padding: "6px 12px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "var(--text-caption1)",
                          fontWeight: "var(--weight-medium)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      {showReindex && (
                        <ReindexButton
                          status={reindexStatus}
                          onReindex={handleReindex}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Unsaved changes prompt when switching files */}
            {pendingFile && (
              <div
                style={{
                  padding: "var(--space-2) var(--space-6)",
                  background: "var(--system-orange)",
                  color: "white",
                  fontSize: "var(--text-caption1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "var(--space-2)",
                }}
              >
                <span>Unsaved changes</span>
                <div className="flex items-center" style={{ gap: "var(--space-2)" }}>
                  <button
                    onClick={saveContent}
                    disabled={saving}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(255,255,255,0.2)",
                      color: "white",
                      border: "none",
                      fontSize: "var(--text-caption1)",
                      cursor: "pointer",
                    }}
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={discardAndSwitch}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                      background: "rgba(255,255,255,0.2)",
                      color: "white",
                      border: "none",
                      fontSize: "var(--text-caption1)",
                      cursor: "pointer",
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable content area */}
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto"
              style={{
                padding: "var(--space-8) var(--space-10)",
              }}
            >
              <div style={{ maxWidth: 760, margin: "0 auto" }}>
                {isEditing ? (
                  <>
                    <textarea
                      value={editingContent ?? ""}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="font-mono"
                      style={{
                        width: "100%",
                        minHeight: 400,
                        resize: "vertical",
                        background: "var(--code-bg)",
                        color: "var(--code-text)",
                        border: "1px solid var(--code-border)",
                        borderRadius: "var(--radius-md)",
                        padding: "var(--space-4)",
                        fontSize: "var(--text-footnote)",
                        lineHeight: "var(--leading-relaxed)",
                        outline: "none",
                        fontFamily: "var(--font-mono, ui-monospace, monospace)",
                      }}
                    />
                    {saveError && (
                      <div
                        style={{
                          marginTop: "var(--space-2)",
                          padding: "var(--space-2) var(--space-3)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--system-red)",
                          color: "white",
                          fontSize: "var(--text-caption1)",
                        }}
                      >
                        {saveError}
                      </div>
                    )}
                    <EditingHintsPanel hints={editingHints} />
                  </>
                ) : (
                  renderedContent
                )}
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center h-full"
            style={{ gap: "var(--space-3)" }}
          >
            <FolderIcon />
            <span
              style={{
                fontSize: "var(--text-subheadline)",
                fontWeight: "var(--weight-medium)",
                color: "var(--text-secondary)",
                marginTop: "var(--space-2)",
              }}
            >
              Select a file
            </span>
            <span
              style={{
                fontSize: "var(--text-footnote)",
                color: "var(--text-tertiary)",
                textAlign: "center",
                maxWidth: 240,
              }}
            >
              Choose a file from the sidebar to view its contents
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
