"use client";

/**
 * /dashboard-cc — Claude Code workspace.
 *
 * Talks to POST /api/claude-code/stream over SSE. The backend spawns
 * `claude --print --output-format stream-json` and forwards normalized events.
 * Tool calls, text, and final result render in one transcript stream.
 *
 * Auth: intentionally not gated on login. This page is local-dev only
 * (mirrors Studio mode — see backend `settings.enable_studio`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import s from "./page.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const MODEL_OPTIONS = [
  { value: "sonnet", label: "sonnet" },
  { value: "opus", label: "opus" },
  { value: "haiku", label: "haiku" },
];

const ALL_TOOLS = [
  "Read", "Glob", "Grep", "WebSearch", "WebFetch",
  "Write", "Edit", "Bash",
];
const DEFAULT_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"];

type EventKind =
  | "session" | "text" | "thinking" | "tool_use" | "tool_result"
  | "result" | "rate_limit" | "batch";

interface NormEvent {
  kind: EventKind;
  // session
  session_id?: string; model?: string; cwd?: string; tools?: string[];
  // text/thinking
  text?: string;
  // tool_use
  id?: string; name?: string; input?: Record<string, unknown>;
  // tool_result
  tool_use_id?: string; is_error?: boolean; content?: string;
  // result
  subtype?: string; duration_ms?: number; num_turns?: number;
  total_cost_usd?: number; stop_reason?: string;
  input_tokens?: number; output_tokens?: number;
  cache_read_input_tokens?: number; cache_creation_input_tokens?: number;
  errors?: string[];
  // batch
  items?: NormEvent[];
  // misc
  data?: unknown;
}

// One row in the transcript. A user prompt or a stream of agent events.
type Row =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "agent"; events: NormEvent[]; running: boolean }
  | { id: string; kind: "session"; session_id: string; model: string }
  | { id: string; kind: "error"; message: string };

function shortPath(p?: string) {
  if (!p) return "";
  return p.replace(process.env.NEXT_PUBLIC_HOME || "/Users/rain", "~");
}

function summarizeToolInput(name: string | undefined, input: Record<string, unknown> | undefined): string {
  if (!input) return "";
  switch (name) {
    case "Read":
    case "Write":
    case "Edit":
    case "NotebookEdit":
      return shortPath(String(input.file_path ?? ""));
    case "Bash":
      return String(input.command ?? "");
    case "Glob":
      return String(input.pattern ?? "");
    case "Grep":
      return String(input.pattern ?? input.query ?? "");
    case "WebSearch":
    case "WebFetch":
      return String(input.query ?? input.url ?? "");
    default: {
      try {
        const s = JSON.stringify(input);
        return s.length > 160 ? s.slice(0, 160) + "…" : s;
      } catch { return ""; }
    }
  }
}

function fmtCost(usd?: number) {
  if (usd == null) return "—";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
function fmtDuration(ms?: number) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function fmtTokens(n?: number) {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}

const ToolIcon = ({ name }: { name: string | undefined }) => {
  const ch = (() => {
    switch (name) {
      case "Read": return "📖";
      case "Write": return "✎";
      case "Edit": return "✎";
      case "Bash": return "▶";
      case "Glob": return "*";
      case "Grep": return "⌕";
      case "WebSearch": return "🔍";
      case "WebFetch": return "↗";
      default: return "⚙";
    }
  })();
  return <span className={s.toolIcon}>{ch}</span>;
};

interface ToolCardProps {
  call: NormEvent;
  result?: NormEvent;
  defaultOpen?: boolean;
}
function ToolCard({ call, result, defaultOpen = false }: ToolCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const summary = summarizeToolInput(call.name, call.input);
  return (
    <div className={s.tool}>
      <div className={s.toolHeader} onClick={() => setOpen(o => !o)}>
        <ToolIcon name={call.name} />
        <span className={s.toolName}>{call.name}</span>
        <span className={s.toolSummary}>{summary}</span>
        <span className={`${s.toolCaret} ${open ? s.toolCaretOpen : ""}`}>▸</span>
      </div>
      {open && (
        <div className={s.toolBody}>
          <span className={s.toolBodyLabel}>input</span>
          {JSON.stringify(call.input, null, 2)}
          {result && (
            <>
              <span className={s.toolBodyLabel}>
                output {result.is_error ? <span className={s.toolResultErr}>· error</span> : <span className={s.toolResultOk}>· ok</span>}
              </span>
              {result.content || "(empty)"}
            </>
          )}
          {!result && (
            <>
              <span className={s.toolBodyLabel}>output</span>
              <span style={{ color: "#57534E" }}>(running…)</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResultFooter({ ev }: { ev: NormEvent }) {
  const isErr = ev.is_error || (ev.subtype && ev.subtype !== "success");
  return (
    <div className={`${s.resultFooter} ${isErr ? s.resultErr : ""}`}>
      <span>{isErr ? "✗" : "✓"} <strong>{ev.subtype ?? "done"}</strong></span>
      <span>· {ev.num_turns ?? "—"} turns</span>
      <span>· {fmtDuration(ev.duration_ms)}</span>
      <span>· {fmtCost(ev.total_cost_usd)}</span>
      <span>
        · in <strong>{fmtTokens(ev.input_tokens)}</strong> / out <strong>{fmtTokens(ev.output_tokens)}</strong>
      </span>
      {(ev.cache_read_input_tokens ?? 0) > 0 && (
        <span>· cache {fmtTokens(ev.cache_read_input_tokens)}</span>
      )}
      {ev.errors && ev.errors.length > 0 && (
        <span style={{ marginLeft: "auto" }}>· {ev.errors.join("; ")}</span>
      )}
    </div>
  );
}

interface AgentRunProps { events: NormEvent[] }
function AgentRun({ events }: AgentRunProps) {
  // Pair tool_use with its tool_result by id, in render order.
  const results = useMemo(() => {
    const m = new Map<string, NormEvent>();
    for (const e of events) {
      if (e.kind === "tool_result" && e.tool_use_id) m.set(e.tool_use_id, e);
    }
    return m;
  }, [events]);

  return (
    <>
      {events.map((e, idx) => {
        if (e.kind === "text") {
          return <div key={idx} className={s.textBlock}>{e.text}</div>;
        }
        if (e.kind === "thinking") {
          return <div key={idx} className={s.thinkingBlock}>{e.text}</div>;
        }
        if (e.kind === "tool_use") {
          return (
            <ToolCard key={idx} call={e} result={e.id ? results.get(e.id) : undefined} />
          );
        }
        if (e.kind === "result") {
          return <ResultFooter key={idx} ev={e} />;
        }
        if (e.kind === "rate_limit") {
          return null;  // silent
        }
        return null;
      })}
    </>
  );
}

export default function ClaudeCodePage() {
  const [prompt, setPrompt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [cwd, setCwd] = useState<string>("");        // empty -> server uses WORKSPACE_ROOT
  const [model, setModel] = useState<string>("sonnet");
  const [maxTurns, setMaxTurns] = useState<number>(8);
  const [allowedTools, setAllowedTools] = useState<string[]>(DEFAULT_TOOLS);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive.
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [rows]);

  // ── Send ─────────────────────────────────────────────
  const send = useCallback(async () => {
    const p = prompt.trim();
    if (!p || running) return;
    setErr(null);
    setPrompt("");
    setStatus("running");
    setRunning(true);

    const userRow: Row = { id: `u-${Date.now()}`, kind: "user", text: p };
    const agentRow: Row = { id: `a-${Date.now()}`, kind: "agent", events: [], running: true };
    setRows(prev => [...prev, userRow, agentRow]);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch(`${API_BASE}/api/claude-code/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({
          prompt: p,
          cwd: cwd || undefined,
          allowed_tools: allowedTools,
          max_turns: maxTurns,
          model,
          permission_mode: "default",
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const pushEvent = (eventName: string, raw: string) => {
        let data: NormEvent | Record<string, unknown>;
        try { data = JSON.parse(raw); } catch { return; }

        if (eventName === "started") {
          // already created the agent row; could surface cwd/model badge later
          return;
        }
        if (eventName === "error") {
          const msg = String((data as Record<string, unknown>).message ?? raw);
          setRows(prev => [...prev, { id: `e-${Date.now()}`, kind: "error", message: msg }]);
          setStatus("error");
          return;
        }
        if (eventName === "done") {
          return;
        }
        if (eventName !== "event") return;

        const ev = data as NormEvent;
        if (ev.kind === "session") {
          setRows(prev => {
            // insert session marker BEFORE the agent row if not already present
            const idx = prev.findIndex(r => r.id === agentRow.id);
            const marker: Row = {
              id: `s-${ev.session_id ?? Date.now()}`,
              kind: "session",
              session_id: ev.session_id ?? "",
              model: ev.model ?? "",
            };
            if (idx === -1) return [...prev, marker];
            const out = prev.slice();
            out.splice(idx, 0, marker);
            return out;
          });
          return;
        }

        // Flatten batches
        const toAppend: NormEvent[] = ev.kind === "batch" && ev.items ? ev.items : [ev];

        setRows(prev => prev.map(r => {
          if (r.id !== agentRow.id || r.kind !== "agent") return r;
          return { ...r, events: [...r.events, ...toAppend] };
        }));
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE messages are separated by blank lines.
        let sep: number;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
          const chunk = buf.slice(0, sep);
          buf = buf.slice(sep + 2);
          let eventName = "message";
          const dataLines: string[] = [];
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) eventName = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          if (dataLines.length) pushEvent(eventName, dataLines.join("\n"));
        }
      }

      setStatus(prev => (prev === "error" ? "error" : "done"));
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") {
        setStatus("idle");
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg);
        setStatus("error");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
      setRows(prev => prev.map(r =>
        r.id === agentRow.id && r.kind === "agent" ? { ...r, running: false } : r
      ));
    }
  }, [prompt, running, cwd, allowedTools, maxTurns, model]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    if (running) return;
    setRows([]);
    setStatus("idle");
    setErr(null);
  }, [running]);

  // Cmd/Ctrl + Enter
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void send();
    } else if (e.key === "Escape" && running) {
      e.preventDefault();
      stop();
    }
  }, [send, stop, running]);

  const toggleTool = (t: string) => {
    setAllowedTools(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const statusDotCls = status === "running" ? s.statusDotRunning
    : status === "error" ? s.statusDotError
    : status === "done" ? s.statusDotDone : "";

  return (
    <div className={s.shell}>
      {/* Topbar */}
      <div className={s.topbar}>
        <div className={s.topbarLeft}>
          <a className={s.back} href="/dashboard">← Dashboard</a>
          <span className={s.logo}>Muses</span>
          <span className={s.tag}>Claude Code</span>
        </div>
        <div className={s.topbarRight}>
          <div className={s.statusPill}>
            <span className={`${s.statusDot} ${statusDotCls}`} />
            {status}
          </div>
        </div>
      </div>

      {/* Config bar */}
      <div className={s.configBar}>
        <div className={s.configField}>
          <span className={s.configLabel}>cwd</span>
          <label className={s.configValue} title="Relative to ~/muses-workspace; blank = workspace root">
            <input
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              placeholder="(workspace root)"
              size={Math.max(16, cwd.length || 16)}
              disabled={running}
            />
          </label>
        </div>
        <div className={s.configField}>
          <span className={s.configLabel}>model</span>
          <select className={s.modelSelect} value={model} onChange={e => setModel(e.target.value)} disabled={running}>
            {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className={s.configField}>
          <span className={s.configLabel}>max turns</span>
          <label className={s.configValue}>
            <input
              type="number" min={1} max={50}
              value={maxTurns}
              onChange={(e) => setMaxTurns(Math.min(50, Math.max(1, parseInt(e.target.value || "1", 10))))}
              size={3}
              disabled={running}
            />
          </label>
        </div>
        <button className={s.toolsToggle} onClick={() => setToolsOpen(o => !o)} title="Configure allowed tools">
          tools · {allowedTools.length}
        </button>
        <button className={s.toolsToggle} onClick={clear} disabled={running || rows.length === 0}>
          clear
        </button>
      </div>

      {/* Tools drawer */}
      {toolsOpen && (
        <div className={s.toolsDrawer}>
          <span className={s.toolsDrawerLabel}>allowed tools</span>
          {ALL_TOOLS.map(t => (
            <button
              key={t}
              className={`${s.toolChip} ${allowedTools.includes(t) ? s.toolChipActive : ""}`}
              onClick={() => toggleTool(t)}
              disabled={running}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Error banner */}
      {err && <div className={s.errBanner}>{err}</div>}

      {/* Transcript */}
      <div ref={transcriptRef} className={s.transcript}>
        {rows.length === 0 ? (
          <div className={s.empty}>
            <div className={s.emptyTitle}>Claude Code workspace</div>
            <div className={s.emptyHint}>
              Spawns <code>claude</code> CLI as a local subprocess.<br/>
              Press <code>⌘↵</code> to run.
            </div>
          </div>
        ) : (
          <div className={s.thread}>
            {rows.map(row => {
              if (row.kind === "session") {
                return (
                  <div key={row.id} className={s.sessionLine}>
                    session {row.session_id.slice(0, 8)} · {row.model}
                  </div>
                );
              }
              if (row.kind === "user") {
                return (
                  <div key={row.id} className={`${s.row} ${s.rowUser}`}>
                    <div className={s.rowLabel}>You</div>
                    <div className={s.userBubble}>{row.text}</div>
                  </div>
                );
              }
              if (row.kind === "agent") {
                return (
                  <div key={row.id} className={s.row}>
                    <div className={s.rowLabel}>Claude{row.running ? " · running" : ""}</div>
                    <AgentRun events={row.events} />
                  </div>
                );
              }
              return (
                <div key={row.id} className={s.errBanner}>{row.message}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className={s.composer}>
        <div className={s.composerInner}>
          <textarea
            className={s.textarea}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Claude to read, edit, search, or run something…  (⌘↵ to send)"
            rows={3}
          />
          <div className={s.composerRow}>
            <span className={s.composerHint}>⌘↵ send · esc stop</span>
            <div className={s.composerSpacer} />
            {running ? (
              <button className={`${s.btn} ${s.btnDanger}`} onClick={stop}>Stop</button>
            ) : (
              <button className={s.btn} onClick={send} disabled={!prompt.trim()}>
                Run ↵
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
