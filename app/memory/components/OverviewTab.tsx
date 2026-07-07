"use client";

import type { RefObject } from "react";
import { Activity, ChevronDown, Zap } from "lucide-react";
import type {
  Agent,
  MemoryConfig,
  MemoryStatus,
  MemoryStats,
  MemoryHealthSummary,
  MemoryHealthCheck,
} from "@/lib/types";
import { renderMarkdown } from "@/lib/sanitize";
import { HealthHero, HealthChecksList, MemoryTimeline, ConfigPanel } from "./overview-panels";

interface Mem0Memory {
  id: string;
  memory: string;
  created_at: string;
  updated_at: string;
  categories: string[];
}

interface Mem0Data {
  enabled: boolean;
  userId: string | null;
  memories: Mem0Memory[];
  count: number;
}

interface HealthChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export interface OverviewTabProps {
  mem0Data: Mem0Data | null;
  health: MemoryHealthSummary | null;
  stats: MemoryStats | null;
  status: MemoryStatus | null;
  config: MemoryConfig | null;
  rootAgent: Agent | null;
  analysisOpen: boolean;
  analysisStreaming: boolean;
  analysisContent: string;
  chatMessages: HealthChatMessage[];
  chatInput: string;
  chatStreaming: boolean;
  chatTextareaRef: RefObject<HTMLTextAreaElement | null>;
  setAnalysisOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setChatInput: (value: string) => void;
  runAnalysis: () => void;
  sendChatMessage: (overrideText?: string) => void;
  handleCheckAction: (check: MemoryHealthCheck) => void;
  handleViewFile: (relativePath: string) => void;
  handleReindex: () => void;
}

