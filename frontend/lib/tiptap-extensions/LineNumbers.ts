import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const lineNumbersKey = new PluginKey("lineNumbers");

/**
 * TipTap extension that adds line numbers to block-level nodes.
 * Shows numbers at lines 1, 5, 10, 15, 20... with a subtle grid.
 */
export const LineNumbers = Extension.create({
  name: "lineNumbers",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: lineNumbersKey,
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];
            let lineNum = 0;

            doc.forEach((node, pos) => {
              lineNum++;
              const isKeyLine = lineNum === 1 || lineNum % 5 === 0;
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  "data-line": String(lineNum),
                  class: isKeyLine
                    ? "editor-line show-line-num line-num-key"
                    : "editor-line show-line-num",
                })
              );
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * Extract text content for a range of block-level lines from the editor.
 * lineStart is 1-based, lineEnd is inclusive.
 */
export function getLineContent(
  editor: any,
  lineStart: number,
  lineEnd?: number
): string {
  if (!editor) return "";
  const doc = editor.state.doc;
  const lines: string[] = [];
  let lineNum = 0;

  doc.forEach((node: any) => {
    lineNum++;
    const end = lineEnd ?? lineNum + 999; // if no end, get everything from start
    if (lineNum >= lineStart && lineNum <= end) {
      lines.push(node.textContent);
    }
  });

  return lines.join("\n");
}

/**
 * Parse =N or =N-M syntax from the beginning of a message.
 * Returns { lineStart, lineEnd, cleanMessage } or null if no match.
 */
export function parseLineRange(input: string): {
  lineStart: number;
  lineEnd?: number;
  cleanMessage: string;
} | null {
  const match = input.match(/^=(\d+)(?:-(\d+))?\s*(.*)/s);
  if (!match) return null;

  const lineStart = parseInt(match[1], 10);
  const lineEnd = match[2] ? parseInt(match[2], 10) : undefined;
  const cleanMessage = match[3] || "";

  return { lineStart, lineEnd, cleanMessage };
}
