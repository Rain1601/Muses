'use client';

/**
 * MusesMark — the landing illustration, hand-drawn and classical: a parchment
 * scroll with an illuminated "M", lines of handwriting, a quill finishing the
 * last line, an inkwell and a laurel sprig (the Muses' emblem). A roughness
 * filter gives every stroke a slight pen wobble. Ink follows the --m-*
 * palette (light / dark); terracotta is the accent. Hover replays the
 * writing; reduced motion shows the finished frame.
 */
import { useEffect, useId, useState } from 'react';
import s from './MusesMark.module.css';

/** A wavy "handwriting" stroke from x0 for `len` px at baseline y (deterministic wobble). */
function script(x0: number, y: number, len: number, seed: number) {
  let d = `M${x0} ${y}`;
  let x = x0;
  let i = 0;
  while (x < x0 + len) {
    const step = 7 + ((seed * 7 + i * 13) % 5);         // 7–11 px per stroke
    const up = i % 2 === 0 ? -(3 + ((seed + i) % 3)) : 2 + ((seed * 3 + i) % 2);
    d += ` q${(step / 2).toFixed(1)} ${up} ${step} ${i % 3 === 2 ? 0.6 : 0}`;
    x += step;
    i++;
  }
  return d;
}

const LINES = [
  { x: 84, y: 72, len: 70 },
  { x: 84, y: 90, len: 66 },
  { x: 64, y: 108, len: 90 },
  { x: 64, y: 126, len: 84 },
  { x: 64, y: 144, len: 56 }, // the quill is finishing this one
];

/** Laurel leaves along the sprig: [x, y, angle] */
const LEAVES: Array<[number, number, number]> = [
  [52, 196, -150], [60, 204, 40], [74, 194, -160], [84, 203, 25],
  [98, 194, -170], [110, 202, 10], [124, 195, -185], [136, 200, -5],
];

export default function MusesMark({ className }: { className?: string }) {
  const rough = `muses-rough-${useId().replace(/:/g, '')}`;
  const [run, setRun] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDone(false);
    const t = setTimeout(() => setDone(true), 4200);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <svg
      key={run}
      viewBox="0 0 260 230"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${s.mark} ${className ?? ''}`}
      role="img"
      aria-label="Muses：羊皮纸卷、羽毛笔与月桂"
      onMouseEnter={() => { if (done) setRun((n) => n + 1); }}
    >
      <defs>
        {/* Pen wobble: displaces every stroke a little, like ink on paper */}
        <filter id={rough} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.4" />
        </filter>
      </defs>

      <circle cx="122" cy="112" r="98" className={s.halo} />

      <g filter={`url(#${rough})`}>
        {/* ── Scroll ── */}
        <g className={s.scroll}>
          <path d="M50 50 C70 47, 150 47, 170 50 L172 172 C150 175, 70 175, 48 172 Z" className={s.parchment} />
          {/* side edges, slightly uneven */}
          <path d="M50 50 C47 92, 53 132, 48 172" pathLength={1} className={`${s.ink} ${s.edge}`} />
          <path d="M170 50 C173 96, 167 136, 172 172" pathLength={1} className={`${s.ink} ${s.edge}`} />
          {/* top roll + curl */}
          <path d="M42 46 C42 36, 178 36, 178 46 C178 56, 42 56, 42 46 Z" className={s.roll} />
          <path d="M42 46 C42 36, 178 36, 178 46 C178 56, 42 56, 42 46 Z" pathLength={1} className={`${s.ink} ${s.edge}`} />
          <path d="M42 46 C35 46, 34 55, 41 56 C46 56, 46 50, 42 50" className={`${s.ink} ${s.thin}`} />
          {/* bottom roll + curl */}
          <path d="M40 176 C40 166, 180 166, 180 176 C180 186, 40 186, 40 176 Z" className={s.roll} />
          <path d="M40 176 C40 166, 180 166, 180 176 C180 186, 40 186, 40 176 Z" pathLength={1} className={`${s.ink} ${s.edge}`} />
          <path d="M180 176 C187 176, 188 167, 181 166 C176 166, 176 172, 180 172" className={`${s.ink} ${s.thin}`} />
        </g>

        {/* ── Illuminated capital M ── */}
        <path d="M62 94 L64 66 L71 82 L78 66 L80 94" pathLength={1} className={`${s.initial} ${s.write}`} style={{ animationDelay: '0.8s' }} />
        <path d="M58 94 H67 M75 94 H84" className={`${s.initial} ${s.serif}`} />
        <circle cx="71" cy="60" r="2" className={s.initialDot} />

        {/* ── Handwriting ── */}
        {LINES.map((l, i) => (
          <path
            key={l.y}
            d={script(l.x, l.y, l.len, i + 2)}
            pathLength={1}
            className={`${s.ink} ${s.hand} ${s.write}`}
            style={{ animationDelay: `${1.15 + i * 0.42}s` }}
          />
        ))}

        {/* ── Inkwell ── */}
        <g className={s.inkwell}>
          <path d="M190 166 C186 182, 190 194, 206 195 C222 194, 226 182, 222 166 Z" className={s.wellBody} />
          <path d="M190 166 C186 182, 190 194, 206 195 C222 194, 226 182, 222 166" className={`${s.ink} ${s.thin}`} />
          <path d="M192 166 C192 159, 220 159, 220 166 C220 172, 192 172, 192 166 Z" className={`${s.ink} ${s.thin} ${s.wellRim}`} />
          <path d="M196 178 C196 184, 198 187, 201 188" className={`${s.thin} ${s.shine}`} />
        </g>

        {/* ── Quill (nib at the end of the last line) ── */}
        <g className={s.quill}>
          <path d="M122 144 C146 112, 186 64, 236 22 C226 52, 200 86, 166 116 C152 126, 138 136, 122 144 Z" className={s.vane} />
          <path d="M122 144 C146 112, 186 64, 236 22" className={`${s.ink} ${s.shaft}`} />
          {/* barbs */}
          <path d="M150 108 l-4 9 M162 95 l-5 10 M175 81 l-5 11 M188 67 l-5 11 M201 54 l-4 10 M214 42 l-3 9 M156 101 l11 2 M170 88 l12 1 M184 74 l12 0 M198 60 l11 -1"
            className={`${s.ink} ${s.barb}`} />
          {/* nib */}
          <path d="M122 144 L126 134 L131 138 Z" className={s.nib} />
        </g>

        {/* ── Laurel sprig ── */}
        <path d="M44 200 C70 192, 110 192, 146 199" pathLength={1} className={`${s.laurelStem} ${s.write}`} style={{ animationDelay: '3.1s' }} />
        {LEAVES.map(([x, y, a], i) => (
          <path
            key={i}
            d="M0 0 C4 -5 12 -5 16 0 C12 5 4 5 0 0 Z"
            transform={`translate(${x} ${y}) rotate(${a})`}
            className={s.leaf}
            style={{ animationDelay: `${3.3 + i * 0.08}s` }}
          />
        ))}
        <circle cx="149" cy="199" r="2.4" className={s.berry} />
      </g>
    </svg>
  );
}
