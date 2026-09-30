"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chapters, profile } from "@/data/resume";
import { motion, useMotionPaused } from "@/lib/motion";
import { useChapter, useCheckpoints, useCheckpointsLive, worldStore } from "@/lib/progress";
import { sfx, useSoundOn } from "@/lib/sfx";
import { Icon } from "./ui/Icon";

export function openQuickResume() {
  window.dispatchEvent(new CustomEvent("sjw:quick-resume"));
}

/** Move keyboard focus to a HUD checkpoint (after an in-world button makes the world travel). */
export function focusHudLevel(i: number) {
  document.querySelector<HTMLElement>(`[data-hud-level="${i}"]`)?.focus({ preventScroll: true });
}

/** Minimum distance between two checkpoint centres on the trail (px). */
const GAP = 36;

/**
 * Checkpoints sit at each level's real start, but never closer than GAP px
 * (story mode's first section is short, so on phones 1 and 2 would collide).
 */
function spread(marks: number[], width: number) {
  const n = marks.length;
  if (!width || n < 2) return marks;
  const px = marks.map((m) => m * width);
  for (let i = 1; i < n; i++) px[i] = Math.max(px[i], px[i - 1] + GAP);
  px[n - 1] = Math.min(px[n - 1], width);
  for (let i = n - 2; i >= 0; i--) px[i] = Math.min(px[i], px[i + 1] - GAP);
  if (px[0] < 0) return marks.map((_, i) => i / (n - 1));
  return px.map((p) => p / width);
}

/** Journey progress → position on the (spread) trail, piecewise between checkpoints. */
function toTrail(p: number, marks: number[], shown: number[]) {
  const n = marks.length;
  for (let i = 0; i < n - 1; i++) {
    if (p <= marks[i + 1]) {
      const t = (p - marks[i]) / Math.max(1e-6, marks[i + 1] - marks[i]);
      return shown[i] + Math.max(0, Math.min(1, t)) * (shown[i + 1] - shown[i]);
    }
  }
  const t = (p - marks[n - 1]) / Math.max(1e-6, 1 - marks[n - 1]);
  return shown[n - 1] + Math.max(0, Math.min(1, t)) * (1 - shown[n - 1]);
}

