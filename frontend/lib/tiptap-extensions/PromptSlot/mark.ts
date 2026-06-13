/**
 * AiSource — a TipTap mark applied to text that came from an AI-generated
 * candidate. Provenance: lets the editor visually distinguish AI-filled regions
 * when a "show AI marks" toggle is on.
 *
 * Renders as `<span data-ai-source class="ai-source">…</span>`. CSS controls
 * whether it's visible or invisible.
 */

import { Mark, mergeAttributes } from "@tiptap/react";

export const AiSource = Mark.create({
  name: "aiSource",
  inclusive: false,
  parseHTML() {
    return [{ tag: "span[data-ai-source]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-ai-source": "true",
        class: "ai-source",
      }),
      0,
    ];
  },
});
