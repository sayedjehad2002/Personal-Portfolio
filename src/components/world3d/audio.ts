"use client";

import { sfx } from "@/lib/sfx";

/**
 * World 2 sound, all synthesized with Web Audio (no files):
 *  - a small theme and an "air" for each realm (desert wind, the muffled sea, cold wind, the volcano's rumble),
 *    cross-faded as he walks from one realm to the next;
 *  - loops that follow what he is doing (skates on ice, the cable car, the dragon's breath);
 *  - one-shot effects (steps on each kind of ground, jump, landing, splash, ice crack, the nest, the flag ...).
 * Under water everything is muffled. It shares the on/off switch of the 2D world's kit (lib/sfx.ts): off by
 * default, and silent until a click or key press because browsers require one.
 */

export type SoundName =
  | "step-sand" | "step-snow" | "step-stone" | "step-scale" | "step-ice"
  | "jump" | "hop" | "land" | "splash-in" | "splash-out" | "kick" | "bubble" | "stroke" | "crack"
  | "cable-on" | "cable-off" | "growl" | "puff" | "nest" | "fanfare" | "firework" | "board" | "realm"
  | "camel" | "owl" | "seal" | "scurry";

export type AudioState = {
  /** how much of each realm applies (desert, aqua, snow, magma) */
  weights: number[];
  realm: number;
  /** 0..1 */
  under: number;
  skate: number;
  ride: number;
  /** how close he is to the dragon, 0..1, and its breath, -1..1 */
  dragon: number;
  breath: number;
  time: number;
};

type Bed = { gain: GainNode; filter: BiquadFilterNode };
type Graph = {
  master: GainNode;
  muffle: BiquadFilterNode;
  fx: GainNode;
  music: GainNode;
  air: GainNode;
  white: AudioBuffer;
  brown: AudioBuffer;
  wind: Bed;
  sea: Bed;
  cold: Bed;
  rumble: Bed;
  skate: Bed;
  breath: Bed;
  cable: GainNode;
  drone: OscillatorNode[];
  droneGain: GainNode;
};

let A: AudioContext | null = null;
let G: Graph | null = null;
/** how many times each sound was asked for (also counted while muted, so tests can check the triggers) */
const counts: Record<string, number> = {};
const last: Record<string, number> = {};
let nextNote = 0;
let step = 0;

/** A short theme per realm: tempo, root note, scale (semitones), a 16-step motif of scale degrees (-1 = rest), a voice. */
const THEMES = [
  { bpm: 84, root: 146.83, scale: [0, 1, 4, 5, 7, 8, 10], motif: [0, -1, 2, 3, 4, -1, 3, 2, 0, -1, 4, 5, 4, 3, 2, -1], voice: "pluck", drone: 73.42 },
  { bpm: 60, root: 311.13, scale: [0, 2, 4, 7, 9], motif: [0, -1, -1, 2, -1, 4, -1, -1, 3, -1, -1, 1, -1, 2, -1, -1], voice: "bell", drone: 77.78 },
  { bpm: 72, root: 523.25, scale: [0, 2, 4, 7, 9], motif: [4, -1, 2, -1, 0, -1, 2, -1, 3, -1, 1, -1, 0, -1, -1, -1], voice: "glock", drone: 130.81 },
  { bpm: 66, root: 73.42, scale: [0, 2, 3, 5, 7, 8, 10], motif: [0, -1, -1, 0, -1, -1, 4, -1, 0, -1, -1, 0, -1, 3, -1, 2], voice: "drum", drone: 36.71 },
] as const;

function build(a: AudioContext): Graph {
  const master = a.createGain();
  master.gain.value = 0.6;
  master.connect(a.destination);
  // everything he hears "in the world" passes this filter, which closes under water
  const muffle = a.createBiquadFilter();
  muffle.type = "lowpass";
  muffle.frequency.value = 18000;
  muffle.connect(master);
  const fx = a.createGain();
  fx.connect(muffle);
  const music = a.createGain();
  music.gain.value = 0.5;
  music.connect(muffle);
  // a soft echo on the music
  const delay = a.createDelay(1);
  delay.delayTime.value = 0.33;
  const fb = a.createGain();
  fb.gain.value = 0.32;
  const wet = a.createGain();
  wet.gain.value = 0.35;
  music.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(muffle);
  const air = a.createGain();
  air.connect(master);

  const len = a.sampleRate * 2;
  const white = a.createBuffer(1, len, a.sampleRate);
  const brown = a.createBuffer(1, len, a.sampleRate);
  const w = white.getChannelData(0);
  const b = brown.getChannelData(0);
  let acc = 0;
  for (let i = 0; i < len; i++) {
    w[i] = Math.random() * 2 - 1;
    acc = (acc + 0.02 * w[i]) / 1.02;
    b[i] = acc * 3.5;
  }
  const bed = (buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number, to: AudioNode): Bed => {
    const src = a.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = a.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = a.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(to);
    src.start();
    return { gain, filter };
  };
  const cable = a.createGain();
  cable.gain.value = 0;
  const cableFilter = a.createBiquadFilter();
  cableFilter.type = "lowpass";
  cableFilter.frequency.value = 260;
  for (const f of [58, 87.3]) {
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(cableFilter);
    o.start();
  }
  cableFilter.connect(cable).connect(fx);
  const droneGain = a.createGain();
  droneGain.gain.value = 0;
  droneGain.connect(music);
  const drone = [1, 1.5].map((k) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = THEMES[0].drone * k;
    o.connect(droneGain);
    o.start();
    return o;
  });
  return {
    master, muffle, fx, music, air, white, brown, cable, drone, droneGain,
    wind: bed(white, "bandpass", 420, 0.7, air),
    sea: bed(brown, "lowpass", 420, 0.5, air),
    cold: bed(white, "bandpass", 1600, 1.4, air),
    rumble: bed(brown, "lowpass", 150, 0.5, air),
    skate: bed(white, "highpass", 3000, 0.5, fx),
    breath: bed(brown, "bandpass", 260, 0.8, fx),
  };
}

