/**
 * AiSource — a TipTap mark applied to text that came from an AI-generated
 * candidate. Provenance: lets the editor visually distinguish AI-filled regions
 * when a "show AI marks" toggle is on, and carries the `editId` attribute the
 * dashboard's edit-history panel uses to find and revert individual AI edits.
 *
 * Renders as `<span data-ai-source data-edit-id="…" class="ai-source">…</span>`.
 * CSS controls visibility; the `data-edit-id` attribute is the durable handle
 * for revert.
 */

import { Mark, mergeAttributes } from "@tiptap/react";

export const AiSource = Mark.create({
  name: "aiSource",
  inclusive: false,
  addAttributes() {
    return {
      editId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-edit-id"),
        renderHTML: (attrs) => {
          if (!attrs.editId) return {};
          return { "data-edit-id": attrs.editId };
        },
      },
    };
  },
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
