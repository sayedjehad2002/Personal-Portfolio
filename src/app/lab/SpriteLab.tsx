"use client";

import { useEffect, useRef, useState } from "react";
import {
  Character,
  type CharacterFrame,
  type CharacterHandle,
  type CharacterState,
  type Expression,
} from "@/components/character/Character";

const STATES: CharacterState[] = ["idle", "walk", "run", "skate", "jump", "wave", "lift", "point", "flag", "cheer"];
const EXPRESSIONS: Expression[] = ["neutral", "happy", "serious", "surprised", "angry"];

// dev reference: the sheet's 3/4 FRONT (RIGHT) view, mapped onto the avatar's viewBox (see public/_ref)
const REF = "/_ref/char-34.png";

export function SpriteLab() {
  const poses = useRef<(CharacterHandle | null)[]>([]);
  const faces = useRef<(CharacterHandle | null)[]>([]);
  const big = useRef<CharacterHandle | null>(null);
  const ghost = useRef<CharacterHandle | null>(null);
  const bigWalk = useRef<CharacterHandle | null>(null);
  const bigRun = useRef<CharacterHandle | null>(null);
  const walkLeft = useRef<CharacterHandle | null>(null);
  const hop = useRef<CharacterHandle | null>(null);
  const hopBox = useRef<HTMLDivElement>(null);
  const boxHop = useRef<CharacterHandle | null>(null);
  const boxHopBox = useRef<HTMLDivElement>(null);
  const turn = useRef<CharacterHandle | null>(null);
  const dash = useRef<CharacterHandle | null>(null);
  const summit = useRef<CharacterHandle | null>(null);
  const profHead = useRef<CharacterHandle | null>(null);
  const spawn = useRef<CharacterHandle | null>(null);
  const spawnAt = useRef(0);
  // the spawn card remounts every 3 s, like a page load: the engine's first frames say "walk" while he stands still
  const [spawnKey, setSpawnKey] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSpawnKey((k) => k + 1), 3000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    spawnAt.current = performance.now();
  }, [spawnKey]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const start = last;
    let prevAir = 0;
    let prevAir2 = 0;
    let prevCrouch = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = (now - start) / 1000;
      poses.current.forEach((h, i) => {
        const state = STATES[i];
        h?.update({ state, phase: time * (state === "run" ? 11 : state === "skate" ? 4 : 7), facing: 1, air: state === "jump" ? 18 : 0, time, dt });
      });
      faces.current.forEach((h, i) => h?.update({ state: "idle", phase: 0, facing: 1, air: 0, time, dt, expression: EXPRESSIONS[i] }));

      // big static renders: time frozen, so they hold the rest pose for comparison with the sheet
      const still: CharacterFrame = { state: "idle", phase: 0, facing: 1, air: 0, time: 0, dt };
      big.current?.update(still);
      ghost.current?.update(still);
      bigWalk.current?.update({ state: "walk", phase: Math.PI / 2, facing: 1, air: 0, time: 0, dt });
      bigRun.current?.update({ state: "run", phase: Math.PI / 2, facing: 1, air: 0, time: 0, dt });
      profHead.current?.update({ state: "walk", phase: 0, facing: 1, air: 0, time: 0, dt });
      const st = (now - spawnAt.current) / 1000;
      spawn.current?.update({ state: st < 0.12 ? "walk" : "idle", phase: 5.3, facing: 1, air: 0, time, dt });

      walkLeft.current?.update({ state: "walk", phase: -time * 7, facing: -1, air: 0, time, dt });

      // hop + land loop: exercises squash & stretch (impact = 1 on the landing frame only)
      const period = 1.6;
      const flight = 0.62;
      const u = time % period;
      const air = u < flight ? 4 * 46 * (u / flight) * (1 - u / flight) : 0;
      const impact = prevAir > 0 && air === 0 ? 1 : 0;
      prevAir = air;
      hop.current?.update({ state: air > 0 ? "jump" : "idle", phase: 0, facing: 1, air, time, dt, impact });
      if (hopBox.current) {
        const px = hopBox.current.clientHeight / 264;
        hopBox.current.style.transform = `translateY(${(-air * px).toFixed(1)}px)`;
      }

      // back-to-back box hops while walking (the gym's plyo boxes): walk, crouch, hop, land, walk on.
      // The whole run stays in the PROFILE view; only a standing hop (above) uses the 3/4 view.
      const bp = time % 1.05;
      const bFlight = 0.58;
      const bu = bp - 0.34;
      const air2 = bu > 0 && bu < bFlight ? 4 * 40 * (bu / bFlight) * (1 - bu / bFlight) : 0;
      const crouch = bp > 0.26 && bp < 0.34;
      const impact2 = prevAir2 > 0 && air2 === 0 ? 1 : crouch && !prevCrouch ? 0.55 : 0;
      prevAir2 = air2;
      prevCrouch = crouch;
      boxHop.current?.update({ state: air2 > 0 ? "jump" : "walk", phase: time * 6.5, facing: 1, air: air2, time, dt, impact: impact2 });
      if (boxHopBox.current) {
        const px = boxHopBox.current.clientHeight / 264;
        boxHopBox.current.style.transform = `translateY(${(-air2 * px).toFixed(1)}px)`;
      }

      // turn: walks right, stops, turns, walks back (facing flips snap with a short squash)
      const tp = time % 4;
      const tFacing: 1 | -1 = tp < 2 ? 1 : -1;
      const tWalk = tp % 2 < 1.2;
      turn.current?.update({ state: tWalk ? "walk" : "idle", phase: time * 7 * tFacing, facing: tFacing, air: 0, time, dt });

      // dash: a HUD level jump (phase races at ~400 rad/s for 1 s, then a normal run)
      const dp = time % 3;
      dash.current?.update({ state: "run", phase: dp < 1 ? time * 400 : time * 11, facing: 1, air: 0, time, dt });

      // summit: plant the flag, then cheer beside it (the flag stays), then walk off
      const sp = time % 9;
      const sState: CharacterState = sp < 3.5 ? "flag" : sp < 7 ? "cheer" : sp < 8 ? "walk" : "idle";
      summit.current?.update({ state: sState, phase: time * 7, facing: 1, air: 0, time, dt });

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="min-h-screen bg-linear-to-b from-ice-400 to-ice-100 p-8">
      {/* ---- avatar vs the character sheet, same viewBox mapping ---- */}
      <section className="mb-8 rounded-2xl bg-[#1b304e] p-6 text-[#cfe0ff]">
        <div className="flex flex-wrap items-end justify-center gap-6">
          <figure className="grid justify-items-center gap-2" data-shot="avatar">
            <Character ref={big} className="h-[560px] w-auto" />
            <figcaption className="pixel-label text-sm">avatar (idle, frozen)</figcaption>
          </figure>
          <figure className="grid justify-items-center gap-2" data-shot="ref">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={REF} alt="Character sheet, 3/4 front right" className="h-[560px] w-auto" />
            <figcaption className="pixel-label text-sm">sheet 3/4 front (right)</figcaption>
          </figure>
          <figure className="grid justify-items-center gap-2" data-shot="overlay">
            <div className="relative h-[560px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={REF} alt="" className="h-full w-auto" />
              <Character ref={ghost} className="absolute inset-0 h-full w-full opacity-55" />
            </div>
            <figcaption className="pixel-label text-sm">overlay</figcaption>
          </figure>
        </div>
      </section>

      {/* ---- the profile view used for walk / run / skate ---- */}
      <section className="mb-8 rounded-2xl bg-[#1b304e] p-6 text-[#cfe0ff]" data-shot="profile">
        <div className="flex flex-wrap items-end justify-center gap-6">
          <figure className="grid justify-items-center gap-2">
            <Character ref={bigWalk} className="h-[420px] w-auto" />
            <figcaption className="pixel-label text-sm">walk (profile, frozen)</figcaption>
          </figure>
          <figure className="grid justify-items-center gap-2">
            <Character ref={bigRun} className="h-[420px] w-auto" />
            <figcaption className="pixel-label text-sm">run (profile, frozen)</figcaption>
          </figure>
          <figure className="grid justify-items-center gap-2" data-shot="profilehead">
            {/* window onto the profile head (walk, passing position): the svg is 560px tall (2.12 px per unit) */}
            <div className="h-[230px] w-[270px] overflow-hidden">
              <Character ref={profHead} className="-mt-[150px] -ml-[82px] h-[560px] w-auto max-w-none" />
            </div>
            <figcaption className="pixel-label text-sm">profile head</figcaption>
          </figure>
        </div>
      </section>

      {/* ---- expressions ---- */}
      <section className="mb-8 grid grid-cols-5 gap-6" data-shot="expressions">
        {EXPRESSIONS.map((e, i) => (
          <div key={e} className="grid place-items-center rounded-2xl bg-[#1b304e] p-4 text-[#cfe0ff]">
            {/* window onto the head: the svg is 400px tall (1.515 px per unit), showing y≈-8..103 */}
            <div className="h-[168px] w-[228px] overflow-hidden">
              <Character
                ref={(h) => {
                  faces.current[i] = h;
                }}
                className="-mt-[108px] -ml-[36px] h-[400px] w-auto max-w-none"
              />
            </div>
            <p className="pixel-label mt-2 text-sm">{e}</p>
          </div>
        ))}
      </section>

      {/* ---- every pose ---- */}
      <div className="grid grid-cols-3 gap-6 lg:grid-cols-6" data-shot="poses">
        {STATES.map((s, i) => (
          <div key={s} className="grid place-items-center rounded-2xl bg-white/40 p-4">
            <Character
              ref={(h) => {
                poses.current[i] = h;
              }}
              className="h-56 w-auto"
            />
            <p className="pixel-label mt-2 text-sm">{s}</p>
          </div>
        ))}
        <div className="grid place-items-center rounded-2xl bg-white/40 p-4">
          <Character ref={walkLeft} className="h-56 w-auto" />
          <p className="pixel-label mt-2 text-sm">walk (left)</p>
        </div>
        <div className="grid place-items-center overflow-hidden rounded-2xl bg-white/40 p-4">
          <div ref={hopBox} className="h-56">
            <Character ref={hop} className="h-full w-auto" />
          </div>
          <p className="pixel-label mt-2 text-sm">standing hop (3/4)</p>
        </div>
      </div>

      {/* ---- transitions ---- */}
      <div className="mt-6 grid grid-cols-5 gap-6" data-shot="transitions">
        <div className="grid place-items-center overflow-hidden rounded-2xl bg-white/40 p-4" data-shot="boxhops">
          <div ref={boxHopBox} className="h-56">
            <Character ref={boxHop} className="h-full w-auto" />
          </div>
          <p className="pixel-label mt-2 text-sm">box hops (moving, profile)</p>
        </div>
        <div className="grid place-items-center rounded-2xl bg-white/40 p-4">
          <Character ref={turn} className="h-56 w-auto" />
          <p className="pixel-label mt-2 text-sm">turn (flip)</p>
        </div>
        <div className="grid place-items-center rounded-2xl bg-white/40 p-4">
          <Character ref={dash} className="h-56 w-auto" />
          <p className="pixel-label mt-2 text-sm">dash (level jump)</p>
        </div>
        <div className="grid place-items-center overflow-visible rounded-2xl bg-white/40 p-4 pt-16">
          <Character ref={summit} className="h-56 w-auto" />
          <p className="pixel-label mt-2 text-sm">flag, cheer, walk off</p>
        </div>
        <div className="grid place-items-center rounded-2xl bg-white/40 p-4" data-shot="spawn">
          <Character key={spawnKey} ref={spawn} className="h-56 w-auto" />
          <p className="pixel-label mt-2 text-sm">spawn (remounts every 3 s)</p>
        </div>
      </div>
    </main>
  );
}
