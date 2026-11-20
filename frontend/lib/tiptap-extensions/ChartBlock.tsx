/**
 * ChartBlock — a chart drawn from rows (Claude Docs: "a chart drawn from rows;
 * its numbers change only through its rows").
 *
 * Data is CSV: the first row names the columns, the first column labels each
 * x position, every other column is a numeric series (max 6). The block draws
 * a bar or line chart as plain SVG, shows its rows as a table, lets you edit
 * them, and can take its rows from the table right above it.
 *
 * Colors: the validated dark categorical slots 1–6 in fixed order (checked
 * against the editor surface var(--m-n885) with the dataviz validator). Marks follow
 * the dataviz spec: bars ≤ 24px, 4px rounded data-end, 2px surface gap; 2px
 * lines; ≥ 8px markers with a 2px surface ring; hairline solid grid; legend
 * for ≥ 2 series; hover tooltip; text never in series color.
 *
 * Serialises to <figure data-chart> holding a caption + a real <table>, so
 * published Markdown / HTML still carries the numbers.
 */
'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    chartBlock: {
      insertChart: (attrs?: { kind?: ChartKind; title?: string; csv?: string }) => ReturnType;
    };
  }
}

export type ChartKind = 'bar' | 'line';

export const SERIES_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];
const SURFACE = 'var(--m-n885)';
const GRID = 'var(--m-n800)';
const TEXT_MUTED = 'var(--m-n400)';
const TEXT_PRIMARY = 'var(--m-n200)';
const MAX_SERIES = SERIES_COLORS.length;

export const SAMPLE_CSV = '季度,收入,成本\nQ1,120,80\nQ2,150,95\nQ3,170,100\nQ4,210,120';

export interface ChartData {
  labels: string[];
  series: Array<{ name: string; values: Array<number | null> }>;
  dropped: number; // series beyond MAX_SERIES
  error?: string;
}

