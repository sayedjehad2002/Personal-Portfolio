import Link from "next/link";
import { NotFoundTitle } from "./NotFoundTitle";

/** Themed 404: the opening shot of the world with a way back to the start. */
export default function NotFound() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-14 text-center">
      <NotFoundTitle />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/world/first-frame.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative flex max-w-md flex-col items-center rounded-3xl border border-white/70 bg-[#FFFDF8]/[0.97] px-7 py-8 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)]">
        <p className="font-display text-[clamp(48px,10vw,72px)] leading-none text-[#B9772F]">404</p>
        <h1 className="mt-2 font-display text-2xl tracking-wide">Off the map</h1>
        <p className="mt-2 text-ink-2">The page you were looking for isn’t here. Head back to the first dune and walk through the world from the start.</p>
        <Link href="/" className="game-btn mt-7">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
