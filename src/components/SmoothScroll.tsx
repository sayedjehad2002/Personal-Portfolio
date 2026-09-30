"use client";

import Lenis from "lenis";
import { createContext, useContext, useEffect, useState } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

const LenisContext = createContext<Lenis | null>(null);

export function useLenis() {
  return useContext(LenisContext);
}

/**
 * One Lenis instance for the whole page, driven by GSAP's ticker so
 * ScrollTrigger always reads the smoothed scroll position.
 * Smoothing is skipped entirely when the visitor prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const [reduce, setReduce] = useState<boolean | null>(null);

  // follow the reduced-motion preference live (it can change mid-visit)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (reduce !== false) return;

    const instance = new Lenis({
      autoRaf: false,
      lerp: 0.14,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      smoothWheel: true,
      // a sideways trackpad swipe walks too (it is a side-scroller)
      gestureOrientation: "both",
    });

    instance.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    setLenis(instance);

    return () => {
      gsap.ticker.remove(tick);
      instance.destroy();
      setLenis(null);
    };
  }, [reduce]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}

/** Scroll to an absolute Y, through Lenis when it is running. */
export function scrollToY(lenis: Lenis | null, y: number, immediate = false) {
  if (lenis) {
    // an instant jump must see the current page height (Lenis refreshes its cached limit only after a debounce)
    if (immediate) lenis.resize();
    lenis.scrollTo(y, { immediate, duration: immediate ? 0 : 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  } else {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: y, behavior: immediate || reduce ? "auto" : "smooth" });
  }
}
