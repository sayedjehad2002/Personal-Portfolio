"use client";

import { useEffect, useRef, useState } from "react";
import { profile } from "@/data/resume";
import { worldStore } from "@/lib/progress";
import { Hud } from "./Hud";
import { QuickResumeDialog, ResumeText } from "./QuickResume";
import { SmoothScroll } from "./SmoothScroll";
import { Snow } from "./Snow";
import { StoryMode } from "./story/StoryMode";
import { FirstFrame } from "./world/FirstFrame";
import { StoryFirstFrame } from "./story/StoryMode";
import { WorldStage } from "./world/WorldStage";

type Mode = "world" | "story";

/**
 * Picks the experience for this device:
 *  - world: the horizontal side-scroller (landscape screens ≥ 768px wide)
 *  - story: vertical scrollytelling (phones, portrait tablets, reduced motion)
 */
function useMode(): Mode | null {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    const world = window.matchMedia("(min-width: 768px) and (min-height: 560px) and (min-aspect-ratio: 23/20)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cur: Mode | null = null;
    const pick = () => {
      const next: Mode = world.matches && !reduce.matches ? "world" : "story";
      // switching modes (e.g. rotating a tablet) keeps your level, with no intro replay
      if (cur && cur !== next) worldStore.holdForSwitch();
      cur = next;
      setMode(next);
    };
    pick();
    world.addEventListener("change", pick);
    reduce.addEventListener("change", pick);
    return () => {
      world.removeEventListener("change", pick);
      reduce.removeEventListener("change", pick);
    };
  }, []);
  return mode;
}

export function Experience() {
  const mode = useMode();
  const [quick, setQuick] = useState(false);
  // the static opening shot stays until the live world has drawn its first frame, then fades out
  const [worldUp, setWorldUp] = useState(false);
  const [firstGone, setFirstGone] = useState(false);
  useEffect(() => {
    if (!worldUp) return;
    const t = setTimeout(() => setFirstGone(true), 350);
    return () => clearTimeout(t);
  }, [worldUp]);
  // phones: the static level-1 opening stays until story mode has mounted under it
  const [storyUp, setStoryUp] = useState(false);
  useEffect(() => {
    if (mode !== "story") return;
    const t = setTimeout(() => setStoryUp(true), 60);
    return () => clearTimeout(t);
  }, [mode]);
  const first = useRef(true);

  useEffect(() => {
    const open = () => setQuick(true);
    window.addEventListener("sjw:quick-resume", open);
    return () => window.removeEventListener("sjw:quick-resume", open);
  }, []);

  // First load starts at the top (a mode switch resumes at your level: see worldStore.holdForSwitch).
  useEffect(() => {
    if (!mode || !first.current) return;
    first.current = false;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, [mode]);

  return (
    <SmoothScroll>
      <nav aria-label="Skip">
        <a
          href="#quick-resume"
          onClick={(e) => {
            e.preventDefault();
            setQuick(true);
          }}
          className="sr-only-focusable fixed left-4 top-4 z-[100] rounded-xl bg-gold px-4 py-2 font-bold text-ink"
        >
          Skip the game: open the text resume
        </a>
      </nav>
      <Hud />
      <main id="main">
        <h1 className="sr-only">{profile.name}: interactive resume</h1>
        {mode === "world" && (
          // The whole resume for screen readers; the visual world below repeats it as a game.
          <section className="sr-only" aria-label="Resume">
            <ResumeText headingLevel={2} tabbable={false} />
          </section>
        )}
        {mode === "world" ? <WorldStage key="world" onReady={() => setWorldUp(true)} /> : mode === "story" ? <StoryMode /> : null}
      </main>
      {mode !== "story" && !firstGone && <FirstFrame leaving={worldUp} />}
      {mode !== "world" && !storyUp && <StoryFirstFrame />}
      <Snow className="fixed inset-0 z-[55] h-full w-full" />
      <QuickResumeDialog open={quick} onClose={() => setQuick(false)} />
    </SmoothScroll>
  );
}
