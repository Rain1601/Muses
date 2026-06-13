/**
 * PromptSlot — shared types for the bracket-detection and selection-task systems.
 * Both /dashboard-pw and main /dashboard editor wire into the same task model:
 *
 *   "task" = (prompt, candidates[], status) — keyed by either:
 *     - bracket content (for inline 【...】 slots)
 *     - a synthetic id (for ⌘K selection tasks)
 */

export type SlotStatus = "idle" | "pending" | "ready" | "error";

export interface Candidate {
  text: string;
  cost_usd?: number;
  duration_ms?: number;
  model?: string;
  error?: string | null;
}

export interface SlotState {
  status: SlotStatus;
  candidates?: Candidate[];
  totalCost?: number;
  error?: string;
  /** For selection tasks: the original selected text so we can restore on cancel */
  originalText?: string;
  /** For selection tasks: doc range where the selection was */
  range?: { from: number; to: number };
  /** For selection tasks: the user's instruction */
  instruction?: string;
}

export interface SlotMatch {
  prompt: string;       // trimmed prompt text
  from: number;         // doc position of opening 【
  to: number;           // doc position right after 】
  isEditing: boolean;   // cursor currently inside this slot
}
