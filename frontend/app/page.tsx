"use client";

import { useUserStore } from "@/store/user";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import s from "./page.module.css";

/* Hand-drawn Muses pen illustration — Anthropic warm minimalism style */
function MusesIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 500" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* === Quill / Fountain Pen (terracotta filled, hand-drawn) === */}
      {/* Pen nib — bold terracotta blob */}
      <path
        d="M210 68 C218 65, 228 72, 235 92 C242 112, 248 145, 250 178 C252 211, 248 238, 240 258 C232 278, 222 285, 212 286 C202 287, 192 280, 184 260 C176 240, 170 213, 168 180 C166 147, 170 114, 178 94 C186 74, 202 71, 210 68Z"
        fill="#d97757"
      />
      {/* Pen outline (cream, bold stroke) */}
      <path
        d="M210 68 C218 65, 228 72, 235 92 C242 112, 248 145, 250 178 C252 211, 248 238, 240 258 C232 278, 222 285, 212 286 C202 287, 192 280, 184 260 C176 240, 170 213, 168 180 C166 147, 170 114, 178 94 C186 74, 202 71, 210 68Z"
        stroke="rgba(255,255,255,0.9)" strokeWidth="7" strokeLinecap="round" fill="none"
      />

      {/* Nib tip — pointed end, two bold strokes converging */}
      <path d="M200 282 C205 310, 208 335, 210 365"
        stroke="rgba(255,255,255,0.88)" strokeWidth="8" strokeLinecap="round" />
      <path d="M222 280 C218 308, 214 333, 212 363"
        stroke="rgba(255,255,255,0.88)" strokeWidth="8" strokeLinecap="round" />
      {/* Nib slit */}
      <path d="M211 290 L211 358"
        stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeLinecap="round" />

      {/* Pen barrel detail lines (grille-like, cream) */}
      <path d="M178 120 C192 116, 222 115, 240 119"
        stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round" />
      <path d="M174 155 C190 150, 224 149, 244 154"
        stroke="rgba(255,255,255,0.35)" strokeWidth="4" strokeLinecap="round" />
      <path d="M172 190 C188 185, 226 184, 246 189"
        stroke="rgba(255,255,255,0.3)" strokeWidth="4" strokeLinecap="round" />

      {/* === Ink drops (small terracotta blobs near nib) === */}
      <path d="M228 355 C234 350, 240 356, 236 364 C232 372, 224 370, 226 362 C228 358, 230 354, 228 355Z"
        fill="#d97757" />
      <path d="M188 368 C192 364, 197 368, 195 374 C193 380, 186 378, 187 372Z"
        fill="#d97757" />

      {/* === Writing lines (cream strokes — text being written) === */}
      <path d="M255 368 C268 365, 290 362, 318 366"
        stroke="rgba(255,255,255,0.5)" strokeWidth="6" strokeLinecap="round" />
      <path d="M250 392 C270 388, 305 386, 335 390"
        stroke="rgba(255,255,255,0.38)" strokeWidth="5" strokeLinecap="round" />
      <path d="M258 416 C278 412, 310 411, 328 414"
        stroke="rgba(255,255,255,0.28)" strokeWidth="4" strokeLinecap="round" />

      {/* === Decorative Squiggle (signature hand motif) === */}
      {/* Wavy M-shape — thick cream, pressure variation */}
      <path d="M72 430 C80 407, 92 435, 105 413 C118 391, 107 433, 129 415 C151 397, 135 433, 155 420"
        stroke="rgba(255,255,255,0.92)" strokeWidth="10" strokeLinecap="round" />
      {/* Loop */}
      <path d="M155 420 C172 435, 187 420, 182 403 C177 386, 159 393, 162 413"
        stroke="rgba(255,255,255,0.88)" strokeWidth="9" strokeLinecap="round" />
      {/* Tail — pressure decreasing */}
      <path d="M162 413 C177 435, 195 432, 208 445"
        stroke="rgba(255,255,255,0.82)" strokeWidth="7" strokeLinecap="round" />
      {/* Terracotta dot at loop junction */}
      <path d="M160 411 C167 405, 171 411, 165 417 C159 423, 153 417, 160 411Z"
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