function boot() {
  if (!sfx.isOn()) {
    if (A && G) G.master.gain.setTargetAtTime(0, A.currentTime, 0.08);
    return null;
  }
  const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
  if (!A && !activated) return null;
  if (!A) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    A = new AC();
    G = build(A);
  }
  if (A.state === "suspended") {
    void A.resume();
    return null;
  }
  G?.master.gain.setTargetAtTime(0.6, A.currentTime, 0.08);
  return A;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo = 0, to?: AudioNode) {
  if (!A || !G) return;
  const t = A.currentTime + when;
  const o = A.createOscillator();
  const g = A.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(to ?? G.fx);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function hiss(dur: number, type: BiquadFilterType, freq: number, gain: number, when = 0, sweepTo = 0, brown = false) {
  if (!A || !G) return;
  const t = A.currentTime + when;
  const src = A.createBufferSource();
  src.buffer = brown ? G.brown : G.white;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = A.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = A.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(G.fx);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

/** One note of a realm's theme. */
function note(voice: string, f: number, when: number) {
  if (!A || !G) return;
  const m = G.music;
  if (voice === "pluck") {
    tone(f, 0.5, "triangle", 0.08, when, 0, m);
    tone(f * 2, 0.18, "sawtooth", 0.012, when, 0, m);
  } else if (voice === "bell") {
    tone(f, 1.9, "sine", 0.07, when, 0, m);
    tone(f * 2.76, 0.9, "sine", 0.018, when, 0, m);
  } else if (voice === "glock") {
    tone(f, 0.95, "sine", 0.06, when, 0, m);
    tone(f * 3, 0.3, "sine", 0.014, when, 0, m);
  } else {
    tone(f * 1.6, 0.34, "sine", 0.2, when, f * 0.8, m);
  }
}

const SOUNDS: Record<SoundName, (v: number) => void> = {
  "step-sand": () => hiss(0.09, "bandpass", 900 + Math.random() * 300, 0.07),
  "step-snow": () => {
    hiss(0.06, "bandpass", 2300 + Math.random() * 500, 0.07);
    hiss(0.07, "bandpass", 1500, 0.05, 0.045);
  },
  "step-stone": () => {
    hiss(0.035, "highpass", 3200, 0.05);
    tone(150, 0.06, "sine", 0.06);
  },
  "step-scale": () => {
    tone(105 + Math.random() * 20, 0.11, "sine", 0.11);
    hiss(0.1, "bandpass", 520, 0.05);
  },
  "step-ice": () => hiss(0.04, "highpass", 4200, 0.04),
  jump: () => tone(240, 0.16, "triangle", 0.07, 0, 560),
  hop: () => tone(300, 0.1, "triangle", 0.05, 0, 520),
  land: (v) => {
    tone(105, 0.1, "sine", 0.08 + 0.08 * v);
    hiss(0.07, "lowpass", 900, 0.05 + 0.04 * v);
  },
  "splash-in": () => {
    hiss(0.55, "lowpass", 3200, 0.2, 0, 280);
    tone(320, 0.3, "sine", 0.1, 0.02, 85);
    [0.18, 0.3, 0.44].forEach((d, i) => tone(520 + i * 140, 0.08, "sine", 0.03, d, 900 + i * 160));
  },
  "splash-out": () => {
    hiss(0.4, "highpass", 1400, 0.13, 0, 3600);
    [0.2, 0.33, 0.5, 0.7].forEach((d, i) => tone(900 - i * 90, 0.05, "sine", 0.03, d, 1300));
  },
  kick: () => {
    hiss(0.3, "lowpass", 700, 0.1, 0, 220);
    tone(480, 0.09, "sine", 0.03, 0.08, 820);
  },
  bubble: () => tone(520 + Math.random() * 380, 0.07, "sine", 0.022, 0, 1000 + Math.random() * 300),
  stroke: () => hiss(0.32, "lowpass", 520, 0.06, 0, 240),
  crack: () => {
    hiss(0.14, "highpass", 2600, 0.11);
    tone(190, 0.26, "triangle", 0.06, 0.02, 85);
    hiss(0.3, "bandpass", 4800, 0.04, 0.08);
  },
  "cable-on": () => {
    tone(90, 0.18, "square", 0.06, 0, 60);
    hiss(0.12, "lowpass", 600, 0.1);
    tone(1320, 0.5, "sine", 0.04, 0.12);
  },
  "cable-off": () => {
    tone(70, 0.2, "square", 0.06);
    hiss(0.14, "lowpass", 500, 0.1);
    tone(880, 0.7, "sine", 0.05, 0.1);
    tone(1320, 0.6, "sine", 0.03, 0.14);
  },
  growl: () => {
    tone(62, 1.5, "sawtooth", 0.07, 0, 44);
    hiss(1.4, "lowpass", 180, 0.16, 0, 90, true);
  },
  puff: () => hiss(0.9, "bandpass", 340, 0.07, 0, 160, true),
  nest: () => [659, 784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.5, "sine", 0.045, i * 0.09)),
  fanfare: () => {
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, "triangle", 0.08, i * 0.13));
    [523, 659, 784, 1046].forEach((f) => tone(f, 1.1, "triangle", 0.05, 0.56));
  },
  firework: () => {
    hiss(0.4, "lowpass", 2400, 0.1);
    tone(1300, 0.28, "triangle", 0.03, 0.05, 320);
    hiss(0.5, "highpass", 5200, 0.03, 0.12);
  },
  board: () => tone(700, 0.09, "sine", 0.03, 0, 940),
  realm: (v) => {
    const t = THEMES[Math.round(v)] ?? THEMES[0];
    [0, 2, 4].forEach((d, i) => note(t.voice, t.root * 2 ** (t.scale[d] / 12), i * 0.14));
  },
  camel: () => {
    tone(120, 0.5, "sawtooth", 0.05, 0, 84);
    hiss(0.45, "bandpass", 300, 0.05, 0, 0, true);
  },
  owl: () => {
    tone(392, 0.28, "sine", 0.06);
    tone(330, 0.42, "sine", 0.06, 0.34);
  },
  seal: () => {
    tone(420, 0.14, "square", 0.035, 0, 250);
    tone(400, 0.16, "square", 0.035, 0.2, 230);
  },
  scurry: () => [0, 0.05, 0.1, 0.15].forEach((d) => hiss(0.025, "highpass", 3600, 0.035, d)),
};

