"use client";

import { useEffect, useRef } from "react";

/**
 * Imperative controls for the snowfall so the scroll engine can steer it
 * every frame without React re-renders.
 *  - intensity: 0 (none, e.g. indoors) .. 1.6 (blizzard)
 *  - wind: horizontal world velocity in px/s; flakes drift against it,
 *    near flakes more than far ones, which reads as parallax.
 */
export const snowControl = {
  intensity: 1,
  wind: 0,
  burst: (_x: number, _y: number) => {},
  /** small kick of snow at the boots, dir = walking direction */
  puff: (_x: number, _y: number, _dir: number) => {},
  /** cold breath: a soft vapour cloud drifting up from the mouth */
  breath: (_x: number, _y: number, _dir: number) => {},
  /** ice shavings sprayed sideways by a skate push */
  spray: (_x: number, _y: number, _dir: number) => {},
  /** a firework shell: a rocket rises from (x, fromY) and bursts into a ring of glowing stars at (x, y) */
  firework: (_x: number, _y: number, _fromY: number, _hue: string) => {},
};

type Flake = { x: number; y: number; r: number; depth: number; speed: number; sway: number; phase: number };
type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: string;
  vapor?: boolean;
  /** firework star (round, glowing, light gravity) / rocket (bursts when it dies) / flash */
  kind?: "star" | "rocket" | "flash";
  /** rocket only: where it bursts */
  burstY?: number;
};
/** hard cap so a long session can never grow the particle list without bound */
const MAX_SPARKS = 900;

const SPARK_COLOURS = ["#ffffff", "#def3ff", "#8fd3ff", "#ffbb33", "#d7262e"];