/** Game HUD: current level, a progress trail with checkpoint flags, quick actions. */
export function Hud() {
  const chapter = useChapter();
  const marks = useCheckpoints();
  const marksLive = useCheckpointsLive();
  const sound = useSoundOn();
  const still = useMotionPaused();
  const trail = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const [trailW, setTrailW] = useState(0);
  const [tipsOff, setTipsOff] = useState(false);
  const shown = useMemo(() => spread(marks, trailW), [marks, trailW]);
  const geo = useRef({ marks, shown });
  geo.current = { marks, shown };

  useEffect(() => {
    const el = trail.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrailW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const draw = (p: number) => {
      const pct = `${(toTrail(p, geo.current.marks, geo.current.shown) * 100).toFixed(2)}%`;
      if (fill.current) fill.current.style.width = pct;
      if (marker.current) marker.current.style.left = pct;
    };
    draw(worldStore.getProgress());
    return worldStore.onProgress(draw);
  }, [shown]);

  // Escape dismisses the checkpoint tooltips until the pointer or focus moves again (WCAG 1.4.13)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTipsOff(true);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const c = chapters[chapter];
  const iconBtn =
    "hidden min-h-11 min-w-11 place-items-center rounded-xl border-2 border-white/60 bg-white/10 transition hover:bg-white/20 sm:grid";
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-[60] px-3 pt-3 sm:px-5">
      {/* Level changes, announced once (visible label is decorative). */}
      <p className="sr-only" aria-live="polite">
        Level {c.level}: {c.name}
      </p>
      <div className="pointer-events-auto mx-auto flex max-w-[1400px] items-center gap-2.5 rounded-2xl border-2 border-white/70 bg-ink/75 px-2.5 py-2 text-ice-50 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md sm:gap-5 sm:px-4">
        <button
          type="button"
          data-hud-level="home"
          onClick={() => worldStore.goTo(0)}
          className="flex shrink-0 items-center gap-2.5 rounded-xl pr-1 text-left"
          aria-label={`${profile.shortName} World, back to the start`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sayed-avatar.webp"
            alt=""
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-xl border-2 border-white bg-ice-600 object-cover shadow-[0_3px_0_#0a5a94]"
          />
          {/* fixed width, so the trail never jumps sideways when the level name changes */}
          <span className="hidden w-[12.75rem] leading-tight md:block" aria-hidden="true">
            <span className="block font-display text-[15px] tracking-wide">{profile.shortName} World</span>
            <span className="block truncate text-[12px] font-extrabold tracking-[0.08em] text-ice-200 uppercase">
              Level <span className="tabular-nums">{c.level}</span> · {c.name}
            </span>
          </span>
        </button>

        {/* progress trail with checkpoints at each level's real start */}
        <nav
          aria-label="Levels"
          className="relative mx-2 min-w-0 flex-1"
          onPointerOver={() => tipsOff && setTipsOff(false)}
          onFocus={() => tipsOff && setTipsOff(false)}
        >
          {/* very narrow phones: no room for five checkpoints, so the level's name sits over a plain progress bar */}
          <p aria-hidden="true" className="mb-1 hidden truncate text-[12px] font-extrabold text-ice-100 max-[400px]:block">{c.name}</p>
          <div ref={trail} className="relative h-2.5 rounded-full bg-white/15">
            <div ref={fill} className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-ice-300 via-ice-200 to-white" style={{ width: "0%" }} />
            <div
              ref={marker}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gold shadow-[0_0_12px_#ffbb33]"
              style={{ left: "0%" }}
            />
          </div>
          {/* the markers fade in once the world (or story mode) has placed them, so they never jump at load */}
          <ol className={`absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 transition-opacity duration-300 max-[400px]:hidden ${marksLive ? "opacity-100" : "opacity-0"}`}>
            {chapters.map((ch, i) => (
              <li key={ch.id} className="absolute -translate-x-1/2" style={{ left: `${((shown[i] ?? i / (chapters.length - 1)) * 100).toFixed(2)}%` }}>
                <button
                  type="button"
                  data-hud-level={i}
                  onClick={() => worldStore.goTo(i)}
                  aria-label={`Go to level ${ch.level}: ${ch.name} (${ch.contents})`}
                  aria-current={i === chapter ? "step" : undefined}
                  className={`group relative grid size-6 -translate-y-1/2 place-items-center rounded-lg border-2 font-display text-[12px] sm:size-7 sm:text-[13px] transition-all duration-200 before:absolute before:-inset-2 before:content-[''] hover:scale-110 ${
                    i <= chapter ? "border-white bg-ice-600 text-white" : "border-white/50 bg-ink-2 text-ice-100"
                  } ${i === chapter ? "scale-110 shadow-[0_0_0_3px_rgba(143,211,255,0.45)]" : ""}`}
                >
                  {i === chapters.length - 1 ? <Icon name="flag" weight="fill" className="size-3.5" /> : ch.level}
                  <span
                    aria-hidden="true"
                    className={`absolute top-[calc(100%+22px)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/25 bg-ink px-2.5 py-1 text-center shadow-lg text-[12px] font-bold text-ice-50 opacity-0 transition-opacity lg:block ${
                      tipsOff ? "" : "group-hover:opacity-100 group-focus-visible:opacity-100"
                    }`}
                  >
                    {ch.name}
                    <span className="block font-sans text-[11px] font-semibold text-ice-200">{ch.contents}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={motion.toggle}
            aria-pressed={still}
            aria-label="Pause animations"
            title={still ? "Play the ambient animations" : "Pause the ambient animations"}
            // on phones too (WCAG 2.2.2): the snowfall and ambient loops run there as well
            className={iconBtn.replace("hidden ", "grid ").replace(" sm:grid", "")}
          >
            <Icon name={still ? "play" : "pause"} weight="fill" className="size-4" />
          </button>
          <button type="button" onClick={sfx.toggle} aria-pressed={sound} aria-label="Sound effects" title={sound ? "Mute sound effects" : "Play sound effects"} className={iconBtn}>
            <Icon name={sound ? "speaker-on" : "speaker-off"} className="size-4" />
          </button>
          <button
            type="button"
            onClick={openQuickResume}
            className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-white/60 bg-white/10 px-3 py-1.5 text-sm font-bold transition hover:bg-white/20"
          >
            <Icon name="list" className="size-4" />
            <span className="sr-only sm:not-sr-only">Quick resume</span>
          </button>
          <a
            href={profile.cvHref}
            download
            className="flex min-h-11 items-center gap-2 rounded-xl border-2 border-white bg-flag px-3 py-1.5 text-sm font-bold text-white shadow-[0_3px_0_#a8141c] transition hover:brightness-110"
          >
            <Icon name="download" className="size-4" />
            <span className="sr-only sm:not-sr-only">
              CV<span className="sr-only"> (PDF download)</span>
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
