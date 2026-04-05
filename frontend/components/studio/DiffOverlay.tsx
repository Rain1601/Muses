"use client";

interface DiffChange {
  type: "add" | "delete" | "context";
  content: string;
}

interface DiffHunk {
  header: string;
  changes: DiffChange[];
}

interface Props {
  diff: { hunks: DiffHunk[]; raw: string };
  filename: string;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Diff Overlay — shows incoming file changes with red/green highlighting.
 * Appears when Claude Code CLI modifies the workspace file.
 */
export default function DiffOverlay({ diff, filename, onAccept, onReject }: Props) {
  return (
    <div className="absolute inset-0 bg-[#1C1917]/95 backdrop-blur-sm z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#292524]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#D97757] animate-pulse" />
          <span className="text-sm font-medium text-[#FAFAF9]">
            Claude 修改了 {filename}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="text-xs px-3 py-1.5 rounded border border-red-800/50 text-red-400 hover:bg-red-900/30 transition-colors"
          >
            ✕ Reject
          </button>
          <button
            onClick={onAccept}
            className="text-xs px-3 py-1.5 rounded border border-green-800/50 text-green-400 hover:bg-green-900/30 transition-colors"
          >
            ✓ Accept
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-6">
        {diff.hunks.map((hunk, hi) => (
          <div key={hi} className="mb-4">
            <div className="text-[#57534E] mb-1">{hunk.header}</div>
            {hunk.changes.map((change, ci) => (
              <div
                key={ci}
                className={
                  change.type === "delete"
                    ? "bg-red-900/20 text-red-300 border-l-2 border-red-500 pl-3"
                    : change.type === "add"
                    ? "bg-green-900/20 text-green-300 border-l-2 border-green-500 pl-3"
                    : "text-[#78716C] pl-3"
                }
              >
                <span className="select-none mr-2 text-[#44403C]">
                  {change.type === "delete" ? "−" : change.type === "add" ? "+" : " "}
                </span>
                {change.content}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Keyboard hint */}
      <div className="px-4 py-2 border-t border-[#292524] text-xs text-[#57534E] text-center">
        按 <kbd className="px-1.5 py-0.5 rounded bg-[#292524] text-[#A8A29E]">Enter</kbd> Accept · <kbd className="px-1.5 py-0.5 rounded bg-[#292524] text-[#A8A29E]">Esc</kbd> Reject
      </div>
    </div>
  );
}
