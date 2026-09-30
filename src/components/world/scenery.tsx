"use client";

/* eslint-disable @next/next/no-img-element */
import { forwardRef, memo, type CSSProperties, type RefObject } from "react";
import { PROPS, TILES } from "./assets";
import { DoorFacade } from "./props";
import { CABIN, type Placement, type World, type Zone } from "./spec";

const OUTDOOR = new Set(["forest", "waterfront", "gulf", "yard", "ride", "sky"]);

/**
 * Range [a, b] of world x mapped onto a parallax layer moving at factor f:
 * the layer's left edge reaches the player's screen x when the player reaches
 * a, and its right edge leaves the player when the player reaches b.
 * Open ends (for layers that run off the start/end of the world) extend a screen.
 */
function span(W: World, a: number, b: number, f: number, open: { l?: boolean; r?: boolean } = {}): CSSProperties {
  const left = W.cx + f * (a - W.cx) - (open.l ? 2 * W.vw : 0);
  const right = W.cx + f * (b - W.cx) + (open.r ? 2 * W.vw : 0);
  return { left, width: right - left };
}

function rangeOf(W: World, pred: (z: Zone) => boolean) {
  const zs = W.zones.filter(pred);
  return { a: Math.min(...zs.map((z) => z.x0)), b: Math.max(...zs.map((z) => z.x1)) };
}

/** Camera y the ride has when the player is at world x (for placing sky things along the climb). */
function rideCamY(W: World, wx: number) {
  const R = W.ride;
  if (wx <= R.bx) return 0;
  if (wx >= R.tx) return R.Sy;
  const d = (wx - R.bx) / R.cos;
  return R.by - d * R.sin - R.cruiseFeet;
}

const CLOUD_SEA =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 120'%3E%3Cpath d='M0 120 L0 58 Q20 30 52 40 Q70 12 104 26 Q130 4 160 26 Q186 14 206 34 Q236 10 268 30 Q296 18 314 38 Q346 20 372 42 Q392 36 400 58 L400 120 Z' fill='%23ffffff'/%3E%3Cpath d='M0 120 L0 84 Q60 66 120 80 Q200 60 280 82 Q340 70 400 84 L400 120 Z' fill='%23e3f3ff'/%3E%3C/svg%3E\")";

