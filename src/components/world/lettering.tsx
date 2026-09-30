"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Crisp lettering over Sayed's scene paintings. The paintings are raster art whose painted words go soft when the
 * scene is scaled up (1920 screens, 2x displays), so each lettered element is redrawn as a vector SVG, traced from
 * the painting (same colours, same letter shapes, no web font), and laid exactly over it.
 * Boxes are fractions of the painting (x0, y0 = top-left; w, h), made by the lettering art workflow on 30 Sep 2026.
 */
export type LetterBox = { src: string; x0: number; y0: number; w: number; h: number };

export const LETTERING: Record<string, LetterBox[]> = {
  gym: [
    { src: "/scenes/lettering/gym-poster-left.svg", x0: 0.06625, y0: 0.216092, w: 0.1375, h: 0.285057 },
    { src: "/scenes/lettering/gym-poster-right.svg", x0: 0.798125, y0: 0.216092, w: 0.135625, h: 0.275862 },
    { src: "/scenes/lettering/gym-window-no-excuses.svg", x0: 0.4, y0: 0.317241, w: 0.2, h: 0.068966 },
    { src: "/scenes/lettering/gym-plates.svg", x0: 0.32875, y0: 0.571264, w: 0.34125, h: 0.068966 },
  ],
  // story mode only: in the world the same sign is drawn in front of the player (TILES.summitSign)
  summit: [{ src: "/scenes/lettering/summit-sign.svg", x0: 0.2275, y0: 0.34749, w: 0.30125, h: 0.43758 }],
};
/** The start sign's box in base-camp.webp (fractions); it is erased from the open painting and drawn as <StartSign>. */
export const START_SIGN = { x0: 0.245, y0: 0.18785, w: 0.52875, h: 0.47956 };

/** Scenes whose lettering the world draws some other way. */
export const WORLD_SKIP = new Set(["summit"]);

/**
 * The overlays for one painting. Render it right AFTER the painting's <img> (it looks at its previous sibling):
 * it stays hidden until that image has decoded, so the letters never float on an empty box after a long jump.
 * `style` places the wrapper over the painting (world px in the world, `inset: 0` inside story mode's art box).
 */
export function SceneLettering({ id, style }: { id: string; style: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const boxes = LETTERING[id];
  useEffect(() => {
    const img = ref.current?.previousElementSibling;
    if (!(img instanceof HTMLImageElement)) return;
    let live = true;
    // decode() resolves once the image is decoded, whether it loaded before hydration or not
    img.decode().then(
      () => live && setReady(true),
      () => {}, // painted lettering stays; the overlay stays hidden
    );
    return () => {
      live = false;
    };
  }, []);
  if (!boxes) return null;
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute" style={{ ...style, visibility: ready ? "visible" : "hidden" }}>
      {boxes.map((b) => (
        <img
          key={b.src}
          src={b.src}
          alt=""
          draggable={false}
          className="absolute block max-w-none select-none"
          style={{ left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
        />
      ))}
    </div>
  );
}
