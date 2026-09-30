"use client";

import { memo } from "react";
import type { Critter, World } from "./spec";

/**
 * Bahrain's wildlife and the moving bits of kit that make the world feel alive.
 * Each critter is a small stack of frames (the art is drawn in matching pairs);
 * WorldStage makes the shy ones react when Sayed comes close (flamingos and
 * bulbuls fly off, the hare hops away, the punching bag swings) and puts them
 * back once they are off-screen, so they replay like everything else.
 */
/** a = rest frame; b / c = motion frames; aspect = w/h; flyH = motion-frame height / rest height (same drawing scale) */
const ART: Record<Critter["kind"], { a: string; b?: string; c?: string; aspect: number; aspectFly?: number; flyH?: number }> = {
  flamingo: { a: "/props/life/flamingo-stand.svg", b: "/props/life/flamingo-fly-a.svg", c: "/props/life/flamingo-fly-b.svg", aspect: 111 / 231, aspectFly: 289 / 176, flyH: 176 / 231 },
  bulbul: { a: "/props/life/bulbul-perch.svg", b: "/props/life/bulbul-fly.svg", aspect: 60.5 / 51 },
  hare: { a: "/props/life/hare-sit.svg", b: "/props/life/hare-hop.svg", aspect: 126 / 109.5 },
  camel: { a: "/props/life/camel.svg", aspect: 203.5 / 178 },
  bag: { a: "/props/life/heavy-bag.svg", aspect: 100 / 562 },
  fish: { a: "/props/life/fish-a.svg", aspect: 103.5 / 46 },
  fish2: { a: "/props/life/fish-b.svg", aspect: 103.5 / 46 },
  oyster: { a: "", aspect: 120 / 72 },
};

/** A pearl oyster sitting in the ice; WorldStage swings its lid open ([data-lid], hinge at 14,44) and shows the pearl. */
function Oyster() {
  return (
    <svg viewBox="0 0 120 72" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <radialGradient id="pearl" cx="0.38" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#f6eefa" />
          <stop offset="1" stopColor="#d6c8e6" />
        </radialGradient>
      </defs>
      {/* the snow it sits in */}
      <ellipse cx="60" cy="64" rx="58" ry="7" fill="#f4fbff" stroke="#bfe0f5" strokeWidth="2" />
      {/* bottom shell with its mother-of-pearl lining */}
      <path d="M10 44 Q12 64 60 66 Q108 64 110 44 Q84 53 60 53 Q36 53 10 44 Z" fill="#b8a58c" stroke="#0e1b33" strokeWidth="3" strokeLinejoin="round" />
      <path d="M20 46 Q60 60 100 46 Q82 51 60 51 Q38 51 20 46 Z" fill="#ece6f4" />
      <path d="M26 56 Q60 64 94 56" stroke="#8f7c63" strokeWidth="2" fill="none" strokeLinecap="round" />
      <g data-pearl="" style={{ opacity: 0 }}>
        <circle cx="60" cy="45" r="15" fill="#fff5d8" opacity="0.55" />
        <circle cx="60" cy="46" r="8.5" fill="url(#pearl)" stroke="#0e1b33" strokeWidth="2" />
        <circle cx="57" cy="43" r="2.4" fill="#ffffff" />
        <path data-glint="" d="M60 26 L62 33 L69 35 L62 37 L60 44 L58 37 L51 35 L58 33 Z" fill="#ffffff" style={{ opacity: 0 }} />
      </g>
      {/* the lid */}
      <g data-lid="">
        <path d="M10 44 Q14 16 60 14 Q106 16 110 44 Q84 37 60 37 Q36 37 10 44 Z" fill="#a8937a" stroke="#0e1b33" strokeWidth="3" strokeLinejoin="round" />
        <path d="M30 22 Q35 30 30 39 M50 16 Q55 26 50 37 M70 16 Q75 26 70 37 M90 22 Q95 30 90 39" stroke="#7d6a53" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <path d="M22 30 Q60 12 98 30" stroke="#cdbca4" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
      </g>
    </svg>
  );
}

export const Critters = memo(function Critters({ world: W, layer }: { world: World; layer: "back" | "ice" }) {
  return (
    <>
      {W.critters
        .filter((c) => (layer === "ice" ? c.kind === "fish" || c.kind === "fish2" : c.kind !== "fish" && c.kind !== "fish2"))
        .map((c, i) => {
          const art = ART[c.kind];
          const w = c.h * (c.aspect ?? art.aspect);
          const hanging = c.kind === "bag";
          const top = hanging ? c.ground : c.ground - c.h;
          if (c.kind === "fish" || c.kind === "fish2") {
            // swims back and forth under the ice (CSS), seen dimly through it
            return (
              <div key={i} aria-hidden="true" className="fx-fish pointer-events-none absolute" style={{ left: c.x - w / 2, top, width: w, height: c.h, animationDuration: `${7 + (i % 3) * 2.5}s`, animationDelay: `${-i * 1.7}s` }}>
                <img src={art.a} alt="" className="h-full w-full max-w-none opacity-70" draggable={false} />
              </div>
            );
          }
          if (c.kind === "oyster") {
            return (
              <div key={i} aria-hidden="true" data-critter="oyster" data-x={Math.round(c.x)} className="pointer-events-none absolute" style={{ left: c.x - w / 2, top, width: w, height: c.h }}>
                <Oyster />
              </div>
            );
          }
          return (
            <div
              key={i}
              aria-hidden="true"
              data-critter={c.kind}
              data-x={Math.round(c.x)}
              className={`pointer-events-none absolute ${hanging ? "origin-top" : "origin-bottom"} ${c.kind === "camel" ? "fx-breathe" : ""}`}
              style={{ left: c.x - w / 2, top, width: w, height: c.h, scale: c.flip ? "-1 1" : undefined }}
            >
              <img src={art.a} alt="" data-frame="rest" className="absolute inset-0 h-full w-full max-w-none" draggable={false} />
              {art.b && (
                <img
                  src={art.b}
                  alt=""
                  data-frame="a"
                  className="absolute bottom-0 left-1/2 max-w-none -translate-x-1/2 opacity-0"
                  style={{ height: c.h * (art.flyH ?? 1), width: c.h * (art.flyH ?? 1) * (art.aspectFly ?? art.aspect) }}
                  draggable={false}
                />
              )}
              {art.c && (
                <img
                  src={art.c}
                  alt=""
                  data-frame="b"
                  className="absolute bottom-0 left-1/2 max-w-none -translate-x-1/2 opacity-0"
                  style={{ height: c.h * (art.flyH ?? 1), width: c.h * (art.flyH ?? 1) * (art.aspectFly ?? art.aspect) }}
                  draggable={false}
                />
              )}
            </div>
          );
        })}
    </>
  );
});
