"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny store shared by the active engine (world or story mode) and the HUD.
 * `chapter` and `checkpoints` change rarely (React re-renders); `progress`
 * changes every frame, so it is pushed to listeners that write to the DOM.
 */
type Nav = { goTo: (chapter: number, immediate?: boolean) => void };

let chapter = 0;
// where the world puts the five level starts (measured 30 Sep 2026: the same at every landscape size, because
// the world is sized in screen heights), so the HUD draws its checkpoints in place before the world reports them
let checkpoints: number[] = [0, 0.1355, 0.5583, 0.6916, 0.8159];
/** the engine has reported its real checkpoints (the HUD shows its markers from then on) */
let checkpointsLive = false;
const subs = new Set<() => void>();
const progressSubs = new Set<(p: number) => void>();
let nav: Nav | null = null;
let lastProgress = 0;
/** Level to resume at after a mode switch (e.g. rotating a tablet). */
let resumeAt: number | null = null;

const emit = () => subs.forEach((f) => f());

export const worldStore = {
  setChapter(i: number) {
    if (i === chapter) return;
    chapter = i;
    emit();
  },
  getChapter: () => chapter,
  /** Fraction (0..1) of the journey where each level starts, for the HUD markers. */
  setCheckpoints(c: number[]) {
    const same = c.length === checkpoints.length && c.every((v, i) => Math.abs(v - checkpoints[i]) < 1e-4);
    if (same && checkpointsLive) return;
    checkpointsLive = true;
    if (!same) checkpoints = c;
    emit();
  },
  setProgress(p: number) {
    lastProgress = p;
    progressSubs.forEach((f) => f(p));
  },
  getProgress: () => lastProgress,
  onProgress(f: (p: number) => void) {
    progressSubs.add(f);
    return () => {
      progressSubs.delete(f);
    };
  },
  /** Remember the current level across a mode switch; the next engine resumes there. */
  holdForSwitch() {
    resumeAt = chapter;
  },
  resumePending: () => resumeAt !== null,
  setNav(n: Nav | null) {
    nav = n;
    if (n && resumeAt !== null) {
      const i = resumeAt;
      resumeAt = null;
      // let the new engine lay out first
      requestAnimationFrame(() => requestAnimationFrame(() => n.goTo(i, true)));
    }
  },
  goTo(i: number) {
    nav?.goTo(i);
  },
};

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function useChapter() {
  return useSyncExternalStore(subscribe, () => chapter, () => 0);
}

export function useCheckpoints() {
  return useSyncExternalStore(subscribe, () => checkpoints, () => checkpoints);
}

export function useCheckpointsLive() {
  return useSyncExternalStore(subscribe, () => checkpointsLive, () => false);
}
