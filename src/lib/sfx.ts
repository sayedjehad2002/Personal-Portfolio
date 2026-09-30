"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny synthesized 8-bit sound kit (Web Audio, no files). Off by default; the
 * HUD speaker button turns it on. Every call is a no-op while muted.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let enabled = false;
const subs = new Set<() => void>();

try {
  enabled = typeof window !== "undefined" && window.localStorage.getItem("sjw:sound") === "on";
} catch {
  enabled = false;
}

function audio() {
  if (!enabled) return null;
  // browsers only allow audio after a click or key press; until then stay silent (nothing queues up)
  const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
  if (!ctx && !activated) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
    return null;
  }
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number) {
  const a = audio();
  if (!a || !master) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, filter: BiquadFilterType, freq: number, gain: number, when = 0) {
  const a = audio();
  if (!a || !master || !noiseBuf) return;
  const t = a.currentTime + when;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = a.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.3, dur + 0.05);
}

export const sfx = {
  isOn: () => enabled,
  toggle() {
    enabled = !enabled;
    try {
      window.localStorage.setItem("sjw:sound", enabled ? "on" : "off");
    } catch {
      /* private mode: keep the in-memory setting */
    }
    if (enabled) sfx.levelUp();
    subs.forEach((f) => f());
  },
  step: (indoor: boolean) => (indoor ? noise(0.05, "bandpass", 700, 0.05) : noise(0.07, "bandpass", 1400 + Math.random() * 500, 0.07)),
  skate: () => noise(0.16, "highpass", 3200, 0.05),
  jump: () => tone(260, 0.14, "square", 0.05, 0, 620),
  land: () => {
    tone(110, 0.09, "sine", 0.12);
    noise(0.06, "lowpass", 900, 0.06);
  },
  crack: () => {
    noise(0.12, "highpass", 2600, 0.09);
    tone(180, 0.22, "triangle", 0.05, 0.02, 90);
  },
  bell: () => {
    tone(880, 0.9, "sine", 0.09);
    tone(1320, 0.7, "sine", 0.05, 0.02);
  },
  levelUp: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, "triangle", 0.06, i * 0.07)),
  firework: () => {
    noise(0.35, "lowpass", 2200, 0.08);
    tone(1200, 0.25, "triangle", 0.03, 0.05, 300);
  },
};

export function useSoundOn() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    () => enabled,
    () => false,
  );
}
