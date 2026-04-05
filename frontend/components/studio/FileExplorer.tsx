"use client";

import { useState, useRef, useEffect } from "react";

interface FileItem {
  name: string;
  size: number;
  modified: number;
}

interface Props {
  files: FileItem[];
  activeFile: string | null;
  onOpenFile: (name: string) => void;
  onCreateFile: (name: string) => void;
  onRefresh: () => void;
}

type FilterTag = "all" | "article" | "skill";

function getFileTag(name: string): "article" | "skill" {
  // Files starting with "skill-" or in a skills pattern are skills
  if (name.startsWith("skill-") || name.startsWith("prompt-") || name.includes(".skill.")) {
    return "skill";
  }
  return "article";
}

export default function FileExplorer({ files, activeFile, onOpenFile, onCreateFile, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState<FilterTag>("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    const filename = name.endsWith(".md") ? name : `${name}.md`;
    onCreateFile(filename);
    setNewName("");
    setCreating(false);
  };

  const filtered = filter === "all" ? files : files.filter(f => getFileTag(f.name) === filter);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#292524]">
        <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">Files</span>
        <div className="flex gap-1">
          <button onClick={onRefresh} className="p-1 text-[#78716C] hover:text-[#A8A29E] transition-colors" title="刷新">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
              <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
            </svg>
          </button>
          <button onClick={() => setCreating(true)} className="p-1 text-[#78716C] hover:text-[#A8A29E] transition-colors" title="新建">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14"/><path d="M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Filter tags */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-[#292524]">
        {(["all", "article", "skill"] as FilterTag[]).map(tag => (
          <button
            key={tag}
            onClick={() => setFilter(tag)}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              filter === tag
                ? "bg-[#292524] text-[#D6D3D1]"
                : "text-[#57534E] hover:text-[#A8A29E]"
            }`}
          >
            {tag === "all" ? "全部" : tag === "article" ? "文章" : "Skill"}
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {creating && (
          <div className="px-2 py-1">
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              onBlur={handleCreate}
              placeholder="filename.md"
              className="w-full px-2 py-1 text-xs bg-[#292524] border border-[#44403C] rounded text-[#D6D3D1] outline-none placeholder-[#57534E] focus:border-[#D97757]"
            />
          </div>
        )}

        {filtered.length === 0 && !creating ? (
          <div className="px-3 py-4 text-xs text-[#57534E] text-center">
            {filter === "all" ? "暂无文件" : `暂无${filter === "article" ? "文章" : "Skill"}`}
            <br />
            <button onClick={() => setCreating(true)} className="text-[#D97757] mt-1 hover:underline">
              新建
            </button>
          </div>
        ) : (
          filtered.map((file) => {
            const tag = getFileTag(file.name);
            return (
              <button
                key={file.name}
                onClick={() => onOpenFile(file.name)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                  activeFile === file.name
                    ? "bg-[#292524] text-[#FAFAF9]"
                    : "text-[#A8A29E] hover:bg-[#292524]/50 hover:text-[#D6D3D1]"
                }`}
              >
                {/* Tag indicator */}
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  tag === "skill" ? "bg-[#D97757]" : "bg-[#57534E]"
                }`} />
                <span className="truncate text-xs">{file.name}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
