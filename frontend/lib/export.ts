/**
 * Export the open doc tab: Markdown, standalone HTML, or PDF (the browser's
 * print dialog → "Save as PDF"). Runs in the browser on the editor's HTML, so
 * it works for DB articles and workspace files alike.
 *
 * What is exported is the text as it stands (see cleanForExport): an open
 * suggestion counts as not accepted yet (old words kept, proposed words left
 * out); comment highlights, chips and pending placeholders drop to their
 * plain text or go; a chart exports as its caption plus its data table.
 */

export type ExportFormat = 'md' | 'html' | 'pdf';

/**
 * Strip editing-only markup. Open suggestions export as the text that is in
 * the doc until someone accepts them: the struck (old) words stay, the
 * proposed (new) words are dropped.
 */
export function cleanForExport(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root')!;
  root.querySelectorAll('ins[data-suggestion-id]').forEach((el) => el.remove());
  root.querySelectorAll('del[data-suggestion-id], span[data-comment-id], span[data-date-chip], span[data-status-chip]').forEach((el) => {
    el.replaceWith(...Array.from(el.childNodes));
  });
  root.querySelectorAll('div[data-pending-block]').forEach((el) => el.remove());
  // Charts: caption (bold) + their data table.
  root.querySelectorAll('figure[data-chart]').forEach((fig) => {
    const out: Node[] = [];
    const cap = fig.querySelector('figcaption');
    if (cap?.textContent?.trim()) {
      const p = doc.createElement('p');
      const b = doc.createElement('strong');
      b.textContent = cap.textContent.trim();
      p.appendChild(b);
      out.push(p);
    }
    const table = fig.querySelector('table');
    if (table) out.push(table);
    fig.replaceWith(...out);
  });
  root.querySelectorAll('[data-line]').forEach((el) => el.removeAttribute('data-line'));
  // Paragraphs a removed suggestion left empty.
  root.querySelectorAll('p').forEach((p) => { if (!p.textContent?.trim() && !p.querySelector('img,br')) p.remove(); });
  return root.innerHTML;
}

const EXPORT_CSS = `
:root{color-scheme:light}
body{max-width:760px;margin:40px auto;padding:0 20px;font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:#1f1d1a;background:#fff}
h1{font-size:1.9em;line-height:1.25;margin:0 0 .6em}h2{font-size:1.4em;margin:1.6em 0 .5em}h3{font-size:1.15em;margin:1.3em 0 .4em}
p{margin:.6em 0}img{max-width:100%}a{color:#2a78d6}
blockquote{margin:1em 0;padding:.2em 1em;border-left:3px solid #d9d6cf;color:#57534e}
pre{background:#f5f4f1;padding:12px 14px;border-radius:6px;overflow:auto;font-size:.88em}code{font-family:"JetBrains Mono","SF Mono",Menlo,monospace}
table{border-collapse:collapse;margin:1em 0;font-size:.92em}th,td{border:1px solid #d9d6cf;padding:6px 10px;text-align:left}th{background:#f5f4f1}
figure[data-chart]{margin:1.2em 0}figure[data-chart] figcaption{font-weight:600;margin-bottom:.4em}
ul[data-type=taskList]{list-style:none;padding-left:0}ul[data-type=taskList] li{display:flex;gap:.5em}
@media print{body{margin:0;max-width:none}a{color:inherit}}
`;

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export function standaloneHtml(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

export function safeFilename(title: string) {
  return (title || 'muses-doc').replace(/[\\/:*?"<>|\n\r]+/g, ' ').trim().slice(0, 80) || 'muses-doc';
}

function download(name: string, mime: string, text: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Print an HTML document through a hidden iframe (→ "Save as PDF"). */
function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const cleanup = () => setTimeout(() => frame.remove(), 500);
  frame.onload = () => {
    const w = frame.contentWindow!;
    w.addEventListener('afterprint', cleanup);
    w.focus();
    w.print();
    setTimeout(cleanup, 60_000);
  };
  frame.srcdoc = html;
}

/** HTML → Markdown, with GFM pipe tables (plain turndown has none). */
export async function htmlToMarkdown(html: string): Promise<string> {
  const TurndownService = (await import('turndown')).default;
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' });
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ').trim();
  td.addRule('gfmTable', {
    filter: 'table',
    replacement: (_content: string, node: any) => {
      const rows: string[][] = Array.from(node.querySelectorAll('tr')).map((tr: any) =>
        Array.from(tr.children).map((c: any) => cell(td.turndown(c.innerHTML))));
      if (!rows.length) return '';
      const width = Math.max(...rows.map((r) => r.length));
      const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
      const line = (r: string[]) => `| ${pad(r).join(' | ')} |`;
      return `\n\n${line(rows[0])}\n| ${Array(width).fill('---').join(' | ')} |\n${rows.slice(1).map(line).join('\n')}\n\n`;
    },
  });
  return td.turndown(html);
}

export async function exportDoc(format: ExportFormat, opts: { title: string; html: string; toMarkdown?: (html: string) => string | Promise<string> }) {
  const body = cleanForExport(opts.html);
  const name = safeFilename(opts.title);
  if (format === 'md') {
    const md = await (opts.toMarkdown ?? htmlToMarkdown)(body);
    download(`${name}.md`, 'text/markdown', md.endsWith('\n') ? md : `${md}\n`);
  } else if (format === 'html') {
    download(`${name}.html`, 'text/html', standaloneHtml(opts.title, body));
  } else {
    printHtml(standaloneHtml(opts.title, body));
  }
}
