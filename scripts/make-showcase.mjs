// Makes the 30-second showcase video (1920x1080, 60 fps, with music and sound effects) for a LinkedIn post.
//
//   node scripts/make-showcase.mjs            capture the clips, write the soundtrack, cut the video
//   node scripts/make-showcase.mjs --audio    keep the captured frames, redo the soundtrack and the cut
//
// How: the page runs on a clock this script steps by hand (one frame at a time), so every frame is drawn in full and
// captured as a still, however long it takes; nothing is dropped and motion is exact. The soundtrack is written
// here as a WAV: an original piece at 120 beats a minute (every cut lands on a beat) plus effects placed on the
// frames where the game itself asked for those sounds. ffmpeg (on the PATH) joins the two.
// Needs a server (QA_URL, default the local production copy on port 3001).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// 60 frames a second by default (LinkedIn accepts up to 60); SHOWCASE_FPS=30 halves the capture time
const FPS = Number(process.env.SHOWCASE_FPS || 60);
/** waits written for 30 frames a second are scaled to the rate in use */
const K = FPS / 30;
// The frame. SHOWCASE_FORMAT picks it:
//   tall   (default) 1080x1920, 9:16: fills a phone screen in LinkedIn's video feed
//   feed   1080x1350, 4:5: the tallest shape LinkedIn shows whole in the main feed
//   wide   1920x1080, 16:9
// The upright ones are captured as the phone layout (a page 600 px wide, drawn at 1.8x), so the cards and the
// HUD are large enough to read on a phone and the picture fills the frame edge to edge.
const FORMAT = process.env.SHOWCASE_FORMAT || "tall";
const SHAPES = { tall: { w: 600, h: 1067, scale: 1.8, outW: 1080, outH: 1920 }, feed: { w: 600, h: 750, scale: 1.8, outW: 1080, outH: 1350 }, wide: { w: 1920, h: 1080, scale: 1, outW: 1920, outH: 1080 } };
const SHAPE = SHAPES[FORMAT];
const W = SHAPE.w;
const H = SHAPE.h;
const url = process.env.QA_URL || "http://localhost:3001/";
const work = process.env.SHOWCASE_TMP || `test-results/showcase-${FORMAT}`;
const outDir = "docs/video";
const framesDir = path.join(work, "frames");
fs.mkdirSync(outDir, { recursive: true });

// ------------------------------------------------------------------------------------------------ the edit
// name, from x, to x, seconds. Each cut is on a beat (a beat is half a second).
const CLIPS = [
  { name: "arrive", from: 0, to: 6.5, sec: 3.0, still: true },
  { name: "desert", from: 9.2, to: 17.2, sec: 3.0 },
  { name: "shore", from: 56.5, to: 68.5, sec: 3.0 },
  { name: "sea", from: 80, to: 92, sec: 3.5 },
  { name: "ice", from: 119.2, to: 131.5, sec: 3.0 },
  { name: "lab", from: 172, to: 184, sec: 3.0 },
  { name: "cable", from: 191, to: 202, sec: 2.5 },
  { name: "dragon", from: 240, to: 256, sec: 3.0 },
  { name: "wake", sec: 4.5 },
  { name: "card", sec: 1.5 },
];
const TOTAL = CLIPS.reduce((a, c) => a + c.sec, 0);
const CUTS = CLIPS.slice(1).map((_, i) => CLIPS.slice(0, i + 1).reduce((a, c) => a + c.sec, 0));