/** Sky and the slow parallax layers behind the world (they move on x and y). */
export const Backdrop = memo(function Backdrop({ world: W, altitudeRef }: { world: World; altitudeRef: RefObject<HTMLDivElement | null> }) {
  const R = W.ride;
  const all = { a: W.worldX0, b: W.worldX1 };
  const forest = rangeOf(W, (z) => z.level === 0);
  const bahrain = rangeOf(W, (z) => z.level === 1);
  const peak = { a: R.bx, b: W.worldX1 };
  const ground = W.zones[0].ground;
  const fadeMask = "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)";
  const clouds = W.zones
    .filter((z) => OUTDOOR.has(z.theme))
    .flatMap((z, zi) => {
      const n = Math.max(1, Math.round((z.x1 - z.x0) / (W.u * (z.theme === "ride" ? 0.7 : 1.1))));
      return Array.from({ length: n }, (_, k) => {
        const wx = z.x0 + ((k + 0.5) / n) * (z.x1 - z.x0);
        const seed = (zi * 7 + k * 13) % 10;
        return { wx, seed, lift: rideCamY(W, wx) * 0.55 };
      });
    });
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute inset-0" style={{ background: TILES.sky }} />
      {/* deeper blue with altitude */}
      <div
        ref={altitudeRef}
        className="absolute inset-0"
        style={{ opacity: 0, background: "linear-gradient(180deg, #0b4fa8 0%, #1677d6 45%, #56b6f5 80%, #bfe6ff 100%)" }}
      >
        {/* aurora ribbons, only this high up */}
        <div className="aurora absolute inset-x-[-10%] top-[4%] h-[38%]" />
        <div className="aurora aurora-2 absolute inset-x-[-10%] top-[10%] h-[30%]" />
      </div>

      {/* far mountains, the whole way */}
      <div data-parallax="0.12" className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        <div
          className="absolute"
          style={{
            ...span(W, all.a, all.b, 0.12, { l: true, r: true }),
            top: ground - W.u * 0.5,
            height: W.u * 0.42,
            backgroundImage: `url(${TILES.farMountains.src})`,
            backgroundSize: `auto 100%`,
            backgroundRepeat: "repeat-x",
            opacity: 0.9,
          }}
        />
      </div>

      {/* a sea of clouds you rise above near the top */}
      <div data-parallax="0.35" className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        <div
          className="absolute"
          style={{
            ...span(W, peak.a, peak.b, 0.35, { r: true }),
            top: W.vh * 0.74 + R.Sy * 0.35,
            height: W.vh * 0.7,
            backgroundImage: CLOUD_SEA,
            backgroundSize: `${W.u * 0.9}px ${W.u * 0.27}px`,
            backgroundRepeat: "repeat-x",
            backgroundColor: "transparent",
            WebkitMaskImage: "linear-gradient(90deg, transparent, #000 20%)",
            maskImage: "linear-gradient(90deg, transparent, #000 20%)",
          }}
        >
          <div className="absolute inset-x-0 bottom-0 top-[26%] bg-linear-to-b from-[#e3f3ff] to-white" />
        </div>
      </div>

      {/* Manama skyline far away over the Bahrain level */}
      <div data-parallax="0.3" className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        <div
          className="absolute"
          style={{
            ...span(W, bahrain.a, bahrain.b, 0.3),
            top: ground - W.u * 0.38,
            height: W.u * 0.3,
            backgroundImage: `url(${TILES.farSkyline.src})`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
            WebkitMaskImage: fadeMask,
            maskImage: fadeMask,
          }}
        />
      </div>

      {/* snowy hills with small pines over the forest and at the foot of the mountain */}
      <div data-parallax="0.45" className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        {[forest, peak].map((r, k) => (
          <div
            key={k}
            className="absolute"
            style={{
              ...span(W, r.a, r.b, 0.45, { l: k === 0, r: k === 1 }),
              top: ground - W.u * 0.3,
              height: W.u * 0.32,
              backgroundImage: `url(${TILES.midHills.src})`,
              backgroundSize: "auto 100%",
              backgroundRepeat: "repeat-x",
              WebkitMaskImage: fadeMask,
              maskImage: fadeMask,
            }}
          />
        ))}
      </div>

      {/* frozen sea behind the waterfront */}
      <div data-parallax="0.7" className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        <div
          className="absolute"
          style={{
            ...span(W, bahrain.a, bahrain.b, 0.7),
            top: ground - W.u * 0.085,
            height: W.u * 0.1,
            backgroundImage: `url(${TILES.frozenSea.src})`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
            WebkitMaskImage: fadeMask,
            maskImage: fadeMask,
          }}
        />
      </div>

      {/* a falcon (Bahrain's national bird) circling over Manama */}
      <div data-parallax="0.4" className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        <div className="absolute" style={{ ...span(W, bahrain.a, bahrain.b, 0.4), top: W.u * 0.16, height: W.u * 0.2 }}>
          <div className="fx-falcon absolute left-[30%] top-0">
            <svg viewBox="0 0 120 60" style={{ width: W.u * 0.09 }} aria-hidden="true">
              <g className="fx-wing-l">
                <path d="M58 30 Q40 10 6 14 Q26 22 34 30 Z" fill="#3b2a1e" />
              </g>
              <g className="fx-wing-r">
                <path d="M62 30 Q80 10 114 14 Q94 22 86 30 Z" fill="#3b2a1e" />
              </g>
              <path d="M50 30 Q60 22 72 30 Q66 38 60 46 Q54 38 50 30 Z" fill="#5a3f2a" />
              <path d="M69 27 L78 25 L72 31 Z" fill="#e2a33b" />
              <circle cx="67" cy="27" r="1.4" fill="#fff" />
            </svg>
          </div>
        </div>
      </div>

      {/* clouds (they sink below you as you climb) */}
      <div data-parallax="0.55" className="absolute left-0 top-0 h-0 w-0 will-change-transform">
        {clouds.map(({ wx, seed, lift }, k) => {
          const h = W.u * (0.07 + (seed % 3) * 0.018);
          const cloud = PROPS[seed % 2 ? "cloud-a" : "cloud-b"];
          if (!cloud) return null;
          return (
            <img
              key={k}
              src={cloud.src}
              alt=""
              className="absolute max-w-none"
              style={{ left: wx * 0.55 - W.cx * 0.55 + W.cx, top: lift + W.u * (0.1 + (seed % 4) * 0.07), height: h, opacity: 0.92 }}
            />
          );
        })}
      </div>
    </div>
  );
});

