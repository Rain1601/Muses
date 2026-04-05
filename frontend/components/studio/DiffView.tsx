"use client";

import { useMemo, useRef, useEffect } from "react";

interface Props {
  oldContent: string;
  newContent: string;
}

interface DiffLine {
  type: "same" | "add" | "delete";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

/**
 * Simple Myers-like diff for line arrays.
 * Returns an array of DiffLine with type markers.
 */
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const diff: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: "same", content: oldLines[i - 1], oldLineNo: i, newLineNo: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "add", content: newLines[j - 1], newLineNo: j });
      j--;
    } else {
      diff.unshift({ type: "delete", content: oldLines[i - 1], oldLineNo: i });
      i--;
    }
  }

  return diff;
}

export default function DiffView({ oldContent, newContent }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const diffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);

  // Scroll to first change
  useEffect(() => {
    if (scrollRef.current) {
      const firstChange = scrollRef.current.querySelector("[data-changed]");
      if (firstChange) {
        firstChange.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [diffLines]);

  // Count changes
  const added = diffLines.filter(l => l.type === "add").length;
  const deleted = diffLines.filter(l => l.type === "delete").length;

  return (
    <div className="h-full flex flex-col">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-[#292524] text-xs text-[#57534E] flex-shrink-0">
        <span>Diff</span>
        {added > 0 && <span className="text-green-500">+{added}</span>}
        {deleted > 0 && <span className="text-red-400">-{deleted}</span>}
        {added === 0 && deleted === 0 && <span>无变更</span>}
      </div>

      {/* Diff content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-sm" style={{ lineHeight: "24px" }}>
        {diffLines.map((line, idx) => {
          const lineNo = line.type === "delete" ? line.oldLineNo : line.newLineNo;
          const showLineNo = lineNo && (lineNo % 5 === 0 || lineNo === 1);

          return (
            <div
              key={idx}
              data-changed={line.type !== "same" ? "" : undefined}
              className={`flex ${
                line.type === "delete"
                  ? "bg-red-950/30"
                  : line.type === "add"
                  ? "bg-green-950/30"
                  : ""
              }`}
            >
              {/* Line number */}
              <div className="w-12 flex-shrink-0 text-right pr-3 select-none text-xs" style={{ lineHeight: "24px" }}>
                {showLineNo ? (
                  <span className="text-[#57534E]">{lineNo}</span>
                ) : (
                  <span className="text-transparent">·</span>
                )}
              </div>

              {/* Gutter indicator */}
              <div className="w-6 flex-shrink-0 text-center select-none" style={{ lineHeight: "24px" }}>
                {line.type === "delete" && <span className="text-red-400">−</span>}
                {line.type === "add" && <span className="text-green-400">+</span>}
              </div>

              {/* Content */}
              <div
                className={`flex-1 px-2 ${
                  line.type === "delete"
                    ? "text-red-300/80 line-through decoration-red-500/40"
                    : line.type === "add"
                    ? "text-green-300/90"
                    : "text-[#D6D3D1]"
                }`}
                style={{ lineHeight: "24px", minHeight: "24px" }}
              >
                {line.content || "\u00A0"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
