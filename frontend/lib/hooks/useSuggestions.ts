'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  acceptSuggestion, listSuggestions, rejectSuggestion, revealSuggestion, type SuggestionInfo,
} from '@/lib/tiptap-extensions/Suggestion';

/** Open suggestions in the doc (derived from its marks), with accept / reject. */
export function useSuggestions(editor: any) {
  const [items, setItems] = useState<SuggestionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor || editor.isDestroyed) { setItems([]); return; }
    const refresh = () => setItems(listSuggestions(editor));
    refresh();
    editor.on('update', refresh);
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-suggestion-id]') as HTMLElement | null;
      if (el) setActiveId(el.getAttribute('data-suggestion-id'));
    };
    const dom = editor.view.dom as HTMLElement;
    dom.addEventListener('click', onClick);
    return () => { editor.off('update', refresh); dom.removeEventListener('click', onClick); };
  }, [editor]);

  const ok = () => editor && !editor.isDestroyed;
  const accept = useCallback((id: string) => { if (ok()) acceptSuggestion(editor, id); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps
  const reject = useCallback((id: string) => { if (ok()) rejectSuggestion(editor, id); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps
  const acceptAll = useCallback(() => { if (ok()) for (const s of listSuggestions(editor)) acceptSuggestion(editor, s.id); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps
  const rejectAll = useCallback(() => { if (ok()) for (const s of listSuggestions(editor)) rejectSuggestion(editor, s.id); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps
  const reveal = useCallback((id: string) => { setActiveId(id); if (ok()) revealSuggestion(editor, id); }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  return { items, activeId, setActiveId, accept, reject, acceptAll, rejectAll, reveal };
}

export type SuggestionsApi = ReturnType<typeof useSuggestions>;
