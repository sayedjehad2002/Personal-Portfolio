"use client";

import { useEffect, useRef, useState } from "react";
import { chapters } from "@/data/resume";
import { gsap, useGSAP } from "@/lib/gsap";
import { worldStore } from "@/lib/progress";
import { Character, type CharacterHandle, type CharacterState } from "../character/Character";
import { scrollToY, useLenis } from "../SmoothScroll";
import { snowControl } from "../Snow";
import { sfx } from "@/lib/sfx";
import { Px } from "../ui/Px";
import { WheelHint } from "../ui/WheelHint";
import { createBody, stepBody } from "./physics";
import { Backdrop, Cabin, Foreground, WorldArt } from "./scenery";
import { Critters } from "./critters";
import { GulfTimeline, Sections } from "./sections";
import { buildWorld, cabinAt, camAt, CABIN, surfaceBelow, type Theme, type World } from "./spec";

const TAU = Math.PI * 2;
const SNOW: Record<Theme, number> = { forest: 1, waterfront: 0.75, gulf: 0.8, gym: 0, office: 0, yard: 1.1, ride: 0.9, sky: 1.1 };
const OUTDOOR: Record<Theme, boolean> = { forest: true, waterfront: true, gulf: true, gym: false, office: false, yard: true, ride: true, sky: true };
/** A section pops in when its trigger x reaches this fraction of the screen width. */
const TRIGGER_AT = 0.92;
const PRINTS = 36;
/** Bahrain red, gold, ice blue, aurora green, white */
const FIREWORK_HUES = ["#ff2d3d", "#ffb000", "#1e9bff", "#12c26e", "#ff4fd8"];
/** 0 at a, 1 at b (works for a > b too), clamped. */
const ramp01 = (v: number, a: number, b: number) => Math.max(0, Math.min(1, (v - a) / (b - a)));

/** Scroll offset that puts world x `wx` in the middle of the screen (inverse of camAt). */
function sForWorldX(W: World, wx: number) {
  const R = W.ride;
  const camX = wx - W.vw * 0.5;
  if (camX <= R.H) return Math.max(0, camX);
  const d = (camX + W.cx - R.bx) / R.cos;
  if (d <= R.D) return R.H + d;
  return Math.min(R.maxS, R.H + R.D + (camX - (R.tx - W.cx)));
}

/**
 * Robby-Leonardi-style stage: the page scrolls normally (smoothed by Lenis),
 * a sticky viewport shows the world, and the scroll offset drives a camera
 * path: walk right, ride the cable car up the Ice Mountain, step off at the top.
 * The player stays at a fixed screen x and walks, skates, runs, turns and
 * jumps according to how the world moves under him.
 */