// ------------------------------------------------------------------------------------------------ capture
async function capture() {
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.QA_CHANNEL || "msedge", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SHAPE.scale });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // the page's clock: time only moves when __step is called
  await page.addInitScript(() => {
    let now = 0;
    let id = 0;
    const cbs = new Map();
    const t0 = Date.now();
    performance.now = () => now;
    Date.now = () => t0 + now;
    window.requestAnimationFrame = (cb) => (cbs.set(++id, cb), id);
    window.cancelAnimationFrame = (i) => void cbs.delete(i);
    window.__step = (ms) => {
      now += ms;
      const run = [...cbs.values()];
      cbs.clear();
      for (const cb of run) cb(now);
      // CSS transitions and animations move on the same clock
      for (const a of document.getAnimations()) {
        if (a.__t === undefined) {
          a.pause();
          a.__t = Number(a.currentTime) || 0;
        }
        a.__t += ms;
        a.currentTime = a.__t;
      }
      const w = window.__world;
      return w ? { x: w.sim.x, sounds: { ...w.sim.qa.sounds }, revealed: w.sim.qa.revealed } : null;
    };
  });
  await page.goto(url, { waitUntil: "load" });
  const step = () => page.evaluate((ms) => window.__step(ms), 1000 / FPS);
  // loading needs real time (downloads, shader compiling) as well as frames
  for (let i = 0; i < 3000; i++) {
    const s = await step();
    if (s?.revealed) break;
    await page.waitForTimeout(15);
  }
  await page.waitForTimeout(1200); // the loading screen's own timer takes it away
  for (let i = 0; i < 40 * K; i++) await step();
  await page.getByRole("button", { name: "Sound", exact: true }).click(); // so the HUD shows the sound on
  for (let i = 0; i < 20 * K; i++) await step();

  const events = [];
  let frame = 0;
  let prev = (await step())?.sounds ?? {};
  const grab = async () => {
    const s = await step();
    for (const [k, n] of Object.entries(s.sounds)) if (n > (prev[k] ?? 0)) events.push({ name: k, t: +(frame / FPS).toFixed(3) });
    prev = s.sounds;
    await page.screenshot({ path: path.join(framesDir, `f${String(frame).padStart(5, "0")}.jpg`), type: "jpeg", quality: 95 });
    frame++;
    return s;
  };
  const idle = async (n30) => {
    let s;
    for (let i = 0; i < Math.round(n30 * K); i++) s = await step();
    prev = s?.sounds ?? prev;
    return s;
  };
  const scrollTo = (x, sec, ease = "linear") =>
    page.evaluate(
      ([x, sec, ease]) => {
        const w = window.__world;
        w.lenis.scrollTo(x * w.sim.u, { duration: sec, easing: ease === "linear" ? (t) => t : (t) => t * t * (3 - 2 * t), lock: true, force: true });
      },
      [x, sec, ease],
    );
  // (forced: the glide before it is still holding the scroll, and an unforced jump would be ignored)
  const jumpTo = (x) => page.evaluate((x) => window.__world.lenis.scrollTo(x * window.__world.sim.u, { immediate: true, force: true }), x);

  for (const c of CLIPS) {
    const n = Math.round(c.sec * FPS);
    if (c.name === "wake") {
      // walk the last stretch to the top; the clip starts just after the flag goes in and the dragon's eye opens
      await jumpTo(267.2);
      await idle(45);
      await scrollTo(273.6, 2.4);
      let woke = -1;
      for (let i = 0; i < 200 * K && woke < 0; i++) {
        const s = await step();
        if ((s.sounds.fanfare ?? 0) > (prev.fanfare ?? 0)) woke = i;
        prev = s.sounds;
      }
      await idle(6);
      events.push({ name: "wake", t: +(frame / FPS - 0.2).toFixed(3) });
      for (let i = 0; i < n; i++) await grab();
    } else if (c.name === "card") {
      const end = await page.evaluate(() => window.__world.end + window.__world.epilogue + 1);
      await scrollTo(end, 1.0, "ease");
      await idle(70);
      for (let i = 0; i < n; i++) await grab();
    } else if (c.still) {
      // the opening: he stands a moment under his name, then sets off
      await jumpTo(c.from);
      await idle(30);
      const hold = Math.round(0.8 * FPS);
      for (let i = 0; i < hold; i++) await grab();
      await scrollTo(c.to, c.sec - 0.8 + 0.6, "ease");
      for (let i = hold; i < n; i++) await grab();
    } else {
      // already moving when the clip starts, at one steady pace, so the cuts match in motion
      const v = (c.to - c.from) / c.sec;
      const lead = 1.0;
      await jumpTo(c.from - v * lead);
      await idle(45);
      await scrollTo(c.to + v * 0.5, c.sec + lead + 0.5);
      await idle(Math.round(lead * FPS));
      for (let i = 0; i < n; i++) await grab();
    }
    console.log("clip", c.name, "frames to", frame, "x", (await page.evaluate(() => window.__world.sim.x)).toFixed(1));
  }
  await browser.close();
  fs.writeFileSync(path.join(work, "events.json"), JSON.stringify({ frames: frame, events, errors }, null, 1));
  return { frames: frame, events, errors };
}

