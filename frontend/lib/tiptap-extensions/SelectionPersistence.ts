import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { TextSelection } from '@tiptap/pm/state';

export interface SelectionPersistenceOptions {
  className: string;
  onSelectionPersist?: (info: { from: number; to: number; text: string }) => void;
  onSelectionClear?: () => void;
}

const selectionPersistKey = new PluginKey('selectionPersistence');

export const SelectionPersistence = Extension.create<SelectionPersistenceOptions>({
  name: 'selectionPersistence',

  addOptions() {
    return {
      className: 'selection-decoration',
      onSelectionPersist: undefined,
      onSelectionClear: undefined,
    };
  },

  addProseMirrorPlugins() {
    const { className, onSelectionPersist, onSelectionClear } = this.options;

    return [
      new Plugin({
        key: selectionPersistKey,

        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, decorationSet, _oldState, _newState) {
            const meta = tr.getMeta(selectionPersistKey);
            if (meta === 'clear') return DecorationSet.empty;
            if (meta && meta.decorations) return meta.decorations;
            return decorationSet.map(tr.mapping, tr.doc);
          },
        },

        props: {
          decorations(state) {
            return selectionPersistKey.getState(state);
          },

          handleDOMEvents: {
            blur(view, _event) {
              const { from, to } = view.state.selection;
              if (from === to) return false;

              const text = view.state.doc.textBetween(from, to, '\n');
              const deco = Decoration.inline(from, to, { class: className });
              const decoSet = DecorationSet.create(view.state.doc, [deco]);
              const tr = view.state.tr.setMeta(selectionPersistKey, { decorations: decoSet });
              view.dispatch(tr);

              onSelectionPersist?.({ from, to, text });
              return false;
            },

            focus(view, _event) {
              const currentDecos = selectionPersistKey.getState(view.state);
              if (!currentDecos || currentDecos === DecorationSet.empty) return false;

              // Find the decoration range to restore selection
              const decos = currentDecos.find();
              const tr = view.state.tr.setMeta(selectionPersistKey, 'clear');

              if (decos.length > 0) {
                const { from, to } = decos[0];
                try {
                  tr.setSelection(TextSelection.create(view.state.doc, from, to));
                } catch {
                  // positions invalid after doc change, just clear
                }
              }

              view.dispatch(tr);
              return false;
            },
          },
        },
      }),
    ];
  },
});

/**
 * Programmatically persist the current selection (e.g., for ⌘K shortcut).
 * Call this BEFORE moving focus away from the editor.
 */
export function persistSelection(editor: any): { from: number; to: number; text: string } | null {
  const view = editor.view;
  const { from, to } = view.state.selection;
  if (from === to) return null;

  const text = view.state.doc.textBetween(from, to, '\n');
  const deco = Decoration.inline(from, to, { class: 'selection-decoration' });
  const decoSet = DecorationSet.create(view.state.doc, [deco]);
  const tr = view.state.tr.setMeta(selectionPersistKey, { decorations: decoSet });
  view.dispatch(tr);

  return { from, to, text };
}

/**
 * Clear persisted selection decorations.
 */
export function clearPersistedSelection(editor: any): void {
  const view = editor.view;
  const tr = view.state.tr.setMeta(selectionPersistKey, 'clear');
  view.dispatch(tr);
}

export default SelectionPersistence;
