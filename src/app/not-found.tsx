import Link from "next/link";
import { Character } from "@/components/character/Character";
import { NotFoundTitle } from "./NotFoundTitle";

/** Themed 404: the avatar standing in the snow next to a signpost back to the start. */
export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-linear-to-b from-[#1aa6f2] via-[#58c3fa] to-[#e8f7ff] px-4 py-14 text-center">
      <NotFoundTitle />
      {/* The world's own parallax layers as a still backdrop: far peaks, hills, then the icy ground strip. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-[70px] h-[46%] bg-[url(/tiles/far-mountains.svg)] bg-[length:auto_100%] bg-bottom bg-repeat-x opacity-90" />
        <div className="absolute inset-x-0 bottom-[70px] h-[24%] bg-[url(/tiles/mid-hills.svg)] bg-[length:auto_100%] bg-bottom bg-repeat-x" />
        <div className="absolute inset-x-0 bottom-0 h-[80px] bg-[url(/tiles/ground-ice.webp)] bg-[length:auto_100%] bg-top bg-repeat-x" />
      </div>
      <div className="relative flex flex-col items-center">
        <div className="wood px-7 py-3">
          <p className="font-display text-[clamp(40px,9vw,64px)] leading-none tracking-wide">404</p>
          <p className="font-display text-[clamp(20px,4.5vw,28px)] leading-none tracking-wide text-ice-200">Off the map</p>
        </div>
        {/* he stands on a little snow mound rather than floating between the sign and the card */}
        <div className="relative mt-5 aspect-[200/264] h-[clamp(120px,22vh,190px)]" aria-hidden="true">
          <span className="absolute bottom-[1%] left-1/2 h-[12%] w-[115%] -translate-x-1/2 rounded-[50%] bg-white shadow-[inset_0_-5px_0_#cfe9fb,0_6px_14px_-6px_rgba(8,40,90,0.35)]" />
          <Character className="relative h-full w-full" />
        </div>
        <div className="frost mt-5 max-w-md px-6 py-5">
          <h1 className="font-display text-2xl tracking-wide">This trail is buried under snow</h1>
          <p className="mt-2 text-ink-2">
            The page you were looking for isn’t here. Head back to base camp and walk through the world from the start.
          </p>
        </div>
        <Link href="/" className="game-btn mt-7">
          Back to base camp
        </Link>
      </div>
    </main>
  );
}
