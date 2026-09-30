import { Character } from "../character/Character";

/**
 * The world's opening shot, drawn straight into the server HTML: the base-camp
 * scene and Sayed standing exactly where the live world will put them (same
 * maths as spec.ts: scene centred on 46% of the width, feet on its walk line,
 * the character a quarter of the viewport tall). So the page opens directly
 * in the world, and the live world simply takes over on top of it.
 * Shown only where the world mode applies (CSS media query, works before JS).
 */
export function FirstFrame({ leaving }: { leaving: boolean }) {
  // base-camp.webp is 1600 x 905 with its walk line at y 752
  const sceneW = "calc(100vh * 1600 / 905)";
  const unit = "(100vh * 0.25 / 180)";
  return (
    <div aria-hidden="true" className={`first-frame pointer-events-none fixed inset-0 z-[20] transition-opacity duration-300 ${leaving ? "opacity-0" : "opacity-100"}`}>
      <div className="absolute inset-0 bg-linear-to-b from-[#1aa6f2] via-[#62c4f7] to-[#dff3ff]" />
      {/* beyond the painting's edges: the snowy ground the live world draws there */}
      <div className="absolute inset-x-0 bottom-0 h-[17%] bg-[#e8f6ff]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/scenes/open/base-camp.webp"
        alt=""
        fetchPriority="high"
        className="absolute top-0 max-w-none"
        style={{ height: "100vh", width: sceneW, left: `calc(46vw - ${sceneW} / 2)` }}
      />
      <div
        className="absolute"
        style={{
          left: `calc(46vw - 100 * ${unit})`,
          top: `calc(100vh * 752 / 905 - 260 * ${unit})`,
          width: `calc(200 * ${unit})`,
          height: `calc(264 * ${unit})`,
        }}
      >
        <Character className="h-full w-full drop-shadow-[0_6px_10px_rgba(4,20,45,0.35)]" />
      </div>
    </div>
  );
}