/** Drawn stand-ins for walkable props, so a platform is never invisible if its art is missing. */
function PlatformFallback({ p }: { p: Placement }) {
  const w = p.w ?? p.h * 2;
  const style: CSSProperties = { left: p.x - w / 2, top: p.ground - p.h, width: w, height: p.h };
  if (p.name.startsWith("plyo-box")) {
    return (
      <div aria-hidden="true" className="absolute rounded-[6px] border-[3px] border-[#0b1020] bg-linear-to-b from-[#2b3446] to-[#161c28]" style={style}>
        <span className="absolute inset-x-0 top-[18%] h-[10%] bg-flag" />
        <span className="absolute inset-x-[10%] top-0 h-[6%] rounded-b bg-white/15" />
      </div>
    );
  }
  if (p.name === "snow-ledge") {
    return (
      <div aria-hidden="true" className="absolute" style={style}>
        <div className="absolute inset-x-[4%] bottom-0 top-[10%] rounded-t-[14px] border-[3px] border-[#152343] bg-linear-to-b from-[#5a6f9c] to-[#3a4f78]" />
        <div className="absolute inset-x-0 top-0 h-[22%] rounded-full bg-white shadow-[0_3px_0_#cfe8fb]" />
      </div>
    );
  }
  return null;
}

function PropImg({ p }: { p: Placement }) {
  const meta = PROPS[p.name];
  if (!meta) return <PlatformFallback p={p} />;
  const w = p.w ?? p.h * meta.aspect;
  const top = p.ground - p.h + p.h * (meta.sink ?? 0);
  return (
    <>
      {p.fx === "glow" && (
        <span
          aria-hidden="true"
          className="fx-glow absolute rounded-full"
          style={{ left: p.x - p.h * 0.35, top: top - p.h * 0.05, width: p.h * 0.7, height: p.h * 0.7 }}
        />
      )}
      {p.fx === "flag" && (
        // the cloth hangs behind the pole from its attach point (0.531 w, 0.052 h) and waves from its hoist
        <img
          src="/props/heritage/big-flag-cloth.svg"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="fx-flag absolute max-w-none select-none"
          style={{ left: p.x - w / 2 + 0.531 * w, top: top + 0.052 * p.h, height: 0.2305 * p.h, width: 0.369 * p.h }}
        />
      )}
      <img
        src={meta.src}
        alt=""
        aria-hidden="true"
        draggable={false}
        data-platform={p.platform ? "" : undefined}
        data-x0={p.platform ? Math.round(p.x - w / 2) : undefined}
        data-x1={p.platform ? Math.round(p.x + w / 2) : undefined}
        className={`absolute max-w-none select-none ${p.platform ? "origin-bottom" : ""} ${p.fx === "sway" ? "fx-sway" : p.fx === "bob" ? "fx-bob" : ""}`}
        style={{
          left: p.x - w / 2,
          top,
          width: w,
          height: p.h,
          scale: p.flip ? "-1 1" : undefined,
          animationDelay: `${-((p.x * 0.37) % 5).toFixed(2)}s`,
        }}
      />
      {p.fx === "servers" && <ServerLeds left={p.x - w / 2} top={top} w={w} h={p.h} seed={p.x} />}
      {p.fx === "holo" && <HoloCode left={p.x - w / 2} top={top} w={w} h={p.h} />}
      {p.label && (
        <span
          aria-hidden="true"
          className={`absolute grid select-none place-items-center whitespace-nowrap font-display leading-none tracking-wide ${p.label.tone === "neon" ? "neon-text" : "text-[#ffe2a6]"}`}
          style={{
            left: p.x - w / 2 + p.label.box[0] * w,
            top: top + p.label.box[1] * p.h,
            width: (p.label.box[2] - p.label.box[0]) * w,
            height: (p.label.box[3] - p.label.box[1]) * p.h,
            fontSize: (p.label.box[3] - p.label.box[1]) * p.h * 0.62,
            textShadow: p.label.tone === "wood" ? "0 2px 0 #3a200c, 0 0 1px #3a200c" : undefined,
          }}
        >
          {p.label.text}
        </span>
      )}
    </>
  );
}

/** A wind-turbine rotor seen head-on, with a soft motion-blur disc over the painted blades underneath. */
function Rotor({ x, y, r, speed }: { x: number; y: number; r: number; speed: number }) {
  return (
    <svg aria-hidden="true" viewBox="-50 -50 100 100" className="fx-spin absolute" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, animationDuration: `${speed}s` }}>
      <circle r="49" fill="rgb(232 245 255 / 0.14)" />
      {[0, 120, 240].map((a) => (
        <path key={a} d="M-3.4 -5 L-2.2 -46 Q0 -50 2.2 -46 L3.4 -5 Z" fill="#f7fbff" stroke="#8ea6c2" strokeWidth="1.6" strokeLinejoin="round" transform={`rotate(${a})`} />
      ))}
      <circle r="6.5" fill="#9fb2c8" stroke="#5d6f86" strokeWidth="2" />
    </svg>
  );
}

