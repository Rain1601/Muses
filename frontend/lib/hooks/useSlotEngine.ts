/**
 * useSlotEngine — manages the lifecycle of prompt-driven tasks in an editor.
 *
 * Two kinds of tasks share this engine:
 *   - bracket slots: 【prompt】 in the doc, fired when cursor leaves them
 *   - selection tasks (⌘K): a synthetic "slot" created on demand from a
 *     selected range + a user-typed instruction
 *
 * Both ultimately produce {candidates, status} keyed by some string id, which
 * the host UI renders through the same CandidatePopover.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { extractSlotsFromDoc } from "@/lib/tiptap-extensions/PromptSlot";
import type { SlotState, SlotStatus, Candidate } from "@/lib/tiptap-extensions/PromptSlot";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const SLOT_DEBOUNCE_MS = 800;
const CONTEXT_CHARS = 600;
const TOKEN_LS_KEY = "muses_token";

interface FireOpts {
  /** What the model should do. For brackets, this is the bracket content. For ⌘K, it's the instruction prepended to the selection. */
  prompt: string;
  contextBefore?: string;
  contextAfter?: string;
  provider?: string;
  model?: string;
  n?: number;
}

export interface UseSlotEngineReturn {
  slots: Map<string, SlotState>;
  fireSlot: (key: string, opts: FireOpts) => Promise<void>;
  updateSlot: (key: string, patch: Partial<SlotState>) => void;
  clearSlot: (key: string) => void;
  /** Get a stable accessor for the slot map (for plugin getState). */
  getStateRef: () => Map<string, SlotState>;
}

export function useSlotEngine(editor: Editor | null, opts?: {
  provider?: string;
  model?: string;
  autoFireBrackets?: boolean;  // default true; set false to disable bracket-watching
}): UseSlotEngineReturn {
  const provider = opts?.provider ?? "local:claude";
  const model = opts?.model ?? "sonnet";
  const autoFire = opts?.autoFireBrackets ?? true;

  const [slotMap, setSlotMap] = useState<Map<string, SlotState>>(new Map());
  const slotMapRef = useRef(slotMap);
  useEffect(() => { slotMapRef.current = slotMap; }, [slotMap]);

  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const updateSlot = useCallback((key: string, patch: Partial<SlotState>) => {
    setSlotMap(prev => {
      const next = new Map(prev);
      const cur = prev.get(key) ?? { status: "idle" as SlotStatus };
      next.set(key, { ...cur, ...patch });
      return next;
    });
  }, []);

  const clearSlot = useCallback((key: string) => {
    setSlotMap(prev => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const fireSlot = useCallback(async (key: string, fireOpts: FireOpts) => {
    updateSlot(key, { status: "pending", error: undefined });
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_LS_KEY) : null;
      const res = await fetch(`${API_BASE}/api/slot-fill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: fireOpts.prompt,
          context_before: fireOpts.contextBefore ?? "",
          context_after: fireOpts.contextAfter ?? "",
          n_candidates: fireOpts.n ?? 3,
          provider: fireOpts.provider ?? provider,
          model: fireOpts.model ?? model,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${t.slice(0, 200)}`);
      }
      const data = await res.json() as { candidates: Candidate[]; total_cost_usd: number };
      updateSlot(key, {
        status: "ready",
        candidates: data.candidates,
        totalCost: data.total_cost_usd,
      });
    } catch (e) {
      updateSlot(key, {
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }, [provider, model, updateSlot]);

  // ── Auto-watch brackets in the doc ───────────────────────
  useEffect(() => {
    if (!editor || !autoFire) return;
    const onUpdate = () => {
      const cursor = editor.state.selection.from;
      const slots = extractSlotsFromDoc(editor.state.doc, cursor);

      const seen = new Set<string>();
      for (const slot of slots) {
        seen.add(slot.prompt);
        if (slot.isEditing) continue;
        const cur = slotMapRef.current.get(slot.prompt);
        if (cur && cur.status !== "idle") continue;
        const existing = debounceRef.current.get(slot.prompt);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          debounceRef.current.delete(slot.prompt);
          const cursor2 = editor.state.selection.from;
          const slots2 = extractSlotsFromDoc(editor.state.doc, cursor2);
          const still = slots2.find(x => x.prompt === slot.prompt);
          if (!still || still.isEditing) return;
          // Build context from surrounding text.
          const fullText = editor.getText();
          const occIdx = fullText.indexOf(`【${slot.prompt}】`);
          const ctxFrom = occIdx >= 0 ? occIdx : 0;
          const ctxTo = occIdx >= 0 ? occIdx + slot.prompt.length + 2 : 0;
          const before = fullText.slice(Math.max(0, ctxFrom - CONTEXT_CHARS), ctxFrom);
          const after = fullText.slice(ctxTo, Math.min(fullText.length, ctxTo + CONTEXT_CHARS));
          void fireSlot(slot.prompt, {
            prompt: slot.prompt,
            contextBefore: before,
            contextAfter: after,
          });
        }, SLOT_DEBOUNCE_MS);
        debounceRef.current.set(slot.prompt, t);
      }

      // GC bracket-scoped slots that no longer exist in the doc.
      // Selection-task slots are NOT bracket-scoped — their keys start with "sel:"
      // and we leave them alone here.
      const map = slotMapRef.current;
      const toDrop: string[] = [];
      map.forEach((_, k) => {
        if (k.startsWith("sel:")) return;
        if (!seen.has(k)) toDrop.push(k);
      });
      if (toDrop.length) {
        setSlotMap(prev => {
          const next = new Map(prev);
          toDrop.forEach(k => next.delete(k));
          return next;
        });
      }
    };

    editor.on("update", onUpdate);
    editor.on("selectionUpdate", onUpdate);
    onUpdate();
    return () => {
      editor.off("update", onUpdate);
      editor.off("selectionUpdate", onUpdate);
    };
  }, [editor, autoFire, fireSlot]);

  return {
    slots: slotMap,
    fireSlot,
    updateSlot,
    clearSlot,
    getStateRef: () => slotMapRef.current,
  };
}