export function WorldStage({ onReady }: { onReady?: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const worldEl = useRef<HTMLDivElement>(null);
  const frontEl = useRef<HTMLDivElement>(null);
  const charWrap = useRef<HTMLDivElement>(null);
  const bubbleEl = useRef<HTMLDivElement>(null);
  const printsEl = useRef<HTMLDivElement>(null);
  const cabinBack = useRef<HTMLDivElement>(null);
  const cabinFront = useRef<HTMLDivElement>(null);
  const altitude = useRef<HTMLDivElement>(null);
  const hintEl = useRef<HTMLDivElement>(null);
  const droneEl = useRef<HTMLDivElement>(null);
  const flockEl = useRef<HTMLDivElement>(null);
  const duskEl = useRef<HTMLDivElement>(null);
  const hero = useRef<CharacterHandle>(null);
  /** a jump asked for by ↑ / W / Space or a click on the avatar */
  const jumpReq = useRef(false);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  lenisRef.current = lenis;

  const [world, setWorld] = useState<World | null>(null);
  const [bubble, setBubble] = useState<{ text: string; side: "left" | "right" } | null>(null);
  const [toast, setToast] = useState<{ level: number; key: number } | null>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const measure = () => {
      const vw = document.documentElement.clientWidth;
      const vh = window.innerHeight;
      setWorld((prev) => (prev && prev.vw === vw && prev.vh === vh ? prev : buildWorld(vw, vh)));
    };
    const raf = requestAnimationFrame(measure);
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 180);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useGSAP(
    () => {
      const W = world;
      if (!W || !track.current || !worldEl.current || !charWrap.current) return;
      const R = W.ride;
      const trackTop = () => track.current!.getBoundingClientRect().top + window.scrollY;
      const top0 = trackTop();
      // World geometry for the QA scripts: always in dev, and in production with ?qa in the URL.
      if (process.env.NODE_ENV !== "production" || new URLSearchParams(window.location.search).has("qa"))
        (window as unknown as { __sjw: unknown }).__sjw = { W, top0 };

      // Keep the visitor at the same point of the journey after a resize.
      if (progressRef.current > 0) scrollToY(lenisRef.current, top0 + progressRef.current * R.maxS, true);
      worldStore.setCheckpoints(W.levelStarts.map((s) => s / R.maxS));

      // ---- pop-in sections: a paused timeline each, played when reached ----
      const pops = gsap.utils.toArray<HTMLElement>("[data-pop]", worldEl.current).map((el) => {
        const kind = el.dataset.pop ?? "rise";
        const x = Number(el.dataset.x);
        const items = gsap.utils.toArray<HTMLElement>("[data-item]", el);
        const tl = gsap.timeline({ paused: true });
        const from =
          kind === "drop"
            ? { y: -W.vh * 0.7, opacity: 0 }
            : kind === "pop"
              ? { scale: 0.2, opacity: 0, rotate: -8 }
              : kind === "slide"
                ? { x: W.vw * 0.25, opacity: 0 }
                : kind === "swing"
                  ? { rotate: -24, y: -W.vh * 0.25, opacity: 0 }
                  : { y: W.vh * 0.62, opacity: 0 };
        const ease =
          kind === "drop" ? "bounce.out" : kind === "pop" ? "back.out(2)" : kind === "slide" ? "power3.out" : kind === "swing" ? "elastic.out(1, 0.45)" : "back.out(1.3)";
        tl.fromTo(el, from, { x: 0, y: 0, scale: 1, rotate: 0, duration: kind === "drop" || kind === "swing" ? 1.1 : 0.75, ease });
        tl.to(el, { opacity: 1, duration: 0.18, ease: "none" }, 0);
        if (items.length) {
          // lines follow the board in quickly, so a brisk scroll never reaches a board whose text is still hidden
          tl.fromTo(items, { opacity: 0, y: 14, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "back.out(1.8)", stagger: 0.045 }, 0.16);
        }
        tl.progress(0);
        const left = el.offsetLeft;
        const right = left + el.offsetWidth;
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        el.style.pointerEvents = "none";
        return { el, x, left, right, top, bottom, tl, on: false, pin: false };
      });

      // ---- setters ----
      const body = createBody(W.anchors.start.ground);
      const setWorldX = gsap.quickSetter(worldEl.current, "x", "px");
      const setWorldY = gsap.quickSetter(worldEl.current, "y", "px");
      const setFrontX = frontEl.current ? gsap.quickSetter(frontEl.current, "x", "px") : null;
      const setFrontY = frontEl.current ? gsap.quickSetter(frontEl.current, "y", "px") : null;
      const setCharY = gsap.quickSetter(charWrap.current, "y", "px");
      const layers = gsap.utils.toArray<HTMLElement>("[data-parallax]", stage.current!).map((el) => ({
        f: Number(el.dataset.parallax),
        setX: gsap.quickSetter(el, "x", "px"),
        setY: gsap.quickSetter(el, "y", "px"),
      }));
      gsap.set(charWrap.current, { x: W.cx - 100 * W.unit });

      // footprint pool (world space, fades out)
      // boxes and rocks he can stand on: they squash under a landing and recoil when he pushes off
      const platforms = gsap.utils.toArray<HTMLElement>("[data-platform]", worldEl.current).map((el) => ({
        el,
        x0: Number(el.dataset.x0),
        x1: Number(el.dataset.x1),
      }));
      const bounce = (wx: number, amount: number) => {
        const p = platforms.find((q) => wx >= q.x0 && wx <= q.x1);
        if (!p) return;
        gsap.fromTo(
          p.el,
          { scaleY: 1 - 0.1 * amount, scaleX: 1 + 0.05 * amount },
          { scaleY: 1, scaleX: 1, duration: 0.55, ease: "elastic.out(1.1, 0.35)", overwrite: true },
        );
      };

      // ---- ambient loops (swaying palms, floating pennants, fish, LEDs, fans, neon...) only run on screen ----
      // CSS animations keep running off-screen; across a 30,000px world that is a lot of wasted frames
      const AMBIENT = ".fx-sway,.fx-bob,.fx-glow,.fx-float,.fx-spin,.fx-blink,.fx-code,.fx-fish,.fx-breathe,.fx-flag,.neon-text";
      const worldLeft = worldEl.current.getBoundingClientRect().left;
      const frontLeft = frontEl.current ? frontEl.current.getBoundingClientRect().left : worldLeft;
      const ambient = [
        ...Array.from(worldEl.current.querySelectorAll<HTMLElement>(AMBIENT)).map((el) => ({ el, base: worldLeft })),
        ...(frontEl.current ? Array.from(frontEl.current.querySelectorAll<HTMLElement>(AMBIENT)).map((el) => ({ el, base: frontLeft })) : []),
      ].map(({ el, base }) => {
        const r = el.getBoundingClientRect();
        return { el, x0: r.left - base - W.vw * 0.25, x1: r.right - base + W.vw * 0.25, on: true };
      });
      let nextCull = 0;
      const cull = (camX: number) => {
        for (const a of ambient) {
          const on = a.x1 > camX && a.x0 < camX + W.vw;
          if (on !== a.on) {
            a.on = on;
            a.el.style.animationPlayState = on ? "" : "paused";
          }
        }
      };

      // the timeline in the Gulf ice lights up to where he has skated
      const ruler = worldEl.current.querySelector<HTMLElement>("[data-ruler-fill]");
      const rulerX0 = Number(ruler?.dataset.x0 ?? 0);
      const rulerMax = ruler?.previousElementSibling instanceof HTMLElement ? ruler.previousElementSibling.offsetWidth : 0;
      let lastRuler = -1;

      // ---- wildlife and kit that react to him (flamingos/bulbuls fly off, the hare hops away, the bag swings) ----
      const critters = gsap.utils.toArray<HTMLElement>("[data-critter]", worldEl.current).map((el) => ({
        el,
        kind: el.dataset.critter ?? "",
        x: Number(el.dataset.x),
        gone: false,
        tl: null as gsap.core.Timeline | null,
      }));
      const frame = (el: HTMLElement, name: string, on: boolean) => {
        const f = el.querySelector<HTMLElement>(`[data-frame="${name}"]`);
        if (f) f.style.opacity = on ? "1" : "0";
      };
      const react = (cr: (typeof critters)[number], from: number) => {
        const away = cr.x >= from ? 1 : -1;
        // art faces right; a critter already mirrored in CSS needs the opposite scale to face "away"
        const face = away * (cr.el.style.scale ? -1 : 1);
        cr.tl?.kill();
        const tl = gsap.timeline();
        if (cr.kind === "flamingo" || cr.kind === "bulbul") {
          // a short run-up hop, then flap up and away from him
          tl.call(() => {
            frame(cr.el, "rest", false);
            frame(cr.el, "a", true);
            cr.el.classList.add("is-flapping");
          });
          tl.to(cr.el, { x: away * W.u * (cr.kind === "bulbul" ? 0.9 : 1.6), y: -W.vh * (cr.kind === "bulbul" ? 0.55 : 0.75), scaleX: face, duration: cr.kind === "bulbul" ? 1.2 : 2.6, ease: "power1.in" }, 0.05);
        } else if (cr.kind === "hare") {
          // three hops away, then sits up again
          for (let k = 0; k < 3; k++) {
            tl.call(() => {
              frame(cr.el, "rest", false);
              frame(cr.el, "a", true);
            });
            tl.to(cr.el, { x: `+=${away * W.u * 0.2}`, scaleX: face, duration: 0.3, ease: "none" });
            tl.to(cr.el, { y: -W.u * 0.05, duration: 0.15, ease: "power2.out" }, "<");
            tl.to(cr.el, { y: 0, duration: 0.15, ease: "power2.in" }, ">");
            tl.call(() => {
              frame(cr.el, "a", false);
              frame(cr.el, "rest", true);
            });
            tl.to({}, { duration: 0.08 });
          }
        } else if (cr.kind === "bag") {
          tl.fromTo(cr.el, { rotate: away * 13 }, { rotate: 0, duration: 2.4, ease: "elastic.out(1, 0.22)" });
        }
        cr.tl = tl;
      };
      const settle = (cr: (typeof critters)[number]) => {
        cr.tl?.kill();
        cr.tl = null;
        cr.el.classList.remove("is-flapping");
        gsap.set(cr.el, { x: 0, y: 0, scaleX: 1, rotate: 0 });
        frame(cr.el, "a", false);
        frame(cr.el, "b", false);
        frame(cr.el, "rest", true);
        cr.gone = false;
      };

      const prints = printsEl.current ? Array.from(printsEl.current.children) as HTMLElement[] : [];
      let printK = 0;
      const stamp = (wx: number, wy: number, facing: number, kind: "boot" | "skate") => {
        const el = prints[printK++ % prints.length];
        if (!el) return;
        el.dataset.kind = kind;
        el.style.transition = "none";
        el.style.opacity = kind === "skate" ? "0.5" : "0.42";
        el.style.transform = `translate(${wx.toFixed(1)}px, ${wy.toFixed(1)}px) scaleX(${facing})`;
        void el.offsetWidth;
        el.style.transition = "opacity 5s linear";
        el.style.opacity = "0";
      };

      let prevX = -1;
      let prevSpeed = 0;
      let phase = 0;
      let facing: 1 | -1 = 1;
      let still = 0.3; // he starts standing (idle), not mid-step
      let lastBubble: string | null | undefined = undefined;
      let bubbleSide: "left" | "right" = "right";
      let bubbleW = Math.min(W.vw * 0.3, 340);
      let bubbleH = 64;
      let measureBubble = false;
      let lastLevel = -1;
      let lastStep = 0;
      let flagged = false;
      let nextFirework = 0;
      let fireworkK = 0;
      let nextBreath = 0;
      let sway = 0;
      let swayV = 0;
      let lastPhase: "walk" | "ride" | "arrive" = "walk";
      // camera bump (spring): a dip when stepping onto the frozen Gulf, a jolt on heavy landings
      let shake = 0;
      let shakeV = 0;
      let wasIce = false;
      let indoor = false;
      // a flock of flamingos crosses the sky once per ride (again if you ride it again)
      let flockFlown = false;
      const flyFlock = () => {
        const el = flockEl.current;
        if (!el) return;
        el.classList.add("is-flapping");
        gsap.fromTo(
          el,
          { x: W.vw + W.u * 0.2, y: W.vh * 0.27, opacity: 1 },
          { x: -W.u * 0.9, y: W.vh * 0.17, duration: 9, ease: "none", onComplete: () => void gsap.set(el, { opacity: 0 }) },
        );
      };

      // the AI Lab helper drone: joins him indoors at Lumofy, trails behind his shoulder, blinks now and then
      const drone = { x: W.cx, y: W.vh * 0.4, tx: W.cx, ty: W.vh * 0.4, shown: 0, facing: 1, nextBlink: 0, blocked: false };
      const droneBlink = droneEl.current?.querySelector<HTMLElement>("[data-blink]") ?? null;
      const doorL = cabinFront.current?.querySelector<HTMLElement>('[data-door="l"]') ?? null;
      const doorR = cabinFront.current?.querySelector<HTMLElement>('[data-door="r"]') ?? null;
      let lastDoorL = -1;
      let lastDoorR = -1;

      const render = (time: number, deltaMs: number) => {
        const dt = Math.max(1 / 240, Math.min(0.05, deltaMs / 1000));
        const s = window.scrollY - top0;
        const c = camAt(W, s);
        if (prevX < 0) prevX = c.x;
        const dx = c.x - prevX;
        prevX = c.x;
        const speed = dx / dt;

        setWorldX(-c.camX);
        shakeV += (-shake * 190 - shakeV * 13) * dt;
        shake += shakeV * dt;
        setWorldY(-c.camY + shake);
        setFrontX?.(-c.camX);
        setFrontY?.(-c.camY + shake);
        for (const l of layers) {
          l.setX(-c.camX * l.f);
          l.setY(-c.camY * l.f + shake * l.f);
        }

        // ---- player ----
        const x = c.x;
        const wasGround = body.onGround;
        const landSpeed = body.vy;
        if (jumpReq.current) {
          jumpReq.current = false;
          if (body.onGround && c.phase !== "ride") {
            body.vy = -Math.sqrt(2 * 9 * W.charH * W.charH * 0.62);
            body.onGround = false;
            body.crouch = 0;
            body.jumpedAt = time;
          }
        }
        if (c.phase === "ride") {
          body.y = cabinAt(W, c.d).y;
          body.vy = 0;
          body.onGround = true;
        } else {
          // a camera cut (Home, a scrollbar drag, a restore) is a teleport: land him where he now stands
          if (Math.abs(dx) > W.vw * 0.75 || body.y < c.camY - W.charH * 1.5) {
            const g = surfaceBelow(W.solids, x, -1e6, 0);
            if (Number.isFinite(g)) {
              body.y = g;
              body.vy = 0;
              body.onGround = true;
              body.crouch = 0;
            }
          }
          // how far the current scroll will still carry him (walk and arrive map scroll 1:1 to x)
          const L = lenisRef.current;
          const remaining = L ? L.targetScroll - L.animatedScroll : Number.NaN;
          stepBody(body, W.solids, x, dx, dt, W.charH, time, c.camY + W.vh * 1.4, remaining);
        }
        const screenY = body.y - c.camY;
        setCharY(screenY + shake - 260 * W.unit);
        if (Math.abs(dx) > 0.05) {
          const nf = dx > 0 ? 1 : -1;
          // reversing at speed kicks up a skid puff
          if (nf !== facing && Math.abs(prevSpeed) > 350 && body.onGround && c.phase !== "ride") snowControl.puff(W.cx + nf * 16 * W.unit, screenY - 2, -nf);
          facing = nf;
        }
        const zone = W.zones.find((z) => x >= z.x0 && x < z.x1) ?? W.zones[W.zones.length - 1];
        const theme = c.phase === "ride" ? "ride" : zone.theme;
        const skating = theme === "gulf" && body.onGround;
        // the Gulf's entrance: the ice takes his weight with a dip, a crack and a spray
        const onIce = theme === "gulf";
        if (onIce !== wasIce && body.onGround && c.phase === "walk") {
          if (onIce) {
            shakeV += W.u * 0.5;
            snowControl.spray(W.cx, screenY - 2, 1);
            snowControl.spray(W.cx, screenY - 2, -1);
            sfx.crack();
          }
          wasIce = onIce;
        }
        const running = Math.abs(speed) > 700;
        const stride = (hero.current?.strideUnits ?? 68) * W.unit * (skating ? 2.2 : running ? 1.5 : 1);
        // distance-locked cycle (feet planted up to ~1100 px/s), capped so a fling or a HUD jump reads as a sprint, not strobing legs
        const maxStep = 64 * dt;
        if (c.phase !== "ride") phase += Math.max(-maxStep, Math.min(maxStep, (dx / stride) * TAU));
        still = Math.abs(speed) < 14 ? still + dt : 0;

        let pose: CharacterState;
        if (!body.onGround) pose = "jump";
        else if (c.phase === "ride") pose = still > 0.8 ? "wave" : "idle";
        else if (skating && still < 0.25) pose = "skate";
        else if (running) pose = "run";
        else if (still < 0.12) pose = "walk";
        else {
          // the zone's gesture (wave, point, dumbbells) only after a real pause, so reading notch by notch
          // doesn't replay it between every notch; the summit flag goes up straight away
          const gesture = W.idlePose(x);
          pose = still > (gesture === "flag" ? 0.5 : 1.6) ? gesture : "idle";
        }
        if (pose === "flag" && still > 3 && Math.floor(time / 3.5) % 3 === 2) pose = "cheer";
        const landedNow = !wasGround && body.onGround;
        if (landedNow && landSpeed > W.charH * 3.2) shakeV += Math.min(W.u * 0.3, landSpeed * 0.1);
        // height above the ground below (character units): drives his contact shadow and air stretch
        let air = 0;
        if (!body.onGround && c.phase !== "ride") {
          const g = surfaceBelow(W.solids, x, body.y);
          air = Number.isFinite(g) ? Math.min(400, Math.max(0, (g - body.y) / W.unit)) : 0;
        }
        // a crouch before each hop (the squash spring does the knees), a squash on landing
        const crouchNow = body.crouchedAt === time;
        const impact = landedNow ? Math.min(1, 0.5 + landSpeed / (W.charH * 6)) : crouchNow ? 0.55 : 0;
        hero.current?.update({ state: pose, phase, facing, air, time, dt, impact });
        if (indoor !== !OUTDOOR[theme]) {
          indoor = !OUTDOOR[theme];
          charWrap.current!.dataset.indoor = indoor ? "1" : "";
        }

        if (ruler) {
          const wR = Math.round(Math.max(0, Math.min(rulerMax, x - rulerX0)));
          if (wR !== lastRuler) {
            lastRuler = wR;
            ruler.style.transform = `scaleX(${(wR / Math.max(1, rulerMax)).toFixed(4)})`;
          }
        }

        if (time > nextCull) {
          nextCull = time + 0.25;
          cull(c.camX);
        }

        // ---- winter effects ----
        const outdoor = OUTDOOR[theme];
        const step = Math.floor(phase / Math.PI);
        if (body.onGround && step !== lastStep && Math.abs(speed) > 14 && c.phase !== "ride") {
          const footX = x - facing * 14 * W.unit;
          if (skating) sfx.skate();
          else sfx.step(!outdoor);
          if (skating) {
            snowControl.spray(W.cx - facing * 20 * W.unit, screenY - 2, facing);
            stamp(footX - facing * 30 * W.unit, body.y, facing, "skate");
          } else if (outdoor) {
            snowControl.puff(W.cx - facing * 18 * W.unit, screenY - 2, facing);
            stamp(footX, body.y, facing, "boot");
          }
        }
        lastStep = step;
        if (wasGround && !body.onGround && body.vy < 0) {
          // push-off: a kick of snow from the boots, and whatever he stood on recoils
          sfx.jump();
          snowControl.puff(W.cx - facing * 12 * W.unit, screenY - 2, -facing);
          bounce(x, 0.5);
        }
        if (!wasGround && body.onGround) {
          sfx.land();
          bounce(x, Math.min(1.4, 0.6 + landSpeed / (W.charH * 5)));
          // snow (or gym-floor dust) bursts out from both boots
          snowControl.puff(W.cx - 10, screenY - 2, 1);
          snowControl.puff(W.cx + 10, screenY - 2, -1);
        }
        // cold breath while standing still outside
        if (outdoor && still > 0.9 && time > nextBreath && body.onGround) {
          nextBreath = time + 2.4 + (Math.sin(time * 7.1) + 1) * 0.4;
          snowControl.breath(W.cx + facing * 44 * W.unit, screenY - 104 * W.unit, facing);
        }

        // the lift bell rings as the cabin leaves and as it docks
        if (c.phase !== lastPhase) {
          if (c.phase === "ride" || lastPhase === "ride") sfx.bell();
          lastPhase = c.phase;
        }

        // ---- the cable car: follows the ride, swings when you speed up or stop ----
        const cab = cabinAt(W, c.d);
        const accel = (speed - prevSpeed) / dt;
        prevSpeed = speed;
        swayV += (-accel * 0.00004 - sway * 18) * dt - swayV * 2.6 * dt;
        sway = Math.max(-7, Math.min(7, sway + swayV * dt * 60));
        const cabT = `translate(${(cab.x - CABIN.w * 0.5 * W.unit).toFixed(1)}px, ${(cab.y - CABIN.floor * W.unit).toFixed(1)}px) rotate(${sway.toFixed(2)}deg)`;
        if (cabinBack.current) cabinBack.current.style.transform = cabT;
        if (cabinFront.current) cabinFront.current.style.transform = cabT;
        // sliding doors, by his distance from the cabin's centre (character units; the side walls are 120 out):
        // the left leaf opens as he walks up at the valley and shuts behind him, the right one lets him out on top
        const rel = (x - cab.x) / W.unit;
        const openL = c.phase === "walk" ? Math.min(ramp01(-rel, 260, 190), ramp01(-rel, 8, 55)) : 0;
        const openR = c.phase === "arrive" ? Math.min(ramp01(rel, 0, 40), ramp01(rel, 262, 190)) : 0;
        if (doorL && openL !== lastDoorL) {
          lastDoorL = openL;
          doorL.style.transform = openL ? `translateX(${(openL * 36.25).toFixed(2)}%)` : "";
        }
        if (doorR && openR !== lastDoorR) {
          lastDoorR = openR;
          doorR.style.transform = openR ? `translateX(${(-openR * 36.25).toFixed(2)}%)` : "";
          doorR.style.zIndex = openR ? "2" : "";
        }

        // the summit: plant the flag, then fireworks while you enjoy the view
        if (x >= W.anchors.contact.x - W.u * 0.02 && still > 0.5) {
          if (!flagged) {
            // flag planted: snow bursts from the peak, twilight falls and a volley of three shells goes up
            flagged = true;
            if (duskEl.current) gsap.to(duskEl.current, { opacity: 1, duration: 2.2, ease: "power1.inOut", overwrite: true });
            snowControl.burst(W.cx + 50 * W.unit, screenY - 150 * W.unit);
            sfx.firework();
            [0, 0.35, 0.7].forEach((d, k) =>
              gsap.delayedCall(d, () => {
                snowControl.firework(W.vw * [0.16, 0.3, 0.42][k], W.vh * [0.34, 0.24, 0.38][k], W.vh * 0.95, FIREWORK_HUES[k]);
                if (k) sfx.firework();
              }),
            );
            nextFirework = time + 2.4;
            fireworkK = 3;
          } else if (time > nextFirework && document.documentElement.dataset.motion !== "off") {
            nextFirework = time + 1.6 + (fireworkK % 3) * 0.5;
            sfx.firework();
            const k = fireworkK++;
            snowControl.firework(W.vw * (0.12 + 0.34 * ((k * 0.618) % 1)), W.vh * (0.22 + 0.16 * ((k * 0.382) % 1)), W.vh * 0.95, FIREWORK_HUES[k % FIREWORK_HUES.length]);
          }
        } else if (x < W.anchors.contact.x - W.u * 0.08 && flagged) {
          flagged = false;
          if (duskEl.current) gsap.to(duskEl.current, { opacity: 0, duration: 1.2, ease: "power1.out", overwrite: true });
        }

        // ---- the ride's flamingo flock ----
        if (c.phase === "ride" && c.d > R.D * 0.18 && c.d < R.D * 0.5) {
          if (!flockFlown) {
            flockFlown = true;
            flyFlock();
          }
        } else if (c.phase !== "ride") flockFlown = false;

        // ---- the AI Lab drone ----
        if (droneEl.current) {
          const inLab = c.phase === "walk" && theme === "office";
          if (inLab) {
            if (Math.abs(dx) > 0.5) drone.facing = dx > 0 ? 1 : -1;
            // behind his shoulder at head height, or lower at his back when a board is showing there;
            // with nowhere clear (e.g. at the whiteboard) it steps out of sight, never over text
            const dw = W.charH * 0.4;
            const dh = dw * 0.73;
            const overBoard = (cx0: number, cy0: number) =>
              pops.some((p) => p.on && cx0 + dw / 2 > p.left - c.camX && cx0 - dw / 2 < p.right - c.camX && cy0 + dh / 2 > p.top - c.camY && cy0 - dh / 2 < p.bottom - c.camY);
            drone.tx = W.cx - drone.facing * W.charH * 0.5;
            drone.ty = screenY - W.charH * 1.22;
            drone.blocked = false;
            if (overBoard(drone.tx, drone.ty)) {
              drone.tx = W.cx - drone.facing * W.charH * 0.62;
              drone.ty = screenY - W.charH * 0.8;
              drone.blocked = overBoard(drone.tx, drone.ty);
            }
          }
          drone.shown += ((inLab && !drone.blocked ? 1 : 0) - drone.shown) * Math.min(1, dt * 3);
          if (drone.shown > 0.01) {
            const ty = drone.ty + Math.sin(time * 2.2) * W.charH * 0.035;
            drone.x += (drone.tx - drone.x) * Math.min(1, dt * 3.2);
            drone.y += (ty - drone.y) * Math.min(1, dt * 3.2);
            const tilt = Math.max(-12, Math.min(12, (drone.tx - drone.x) * 0.08));
            droneEl.current.style.opacity = drone.shown.toFixed(3);
            droneEl.current.style.transform = `translate3d(${(drone.x - W.charH * 0.2).toFixed(1)}px, ${(drone.y - (1 - drone.shown) * W.charH * 0.6).toFixed(1)}px, 0) rotate(${tilt.toFixed(1)}deg) scaleX(${drone.facing})`;
            if (droneBlink && time > drone.nextBlink) {
              drone.nextBlink = time + 2.6 + (Math.sin(time * 3.1) + 1) * 1.2;
              droneBlink.style.opacity = "1";
              gsap.delayedCall(0.14, () => (droneBlink.style.opacity = "0"));
            }
          } else if (droneEl.current.style.opacity !== "0") {
            droneEl.current.style.opacity = "0";
          }
        }

        // ---- wildlife: shy ones react when he comes close, and are back in place once off-screen ----
        if (c.phase !== "ride") {
          for (const cr of critters) {
            if (cr.kind === "camel") continue;
            const d = Math.abs(x - cr.x);
            const reach = cr.kind === "bag" ? W.u * 0.1 : cr.kind === "bulbul" ? W.u * 0.35 : W.u * 0.5;
            if (!cr.gone && d < reach && (cr.kind !== "bag" || Math.abs(speed) > 60)) {
              cr.gone = true;
              react(cr, x);
            } else if (cr.gone && d > W.vw * (cr.kind === "bag" ? 0.25 : 0.95)) settle(cr);
          }
        }

        // ---- pop-ins (replay whenever they re-enter, from either side) ----
        const edge = c.camX + W.vw * TRIGGER_AT;
        for (const p of pops) {
          // in when its trigger reaches the right side; out only once it is fully off-screen
          // (behind you, or ahead again after scrolling back), so nothing leaves while visible
          if (!p.on && edge >= p.x && p.right > c.camX) {
            p.on = true;
            p.el.style.pointerEvents = "";
            p.tl.play();
          } else if (p.on && !p.pin && (p.right < c.camX - W.vw * 0.12 || p.left > c.camX + W.vw + 24)) {
            p.on = false;
            p.el.style.pointerEvents = "none";
            p.tl.reverse();
          }
        }

        // ---- speech bubble follows the player's head ----
        // beside the head (during the ride, beside the cable car instead of over its roof). It takes the
        // side away from any board that is showing, and steps aside when both sides would cover one.
        const bb = W.bubbles.find((q) => x >= q.x0 && x < q.x1);
        const riding = c.phase === "ride";
        const bubX = (sd: "left" | "right") => W.cx + (sd === "right" ? 1 : -1) * (riding ? CABIN.w * 0.52 * W.unit : W.charH * 0.28);
        const bubY = screenY - W.charH * (riding ? 0.75 : (bb?.dy ?? 1.08));
        const covers = (sd: "left" | "right", pad: number) => {
          const x0 = sd === "right" ? bubX(sd) : bubX(sd) - bubbleW;
          const y0 = bubY - bubbleH - 6;
          for (const p of pops) {
            if (!p.on) continue;
            const L = p.left - c.camX;
            const T = p.top - c.camY;
            if (x0 + bubbleW + pad > L && x0 - pad < p.right - c.camX && bubY + 14 + pad > T && y0 - pad < p.bottom - c.camY) return true;
          }
          return false;
        };
        let hideBubble = false;
        if (bb) {
          const pref = bb.side ?? "right";
          if (!lastBubble || !lastBubble.startsWith(bb.text)) bubbleSide = pref;
          if (bubbleSide !== pref && !covers(pref, 16)) bubbleSide = pref;
          if (covers(bubbleSide, 0)) {
            const other = bubbleSide === "right" ? "left" : "right";
            if (!covers(other, 16)) bubbleSide = other;
            else hideBubble = true;
          }
        }
        const b = bb && !hideBubble ? bb.text + bubbleSide : null;
        if (b !== lastBubble) {
          lastBubble = b;
          setBubble(bb && b ? { text: bb.text, side: bubbleSide } : null);
          measureBubble = !!b;
        } else if (measureBubble && bubbleEl.current?.firstElementChild) {
          const el = bubbleEl.current.firstElementChild as HTMLElement;
          bubbleW = el.offsetWidth;
          bubbleH = el.offsetHeight;
          measureBubble = false;
        }
        if (bubbleEl.current) bubbleEl.current.style.transform = `translate3d(${bubX(bubbleSide)}px, ${bubY}px, 0)`;
        if (hintEl.current) hintEl.current.style.opacity = String(Math.max(0, 1 - s / (W.vw * 0.12)));

        // ---- altitude: the sky deepens as you climb ----
        if (altitude.current) altitude.current.style.opacity = String(Math.max(0, Math.min(1, -c.camY / (R.D * R.sin))) * 0.85);

        // ---- level toast + HUD ----
        const level = zone.level;
        if (level !== lastLevel) {
          if (lastLevel >= 0) {
            setToast({ level, key: time });
            sfx.levelUp();
          }
          lastLevel = level;
          worldStore.setChapter(level);
        }
        progressRef.current = R.maxS > 0 ? Math.max(0, s) / R.maxS : 0;
        worldStore.setProgress(progressRef.current);

        let snow = SNOW[theme];
        if (c.phase === "ride" && c.d > R.cloud.d0 && c.d < R.cloud.d1) {
          snow = 0.9 + 0.9 * Math.sin((Math.PI * (c.d - R.cloud.d0)) / (R.cloud.d1 - R.cloud.d0));
        }
        snowControl.intensity = snow;
        const L = lenisRef.current;
        if (L) {
          const want = theme === "gulf" ? 0.06 : c.phase === "ride" ? 0.1 : 0.14;
          if (L.options.lerp !== want) L.options.lerp = want;
        }
        snowControl.wind = speed;
      };
      gsap.ticker.add(render);
      // tell the page the live world is drawn (the static opening shot can go) once its first scene is decoded
      const firstScene = worldEl.current.querySelector<HTMLImageElement>('img[src*="base-camp"]');
      const ready = () => requestAnimationFrame(() => onReadyRef.current?.());
      if (!firstScene || firstScene.complete) ready();
      else firstScene.decode().then(ready, ready);

      // Keyboard users: tabbing to a link on a board travels the world there.
      const onFocus = (e: FocusEvent) => {
        stage.current!.scrollLeft = 0;
        stage.current!.scrollTop = 0;
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-x]");
        if (!el) return;
        // show its board right away and keep it up while it holds focus
        const pop = pops.find((p) => p.el === el);
        if (pop) {
          pop.pin = true;
          if (!pop.on) {
            pop.on = true;
            pop.el.style.pointerEvents = "";
            pop.tl.play();
          }
        }
        const r = (e.target as HTMLElement).getBoundingClientRect();
        if (r.left >= 0 && r.right <= W.vw && r.top >= 0 && r.bottom <= W.vh) return; // already on screen
        scrollToY(lenisRef.current, trackTop() + sForWorldX(W, Number(el.dataset.x) + W.vw * 0.34));
      };
      stage.current!.addEventListener("focusin", onFocus);
      const onBlur = (e: FocusEvent) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>("[data-x]");
        const pop = el && pops.find((p) => p.el === el);
        if (pop && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) pop.pin = false;
      };
      stage.current!.addEventListener("focusout", onBlur);

      worldStore.setNav({
        goTo: (i, immediate) => {
          scrollToY(lenisRef.current, trackTop() + W.levelJumps[Math.max(0, Math.min(W.levelJumps.length - 1, i))], immediate);
        },
      });

      return () => {
        gsap.ticker.remove(render);
        if (lenisRef.current) lenisRef.current.options.lerp = 0.14;
        snowControl.wind = 0;
        stage.current?.removeEventListener("focusin", onFocus);
        stage.current?.removeEventListener("focusout", onBlur);
        worldStore.setNav(null);
        pops.forEach((p) => p.tl.kill());
        critters.forEach((cr) => cr.tl?.kill());
      };
    },
    { dependencies: [world], scope: stage, revertOnUpdate: true },
  );

  // Touch screens in landscape: a sideways swipe walks too (vertical swipes already scroll natively).
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let px = 0;
    let py = 0;
    let goal = 0;
    let sideways: boolean | null = null;
    const start = (e: TouchEvent) => {
      px = e.touches[0].clientX;
      py = e.touches[0].clientY;
      sideways = null;
      goal = lenisRef.current ? lenisRef.current.animatedScroll : window.scrollY;
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      const dx = t.clientX - px;
      const dy = t.clientY - py;
      if (sideways === null && Math.hypot(dx, dy) > 8) sideways = Math.abs(dx) > Math.abs(dy);
      if (!sideways) return;
      e.preventDefault();
      px = t.clientX;
      py = t.clientY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      goal = Math.max(0, Math.min(max, goal - dx * 1.6));
      const L = lenisRef.current;
      if (L) L.scrollTo(goal, { lerp: 0.2 });
      else window.scrollTo(0, goal);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
    };
  }, [world]);

  // Keyboard: hold ← → (or A / D) to walk at a steady pace; ↑, W or Space jumps.
  useEffect(() => {
    let dir = 0;
    let raf = 0;
    let last = 0;
    let goal = 0;
    const walk = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      if (!dir) return;
      const L = lenisRef.current;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      goal = Math.max(0, Math.min(max, goal + dir * window.innerHeight * 1.45 * dt));
      if (L) L.scrollTo(goal, { lerp: 0.14 });
      else window.scrollTo(0, goal);
      raf = requestAnimationFrame(walk);
    };
    const keyDir = (k: string) => (k === "ArrowRight" || k === "d" || k === "D" ? 1 : k === "ArrowLeft" || k === "a" || k === "A" ? -1 : 0);
    const onDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("dialog, input, textarea, select")) return;
      const d = keyDir(e.key);
      if (d) {
        e.preventDefault();
        if (dir !== d) {
          dir = d;
          goal = lenisRef.current ? lenisRef.current.animatedScroll : window.scrollY;
          last = performance.now();
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(walk);
        }
        return;
      }
      const jumpKey = e.key === "ArrowUp" || e.key === "w" || e.key === "W" || (e.key === " " && !t?.closest?.("a, button, [role=button]"));
      if (jumpKey && !e.repeat) {
        e.preventDefault();
        jumpReq.current = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (keyDir(e.key) === dir) dir = 0;
    };
    const stop = () => (dir = 0);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", stop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", stop);
    };
  }, []);

  const W = world;
  return (
    <div ref={track} style={{ height: W ? W.ride.maxS + W.vh : "100vh" }}>
      <section
        ref={stage}
        aria-label="Sayed Jehad World, an interactive side-scrolling resume (the same content is in the text resume)"
        data-world
        className="sticky top-0 h-screen w-full overflow-hidden bg-[#1aa6f2]"
      >
        {W && (
          <>
            <Backdrop world={W} altitudeRef={altitude} />
            <div ref={worldEl} className="absolute left-0 top-0 z-10 h-0 w-0 will-change-transform">
              <WorldArt world={W} layer="back" />
              <Critters world={W} layer="back" />
              {/* twilight over the summit once the flag is planted (the fireworks read better against it) */}
              <div
                ref={duskEl}
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  left: W.ride.tx - W.vw,
                  top: W.ride.Sy - W.vh * 0.6,
                  width: W.worldX1 - W.ride.tx + W.vw * 2,
                  height: W.vh * 1.4,
                  opacity: 0,
                  background: "linear-gradient(180deg, rgb(10 18 44 / 0.92), rgb(46 36 104 / 0.7) 48%, rgb(236 120 96 / 0.28) 70%, transparent 86%)",
                }}
              />
              <Cabin world={W} layer="back" ref={cabinBack} />
              <Sections world={W} />
              <WorldArt world={W} layer="ground" />
              <GulfTimeline world={W} />
              <Critters world={W} layer="ice" />
              <div ref={printsEl} aria-hidden="true">
                {Array.from({ length: PRINTS }, (_, i) => (
                  <span key={i} className="footprint" style={{ opacity: 0 }} />
                ))}
              </div>
            </div>

            {/* the player */}
            <div
              ref={charWrap}
              className="pointer-events-none absolute left-0 top-0 z-30 will-change-transform"
              style={{ width: 200 * W.unit, height: 264 * W.unit }}
            >
              <Character ref={hero} className="h-full w-full drop-shadow-[0_6px_10px_rgba(4,20,45,0.35)]" />
              {/* click him to jump (the keyboard has ↑ / Space) */}
              <div
                aria-hidden="true"
                onPointerDown={() => (jumpReq.current = true)}
                className="pointer-events-auto absolute cursor-pointer"
                style={{ left: "25%", right: "30%", top: "30%", bottom: "4%" }}
              />
            </div>

            {/* flamingos crossing the sky during the ride (behind the mountain and the cable car) */}
            <div ref={flockEl} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-[5] opacity-0 will-change-transform">
              {[0, 1, 2].map((k) => (
                <div key={k} className="absolute" style={{ left: k * W.u * 0.16, top: [0, W.u * 0.05, -W.u * 0.03][k], width: W.u * 0.13, height: W.u * 0.13 * (176 / 289) }}>
                  <img data-frame="a" src="/props/life/flamingo-fly-a.svg" alt="" className="absolute inset-0 h-full w-full max-w-none -scale-x-100" draggable={false} />
                  <img data-frame="b" src="/props/life/flamingo-fly-b.svg" alt="" className="absolute inset-0 h-full w-full max-w-none -scale-x-100 opacity-0" draggable={false} />
                </div>
              ))}
            </div>

            {/* the AI Lab helper drone (only shown indoors at Lumofy) */}
            <div ref={droneEl} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 z-[31] will-change-transform" style={{ width: W.charH * 0.4, height: W.charH * 0.4 * (109.25 / 150), opacity: 0 }}>
              <img src="/props/life/drone-bot.svg" alt="" className="absolute inset-0 h-full w-full max-w-none" draggable={false} />
              <img data-blink src="/props/life/drone-bot-blink.svg" alt="" className="absolute inset-0 h-full w-full max-w-none opacity-0" draggable={false} />
              {/* spinning propellers */}
              {[0.333, 69].map((l) => (
                <img key={l} src="/props/life/drone-bot-prop.svg" alt="" className="fx-prop absolute max-w-none" style={{ left: `${l}%`, top: "0.32%", width: "30.667%", height: "9.886%" }} draggable={false} />
              ))}
              <span className="fx-glow absolute -bottom-[30%] left-1/2 h-[45%] w-[70%] -translate-x-1/2 rounded-full" />
            </div>

            {/* things the player is behind: the summit sign, the front of the cable car */}
            <div ref={frontEl} className="pointer-events-none absolute left-0 top-0 z-[35] h-0 w-0 will-change-transform">
              <WorldArt world={W} layer="front" />
              <Cabin world={W} layer="front" ref={cabinFront} />
            </div>
            <Foreground world={W} />

            {/* speech bubble */}
            <div ref={bubbleEl} className="pointer-events-none absolute left-0 top-0 z-[46]" aria-live="polite">
              {bubble && (
                <div
                  key={bubble.text}
                  className={`${bubble.side === "left" ? "bubble-pop-left" : "bubble-pop"} relative`}
                  style={{ width: "max-content", maxWidth: Math.min(W.vw * 0.3, 340) }}
                >
                  <div className="frost rounded-2xl px-4 py-3 text-[clamp(13px,1.75vh,17px)] font-bold leading-snug text-ink">{bubble.text}</div>
                  <svg
                    className={`absolute -bottom-3 ${bubble.side === "left" ? "right-4 -scale-x-100" : "left-4"}`}
                    width="26"
                    height="16"
                    viewBox="0 0 26 16"
                    aria-hidden="true"
                  >
                    <path d="M2 0 L24 0 L4 15 Z" fill="#eef8ff" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                </div>
              )}
            </div>

            {/* how to play: the first screen tells you the mouse wheel walks; fades as you set off */}
            <div ref={hintEl} aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[88px] z-[47] -translate-x-1/2">
              <div className="level-toast-in">
                <WheelHint />
              </div>
            </div>

            {/* level toast */}
            {toast && (
              <div key={toast.key} aria-hidden="true" className="level-toast pointer-events-none absolute bottom-[3.5vh] left-1/2 z-[47] text-center">
                <div className="wood flex items-center gap-4 px-6 py-2.5">
                  <Px className="text-[clamp(12px,1.4vh,14px)] text-[#ffe2a6]">{`Level ${chapters[toast.level].level}`}</Px>
                  <p className="font-display text-[clamp(24px,4vh,42px)] leading-none tracking-wide">{chapters[toast.level].name}</p>
                  <p className="hidden text-[clamp(12px,1.5vh,15px)] font-bold text-white lg:block">{chapters[toast.level].tagline}</p>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