// ------------------------------------------------------------------------------------------------ soundtrack
const SR = 44100;
function soundtrack(events) {
  const N = Math.round(TOTAL * SR);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const hz = (semi) => 220 * 2 ** (semi / 12); // semitones from A3
  /** one voice: wave(phase) shaped by an envelope, through a low-pass that can sweep, placed left to right */
  const voice = ({ t, dur, f, f1 = f, wave = "sin", vol = 0.2, a = 0.005, r = 0.1, cut = 0, cut1 = cut, pan = 0, vib = 0 }) => {
    const i0 = Math.max(0, Math.round(t * SR));
    const n = Math.round(dur * SR);
    let ph = 0;
    let lp = 0;
    const gl = vol * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = vol * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = 0; i < n && i0 + i < N; i++) {
      const k = i / n;
      const ft = (f + (f1 - f) * k) * (1 + vib * Math.sin((i / SR) * 2 * Math.PI * 5.5));
      ph += ft / SR;
      const p = ph % 1;
      let s = wave === "sin" ? Math.sin(2 * Math.PI * p) : wave === "tri" ? 4 * Math.abs(p - 0.5) - 1 : wave === "saw" ? 2 * p - 1 : wave === "sq" ? (p < 0.5 ? 1 : -1) : rnd();
      const c = cut + (cut1 - cut) * k;
      if (c > 0) {
        const al = 1 - Math.exp((-2 * Math.PI * c) / SR);
        lp += al * (s - lp);
        s = lp;
      }
      const ts = i / SR;
      const env = Math.min(1, ts / a) * Math.min(1, (dur - ts) / r);
      L[i0 + i] += s * env * gl;
      R[i0 + i] += s * env * gr;
    }
  };
  const noise = (o) => voice({ ...o, wave: "noise", f: 1 });
  const kick = (t, v = 0.55) => voice({ t, dur: 0.28, f: 150, f1: 42, vol: v, a: 0.002, r: 0.2 });
  const clap = (t, v = 0.2) => {
    noise({ t, dur: 0.16, vol: v, cut: 5200, cut1: 1800, a: 0.001, r: 0.14 });
    voice({ t, dur: 0.09, f: 190, f1: 150, wave: "tri", vol: v * 0.7, r: 0.08 });
  };
  const hat = (t, v = 0.05, pan = 0.3) => {
    const i0 = Math.round(t * SR);
    let last = 0;
    for (let i = 0; i < SR * 0.04 && i0 + i < N; i++) {
      const s = rnd();
      const hp = s - last; // a crude high-pass: only the hiss
      last = s;
      const e = (1 - i / (SR * 0.04)) ** 2 * v;
      L[i0 + i] += hp * e * (1 - pan * 0.5);
      R[i0 + i] += hp * e * (1 + pan * 0.5);
    }
  };

  // ---- the music. A minor, 120 bpm. One bar is 2 s; bars start at 1.0 s (the first second is a pick-up).
  const BEAT = 0.5;
  const CHORDS = [
    [0, 3, 7], // A minor
    [-4, 0, 3], // F
    [3, 7, 10], // C
    [-2, 2, 5], // G
  ];
  const chordAt = (t) => CHORDS[((Math.floor((t - 1) / 2) % 4) + 4) % 4];
  const sect = (t) => (t < 3 ? "open" : t < 9 ? "desert" : t < 12.5 ? "aqua" : t < 21 ? "snow" : t < 24 ? "magma" : t < 28.5 ? "wake" : "end");
  // the pick-up: a swell and a rising hiss into the first cut
  for (const semi of [0, 7, 12, 15]) voice({ t: 0, dur: 3.2, f: hz(semi - 12), wave: "saw", vol: 0.045, a: 1.6, r: 1.2, cut: 500, cut1: 2400, pan: semi % 2 ? 0.5 : -0.5 });
  noise({ t: 1.6, dur: 1.4, vol: 0.07, cut: 400, cut1: 7000, a: 1.3, r: 0.05 });
  // pads: one chord a bar, warmer or colder with the realm
  for (let t = 1; t < 24; t += 2) {
    const s = sect(t + 0.01);
    const bright = s === "aqua" ? 700 : s === "snow" ? 2200 : s === "magma" ? 1300 : 1500;
    for (const [i, semi] of chordAt(t).entries()) {
      voice({ t, dur: 2.05, f: hz(semi - 12) * 1.003, wave: "saw", vol: 0.04, a: 0.08, r: 0.4, cut: bright, pan: -0.6 + i * 0.6 });
      voice({ t, dur: 2.05, f: hz(semi) * 0.997, wave: "tri", vol: 0.035, a: 0.08, r: 0.4, cut: bright * 1.5, pan: 0.6 - i * 0.6 });
    }
  }
  // bass, drums and the tune, from the first cut to the climb
  for (let b = 6; b < 48; b++) {
    const t = b * BEAT;
    const s = sect(t + 0.01);
    const ch = chordAt(t);
    const root = hz(ch[0] - 24);
    // bass: two notes a beat, the second an octave up in the louder realms
    voice({ t, dur: 0.22, f: root, wave: "saw", vol: s === "aqua" ? 0.13 : 0.17, r: 0.08, cut: s === "magma" ? 520 : 340 });
    voice({ t: t + 0.25, dur: 0.2, f: root * (s === "magma" || b % 4 === 3 ? 2 : 1), wave: "saw", vol: 0.12, r: 0.08, cut: 340 });
    // drums: the sea is the quiet part, the mountain the loud one
    if (s !== "aqua") {
      if (b % 2 === 0 || s === "magma") kick(t, s === "magma" ? 0.6 : 0.5);
      if (b % 2 === 1) clap(t, s === "magma" ? 0.24 : 0.17);
      hat(t, 0.045);
      hat(t + 0.25, 0.07, -0.3);
      if (s === "magma") hat(t + 0.125, 0.03);
    } else {
      if (b % 4 === 0) kick(t, 0.32);
      hat(t + 0.25, 0.03);
    }
    // the tune: broken chords, a different voice in each realm
    const order = [0, 1, 2, 1, 2, 1, 0, 2];
    for (let k = 0; k < 2; k++) {
      const semi = ch[order[(b * 2 + k) % 8]] + (k === 1 && b % 4 === 2 ? 12 : 0);
      const tt = t + k * 0.25;
      if (s === "desert") voice({ t: tt, dur: 0.24, f: hz(semi + 12), wave: "tri", vol: 0.1, r: 0.2, cut: 3200, pan: k ? 0.35 : -0.35 });
      else if (s === "aqua") voice({ t: tt, dur: 0.5, f: hz(semi + 12), wave: "sin", vol: 0.085, r: 0.45, pan: k ? 0.5 : -0.5, vib: 0.004 });
      else if (s === "snow") {
        voice({ t: tt, dur: 0.4, f: hz(semi + 24), wave: "sin", vol: 0.07, r: 0.38, pan: k ? 0.45 : -0.45 });
        voice({ t: tt, dur: 0.12, f: hz(semi + 36), wave: "sin", vol: 0.025, r: 0.11, pan: k ? -0.45 : 0.45 });
      } else if (s === "magma") voice({ t: tt, dur: 0.22, f: hz(semi), wave: "saw", vol: 0.075, r: 0.1, cut: 2600, pan: k ? 0.3 : -0.3 });
    }
  }
  // a fill into the top, then the mountain holds its breath: a low drone and a slow heartbeat while the dragon wakes
  for (let k = 0; k < 4; k++) voice({ t: 23.5 + k * 0.125, dur: 0.14, f: 180 - k * 25, f1: 90 - k * 10, wave: "sin", vol: 0.3, r: 0.1, pan: -0.6 + k * 0.4 });
  voice({ t: 24, dur: 4.6, f: hz(-24), wave: "saw", vol: 0.13, a: 0.6, r: 0.5, cut: 180, cut1: 620 });
  voice({ t: 24, dur: 4.6, f: hz(-17) * 1.004, wave: "saw", vol: 0.07, a: 1.2, r: 0.5, cut: 220, cut1: 900, pan: 0.4 });
  for (let t = 24; t < 26.6; t += 1) {
    kick(t, 0.4);
    kick(t + 0.22, 0.26);
  }
  noise({ t: 26.6, dur: 1.9, vol: 0.05, cut: 300, cut1: 6500, a: 1.7, r: 0.1 });
  for (let k = 0; k < 8; k++) voice({ t: 27.5 + k * 0.125, dur: 0.13, f: 110 + k * 12, f1: 70, wave: "sin", vol: 0.16 + k * 0.03, r: 0.1 });
  // the end: one bright C major chord with a crash, left to ring
  kick(28.5, 0.7);
  noise({ t: 28.5, dur: 1.5, vol: 0.12, cut: 9000, cut1: 2500, a: 0.002, r: 1.3 });
  for (const [i, semi] of [3, 7, 10, 15, 19].entries()) {
    voice({ t: 28.5, dur: 1.5, f: hz(semi - 12), wave: "saw", vol: 0.07, a: 0.01, r: 1.1, cut: 2600, cut1: 900, pan: -0.6 + i * 0.3 });
    voice({ t: 28.5 + i * 0.05, dur: 1.2, f: hz(semi + 12), wave: "sin", vol: 0.06, r: 1.0, pan: 0.6 - i * 0.3 });
  }

  // ---- the cuts: a short rush of air into each one
  for (const c of CUTS) noise({ t: c - 0.16, dur: 0.3, vol: 0.085, cut: 900, cut1: 6500, a: 0.15, r: 0.12, pan: 0 });

  // ---- effects, on the frames where the game itself played them
  const FX = {
    "splash-in": (t) => {
      noise({ t, dur: 0.6, vol: 0.3, cut: 4200, cut1: 500, a: 0.004, r: 0.5 });
      voice({ t, dur: 0.3, f: 300, f1: 90, vol: 0.2, r: 0.25 });
    },
    "splash-out": (t) => noise({ t, dur: 0.5, vol: 0.24, cut: 5200, cut1: 900, a: 0.004, r: 0.42 }),
    kick: (t) => noise({ t, dur: 0.25, vol: 0.1, cut: 1400, cut1: 400, r: 0.2 }),
    bubble: (t) => voice({ t, dur: 0.07, f: 520 + 300 * Math.abs(rnd()), f1: 1100, vol: 0.045, r: 0.05, pan: rnd() * 0.6 }),
    crack: (t) => {
      noise({ t, dur: 0.12, vol: 0.26, cut: 9000, a: 0.001, r: 0.1 });
      voice({ t: t + 0.02, dur: 0.3, f: 2300, f1: 1500, vol: 0.07, r: 0.28 });
    },
    gem: (t) => [988, 1319].forEach((f, i) => voice({ t: t + i * 0.06, dur: 0.18, f, vol: 0.09, r: 0.15, pan: 0.2 })),
    jump: (t) => voice({ t, dur: 0.14, f: 300, f1: 620, wave: "tri", vol: 0.08, r: 0.1 }),
    hop: (t) => voice({ t, dur: 0.1, f: 280, f1: 460, wave: "tri", vol: 0.06, r: 0.08 }),
    land: (t) => voice({ t, dur: 0.12, f: 120, f1: 60, vol: 0.14, r: 0.1 }),
    "cable-on": (t) => {
      voice({ t, dur: 0.16, f: 90, f1: 60, wave: "sq", vol: 0.1, r: 0.1, cut: 600 });
      voice({ t: t + 0.1, dur: 0.5, f: 1320, vol: 0.05, r: 0.45 });
    },
    owl: (t) => [0, 0.28].forEach((d) => voice({ t: t + d, dur: 0.22, f: 420, f1: 360, vol: 0.07, r: 0.15, pan: 0.5 })),
    camel: (t) => voice({ t, dur: 0.5, f: 150, f1: 95, wave: "saw", vol: 0.07, r: 0.3, cut: 700, vib: 0.03, pan: 0.4 }),
    seal: (t) => [0, 0.2].forEach((d) => voice({ t: t + d, dur: 0.16, f: 330, f1: 250, wave: "saw", vol: 0.06, r: 0.1, cut: 1200, pan: -0.4 })),
    nest: (t) => [659, 784, 988, 1175, 1568].forEach((f, i) => voice({ t: t + i * 0.09, dur: 0.5, f, vol: 0.07, r: 0.45 })),
    roar: (t) => {
      voice({ t, dur: 2.3, f: 62, f1: 30, wave: "saw", vol: 0.36, a: 0.08, r: 0.9, cut: 520, cut1: 160, vib: 0.02 });
      voice({ t, dur: 2.0, f: 124, f1: 58, wave: "sq", vol: 0.09, a: 0.08, r: 0.8, cut: 900, cut1: 300 });
      noise({ t, dur: 2.2, vol: 0.26, cut: 900, cut1: 240, a: 0.1, r: 1.0 });
    },
    fire: (t) => {
      noise({ t, dur: 1.6, vol: 0.34, cut: 500, cut1: 2600, a: 0.12, r: 0.6 });
      voice({ t, dur: 1.6, f: 70, f1: 110, wave: "saw", vol: 0.14, a: 0.1, r: 0.6, cut: 300 });
    },
    firework: (t) => {
      voice({ t, dur: 0.2, f: 160, f1: 50, vol: 0.3, r: 0.18, pan: rnd() * 0.7 });
      noise({ t, dur: 0.45, vol: 0.2, cut: 3200, cut1: 900, a: 0.002, r: 0.4, pan: rnd() * 0.7 });
      for (let k = 0; k < 7; k++) noise({ t: t + 0.12 + Math.abs(rnd()) * 0.5, dur: 0.03, vol: 0.09, cut: 8000, r: 0.02, pan: rnd() });
    },
  };
  const used = {};
  for (const e of events) {
    const name = e.name === "wake" ? null : e.name;
    if (name && FX[name]) {
      FX[name](e.t);
      used[name] = (used[name] ?? 0) + 1;
    }
    // the fire comes 2.9 s into the waking (the same timing as the game)
    if (e.name === "wake") {
      FX.fire(e.t + 2.6);
      used.fire = 1;
    }
  }

  // ---- master: fade in and out, level, a soft ceiling
  let peak = 0;
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const gain = 1.35 / peak;
  const pcm = Buffer.alloc(44 + N * 4);
  pcm.write("RIFF", 0);
  pcm.writeUInt32LE(36 + N * 4, 4);
  pcm.write("WAVEfmt ", 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20);
  pcm.writeUInt16LE(2, 22);
  pcm.writeUInt32LE(SR, 24);
  pcm.writeUInt32LE(SR * 4, 28);
  pcm.writeUInt16LE(4, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write("data", 36);
  pcm.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 0.05) * Math.min(1, (TOTAL - t) / 0.35);
    pcm.writeInt16LE(Math.round(Math.tanh(L[i] * gain) * fade * 30000), 44 + i * 4);
    pcm.writeInt16LE(Math.round(Math.tanh(R[i] * gain) * fade * 30000), 46 + i * 4);
  }
  const wav = path.join(work, "soundtrack.wav");
  fs.writeFileSync(wav, pcm);
  return { wav, used };
}

