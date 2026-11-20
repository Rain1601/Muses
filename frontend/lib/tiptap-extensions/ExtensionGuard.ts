/**
 * ExtensionGuard — keeps browser extensions (translators, grammar checkers…)
 * from writing into the document.
 *
 * A page cannot list or disable extensions, but it can:
 *   1. opt out — the editor root carries the attributes the common ones honour
 *      (translate="no" / .notranslate, data-gramm, data-lt-active…), set in
 *      NotionEditor's editorProps.attributes;
 *   2. refuse to save their DOM — ProseMirror reads DOM mutations back into
 *      the doc as if the user typed them; the `domParser` prop below ignores
 *      known extension nodes, so injected translations never reach the doc;
 *   3. detect and remove — a MutationObserver names the extension, removes its
 *      nodes from the editor and fires EXTENSION_BLOCKED_EVENT for a notice.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { DOMParser as PMDOMParser, type TagParseRule } from '@tiptap/pm/model';

export const EXTENSION_BLOCKED_EVENT = 'muses:extension-blocked';

/** Root attributes that ask well-known extensions to leave the editor alone. */
export const EXTENSION_OPT_OUT_ATTRS: Record<string, string> = {
  translate: 'no',
  'data-gramm': 'false',
  'data-gramm_editor': 'false',
  'data-enable-grammarly': 'false',
  'data-lt-active': 'false',
};

interface Signature { name: string; selector: string; attrPrefix?: string }

const SIGNATURES: Signature[] = [
  {
    name: '沉浸式翻译',
    selector: '[data-immersive-translate-translation-element-mark], .immersive-translate-target-wrapper, [class*="immersive-translate-"]',
    attrPrefix: 'data-immersive-translate',
  },
  { name: 'Grammarly', selector: 'grammarly-extension, grammarly-desktop-integration, [data-grammarly-part]', attrPrefix: 'data-gr-' },
  { name: 'LanguageTool', selector: 'lt-mirror, lt-highlighter, lt-toolbar, lt-div', attrPrefix: 'data-lt-tmp-id' },
  { name: 'DeepL', selector: 'deepl-input-controller, [class*="dl-translator"]' },
  { name: '划词/翻译插件', selector: '[class*="kiss-translator"], [class*="trancy"], [class*="openai-translator"], [class*="sider-"]' },
];

const ALL_SELECTOR = SIGNATURES.map((s) => s.selector).join(', ');

/** Which extension (if any) produced this element. Hyphenated tags are never ours. */
function identify(el: Element): string | null {
  for (const sig of SIGNATURES) {
    if (el.matches(sig.selector)) return sig.name;
    if (sig.attrPrefix && Array.from(el.attributes).some((a) => a.name.startsWith(sig.attrPrefix!))) return sig.name;
  }
  if (el.tagName.includes('-')) return `未知插件（<${el.tagName.toLowerCase()}>）`;
  return null;
}

const IGNORE_RULES: TagParseRule[] = [
  ...SIGNATURES.flatMap((s) => s.selector.split(',').map((tag) => ({ tag: tag.trim(), ignore: true, priority: 1000 }))),
];

export const ExtensionGuard = Extension.create({
  name: 'extensionGuard',

  addProseMirrorPlugins() {
    const schema = this.editor.schema;
    const base = PMDOMParser.fromSchema(schema);
    const guardedParser = new PMDOMParser(schema, [...IGNORE_RULES, ...base.rules]);

    return [
      new Plugin({
        key: new PluginKey('extensionGuard'),
        props: { domParser: guardedParser },
        view(view) {
          const reported = new Set<string>();
          const report = (name: string) => {
            if (reported.has(name)) return;
            reported.add(name);
            console.warn(`[Muses] 已拦截浏览器插件对编辑器的改动：${name}`);
            window.dispatchEvent(new CustomEvent(EXTENSION_BLOCKED_EVENT, { detail: { name } }));
          };

          const sweep = (root: Element) => {
            const hits: Element[] = [];
            if (root !== view.dom) { if (identify(root)) hits.push(root); }
            root.querySelectorAll(ALL_SELECTOR).forEach((el) => hits.push(el));
            root.querySelectorAll('*').forEach((el) => { if (el.tagName.includes('-')) hits.push(el); });
            for (const el of hits) {
              const name = identify(el);
              if (!name) continue;
              // ProseMirror often redraws first and the node is already gone — still report it.
              report(name);
              if (el.isConnected && view.dom.contains(el)) el.remove();
            }
          };

          const observer = new MutationObserver((records) => {
            for (const r of records) {
              if (r.type === 'attributes' && r.target instanceof Element && r.attributeName) {
                const sig = SIGNATURES.find((s) => s.attrPrefix && r.attributeName!.startsWith(s.attrPrefix));
                // Only report: stripping its marker would make the extension re-walk the node forever.
                if (sig) report(sig.name);
                continue;
              }
              r.addedNodes.forEach((n) => { if (n instanceof Element) sweep(n); });
            }
          });
          observer.observe(view.dom, { childList: true, subtree: true, attributes: true });
          sweep(view.dom);

          return { destroy: () => observer.disconnect() };
        },
      }),
    ];
  },
});

export default ExtensionGuard;
