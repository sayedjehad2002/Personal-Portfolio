"use client";

import { useSyncExternalStore } from "react";

/**
 * "Pause animations" switch (WCAG 2.2.2): stops the ambient loops that run on
 * their own (snowfall, swaying palms, aurora, neon flicker, floating pennants).
 * Anything you cause by scrolling still moves. Remembered in localStorage and
 * mirrored on <html data-motion="off"> so CSS can stop the loops.
 */
let paused = false;
const subs = new Set<() => void>();

function apply() {
  if (typeof document !== "undefined") document.documentElement.dataset.motion = paused ? "off" : "on";
}

try {
  paused = typeof window !== "undefined" && window.localStorage.getItem("sjw:motion") === "off";
  apply();
} catch {
  paused = false;
}

export const motion = {
  isPaused: () => paused,
  toggle() {
    paused = !paused;
    try {
      window.localStorage.setItem("sjw:motion", paused ? "off" : "on");
    } catch {
      /* private mode: keep the in-memory setting */
    }
    apply();
    subs.forEach((f) => f());
  },
};

export function useMotionPaused() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => paused,
    () => false,
  );
}
