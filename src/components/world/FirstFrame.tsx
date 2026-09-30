import { Character } from "../character/Character";
import { PROPS, TILES } from "./assets";
import { START_SIGN } from "./lettering";
import { StartSign } from "./StartSign";

/**
 * The world's opening shot, drawn straight into the server HTML: the base-camp
 * scene and Sayed standing exactly where the live world will put them (same
 * maths as spec.ts / scenery.tsx at scroll 0, where the camera sits at world
 * x 0: scene centred on 46% of the width, feet on its walk line, the character
 * a quarter of the viewport tall, the far layers, the snow and the pines at
 * the painting's edges). So the page opens directly in the world, and the live
 * world simply takes over on top of it (only the drifting clouds fade in).
 * Shown only where the world mode applies (CSS media query, works before JS).
 */
export function FirstFrame({ leaving }: { leaving: boolean }) {
  const U = "100vh";
  // base-camp.webp is 1600 x 905 with its walk line at y 752
  const sceneW = `(${U} * 1600 / 905)`;
  const ground = `(${U} * 752 / 905)`;
  const unit = `(${U} * 0.25 / 180)`;
  const left = `(46vw - ${sceneW} / 2)`;
  const right = `(46vw + ${sceneW} / 2)`;
  // the world starts 1.2 screens before the painting (spec.ts `pre`); the forest corridor runs 5.2u after it
  const worldX0 = `(${left} - 120vw)`;
  const forestEnd = `(${right} + ${U} * 5.2)`;
  const fade = `linear-gradient(90deg, transparent, #000 calc(${U} * 0.06), #000 calc(100% - ${U} * 0.2), transparent)`;
  const hillsFade = "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)";
  const snow = TILES.groundIce;
  const pine = (name: "pine-tall" | "pine-cluster", x: string, h: number) => {
    const meta = PROPS[name];
    if (!meta) return null;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={meta.src}
        alt=""
        className="absolute max-w-none"
        style={{ height: `calc(${U} * ${h})`, width: `calc(${U} * ${h * meta.aspect})`, left: `calc(${x} - ${U} * ${(h * meta.aspect) / 2})`, top: `calc(${ground} - ${U} * ${h})` }}
      />
    );
  };
  return (
    <div aria-hidden="true" className={`first-frame pointer-events-none fixed inset-0 z-[20] transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <div className="absolute inset-0" style={{ background: TILES.sky }} />
      {/* far mountains (parallax 0.12) and the snowy hills with small pines (0.45), where the backdrop puts them */}
      <div
        className="absolute bg-[length:auto_100%] bg-repeat-x opacity-90"
        style={{
          backgroundImage: `url(${TILES.farMountains.src})`,
          left: `calc(46vw + 0.12 * (${worldX0} - 46vw) - 200vw)`,
          width: "600vw",
          top: `calc(${ground} - ${U} * 0.5)`,
          height: `calc(${U} * 0.42)`,
        }}
      />
      <div
        className="absolute bg-[length:auto_100%] bg-repeat-x"
        style={{
          backgroundImage: `url(${TILES.midHills.src})`,
          left: `calc(46vw + 0.45 * (${worldX0} - 46vw) - 200vw)`,
          width: `calc(0.45 * (${forestEnd} - ${worldX0}) + 200vw)`,
          top: `calc(${ground} - ${U} * 0.3)`,
          height: `calc(${U} * 0.32)`,
          WebkitMaskImage: hillsFade,
          maskImage: hillsFade,
        }}
      />
      {/* the tiled snow the world lays beyond the painting (anchored at world x 0, which is screen x 0 here) */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          top: `calc(${ground} - ${U} * ${snow.surfaceY / snow.srcH})`,
          background: `url(${snow.src}) 0 0 / calc(${U} * ${snow.w / snow.srcH}) calc(${U} * ${snow.h / snow.srcH}) repeat-x, ${snow.fallback}`,
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/scenes/open/base-camp.webp"
        alt=""
        fetchPriority="high"
        className="absolute top-0 max-w-none"
        style={{ height: U, width: `calc${sceneW}`, left: `calc${left}`, WebkitMaskImage: fade, maskImage: fade }}
      />
      {/* the start sign: erased from the painting, drawn as crisp vector art (same box as in the world) */}
      <StartSign
        className="absolute"
        style={{
          left: `calc(${left} + ${sceneW} * ${START_SIGN.x0})`,
          top: `calc(${U} * ${START_SIGN.y0})`,
          width: `calc(${sceneW} * ${START_SIGN.w})`,
          height: `calc(${U} * ${START_SIGN.h})`,
        }}
      />
      {/* the pines at the painting's two edges (spec.ts: a tall pine before it, the pine cluster after it) */}
      {pine("pine-tall", `(${left} - ${U} * 0.1)`, 0.6)}
      {pine("pine-cluster", `(${right} + ${U} * 0.02)`, 0.62)}
      <div
        className="absolute"
        style={{
          left: `calc(46vw - 100 * ${unit})`,
          top: `calc(${ground} - 260 * ${unit})`,
          width: `calc(200 * ${unit})`,
          height: `calc(264 * ${unit})`,
        }}
      >
        <Character className="h-full w-full drop-shadow-[0_6px_10px_rgba(4,20,45,0.35)]" />
      </div>
    </div>
  );
}
