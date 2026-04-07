"use client";

import { useUserStore } from "@/store/user";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import s from "./page.module.css";

/* Hand-drawn Muses pen + paper illustration — Anthropic warm minimalism style */
function MusesIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* === Paper / Notepad — tilted, hand-drawn rectangle === */}
      <g transform="rotate(-6, 200, 220)">
        {/* Paper fill — subtle terracotta tint */}
        <path
          d="M95 72 C155 66, 275 64, 325 70 C332 140, 335 280, 330 380 C270 388, 150 390, 92 384 C86 280, 84 140, 95 72Z"
          fill="rgba(217,119,87,0.08)"
        />
        {/* Paper outline — bold white */}
        <path
          d="M95 72 C155 66, 275 64, 325 70 C332 140, 335 280, 330 380 C270 388, 150 390, 92 384 C86 280, 84 140, 95 72Z"
          stroke="rgba(255,255,255,0.9)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        {/* Page fold — corner detail */}
        <path
          d="M290 68 C295 68, 322 65, 325 70 C326 78, 326 95, 324 108 C312 100, 298 92, 290 88 C290 80, 290 72, 290 68Z"
          fill="rgba(217,119,87,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="3" strokeLinecap="round"
        />

        {/* === Written lines on paper (animated — stroke-dasharray drawing effect) === */}
        {/* Line 1 */}
        <path
          d="M130 130 C165 126, 245 125, 290 129"
          stroke="rgba(255,255,255,0.55)" strokeWidth="6" strokeLinecap="round"
          className={`${s.writingLine} ${s.writingLine1}`}
        />
        {/* Line 2 */}
        <path
          d="M128 170 C170 166, 260 165, 295 169"
          stroke="rgba(255,255,255,0.45)" strokeWidth="5" strokeLinecap="round"
          className={`${s.writingLine} ${s.writingLine2}`}
        />
        {/* Line 3 */}
        <path
          d="M132 210 C168 207, 240 206, 280 210"
          stroke="rgba(255,255,255,0.4)" strokeWidth="5" strokeLinecap="round"
          className={`${s.writingLine} ${s.writingLine3}`}
        />
        {/* Line 4 — shorter, paragraph end */}
        <path
          d="M130 250 C155 247, 200 246, 225 249"
          stroke="rgba(255,255,255,0.35)" strokeWidth="5" strokeLinecap="round"
          className={`${s.writingLine} ${s.writingLine4}`}
        />
        {/* Line 5 */}
        <path
          d="M128 298 C168 294, 255 293, 292 297"
          stroke="rgba(255,255,255,0.45)" strokeWidth="5" strokeLinecap="round"
          className={`${s.writingLine} ${s.writingLine5}`}
        />
        {/* Line 6 — shorter, trailing off */}
        <path
          d="M132 338 C158 335, 210 334, 248 337"
          stroke="rgba(255,255,255,0.35)" strokeWidth="5" strokeLinecap="round"
          className={`${s.writingLine} ${s.writingLine6}`}
        />
      </g>

      {/* === Pen — angled as if writing, terracotta fill + white outline === */}
      <g>
        {/* Pen barrel — bold terracotta, angled ~40 degrees */}
        <path
          d="M280 130 C284 126, 290 128, 292 132 L338 310 C340 318, 336 322, 330 320 L318 316 C312 314, 310 310, 312 304 L280 130Z"
          fill="#d97757"
        />
        {/* Pen barrel outline */}
        <path
          d="M280 130 C284 126, 290 128, 292 132 L338 310 C340 318, 336 322, 330 320 L318 316 C312 314, 310 310, 312 304 L280 130Z"
          stroke="rgba(255,255,255,0.9)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
        {/* Pen grip band */}
        <path d="M314 278 C318 274, 332 284, 328 288"
          stroke="rgba(255,255,255,0.5)" strokeWidth="4" strokeLinecap="round" />
        <path d="M312 268 C316 264, 330 274, 326 278"
          stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
        {/* Pen nib — pointed tip touching paper */}
        <path
          d="M280 130 C278 125, 273 118, 268 108 C265 102, 272 98, 276 104 C279 110, 282 120, 285 128"
          fill="#d97757" stroke="rgba(255,255,255,0.85)" strokeWidth="4" strokeLinecap="round"
        />
        {/* Nib slit */}
        <path d="M274 112 L280 130"
          stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* === Ink dot — where pen meets paper === */}
      <path d="M266 106 C270 102, 275 106, 273 110 C271 114, 264 112, 266 106Z"
        fill="#d97757" />

      {/* === Decorative Squiggle (signature Anthropic hand motif) === */}
      {/* Wavy M-shape — thick cream, pressure variation */}
      <path d="M62 430 C70 407, 82 435, 95 413 C108 391, 97 433, 119 415 C141 397, 125 433, 145 420"
        stroke="rgba(255,255,255,0.92)" strokeWidth="10" strokeLinecap="round" />
      {/* Loop */}
      <path d="M145 420 C162 435, 177 420, 172 403 C167 386, 149 393, 152 413"
        stroke="rgba(255,255,255,0.88)" strokeWidth="9" strokeLinecap="round" />
      {/* Tail — pressure decreasing */}
      <path d="M152 413 C167 435, 185 432, 198 445"
        stroke="rgba(255,255,255,0.82)" strokeWidth="7" strokeLinecap="round" />
      {/* Terracotta dot at loop junction */}
      <path d="M150 411 C157 405, 161 411, 155 417 C149 423, 143 417, 150 411Z"
        fill="#d97757" />
    </svg>
  );
}

/* GitHub mark SVG */
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  );
}

/* Google "G" logo SVG */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export default function HomePage() {
  const { user, isLoading, login, loginWithGoogle, checkAuth } = useUserStore();
  const router = useRouter();

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && user) router.push("/dashboard");
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className={s.loadingScene}>
        <div className={s.spinner} />
      </div>
    );
  }

  return (
    <div className={s.scene}>
      <div className={s.glow} />
      <div className={s.card}>
        <MusesIllustration className={s.illustration} />
        <h1 className={s.title}>Muses</h1>
        <p className={s.tagline}>Read to Inspire, Create to Shine</p>
        <button onClick={login} className={s.loginBtn}>
          <GitHubIcon className={s.githubIcon} />
          Sign in with GitHub
        </button>
        <button onClick={loginWithGoogle} className={`${s.loginBtn} ${s.googleBtn}`}>
          <GoogleIcon className={s.githubIcon} />
          Sign in with Google
        </button>
        <p className={s.subtitle}>开始您的创作之旅</p>
        <div className={s.guestRow}>
          <button onClick={() => router.push("/dashboard")} className={s.guestLink}>
            以访客身份浏览
          </button>
        </div>
      </div>
      <div className={s.footer}>Muses — AI-powered writing studio</div>
    </div>
  );
}
