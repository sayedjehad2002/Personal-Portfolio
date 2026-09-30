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
};

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