export function OverviewTab({
  mem0Data,
  health,
  stats,
  status,
  config,
  rootAgent,
  analysisOpen,
  analysisStreaming,
  analysisContent,
  chatMessages,
  chatInput,
  chatStreaming,
  chatTextareaRef,
  setAnalysisOpen,
  setChatInput,
  runAnalysis,
  sendChatMessage,
  handleCheckAction,
  handleViewFile,
  handleReindex,
}: OverviewTabProps) {
  return (
    <div
      className="overflow-y-auto h-full"
      style={{ padding: "var(--space-4) var(--space-6) var(--space-6)" }}
    >
      {/* mem0 Cloud Memory */}
      {mem0Data && mem0Data.enabled && (
        <div
          style={{
            background: "var(--material-regular)",
            border: "1px solid var(--separator)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-4)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderBottom: "1px solid var(--separator)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <Zap size={16} style={{ color: "var(--system-purple)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--text-footnote)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
                mem0 Cloud Memory
              </div>
              <div style={{ fontSize: "var(--text-caption1)", color: "var(--text-tertiary)" }}>
                Connected as <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>{mem0Data.userId}</span>
                {" · "}
                <span style={{ color: "var(--system-green)", fontWeight: "var(--weight-semibold)" }}>{mem0Data.count}</span> memories
              </div>
            </div>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "var(--text-caption2)",
                fontWeight: "var(--weight-semibold)",
                color: "var(--system-green)",
                background: "rgba(48, 209, 88, 0.12)",
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--system-green)" }} />
              Active
            </span>
          </div>
          {mem0Data.memories.length > 0 && (
            <div style={{ maxHeight: 280, overflowY: "auto" }}>
              {mem0Data.memories.slice(0, 20).map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: "var(--space-2) var(--space-4)",
                    borderBottom: "1px solid var(--separator)",
                    fontSize: "var(--text-footnote)",
                    color: "var(--text-primary)",
                    lineHeight: "var(--leading-normal)",
                  }}
                >
                  <div>{m.memory}</div>
                  <div
                    style={{
                      fontSize: "var(--text-caption2)",
                      color: "var(--text-quaternary)",
                      marginTop: 2,
                    }}
                  >
                    {new Date(m.updated_at).toLocaleDateString()}
                    {m.categories?.length > 0 && (
                      <span style={{ marginLeft: 8 }}>
                        {m.categories.map((c) => (
                          <span
                            key={c}
                            style={{
                              background: "var(--fill-quaternary)",
                              padding: "0 4px",
                              borderRadius: 3,
                              marginLeft: 4,
                              fontSize: "var(--text-caption2)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {c}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Health hero */}
      {health && stats && status && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <HealthHero health={health} stats={stats} status={status} />
        </div>
      )}

      {/* Memory Advisor */}
      {rootAgent && config && status && stats && health && (
        <div style={{
          background: "var(--material-regular)",
          border: "1px solid var(--separator)",
          borderRadius: 12,
          marginBottom: "var(--space-4)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 20px",
            display: "flex", alignItems: "center", gap: 12,
            borderBottom: analysisOpen ? "1px solid var(--separator)" : undefined,
          }}>
            <Activity size={18} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                Memory Advisor
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                AI-powered analysis of your memory system health
              </div>
            </div>
            {analysisStreaming && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12, color: "var(--accent)", fontWeight: 500,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
                  animation: "pulse 1.2s infinite",
                }} />
                Analyzing...
              </span>
            )}
            {!analysisOpen && !analysisContent && !analysisStreaming && (
              <button
                onClick={() => { setAnalysisOpen(true); runAnalysis(); }}
                className="btn-ghost focus-ring"
                style={{
                  padding: "6px 16px", borderRadius: 8,
                  fontSize: 13, fontWeight: 600,
                  background: "var(--accent)", color: "white",
                  border: "none", cursor: "pointer",
                }}
              >
                Analyze
              </button>
            )}
            {(analysisOpen || analysisContent) && (
              <button
                onClick={() => setAnalysisOpen((prev) => !prev)}
                className="focus-ring"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <ChevronDown
                  size={16}
                  style={{
                    color: "var(--text-tertiary)",
                    transform: analysisOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 200ms ease",
                  }}
                />
              </button>
            )}
          </div>

          {analysisOpen && (
            <div>
              {/* Loading skeleton */}
              {analysisStreaming && !analysisContent && (
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[180, 240, 160, 220, 140].map((w, i) => (
                    <div key={i} style={{
                      width: w, maxWidth: "100%", height: 12, borderRadius: 4,
                      background: "var(--fill-tertiary)",
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
                    padding: "16px 20px",
                    maxHeight: 520,
                    overflowY: "auto",
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: "var(--text-primary)",
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisContent) }}
                />
              )}

              {/* Suggested actions (before first analysis) */}
              {!analysisContent && !analysisStreaming && (
                <div style={{ padding: "12px 20px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                    Ask about
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[
                      "What should I fix first and why?",
                      "How do I reorganize MEMORY.md?",
                      "Walk me through cleaning up old daily logs",
                      "Is my memory system set up correctly?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => { setAnalysisOpen(true); runAnalysis(); }}
                        className="btn-ghost focus-ring"
                        style={{
                          padding: "5px 12px", borderRadius: 14,
                          fontSize: 12, fontWeight: 500,
                          background: "var(--fill-secondary)",
                          border: "1px solid var(--separator)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
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
                  <div style={{ height: 1, background: "var(--separator)" }} />

                  {/* Chat messages */}
                  {chatMessages.length > 0 && (
                    <div style={{ maxHeight: 320, overflowY: "auto", padding: "12px 20px" }}>
                      {chatMessages.map((msg) => (
                        <div key={msg.id} style={{
                          marginBottom: 12,
                          display: "flex",
                          justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                        }}>
                          <div style={{
                            maxWidth: "85%",
                            padding: "8px 14px",
                            borderRadius: 12,
                            fontSize: 14,
                            lineHeight: 1.55,
                            ...(msg.role === "user" ? {
                              background: "var(--accent)",
                              color: "white",
                            } : {
                              background: "var(--fill-secondary)",
                              color: "var(--text-primary)",
                            }),
                          }}>
                            {msg.role === "assistant" ? (
                              <div
                                className="markdown-body"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content || "...") }}
                              />
                            ) : (
                              msg.content
                            )}
                            {msg.isStreaming && (
                              <span style={{
                                display: "inline-block", width: 6, height: 14,
                                background: "var(--text-tertiary)", borderRadius: 1,
                                marginLeft: 2, animation: "blink 1s step-end infinite",
                              }} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Follow-up suggestions */}
                  {chatMessages.length === 0 && (
                    <div style={{ padding: "8px 20px 4px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[
                        "Show me the specific changes to make",
                        "What's the impact of not fixing this?",
                        "Help me write the new topic files",
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => sendChatMessage(q)}
                          className="btn-ghost focus-ring"
                          style={{
                            padding: "4px 10px", borderRadius: 12,
                            fontSize: 11, fontWeight: 500,
                            background: "var(--fill-secondary)",
                            border: "1px solid var(--separator)",
                            color: "var(--text-secondary)",
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Chat input */}
                  <div style={{
                    display: "flex", alignItems: "flex-end", gap: 8,
                    padding: "10px 20px 16px",
                  }}>
                    <textarea
                      ref={chatTextareaRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                      placeholder="Ask a follow-up..."
                      disabled={chatStreaming}
                      rows={1}
                      style={{
                        flex: 1, resize: "none",
                        background: "var(--fill-tertiary)",
                        border: "1px solid var(--separator)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 13,
                        color: "var(--text-primary)",
                        outline: "none",
                        lineHeight: 1.4,
                        fontFamily: "inherit",
                      }}
                    />
                    <button
                      onClick={() => sendChatMessage()}
                      disabled={chatStreaming || !chatInput.trim()}
                      className="btn-ghost focus-ring"
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        background: "var(--accent)",
                        color: "white",
                        border: "none",
                        cursor: chatStreaming || !chatInput.trim() ? "not-allowed" : "pointer",
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
      )}

      {/* Health checks */}
      {health && health.checks.length > 0 && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <HealthChecksList
            checks={health.checks}
            onCheckAction={rootAgent ? handleCheckAction : undefined}
            onViewFile={handleViewFile}
            onReindex={handleReindex}
          />
        </div>
      )}

      {/* Timeline */}
      {stats && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <MemoryTimeline timeline={stats.dailyTimeline} />
        </div>
      )}

      {/* Config */}
      {config && <ConfigPanel config={config} />}
    </div>
  );
}