// ------------------------------------------------------------------------------------------------ the cut
function edit(wav, frames) {
  // a flash of light on every cut (in time with the rush of air), a fade up at the start and out at the end, and
  // the address on the last shot
  const flash = CUTS.map((c) => `0.2*gte(t\\,${c})*max(0\\,1-(t-${c})/0.13)`).join("+");
  const font = "C\\:/Windows/Fonts/segoeuib.ttf";
  const vf = [
    `scale=${SHAPE.outW}:${SHAPE.outH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SHAPE.outW}:${SHAPE.outH}`,
    `eq=brightness='${flash}':eval=frame`,
    `drawtext=fontfile='${font}':text='sayedjehad-portfolio.vercel.app':fontsize=${FORMAT === "wide" ? 44 : 50}:fontcolor=white:box=1:boxcolor=0x0E1B33@0.82:boxborderw=24:x=(w-text_w)/2:y=h-${FORMAT === "tall" ? 300 : 170}:enable='gte(t\\,28.7)':alpha='min(1\\,(t-28.7)/0.3)'`,
    `fade=t=in:st=0:d=0.25`,
    `fade=t=out:st=${TOTAL - 0.3}:d=0.3`,
    "format=yuv420p",
  ].join(",");
  const out = path.join(outDir, `sayed-jehad-world-linkedin-30s-${FORMAT === "tall" ? "vertical-9x16" : FORMAT === "feed" ? "feed-4x5" : "wide-16x9"}.mp4`);
  execFileSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(framesDir, "f%05d.jpg"), "-i", wav, "-frames:v", String(frames), "-vf", vf, "-c:v", "libx264", "-profile:v", "high", "-crf", "17", "-preset", "slow", "-r", String(FPS), "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", out],
    { stdio: "inherit" },
  );
  return out;
}

const audioOnly = process.argv.includes("--audio");
const cap = audioOnly ? JSON.parse(fs.readFileSync(path.join(work, "events.json"), "utf8")) : await capture();
const { wav, used } = soundtrack(cap.events);
const out = edit(wav, cap.frames);
console.log(JSON.stringify({ out, format: FORMAT, size: `${SHAPE.outW}x${SHAPE.outH}`, fps: FPS, frames: cap.frames, seconds: cap.frames / FPS, cuts: CUTS, pageErrors: cap.errors, effects: used }, null, 1));
