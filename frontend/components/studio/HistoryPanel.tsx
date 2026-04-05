"use client";

interface HistoryEntry {
  id: number;
  timestamp: number;
  content: string;
  description: string;
}

interface Props {
  history: HistoryEntry[];
  onRevert: (entry: HistoryEntry) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function HistoryPanel({ history, onRevert }: Props) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-[#292524] flex-shrink-0">
        <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">History</span>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto py-2">
        {history.length === 0 ? (
          <div className="px-4 py-6 text-xs text-[#57534E] text-center">
            打开文件后显示编辑历史
          </div>
        ) : (
          [...history].reverse().map((entry, i) => {
            const isLatest = i === 0;
            const isClaude = entry.description.startsWith("Claude");
            return (
              <div key={entry.id} className="px-4 py-2 group hover:bg-[#292524]/50 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {/* Icon */}
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        isClaude ? "bg-[#D97757]" : isLatest ? "bg-green-500" : "bg-[#44403C]"
                      }`} />
                      <span className={`text-xs font-medium truncate ${
                        isLatest ? "text-[#D6D3D1]" : "text-[#78716C]"
                      }`}>
                        {entry.description}
                      </span>
                    </div>
                    <div className="text-xs text-[#44403C] mt-0.5 pl-3">
                      {timeAgo(entry.timestamp)}
                    </div>
                  </div>

                  {/* Revert button */}
                  {!isLatest && (
                    <button
                      onClick={() => onRevert(entry)}
                      className="opacity-0 group-hover:opacity-100 text-xs px-2 py-0.5 rounded border border-[#44403C] text-[#78716C] hover:text-[#D97757] hover:border-[#D97757] transition-all flex-shrink-0"
                    >
                      恢复
                    </button>
                  )}

                  {isLatest && (
                    <span className="text-xs text-[#44403C]">当前</span>
                  )}
                </div>

                {/* Preview diff line count */}
                {i > 0 && i < history.length && (
                  <div className="text-xs text-[#44403C] mt-1 pl-3">
                    {(() => {
                      const prev = [...history].reverse()[i - 1];
                      if (!prev) return null;
                      const oldLines = prev.content.split("\n").length;
                      const newLines = entry.content.split("\n").length;
                      const diff = newLines - oldLines;
                      if (diff === 0) return null;
                      return diff > 0
                        ? <span className="text-green-600">+{diff} 行</span>
                        : <span className="text-red-500">{diff} 行</span>;
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