export function Snow({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    // reduced motion (checked live) and the HUD pause both stop the snowfall
    const rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = 1;
    let flakes: Flake[] = [];
    const sparks: Spark[] = [];
    let raf = 0;
    let last = performance.now();
    let shown = snowControl.intensity;
    let wind = 0;

    // Pre-rendered soft flake so each draw is a cheap drawImage.
    const sprite = document.createElement("canvas");
    sprite.width = sprite.height = 32;
    const sctx = sprite.getContext("2d")!;
    const g = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, 32, 32);

    const make = (anywhere: boolean): Flake => {
      const depth = Math.random() ** 1.6; // more far flakes than near ones
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -10 - Math.random() * 40,
        r: 1.2 + depth * 3.6,
        depth,
        speed: 22 + depth * 70,
        sway: 8 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
      };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(320, Math.max(90, (w * h) / 6500)));
      flakes = Array.from({ length: count }, () => make(true));
    };

    snowControl.burst = (x: number, y: number) => {
      for (let i = 0; i < 70; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
        const v = 180 + Math.random() * 420;
        sparks.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0,
          max: 1.1 + Math.random() * 1.1,
          size: 2 + Math.random() * 4,
          hue: SPARK_COLOURS[i % SPARK_COLOURS.length],
        });
      }
    };

    snowControl.puff = (x: number, y: number, dir: number) => {
      for (let i = 0; i < 5; i++) {
        sparks.push({
          x: x + (Math.random() - 0.5) * 10,
          y,
          vx: -dir * (40 + Math.random() * 90),
          vy: -(60 + Math.random() * 110),
          life: 0,
          max: 0.45 + Math.random() * 0.35,
          size: 2 + Math.random() * 3,
          hue: i % 2 ? "#ffffff" : "#def3ff",
        });
      }
    };

    snowControl.breath = (x: number, y: number, dir: number) => {
      for (let i = 0; i < 4; i++) {
        sparks.push({
          x: x + dir * i * 3,
          y: y - i,
          vx: dir * (22 + Math.random() * 18),
          vy: -(14 + Math.random() * 16),
          life: -i * 0.07,
          max: 1.3 + Math.random() * 0.5,
          size: 7 + i * 2,
          hue: "#ffffff",
          vapor: true,
        });
      }
    };

    const shell = (x: number, y: number, hue: string) => {
      const n = 84;
      const v = 170 + Math.random() * 80;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.05;
        const k = i % 4 === 0 ? 0.62 : 1; // an inner ring for depth
        sparks.push({ x, y, vx: Math.cos(a) * v * k, vy: Math.sin(a) * v * k, life: 0, max: 1.3 + Math.random() * 0.5, size: 3.4, hue: i % 7 === 0 ? "#fff6d6" : hue, kind: "star" });
      }
      sparks.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.28, size: 70, hue: "#ffffff", kind: "flash" });
    };
    snowControl.firework = (x: number, y: number, fromY: number, hue: string) => {
      const t = 0.55;
      sparks.push({ x, y: fromY, vx: (Math.random() - 0.5) * 30, vy: (y - fromY) / t, life: 0, max: t, size: 3, hue, kind: "rocket", burstY: y });
    };

    snowControl.spray = (x: number, y: number, dir: number) => {
      for (let i = 0; i < 9; i++) {
        sparks.push({
          x: x + (Math.random() - 0.5) * 8,
          y: y - Math.random() * 4,
          vx: -dir * (120 + Math.random() * 160),
          vy: -(40 + Math.random() * 90),
          life: 0,
          max: 0.35 + Math.random() * 0.3,
          size: 1.5 + Math.random() * 2.5,
          hue: i % 3 ? "#ffffff" : "#bfe9ff",
        });
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // "Pause animations" (HUD) stops the snowfall; bursts you cause still play
      const want = document.documentElement.dataset.motion === "off" || rmq.matches ? 0 : snowControl.intensity;
      shown += (want - shown) * Math.min(1, dt * 2.5);
      wind += (snowControl.wind - wind) * Math.min(1, dt * 4);

      ctx.clearRect(0, 0, w, h);
      const visible = Math.round(flakes.length * Math.min(1, shown));
      const extra = Math.max(0, shown - 1); // blizzard: faster + slanted
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.phase += dt * (0.6 + f.depth);
        f.y += f.speed * (1 + extra * 1.5) * dt;
        f.x += (Math.sin(f.phase) * f.sway - wind * (0.08 + f.depth * 0.45) + extra * 90 * f.depth) * dt;
        if (f.y > h + 10) Object.assign(f, make(false));
        if (f.x < -20) f.x += w + 40;
        else if (f.x > w + 20) f.x -= w + 40;
        if (i >= visible) continue;
        const s = f.r * 2;
        ctx.globalAlpha = 0.35 + f.depth * 0.6;
        ctx.drawImage(sprite, f.x - f.r, f.y - f.r, s, s);
      }

      if (sparks.length > MAX_SPARKS) sparks.splice(0, sparks.length - MAX_SPARKS);
      // puffs, breath and sprays belong to the world: when the camera moves, they stay where they were made
      const drift = wind * dt;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.life += dt;
        if (p.life >= p.max) {
          if (p.kind === "rocket") shell(p.x, p.burstY ?? p.y, p.hue);
          sparks.splice(i, 1);
          continue;
        }
        if (p.life < 0) continue;
        if (!p.kind) p.x -= drift;
        if (p.kind === "rocket") {
          // a rising spark with a short fading tail
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = "#fff6d6";
          for (let t = 0; t < 5; t++) {
            ctx.globalAlpha = 0.8 - t * 0.15;
            ctx.beginPath();
            ctx.arc(p.x - p.vx * t * 0.012, p.y - p.vy * t * 0.012, p.size - t * 0.45, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }
        if (p.kind === "flash") {
          const k = p.life / p.max;
          const r = p.size * (0.5 + k);
          ctx.globalAlpha = 0.55 * (1 - k);
          ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
          continue;
        }
        if (p.kind === "star") {
          // glowing star: drag + light gravity, twinkles out
          p.vx *= 1 - dt * 1.6;
          p.vy = p.vy * (1 - dt * 1.6) + 70 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const k = p.life / p.max;
          const tw = k > 0.6 ? 0.55 + 0.45 * Math.sin(p.life * 40 + p.x) : 1;
          ctx.globalAlpha = (1 - k * k) * tw;
          // a short streak behind each star, then the star itself
          ctx.strokeStyle = p.hue;
          ctx.lineWidth = p.size * 0.9 * (1 - k * 0.5);
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.fillStyle = p.hue;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - k * 0.4), 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha *= 0.35;
          ctx.drawImage(sprite, p.x - 7, p.y - 7, 14, 14);
          continue;
        }
        if (p.vapor) {
          // soft round puff that grows and thins out as it rises
          p.vx *= 1 - dt * 1.4;
          p.vy *= 1 - dt * 0.6;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const k = p.life / p.max;
          const r = p.size * (0.6 + k * 1.6);
          ctx.globalAlpha = 0.5 * (1 - k) * Math.min(1, p.life * 8);
          ctx.drawImage(sprite, p.x - r, p.y - r, r * 2, r * 2);
          continue;
        }
        p.vy += 520 * dt;
        p.vx *= 1 - dt * 0.8;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = 1 - p.life / p.max;
        ctx.fillStyle = p.hue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 6);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      snowControl.burst = () => {};
      snowControl.breath = () => {};
      snowControl.spray = () => {};
      snowControl.puff = () => {};
      snowControl.firework = () => {};
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}