function splitRow(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(csv: string): ChartData {
  const lines = (csv || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { labels: [], series: [], dropped: 0, error: '至少需要表头和一行数据' };
  const delim = lines[0].includes('\t') ? '\t' : ',';
  const rows = lines.map((l) => splitRow(l, delim));
  const header = rows[0];
  if (header.length < 2) return { labels: [], series: [], dropped: 0, error: '至少需要一列标签和一列数值' };
  const names = header.slice(1);
  const kept = names.slice(0, MAX_SERIES);
  const labels = rows.slice(1).map((r) => r[0] ?? '');
  const series = kept.map((name, j) => ({
    name: name || `系列 ${j + 1}`,
    values: rows.slice(1).map((r) => {
      const v = parseFloat(String(r[j + 1] ?? '').replace(/[,，%\s]/g, ''));
      return Number.isFinite(v) ? v : null;
    }),
  }));
  if (!series.some((s) => s.values.some((v) => v !== null))) {
    return { labels, series, dropped: 0, error: '数值列里没有可读的数字' };
  }
  return { labels, series, dropped: names.length - kept.length };
}

function csvCell(s: string) {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows of a ProseMirror table node → CSV. */
export function tableNodeToCsv(table: any): string {
  const rows: string[] = [];
  table.forEach((row: any) => {
    const cells: string[] = [];
    row.forEach((cell: any) => cells.push(csvCell(cell.textContent.trim())));
    rows.push(cells.join(','));
  });
  return rows.join('\n');
}

/** Clean axis ticks: 0 / 50 / 100 … covering [lo, hi]. */
function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (lo === hi) hi = lo + 1;
  const span = hi - lo;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 1e-9; v += step) ticks.push(Number(v.toFixed(10)));
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

const fmt = (v: number) =>
  Math.abs(v) >= 10000 ? `${Number((v / 10000).toFixed(1))}万` : v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

/** A bar path: square at the baseline, 4px rounded at the data end. */
function barPath(x: number, w: number, yBase: number, yVal: number) {
  const up = yVal <= yBase;
  const h = Math.abs(yBase - yVal);
  const r = Math.min(4, w / 2, h);
  if (up) {
    return `M${x},${yBase}V${yVal + r}Q${x},${yVal} ${x + r},${yVal}H${x + w - r}Q${x + w},${yVal} ${x + w},${yVal + r}V${yBase}Z`;
  }
  return `M${x},${yBase}V${yVal - r}Q${x},${yVal} ${x + r},${yVal}H${x + w - r}Q${x + w},${yVal} ${x + w},${yVal - r}V${yBase}Z`;
}

export function ChartSvg({ data, kind }: { data: ChartData; kind: ChartKind }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const W = 640, H = 280, L = 52, R = kind === 'line' && data.series.length > 1 ? 84 : 16, T = 12, B = 34;
  const n = data.labels.length;
  const all = data.series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const ticks = niceTicks(Math.min(0, ...all), Math.max(0, ...all));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const y = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0));
  const plotW = W - L - R;
  const band = plotW / Math.max(n, 1);
  const xMid = (i: number) => L + band * i + band / 2;
  const xLine = (i: number) => (n <= 1 ? L + plotW / 2 : L + (plotW * i) / (n - 1));
  const xAt = kind === 'bar' ? xMid : xLine;
  const showEveryLabel = n <= 12;

  const nS = data.series.length;
  const GAP = 2;
  const barW = Math.max(2, Math.min(24, (band * 0.72 - GAP * (nS - 1)) / nS));
  const groupW = barW * nS + GAP * (nS - 1);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const i = kind === 'bar'
      ? Math.floor((p.x - L) / band)
      : Math.round(((p.x - L) / plotW) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };

  const tipLeft = hover === null ? 0 : (xAt(hover) / W) * 100;

  return (
    <div className="chart-plot" ref={wrapRef}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="图表" className="chart-svg">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} style={{ stroke: GRID }} strokeWidth={1} />
            <text x={L - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} style={{ fill: TEXT_MUTED }}>{fmt(t)}</text>
          </g>
        ))}
        {data.labels.map((lab, i) => (showEveryLabel || i % Math.ceil(n / 12) === 0) && (
          <text key={i} x={xAt(i)} y={H - B + 18} textAnchor="middle" fontSize={11} style={{ fill: TEXT_MUTED }}>
            {lab.length > 8 ? `${lab.slice(0, 7)}…` : lab}
          </text>
        ))}
        {kind === 'line' && hover !== null && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={T} y2={H - B} style={{ stroke: TEXT_MUTED }} strokeWidth={1} opacity={0.5} />
        )}
        {kind === 'bar' && hover !== null && (
          <rect x={L + band * hover} y={T} width={band} height={H - T - B} style={{ fill: TEXT_PRIMARY }} opacity={0.05} />
        )}

        {kind === 'bar' && data.series.map((s, j) => s.values.map((v, i) => v === null ? null : (
          <path
            key={`${j}-${i}`}
            d={barPath(xMid(i) - groupW / 2 + j * (barW + GAP), barW, y(0), y(v))}
            fill={SERIES_COLORS[j]}
          />
        )))}

        {kind === 'line' && data.series.map((s, j) => {
          const pts = s.values.map((v, i) => (v === null ? null : [xLine(i), y(v)] as const));
          const d = pts.reduce((acc, p, i) => {
            if (!p) return acc;
            const prev = i > 0 && pts[i - 1];
            return acc + `${prev ? 'L' : 'M'}${p[0]},${p[1]}`;
          }, '');
          const lastIdx = pts.map((p, i) => (p ? i : -1)).filter((i) => i >= 0).pop();
          const markAll = n <= 12;
          return (
            <g key={j}>
              <path d={d} fill="none" stroke={SERIES_COLORS[j]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => p && (markAll || i === lastIdx || i === hover) && (
                <circle key={i} cx={p[0]} cy={p[1]} r={4} fill={SERIES_COLORS[j]} style={{ stroke: SURFACE }} strokeWidth={2} />
              ))}
              {nS > 1 && nS <= 4 && lastIdx !== undefined && (
                <text x={pts[lastIdx]![0] + 8} y={pts[lastIdx]![1]} dy="0.32em" fontSize={11} style={{ fill: TEXT_PRIMARY }}>
                  {s.name.length > 8 ? `${s.name.slice(0, 7)}…` : s.name}
                </text>
              )}
            </g>
          );
        })}

        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} style={{ stroke: TEXT_MUTED }} strokeWidth={1} opacity={0.6} />
        {/* Hit area bigger than the marks: the whole plot */}
        <rect x={L} y={T} width={plotW} height={H - T - B} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${tipLeft}%` }} role="status">
          <div className="chart-tip-title">{data.labels[hover]}</div>
          {data.series.map((s, j) => (
            <div key={j} className="chart-tip-row">
              <span className="chart-swatch" style={{ background: SERIES_COLORS[j] }} />
              <span className="chart-tip-name">{s.name}</span>
              <span className="chart-tip-val">{s.values[hover] === null ? '—' : fmt(s.values[hover]!)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartView({ node, updateAttributes, deleteNode, editor, getPos, selected }: NodeViewProps) {
  const { kind, title, csv } = node.attrs as { kind: ChartKind; title: string; csv: string };
  const data = useMemo(() => parseCsv(csv), [csv]);
  const [showData, setShowData] = useState(false);
  const [draft, setDraft] = useState(csv);
  const [note, setNote] = useState<string | null>(null);

  const tableAbove = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return null;
    const before = editor.state.doc.resolve(pos).nodeBefore;
    return before?.type.name === 'table' ? before : null;
  };

  const useTableAbove = () => {
    const t = tableAbove();
    if (!t) { setNote('正上方没有表格：把图表放在表格下面再试'); return; }
    const next = tableNodeToCsv(t);
    updateAttributes({ csv: next });
    setDraft(next);
    setNote(null);
  };

  return (
    <NodeViewWrapper className={`chart-block${selected ? ' is-selected' : ''}`} contentEditable={false} data-drag-handle>
      <div className="chart-head">
        <input
          className="chart-title"
          value={title}
          placeholder="图表标题：一句话说出结论"
          onChange={(e) => updateAttributes({ title: e.target.value })}
        />
        <div className="chart-tools">
          <span className="chart-seg" role="group" aria-label="图表类型">
            <button type="button" className={kind === 'bar' ? 'on' : ''} aria-pressed={kind === 'bar'} onClick={() => updateAttributes({ kind: 'bar' })}>柱状</button>
            <button type="button" className={kind === 'line' ? 'on' : ''} aria-pressed={kind === 'line'} onClick={() => updateAttributes({ kind: 'line' })}>折线</button>
          </span>
          <button type="button" className={`chart-btn${showData ? ' on' : ''}`} onClick={() => { setShowData((v) => !v); setDraft(csv); }}>数据</button>
          <button type="button" className="chart-btn" onClick={useTableAbove} title="用正上方表格的行作为数据">用上方表格</button>
          <button type="button" className="chart-btn danger" onClick={() => deleteNode()}>删除</button>
        </div>
      </div>

      {data.series.length > 1 && (
        <div className="chart-legend">
          {data.series.map((s, j) => (
            <span key={j} className="chart-legend-item">
              <span className="chart-swatch" style={{ background: SERIES_COLORS[j] }} />{s.name}
            </span>
          ))}
        </div>
      )}

      {data.error ? <div className="chart-empty">{data.error}</div> : <ChartSvg data={data} kind={kind} />}
      {data.dropped > 0 && <div className="chart-note">最多显示 {MAX_SERIES} 个系列，其余 {data.dropped} 列未画出</div>}
      {note && <div className="chart-note">{note}</div>}

      {showData && (
        <div className="chart-data">
          {!data.error && (
            <table className="chart-table">
              <thead>
                <tr><th>{csv.split(/\r?\n/)[0]?.split(/[,\t]/)[0] || ''}</th>{data.series.map((s, j) => <th key={j}>{s.name}</th>)}</tr>
              </thead>
              <tbody>
                {data.labels.map((lab, i) => (
                  <tr key={i}><td>{lab}</td>{data.series.map((s, j) => <td key={j}>{s.values[i] === null ? '—' : fmt(s.values[i]!)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          )}
          <textarea
            className="chart-csv"
            rows={Math.min(10, Math.max(3, draft.split('\n').length + 1))}
            value={draft}
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="CSV 数据：第一行是表头，第一列是标签"
          />
          <div className="chart-data-row">
            <span className="chart-note" style={{ margin: 0 }}>第一行是表头，第一列是标签，其余列是数值（逗号或 Tab 分隔）</span>
            <button type="button" className="chart-btn primary" disabled={draft === csv} onClick={() => updateAttributes({ csv: draft })}>应用</button>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}

export const ChartBlock = Node.create({
  name: 'chartBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      kind: {
        default: 'bar',
        parseHTML: (el) => (el.getAttribute('data-kind') === 'line' ? 'line' : 'bar'),
        renderHTML: (a) => ({ 'data-kind': a.kind }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') || '',
        renderHTML: (a) => ({ 'data-title': a.title }),
      },
      csv: {
        default: SAMPLE_CSV,
        parseHTML: (el) => el.getAttribute('data-csv') || '',
        renderHTML: (a) => ({ 'data-csv': a.csv }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-chart]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    // Outside the editor (publish, export, previews) the chart reads as its rows.
    const d = parseCsv(node.attrs.csv);
    const head = (node.attrs.csv || '').split(/\r?\n/)[0]?.split(/[,\t]/)[0] || '';
    const table: any = ['table', {},
      ['thead', {}, ['tr', {}, ['th', {}, head], ...d.series.map((s) => ['th', {}, s.name])]],
      ['tbody', {}, ...d.labels.map((lab, i) => ['tr', {}, ['td', {}, lab], ...d.series.map((s) => ['td', {}, s.values[i] === null ? '' : String(s.values[i])])])],
    ];
    const children: any[] = [];
    if (node.attrs.title) children.push(['figcaption', {}, node.attrs.title]);
    if (!d.error) children.push(table);
    return ['figure', mergeAttributes(HTMLAttributes, { 'data-chart': '' }), ...children] as any;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartView);
  },

  addCommands() {
    return {
      insertChart: (attrs = {}) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { kind: attrs.kind ?? 'bar', title: attrs.title ?? '', csv: attrs.csv ?? SAMPLE_CSV } }),
    };
  },
});

export default ChartBlock;
