/**
 * useEditHistory — per-article log of AI-driven edits with revert support.
 *
 * Each record describes one accepted candidate (bracket fill, ⌘K selection
 * replace, or ⌘K selection append). The record carries enough to identify the
 * edit in the doc (`editId` matches the AiSource mark attribute), restore the
 * original text on revert (`originalText`), and surface metadata in the UI
 * (instruction, cost, model).
 *
 * Persistence: lightweight localStorage keyed by articleId. Surviving page
 * reloads matters for the "I just made a bunch of edits and want to come back
 * tomorrow" case. Capped at MAX_RECORDS per article so the store doesn't grow
 * unboundedly.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECORDS = 100;
const LS_PREFIX = "muses-edit-history:";

export type EditSource = "bracket" | "selection";
export type EditMode = "replace" | "append";

export interface EditRecord {
  id: string;
  timestamp: number;
  source: EditSource;
  /** For selection tasks. */
  instruction?: string;
  /** For brackets: the trimmed prompt text. */
  promptKey?: string;
  /** What was at the edit site before — used to restore on revert.
   *  For brackets this is `【prompt】`. For selection append this is empty. */
  originalText: string;
  /** The AI-inserted text. */
  newText: string;
  mode: EditMode;
  provider?: string;
  model?: string;
  costUsd?: number;
  reverted?: boolean;
}

function loadFromStorage(articleId: string): EditRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_PREFIX + articleId);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveToStorage(articleId: string, records: EditRecord[]) {
  try {
    localStorage.setItem(LS_PREFIX + articleId, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch {
    // Quota exceeded or storage unavailable — silently drop.
  }
}

export interface UseEditHistoryReturn {
  records: EditRecord[];
  addRecord: (rec: Omit<EditRecord, "id" | "timestamp" | "reverted">) => string;
  markReverted: (id: string) => void;
  clear: () => void;
}

let _uid = 0;
function newEditId(): string {
  // Stable across the session even if Date.now() collides.
  return `e${Date.now().toString(36)}-${(++_uid).toString(36)}`;
}

export function useEditHistory(articleId: string | null): UseEditHistoryReturn {
  const [records, setRecords] = useState<EditRecord[]>([]);
  const articleIdRef = useRef(articleId);

  // Reload from storage whenever articleId changes (different article = different log).
  useEffect(() => {
    articleIdRef.current = articleId;
    setRecords(articleId ? loadFromStorage(articleId) : []);
  }, [articleId]);

  // Persist on every change (capped, dropped silently on quota errors).
  useEffect(() => {
    if (!articleIdRef.current) return;
    saveToStorage(articleIdRef.current, records);
  }, [records]);

  const addRecord = useCallback((rec: Omit<EditRecord, "id" | "timestamp" | "reverted">): string => {
    const id = newEditId();
    const full: EditRecord = {
      ...rec,
      id,
      timestamp: Date.now(),
      reverted: false,
    };
    setRecords(prev => [full, ...prev].slice(0, MAX_RECORDS));
    return id;
  }, []);

  const markReverted = useCallback((id: string) => {
    setRecords(prev => prev.map(r => (r.id === id ? { ...r, reverted: true } : r)));
  }, []);

  const clear = useCallback(() => {
    setRecords([]);
    if (articleIdRef.current) saveToStorage(articleIdRef.current, []);
  }, []);

  return { records, addRecord, markReverted, clear };
}

/** Generate an editId without committing a record yet. Use when you need the
 *  id to embed in the AiSource mark before the record is fully formed. */
export { newEditId };