/** A ceiling fan seen from below-front: blades turn inside a flattened ellipse. */
function CeilingFan({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <div aria-hidden="true" className="absolute" style={{ left: x - r, top: y - r * 0.28, width: r * 2, height: r * 0.56 }}>
      <div className="absolute inset-0 rounded-[50%] bg-[rgb(40_48_66/0.55)]" />
      {/* squash outside, spin inside, so the blades turn flat like a real fan seen from below */}
      <div className="absolute left-0 top-1/2 w-full" style={{ height: r * 2, transform: "translateY(-50%) scaleY(0.28)" }}>
        <svg viewBox="-50 -50 100 100" className="fx-spin h-full w-full" style={{ animationDuration: "0.9s" }}>
          {[0, 72, 144, 216, 288].map((a) => (
            <path key={a} d="M-5 -6 L-7 -47 Q0 -50 7 -47 L5 -6 Z" fill="#1f2433" stroke="#0b0e16" strokeWidth="2" opacity="0.9" transform={`rotate(${a})`} />
          ))}
        </svg>
      </div>
      <div className="absolute left-1/2 top-1/2 size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0b0e16] bg-[#c9d3ea]" style={{ height: r * 0.16, width: r * 0.28 }} />
    </div>
  );
}

/** Moving details painted into Sayed's scenes: the Bahrain WTC turbines spin, the gym ceiling fan turns. */
function SceneFx({ W }: { W: World }) {
  const bh = W.scenes.find((s) => s.id === "bahrain");
  const gym = W.scenes.find((s) => s.id === "gym");
  return (
    <>
      {bh &&
        [0.4, 0.511, 0.617].map((fy, i) => (
          <Rotor key={i} x={bh.x + 0.672 * bh.w} y={bh.y + fy * bh.h} r={0.05 * bh.h} speed={2.2 + i * 0.35} />
        ))}
      {gym && <CeilingFan x={gym.x + 0.496 * gym.w} y={gym.y + 0.11 * gym.h} r={0.155 * gym.w} />}
    </>
  );
}

/** Status LEDs blinking on the server rack's units (rows measured on server-rack.svg). */
const LED_ROWS = [0.158, 0.237, 0.33, 0.452, 0.55, 0.623, 0.716, 0.814, 0.888];
const LED_TONES = ["#39ff8f", "#ffb020", "#58c8ff"];
function ServerLeds({ left, top, w, h, seed }: { left: number; top: number; w: number; h: number; seed: number }) {
  const s = Math.max(3, h * 0.012);
  return (
    <span aria-hidden="true" className="pointer-events-none absolute" style={{ left, top, width: w, height: h }}>
      {LED_ROWS.map((y, i) => {
        const k = (Math.round(seed) + i * 7) % 11;
        const tone = LED_TONES[(i + Math.round(seed)) % LED_TONES.length];
        return (
          <span
            key={i}
            className="fx-blink absolute rounded-full"
            style={{
              left: `${60 + (k % 3) * 4}%`,
              top: `${y * 100}%`,
              width: s,
              height: s,
              background: tone,
              boxShadow: `0 0 ${s * 2}px ${tone}`,
              animationDuration: `${0.7 + (k % 5) * 0.37}s`,
              animationDelay: `${-(k * 0.23).toFixed(2)}s`,
            }}
          />
        );
      })}
    </span>
  );
}

/** Lines of "code" scrolling up the lab's hologram screen (screen rect measured on holo-screen.svg). */
const CODE = [0.62, 0.38, 0.8, 0.5, 0.7, 0.28, 0.9, 0.44, 0.66, 0.35, 0.74, 0.55];
function HoloCode({ left, top, w, h }: { left: number; top: number; w: number; h: number }) {
  const line = Math.max(4, h * 0.028);
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute overflow-hidden"
      style={{ left: left + w * 0.13, top: top + h * 0.09, width: w * 0.74, height: h * 0.36 }}
    >
      <span className="fx-code absolute inset-x-0 top-0 flex flex-col" style={{ gap: line * 0.9 }}>
        {[...CODE, ...CODE].map((f, i) => (
          <span key={i} className="flex" style={{ gap: line * 0.8, paddingLeft: `${(i % 3) * 8}%` }}>
            <span className="rounded-full bg-[#8fe3ff]/80" style={{ width: `${f * 40}%`, height: line }} />
            <span className="rounded-full bg-[#ffb020]/70" style={{ width: `${(1 - f) * 30}%`, height: line }} />
          </span>
        ))}
      </span>
    </span>
  );
}

