"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny store shared by the active engine (world or story mode) and the HUD.
 * `chapter` and `checkpoints` change rarely (React re-renders); `progress`
 * changes every frame, so it is pushed to listeners that write to the DOM.
 */
type Nav = { goTo: (chapter: number, immediate?: boolean) => void };

let chapter = 0;
let checkpoints: number[] = [0, 0.25, 0.5, 0.75, 1];
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
    if (c.length === checkpoints.length && c.every((v, i) => Math.abs(v - checkpoints[i]) < 1e-4)) return;
    checkpoints = c;
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
