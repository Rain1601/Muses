"use client";

import { useMemo, useState } from "react";

interface TOCItem {
  level: number;
  text: string;
  id: string;
  children: TOCItem[];
}

interface Props {
  content: string;
}

function extractHeadings(markdown: string): TOCItem[] {
  const lines = markdown.split("\n");
  const flat: { level: number; text: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      flat.push({ level: match[1].length, text: match[2].trim() });
    }
  }

  // Build nested tree
  const root: TOCItem[] = [];
  const stack: { item: TOCItem; level: number }[] = [];

  for (const h of flat) {
    const item: TOCItem = {
      level: h.level,
      text: h.text,
      id: h.text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-"),
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(item);
    } else {
      stack[stack.length - 1].item.children.push(item);
    }

    stack.push({ item, level: h.level });
  }

  return root;
}

function TOCNode({ item, depth }: { item: TOCItem; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = item.children.length > 0;

  return (
    <div>
      <div
        onClick={() => hasChildren && setOpen(!open)}
        className={`flex items-center gap-1 cursor-pointer transition-colors hover:text-[#D6D3D1] ${
          depth === 0 ? "text-[#A8A29E] font-semibold" : "text-[#78716C]"
        }`}
        style={{
          padding: `3px 12px 3px ${12 + depth * 14}px`,
          fontSize: depth === 0 ? "12px" : "11px",
        }}
      >
        {hasChildren && (
          <span
            className="text-[#57534E] text-[7px] transition-transform"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0)" }}
          >
            ▸
          </span>
        )}
        <span className="truncate">{item.text}</span>
      </div>
      {hasChildren && open && (
        <div>
          {item.children.map((child, i) => (
            <TOCNode key={i} item={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FloatingTOC({ content }: Props) {
  const headings = useMemo(() => extractHeadings(content), [content]);

  if (headings.length === 0) return null;

  return (
    <div className="sticky top-4 float-right w-[200px] ml-4 -mr-2 border border-[#292524] rounded-lg bg-[#1C1917] py-2 max-h-[calc(100vh-200px)] overflow-y-auto z-10"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="px-3 pb-2 text-[11px] text-[#57534E] font-semibold">标题目录</div>
      {headings.map((item, i) => (
        <TOCNode key={i} item={item} depth={0} />
      ))}
    </div>
  );
}