/** The mountainside under the cable, drawn as one big snowy polygon with rock strata. */
function Mountain({ W }: { W: World }) {
  const R = W.ride;
  const pts = R.slope;
  const minX = pts[0][0];
  const maxX = pts[pts.length - 1][0];
  const minY = Math.min(...pts.map((p) => p[1])) - 4;
  const maxY = R.by + W.vh * 0.5;
  const P = (x: number, y: number) => `${(x - minX).toFixed(1)} ${(y - minY).toFixed(1)}`;
  const top = pts.map(([x, y]) => P(x, y)).join(" L ");
  const shade = (dy: number) => pts.map(([x, y]) => P(x, y + dy)).join(" L ");
  const w = maxX - minX;
  const h = maxY - minY;
  return (
    <svg
      aria-hidden="true"
      className="absolute max-w-none"
      style={{ left: minX, top: minY, width: w, height: h }}
      viewBox={`0 0 ${w.toFixed(1)} ${h.toFixed(1)}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dff1ff" />
          <stop offset="0.35" stopColor="#b9dcf5" />
          <stop offset="1" stopColor="#7fa6d6" />
        </linearGradient>
      </defs>
      <path d={`M ${top} L ${P(maxX, maxY)} L ${P(minX, maxY)} Z`} fill="url(#mtn)" />
      {/* rock strata following the slope */}
      {[0.12, 0.3, 0.52].map((k, i) => (
        <path key={i} d={`M ${shade(W.u * k)}`} fill="none" stroke={i % 2 ? "#6f8fbf" : "#8aa9d3"} strokeWidth={W.u * (0.03 - i * 0.006)} strokeLinecap="round" opacity={0.55} />
      ))}
      {/* the snow crest */}
      <path d={`M ${top}`} fill="none" stroke="#ffffff" strokeWidth={W.u * 0.03} strokeLinejoin="round" />
      <path d={`M ${shade(W.u * 0.018)}`} fill="none" stroke="#9fd0f2" strokeWidth={W.u * 0.008} opacity={0.8} />
    </svg>
  );
}

/** Steel lift tower. Uses the drawn pylon when the art kit provides it. */
function Pylon({ W, x, base, top }: { W: World; x: number; base: number; top: number }) {
  const meta = PROPS["pylon"];
  if (meta) {
    // art: 200 x 1000, cable contact at (100, 53.8), base at the bottom edge
    const k = (base - top) / (1000 - 53.8);
    return (
      <img src={meta.src} alt="" aria-hidden="true" className="absolute max-w-none" style={{ left: x - 100 * k, top: top - 53.8 * k, width: 200 * k, height: 1000 * k }} />
    );
  }
  const over = W.u * 0.05; // crossarm pokes a little above the cable
  const h = base - top + over;
  const w = Math.max(W.u * 0.08, h * 0.2);
  return (
    <svg aria-hidden="true" className="absolute max-w-none" style={{ left: x - w / 2, top: top - over, width: w, height: h }} viewBox="0 0 100 500" preserveAspectRatio="none">
      <path d="M38 40 L62 40 L78 500 L22 500 Z" fill="none" stroke="#5e6678" strokeWidth="6" />
      {Array.from({ length: 9 }, (_, i) => {
        const y0 = 40 + i * 51;
        const y1 = y0 + 51;
        const l0 = 38 - (i / 9) * 16;
        const r0 = 62 + (i / 9) * 16;
        const l1 = 38 - ((i + 1) / 9) * 16;
        const r1 = 62 + ((i + 1) / 9) * 16;
        return <path key={i} d={`M${l0} ${y0} L${r1} ${y1} M${r0} ${y0} L${l1} ${y1}`} stroke="#8a93a8" strokeWidth="3" />;
      })}
      <rect x="4" y="22" width="92" height="16" rx="4" fill="#9aa3b8" stroke="#0b1020" strokeWidth="3" />
      <circle cx="22" cy="18" r="9" fill="#2b3446" stroke="#0b1020" strokeWidth="3" />
      <circle cx="78" cy="18" r="9" fill="#2b3446" stroke="#0b1020" strokeWidth="3" />
      <rect x="2" y="16" width="96" height="8" rx="4" fill="#ffffff" />
      <rect x="40" y="60" width="20" height="10" fill="#d7262e" />
    </svg>
  );
}

/** The haul rope from the valley station to the summit station. */
function CableLine({ W }: { W: World }) {
  const R = W.ride;
  const x0 = R.bx - W.u * 0.3;
  const y0 = R.by - R.grip + W.u * 0.3 * (R.sin / R.cos);
  const x1 = R.tx + W.u * 0.35;
  const y1 = R.ty - R.grip - W.u * 0.35 * (R.sin / R.cos);
  const minX = Math.min(x0, x1);
  const minY = Math.min(y0, y1) - 6;
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0) + 12;
  return (
    <svg aria-hidden="true" className="absolute max-w-none overflow-visible" style={{ left: minX, top: minY, width: w, height: h }} viewBox={`0 0 ${w} ${h}`}>
      <line x1={x0 - minX} y1={y0 - minY} x2={x1 - minX} y2={y1 - minY} stroke="#1a2130" strokeWidth={Math.max(2.5, W.u * 0.004)} strokeLinecap="round" />
      <line x1={x0 - minX} y1={y0 - minY + 5} x2={x1 - minX} y2={y1 - minY + 5} stroke="#2b3446" strokeWidth={Math.max(1.5, W.u * 0.0025)} strokeLinecap="round" opacity={0.7} />
    </svg>
  );
}

/** Soft cloud bank the cable passes through half-way up. */
function CloudBank({ W, front }: { W: World; front?: boolean }) {
  const R = W.ride;
  const dm = (R.cloud.d0 + R.cloud.d1) / 2;
  const cxw = R.bx + dm * R.cos;
  const cyw = R.by - dm * R.sin - W.vh * 0.28;
  const len = (R.cloud.d1 - R.cloud.d0) * 1.3 + W.vw * 0.4;
  const angle = -Math.atan2(R.sin, R.cos) * (180 / Math.PI);
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute"
      style={{
        left: cxw - len / 2,
        top: cyw - W.vh * 0.7,
        width: len,
        height: W.vh * 1.4,
        transform: `rotate(${angle}deg)`,
        background: "radial-gradient(50% 50% at 50% 50%, rgba(255,255,255,0.96) 0%, rgba(245,251,255,0.85) 38%, rgba(240,249,255,0.35) 62%, rgba(240,249,255,0) 72%)",
        opacity: front ? 0.55 : 1,
      }}
    />
  );
}

/** World-space art: backgrounds of corridors, scene images, the lift, props, ground. */
export const WorldArt = memo(function WorldArt({ world: W, layer }: { world: World; layer: "back" | "ground" | "front" }) {
  const R = W.ride;
  if (layer === "front") {
    const s = W.summitSign;
    return (
      <>
        <CloudBank W={W} front />
        <img src={TILES.summitSign.src} alt="" aria-hidden="true" className="absolute max-w-none" style={{ left: s.x, top: s.y, width: s.w, height: s.h }} />
      </>
    );
  }

  if (layer === "back") {
    return (
      <>
        {/* indoor walls */}
        {W.zones.map((z, i) => {
          if (z.kind !== "corridor" || (z.theme !== "gym" && z.theme !== "office")) return null;
          const t = z.theme === "gym" ? TILES.wallGym : TILES.wallOffice;
          const s = W.vh / t.srcH;
          return (
            <div
              key={i}
              className="absolute top-0"
              style={{
                left: z.x0 - 2,
                width: z.x1 - z.x0 + 4,
                height: z.ground + 2,
                backgroundColor: t.fallback,
                backgroundImage: `url(${t.src})`,
                backgroundSize: `${t.w * s}px ${t.h * s}px`,
                backgroundPosition: `0 ${z.ground - t.floorY * s}px`,
                backgroundRepeat: "repeat-x",
              }}
            />
          );
        })}

        <Mountain W={W} />
        <CloudBank W={W} />

        {/* Sayed's scene art as set pieces */}
        {W.scenes.map((s) => {
          const f = W.u * 0.2;
          // the visible part of the art (a crop trims palms / signs the painting cuts in half), faded into the world
          const a = (s.crop?.l ?? 0) * s.w;
          const b = s.w - (s.crop?.r ?? 0) * s.w;
          const fl = s.fade.l === true ? f : s.fade.l ? s.fade.l * W.u : 0;
          const fr = s.fade.r === true ? f : s.fade.r ? s.fade.r * W.u : 0;
          const mask =
            fl || fr || a > 0 || b < s.w ? `linear-gradient(90deg, transparent ${a}px, #000 ${a + fl}px, #000 ${b - fr}px, transparent ${b}px)` : undefined;
          return (
            <img
              key={s.id}
              src={s.src}
              alt={s.alt}
              width={Math.round(s.w)}
              height={Math.round(s.h)}
              draggable={false}
              decoding="async"
              className="absolute max-w-none select-none"
              style={{ left: s.x, top: s.y, width: s.w, height: s.h, WebkitMaskImage: mask, maskImage: mask }}
            />
          );
        })}

        <SceneFx W={W} />

        {W.props.filter((p) => p.layer === "back").map((p, i) => (
          <PropImg key={`b${i}`} p={p} />
        ))}
        {R.pylons.map((p, i) => (
          <Pylon key={i} W={W} {...p} />
        ))}
        <CableLine W={W} />
      </>
    );
  }

  // ---- ground layer: floors, doors, pillars, front props ----
  const f = W.u * 0.2;
  const tileOf = (z: Zone | undefined) =>
    !z
      ? null
      : z.theme === "gym"
        ? TILES.groundGym
        : z.theme === "office"
          ? TILES.groundOffice
          : z.theme === "forest" || z.theme === "yard"
            ? TILES.groundIce
            : z.theme === "waterfront"
              ? TILES.groundIceCity
              : z.theme === "gulf"
                ? TILES.groundGulf
                : null;
  const SNOW = new Set<unknown>([TILES.groundIce, TILES.groundIceCity]);
  return (
    <>
      {W.zones.map((z, i) => {
        const t = tileOf(z);
        if (!t) return null;
        // indoor scene art keeps its own floor; outdoor scenes get the strip under their faded edges only
        if (z.kind === "scene" && (z.theme === "gym" || z.theme === "office")) return null;
        const s = W.vh / t.srcH;
        // outdoor scene edges: the strip runs a little into the art and feathers out, so the tiled snow blends
        // into the painted ground instead of meeting it at a hard vertical line
        const feather = f * 0.7;
        const yardEnd = z.theme === "yard" ? W.u * 0.16 : 0; // under the valley station deck, then fades
        // forest snow → city snow: the new strip starts early and fades in over the old one (no hard line in the ground)
        const prev = W.zones[i - 1];
        const blend = z.kind === "corridor" && prev?.kind === "corridor" && tileOf(prev) !== t && SNOW.has(t) && SNOW.has(tileOf(prev)) ? W.u * 0.4 : 0;
        const edgeMask =
          blend || yardEnd
            ? `linear-gradient(90deg, ${blend ? "transparent" : "#000"}, #000 ${blend}px, #000 calc(100% - ${yardEnd * 0.6}px), ${yardEnd ? "transparent" : "#000"})`
            : undefined;
        const segs: [number, number, string | undefined][] =
          z.kind === "scene"
            ? [
                [z.x0, z.x0 + f + feather, `linear-gradient(90deg, #000 ${f}px, transparent)`],
                [z.x1 - f - feather, z.x1, `linear-gradient(270deg, #000 ${f}px, transparent)`],
              ]
            : [[z.x0 - 1 - blend, z.x1 + 1 + yardEnd, edgeMask]];
        return segs.map(([a, b, mask], k) => (
          <div
            key={`${i}-${k}`}
            className="absolute"
            style={{
              left: a,
              width: b - a,
              WebkitMaskImage: mask,
              maskImage: mask,
              top: z.ground - t.surfaceY * s,
              height: W.vh - (z.ground - t.surfaceY * s) + 2,
              background: `url(${t.src}) ${-a}px 0 / ${t.w * s}px ${t.h * s}px repeat-x, ${t.fallback}`,
            }}
          />
        ));
      })}

      {W.pillars.map((p, i) => {
        const meta = PROPS[p.kind === "gym" ? "gym-pillar" : "office-pillar"];
        const w = W.u * 0.16;
        return meta ? (
          <img key={`p${i}`} src={meta.src} alt="" aria-hidden="true" className="absolute max-w-none" style={{ left: p.x - w / 2, top: 0, width: w, height: W.vh, objectFit: "fill" }} />
        ) : null;
      })}
      {W.doors.map((d) => (
        <DoorFacade key={d.kind} door={{ ...d, x: d.x - d.w / 2 }} vh={W.vh} charH={W.charH} />
      ))}
      {W.props.filter((p) => p.layer !== "back").map((p, i) => (
        <PropImg key={`f${i}`} p={p} />
      ))}
    </>
  );
});