/** The shortest time (seconds) between two plays of the busy sounds. */
const GAPS: Partial<Record<SoundName, number>> = { bubble: 0.16, board: 0.3, scurry: 0.5, puff: 1.5, growl: 6, camel: 8, owl: 8, seal: 6, stroke: 0.4 };

export const audio = {
  counts,
  /** "running" once the browser lets it play; "none" while it is off */
  state: () => A?.state ?? "none",
  play(name: SoundName, v = 1) {
    const now = performance.now() / 1000;
    if (now - (last[name] ?? -99) < (GAPS[name] ?? 0.03)) return;
    last[name] = now;
    counts[name] = (counts[name] ?? 0) + 1;
    if (boot()) SOUNDS[name](v);
  },
  /** called every frame: sets the airs, the loops and the muffle, and keeps the realm's theme playing */
  update(s: AudioState) {
    const a = boot();
    if (!a || !G) return;
    const t = a.currentTime;
    const set = (p: AudioParam, v: number, k = 0.25) => p.setTargetAtTime(v, t, k);
    const [d, q, n, m] = s.weights;
    set(G.wind.gain.gain, d * 0.05 * (0.75 + 0.25 * Math.sin(s.time * 0.31)));
    set(G.sea.gain.gain, Math.max(q * 0.5, s.under) * 0.2);
    set(G.cold.gain.gain, n * 0.034 * (0.7 + 0.3 * Math.sin(s.time * 0.27)));
    set(G.cold.filter.frequency, 1500 + 500 * Math.sin(s.time * 0.23));
    set(G.rumble.gain.gain, m * 0.22);
    set(G.skate.gain.gain, s.skate * 0.055, 0.08);
    set(G.cable.gain, s.ride * 0.03);
    set(G.breath.gain.gain, s.dragon * (0.04 + 0.12 * Math.max(0, s.breath)), 0.15);
    set(G.muffle.frequency, 700 + (1 - s.under) ** 2 * 17300, 0.12);
    const th = THEMES[s.realm] ?? THEMES[0];
    set(G.droneGain.gain, 0.03);
    G.drone.forEach((o, i) => set(o.frequency, th.drone * (i ? 1.5 : 1), 0.6));
    // the theme: schedule the next eighth notes a little ahead of time
    if (nextNote < t - 0.5) nextNote = t + 0.1;
    while (nextNote < t + 0.15) {
      const i = step % 16;
      const deg = th.motif[i];
      // every fourth bar the second half climbs one degree
      const lift = Math.floor(step / 16) % 4 === 3 && i >= 8 ? 1 : 0;
      if (deg >= 0) {
        const k = deg + lift;
        note(th.voice, th.root * 2 ** ((th.scale[k % th.scale.length] + 12 * Math.floor(k / th.scale.length)) / 12), nextNote - t);
      }
      nextNote += 60 / th.bpm / 2;
      step++;
    }
  },
};