/**
 * The cable car, in two layers around the player: the back (roof, hanger,
 * rear wall) sits behind him, the front (waist panel, window frame) in front,
 * so he stands inside it. Positioned every frame by the stage.
 */
export const Cabin = memo(forwardRef<HTMLDivElement, { world: World; layer: "back" | "front" }>(function Cabin({ world: W, layer }, ref) {
  const meta = PROPS[layer === "back" ? "gondola-back" : "gondola-front"];
  const w = CABIN.w * W.unit;
  const h = CABIN.h * W.unit;
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 will-change-transform"
      style={{ width: w, height: h, transformOrigin: `${(160 / CABIN.w) * 100}% ${(CABIN.gripY / CABIN.h) * 100}%` }}
    >
      {meta && layer === "front" ? (
        // two sliding door leaves (the same art split down the middle): the left leaf slides over the right
        // one while he boards at the valley station, the right leaf slides over the left as he steps out on top
        <>
          <div data-door="r" className="absolute inset-0" style={{ clipPath: "inset(0 0 0 50%)" }}>
            <img src={meta.src} alt="" className="h-full w-full max-w-none" />
          </div>
          <div data-door="l" className="absolute inset-0" style={{ clipPath: "inset(0 49.6% 0 0)" }}>
            <img src={meta.src} alt="" className="h-full w-full max-w-none" />
          </div>
        </>
      ) : meta ? (
        <img src={meta.src} alt="" className="h-full w-full max-w-none" />
      ) : layer === "back" ? (
        <svg viewBox="0 0 320 430" className="h-full w-full">
          <rect x="150" y="14" width="20" height="92" fill="#3a4152" stroke="#0b1020" strokeWidth="4" />
          <rect x="128" y="4" width="64" height="22" rx="8" fill="#5e6678" stroke="#0b1020" strokeWidth="4" />
          <path d="M36 150 Q40 104 90 100 L230 100 Q280 104 284 150 L284 404 L36 404 Z" fill="#3b1a24" stroke="#0b1020" strokeWidth="5" />
          <path d="M28 150 Q34 92 92 90 L228 90 Q286 92 292 150 L292 170 L28 170 Z" fill="#d7262e" stroke="#0b1020" strokeWidth="5" />
          <path d="M28 150 L292 150 L292 162 L28 162 Z" fill="#ffffff" />
          <path d="M40 92 Q90 70 160 72 Q230 70 280 92 L276 102 Q160 84 44 102 Z" fill="#ffffff" />
          <rect x="70" y="340" width="180" height="22" rx="6" fill="#5a1c24" />
        </svg>
      ) : (
        <svg viewBox="0 0 320 430" className="h-full w-full">
          <path d="M28 170 L44 170 L44 318 L28 318 Z M276 170 L292 170 L292 318 L276 318 Z" fill="#b81f27" stroke="#0b1020" strokeWidth="4" />
          <rect x="156" y="170" width="8" height="148" fill="#b81f27" stroke="#0b1020" strokeWidth="3" />
          <path d="M26 318 L294 318 L294 404 Q294 416 280 416 L40 416 Q26 416 26 404 Z" fill="#d7262e" stroke="#0b1020" strokeWidth="5" />
          <rect x="26" y="344" width="268" height="12" fill="#ffffff" />
          <path d="M40 186 L130 186 L60 300 L40 300 Z" fill="#ffffff" opacity="0.14" />
          <path d="M120 416 L128 430 L136 416 Z M190 416 L198 428 L206 416 Z" fill="#bfe9ff" stroke="#0b1020" strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}));

/** Near snow drifts that slide past faster than the ground (1.3x) on outdoor stretches. */
export const Foreground = memo(function Foreground({ world: W }: { world: World }) {
  const items = W.zones
    .filter((z) => z.kind === "corridor" && (z.theme === "forest" || z.theme === "waterfront"))
    .flatMap((z, zi) => {
      const n = Math.max(1, Math.round((z.x1 - z.x0) / (W.u * 1.6)));
      return Array.from({ length: n }, (_, k) => ({ x: z.x0 + ((k + 0.7) / n) * (z.x1 - z.x0), seed: zi + k }));
    });
  return (
    <div data-parallax="1.3" aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-40 h-0 w-0 will-change-transform">
      {items.map((it, k) => {
        const meta = PROPS["snow-drift"];
        if (!meta) return null;
        const h = W.u * (0.055 + (it.seed % 3) * 0.01);
        // placed so it passes the player's screen x when the player is at it.x
        const left = it.x * 1.3 - W.cx * 0.3 - (h * meta.aspect) / 2;
        return <img key={k} src={meta.src} alt="" className="absolute max-w-none" style={{ left, top: W.vh - h * 0.62, height: h, width: h * meta.aspect }} />;
      })}
    </div>
  );
});
