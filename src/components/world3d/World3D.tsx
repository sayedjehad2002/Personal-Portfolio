"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { QuickResumeDialog, ResumeText } from "@/components/QuickResume";
import { scrollToY, useLenis } from "@/components/SmoothScroll";
import { Icon } from "@/components/ui/Icon";
import { WheelHint } from "@/components/ui/WheelHint";
import { profile, stats, values } from "@/data/resume";
import { motion, useMotionPaused } from "@/lib/motion";
import { sfx, useSoundOn } from "@/lib/sfx";
import { audio, type SoundName } from "./audio";
import { BOARDS } from "./boards";
import {
  ANCHORS,
  BREATHING,
  CAM_DIST,
  CAM_Y,
  CHAR_H,
  CHAR_SCALE,
  CM,
  EPILOGUE,
  FOV,
  LEVELS,
  PLAYER_AT,
  REALMS,
  SHIFT,
  SOLIDS,
  TITLES,
  VIEW_H,
  WORLD_END,
  camOffset,
  gestureAt,
  outfitAt,
  playerAtFor,
  realmWeights,
  smooth,
  surfaceAt,
  viewHFor,
  zoneAt,
  type RealmId,
} from "./config";
import { Fx } from "./fx";
import { DRAGON_LIFT, createLife, dragonWake, type Life } from "./life";
import { createBody, stepBody } from "./physics";
import { HERO_RIM, RIMS, TIME, detail, dressRealm } from "./shaders";
import { surfaceBelow } from "./solids";

/**
 * Sayed Jehad World: four realms in one continuous walk (Desert, Aqua, Snow, Magma).
 *
 * The scroll offset maps 1:1 onto the player's x, he stays at a fixed place across the screen, and a small 2D
 * body (physics.ts) handles gravity, jumps and hops onto steps. The world itself is real 3D, exported from
 * Blender one realm at a time, seen by a side-on camera that sinks under the sea, lifts with the cable car and
 * climbs with him over the dragon. What he does also drives the sound (audio.ts) and the particles (fx.ts).
 * After the summit a last stretch of scroll pulls the camera back over the whole walk.
 */

const HERO_URL = "/world/sayed.glb";
/** the realm models are Draco-compressed; the decoder is served from /public/draco (copied from three) */
const DRACO = "/draco/";
const JUMP_V = Math.sqrt(2 * 9 * CHAR_H * CM * CHAR_H * CM * 0.62);
const ANIMS = ["idle", "walk", "run", "jump", "swim", "skate", "climb", "wave", "lift", "point", "cheer"] as const;
/** these are placed by distance or by the jump's progress; the rest run on the clock */
const PLACED = new Set(["walk", "run", "jump", "climb"]);
const TINTS = ["#F6DDB6", "#CDEFEA", "#DDE5F8", "#F9D6C7"];
/** where each HUD chip takes you */
const STARTS = [0, 66.5, 124.6, 204.6];
const SEA = LEVELS.aqua.life.sea_level;
const DRAGON = LEVELS.magma.life.dragon;
const NEST = LEVELS.magma.life.nest;
/** the dragon's nostril, where its breath shows (world position) */
const NOSTRIL = [264.6, 7.0, 1.3];
/** the scroll after the top that brings in the final card (the camera stays at the summit: Sayed did not want a
 *  zoom-out over the whole world) */
const CARD_SCROLL = Math.min(7, EPILOGUE);
/** short lines on the stretches with nothing else to read: his three mottos along the ice, three of his numbers up
 *  the dragon's back (all from the CV) */
const NOTES = [
  ...values.map((v, i) => ({ x: 128.2 + i * 4.6, text: v.motto })),
  ...stats.slice(0, 3).map((sv, i) => ({ x: 233.5 + i * 7.5, text: `${sv.value} ${sv.label.toLowerCase()}` })),
];
/** the loading screen: one bar per realm, and what is being built */
const LOAD_COLORS = ["#F2B45C", "#3FD0C9", "#9DB4FF", "#FF7A3D"];
const LOAD_LINES = ["Raising the dunes", "Filling the Gulf", "Freezing the lake", "Waking the volcano", "Opening the gates"];

/** where the HUD's Contact button takes you: just before the nest */
const CONTACT_X = (ANCHORS.find((a) => a.id === "contact")?.x ?? WORLD_END) - 0.5;

/** The line he moves along: the ground, and in the sea the height he swims at. */
function pathY(x: number) {
  const top = surfaceBelow(SOLIDS, x * CM, -1e6, 0);
  const ground = Number.isFinite(top) ? -top / CM : 0;
  const swim = zoneAt(x, "swim");
  return swim ? ground + smooth(Math.min((x - swim.x0) / (swim.ease_in ?? 3), (swim.x1 - x) / (swim.ease_out ?? 3), 1)) * (swim.hover ?? 1.3) : ground;
}
const realmAt = (x: number) => Math.max(0, REALMS.findIndex((r) => x < r.x1));
/** Gems to pick up along the quiet stretches: most are on his way, every third one needs a jump. */
const GEMS = (
  [
    [13, 21, 2, 0],
    [38, 44, 2, 0],
    [78, 110, 4, 0.9],
    [127, 140, 2.2, 0],
    [149, 155, 2, 0],
    [207, 215, 2, 0],
    [231, 253, 2.2, 0],
  ] as const
).flatMap(([a, b, step, swim]) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => ({ x: a + i * step, y: pathY(a + i * step) + (swim || (i % 3 === 2 ? 2.05 : 1.0)), realm: realmAt(a + i * step) })));
/** the base of the dragon's skull (the hinge its head lifts about) and its mouth measured from there */
const DRAGON_NECK = [261, 5.8];
const DRAGON_MOUTH = [3.4, 0.9];

const STAR_VERT = `
attribute float aPhase; uniform float uTime; varying float vTwinkle;
void main() {
  vTwinkle = 0.55 + 0.45 * sin(uTime * (1.1 + aPhase * 1.7) + aPhase * 40.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 1.8 + aPhase * 1.8;
}`;
const STAR_FRAG = `
uniform float uOpacity; varying float vTwinkle;
void main() {
  float a = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(1.0, 1.0, 1.0, a * vTwinkle * uOpacity);
}`;

type Sim = {
  camX: number;
  camY: number;
  zoom: number;
  /** pixels per world unit at the walk plane, the world height at the top of the screen, his place across it */
  u: number;
  topZ: number;
  playerAt: number;
  x: number;
  y: number;
  jump: boolean;
  /** the jump key is still down: letting go early cuts the jump short (a tap on him counts as held) */
  jumpHeld: boolean;
  /** -1 / 0 / 1 while ← or → is held */
  keyDir: number;
  /** where he is across the screen, in pixels (the camera looks a little ahead, so it is not fixed) */
  heroPx: number;
  /** the loading screen is still up: nothing moves him yet */
  loading: boolean;
  /** ambient loops are stopped ("Pause animations", or the visitor prefers reduced motion) */
  calm: boolean;
  frames: number[];
  /** read by scripts/qa-world.mjs */
  qa: { onGround: boolean; running: boolean; mode: string; realm: number; loaded: string[]; sounds: Record<string, number>; boards: string[]; quality: number; overview: number; progress: number; revealed: boolean };
  onRealm: ((i: number) => void) | null;
  onProgress: ((p: number) => void) | null;
  onReveal: (() => void) | null;
  onGems: ((n: number) => void) | null;
  onQuality: ((q: number) => void) | null;
  dom: {
    boards: Map<string, { el: HTMLElement; w: number; h: number; off: number; side: number }>;
    titles: Map<number, HTMLElement>;
    skies: (HTMLElement | null)[];
    notes: (HTMLElement | null)[];
    intro: HTMLElement | null;
    final: HTMLElement | null;
    nums: (HTMLElement | null)[];
    trail: HTMLElement | null;
    sun: HTMLElement | null;
    moon: HTMLElement | null;
    tint: HTMLElement | null;
    heat: HTMLElement | null;
    hint: HTMLElement | null;
    fps: HTMLElement | null;
  };
};

const createSim = (): Sim => ({
  camX: 0,
  camY: 0,
  zoom: 1,
  u: 80,
  topZ: 6.86,
  playerAt: PLAYER_AT,
  x: 0,
  y: 0,
  jump: false,
  jumpHeld: false,
  keyDir: 0,
  heroPx: 0,
  loading: true,
  calm: false,
  frames: [],
  qa: { onGround: true, running: false, mode: "walk", realm: 0, loaded: [], sounds: audio.counts, boards: [], quality: 0, overview: 0, progress: 0, revealed: false },
  onRealm: null,
  onProgress: null,
  onReveal: null,
  onGems: null,
  onQuality: null,
  dom: { boards: new Map(), titles: new Map(), skies: [], notes: [], intro: null, final: null, nums: [], trail: null, sun: null, moon: null, tint: null, heat: null, hint: null, fps: null },
});

type Lives = Partial<Record<RealmId, { life: Life; root: THREE.Object3D }>>;

/** One realm: loads its model, gives its surfaces their shaders and wakes up what lives there. */
function RealmScene({ id, lives }: { id: RealmId; lives: { current: Lives } }) {
  const { scene } = useGLTF(`/world/${id}.glb`, DRACO);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const root = useThree((s) => s.scene);
  useEffect(() => {
    let alive = true;
    scene.visible = false;
    dressRealm(scene, id);
    const life = createLife(id, scene);
    // its shaders are compiled behind the loading screen, so the realm comes in without a stutter
    gl.compileAsync(scene, camera, root)
      .catch(() => undefined)
      .then(() => {
        if (alive) lives.current[id] = { life, root: scene };
      });
    return () => {
      alive = false;
      delete lives.current[id];
    };
  }, [id, scene, lives, gl, camera, root]);
  return <primitive object={scene} />;
}

const AURORA_FRAG = `
uniform float uTime; uniform float uOpacity; uniform vec3 uLow; uniform vec3 uHigh; uniform float uPhase;
varying vec2 vUv;
float aHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float aNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(aHash(i), aHash(i + vec2(1.0, 0.0)), f.x), mix(aHash(i + vec2(0.0, 1.0)), aHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float y = vUv.y + 0.07 * sin(vUv.x * 9.0 + uPhase + uTime * 0.12);
  float band = pow(clamp(sin(3.14159 * clamp(y, 0.0, 1.0)), 0.0, 1.0), 1.3);
  float rays = 0.18 + 0.82 * smoothstep(0.3, 0.72, aNoise(vec2(vUv.x * 38.0 + uPhase + uTime * 0.06, y * 0.7)));
  gl_FragColor = vec4(mix(uLow, uHigh, smoothstep(0.4, 1.0, y)), band * rays * uOpacity);
  #include <colorspace_fragment>
}`;

function Scene({ sim, small, quality }: { sim: Sim; small: boolean; quality: number }) {
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;
  const { camera } = useThree();
  const hero = useGLTF(HERO_URL);
  const heroRef = useRef<THREE.Group>(null);
  const { actions } = useAnimations(hero.animations, heroRef);
  const lives = useRef<Lives>({});
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const lavaRef = useRef<THREE.PointLight>(null);
  const nestRef = useRef<THREE.PointLight>(null);
  const printsRef = useRef<THREE.InstancedMesh>(null);
  const dustRef = useRef<THREE.InstancedMesh>(null);
  const bubblesRef = useRef<THREE.InstancedMesh>(null);
  const skyRef = useRef<THREE.Group>(null);
  const snowRef = useRef<THREE.Points>(null);
  const embersRef = useRef<THREE.Points>(null);
  const motesRef = useRef<THREE.Points>(null);
  const planktonRef = useRef<THREE.Points>(null);
  const shootRef = useRef<THREE.Mesh>(null);
  const gemsRef = useRef<THREE.InstancedMesh>(null);
  const cloudsRef = useRef<THREE.InstancedMesh>(null);
  // one kind of cloud for the whole world: heaped puffs on a flat base, lit by whichever realm's light it is under
  // (cream over the desert, moonlit over the snow, dark and red over the volcano)
  const clouds = useMemo(() => {
    const puffs = [
      [-2.1, 0.25, 0.75], [-1.05, 0.45, 1.0], [0, 0.55, 1.2], [1.1, 0.42, 0.95], [2.1, 0.22, 0.7], [-0.5, 1.15, 0.8], [0.55, 1.2, 0.75],
    ].map(([px, py, r]) => new THREE.SphereGeometry(r, 14, 10).scale(1.25, 0.8, 0.9).translate(px, py, 0));
    puffs.push(new THREE.SphereGeometry(1, 16, 8).scale(3.0, 0.12, 0.9));
    return {
      geo: mergeGeometries(puffs),
      mat: new THREE.MeshLambertMaterial({ color: "#FFFFFF", emissive: "#FFFFFF", emissiveIntensity: 0.12 }),
      at: Array.from({ length: 13 }, (_, i) => ({ x: i * 26 + (i % 3) * 7 - 20, y: 10.5 + ((i * 37) % 7), z: -40 - ((i * 53) % 24), s: 1.4 + ((i * 29) % 5) * 0.32 })),
    };
  }, []);
  const fx = useMemo(() => new Fx(200), []);

  // realm colours, parsed once
  const pal = useMemo(
    () => REALMS.map((r) => ({ sun: new THREE.Color(r.sun.color), sky: new THREE.Color(r.hemi.sky), ground: new THREE.Color(r.hemi.ground), steps: new THREE.Color(r.steps), dust: new THREE.Color(r.dust) })),
    [],
  );
  // what hangs in the air of each realm: dust in the desert light, plankton in the sea, stars that twinkle, two
  // aurora curtains and falling snow (Snow), rising embers (Magma), and now and then a shooting star
  const sky = useMemo(() => {
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const cloud = (n: number, box: number[]) => {
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) p.set([rnd(box[0], box[1]), rnd(box[2], box[3]), rnd(box[4], box[5])], i * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(p, 3));
      return g;
    };
    const curtain = (low: string, high: string, phase: number) =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: TIME, uOpacity: { value: 0 }, uLow: { value: new THREE.Color(low) }, uHigh: { value: new THREE.Color(high) }, uPhase: { value: phase } },
        vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: AURORA_FRAG,
        transparent: true,
        depthWrite: false,
      });
    const stars = cloud(170, [-75, 75, 12, 60, -100, -100]);
    stars.setAttribute("aPhase", new THREE.BufferAttribute(Float32Array.from({ length: 170 }, () => Math.random()), 1));
    const speck = (color: string, size: number) => new THREE.PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false });
    return {
      stars,
      starsMat: new THREE.ShaderMaterial({ uniforms: { uTime: TIME, uOpacity: { value: 0 } }, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false }),
      motes: cloud(70, [-13, 13, 0.3, 8.5, -7, 4]),
      motesMat: speck("#FFF6DE", 2.2),
      plankton: cloud(150, [-13, 13, -0.2, 2.9, -8, 4]),
      planktonMat: speck("#DFFFF6", 2.4),
      shootMat: new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0, depthWrite: false }),
      aurora: [curtain("#63F0BE", "#B58CFF", 0), curtain("#7CC6FF", "#C7A0FF", 2.1)],
      snow: cloud(260, [-13, 13, -1.5, 13, -9, 4]),
      snowMat: new THREE.PointsMaterial({ color: "#FFFFFF", size: 3.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }),
      embers: cloud(120, [-13, 13, -1, 12, -9, 4]),
      embersMat: new THREE.PointsMaterial({ color: "#FFB04A", size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }),
    };
  }, []);

  useEffect(() => {
    hero.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.frustumCulled = false; // the bind-pose bounds don't cover the swim pose
      // grain, and a rim of the realm's light along his edges
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === "SayedColor") detail(mat, HERO_RIM);
    });
  }, [hero]);

  useEffect(() => {
    for (const name of ANIMS) {
      const a = actions[name];
      if (!a) continue;
      a.reset().play();
      a.paused = PLACED.has(name);
      a.setEffectiveWeight(name === "idle" ? 1 : 0);
    }
  }, [actions]);

  const st = useRef({
    body: createBody(0),
    started: false,
    revealed: false,
    warm: 0,
    progress: -1,
    facing: 1 as 1 | -1,
    turnAcc: 0,
    angle: -0.5,
    pace: 0,
    running: false,
    still: 1,
    phase: 0,
    stepI: 0,
    amb: 0,
    camOff: 0,
    viewH: 0,
    shake: 0,
    shakeV: 0,
    lift: 0,
    liftV: 0,
    outfit: -1,
    skates: false,
    realm: -1,
    wasSwim: false,
    wasSkate: false,
    wasRide: false,
    onDragon: false,
    atNest: false,
    atTop: false,
    fireworks: 0,
    nextFw: 0,
    lastBreath: 0,
    lastPop: 0,
    lastStroke: 0,
    prevBreath: 0,
    // how he moves: squash and stretch, lean, the camera's look-ahead, and the jump (buffered, forgiving, cut short
    // when the key is let go, with one more in the air)
    sq: 0,
    sqV: 0,
    lean: 0,
    accel: 0,
    prevAlong: 0,
    ahead: 0,
    prevCamX: 0,
    jumpBuf: -9,
    leftGroundAt: -9,
    jumped: false,
    jumpCut: false,
    airJumps: 1,
    wakeAt: -1,
    roared: false,
    gems: GEMS.map(() => false),
    gemCount: 0,
    gemsInit: false,
    shownNums: ["", "", "", ""],
    shootAt: 5,
    shootT: 9,
    shootX: 0,
    shootY: 30,
    quality: 0,
    qualityAt: 4,
    w: Object.fromEntries(ANIMS.map((n) => [n, n === "idle" ? 1 : 0])) as Record<string, number>,
    lastPrint: 0,
    printN: 0,
    prints: Array.from({ length: 28 }, () => ({ x: 0, y: -99, z: 0, born: -99, rot: 0 })),
    dust: Array.from({ length: 18 }, () => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, born: -99 })),
    dustN: 0,
    lastDust: 0,
    bubbles: Array.from({ length: 14 }, () => ({ x: 0, y: -99, z: 0, born: -99, r: 0.05 })),
    bubbleN: 0,
    lastBubble: 0,
    lastT: 0,
    weights: [1, 0, 0, 0],
    skyOp: [-1, -1, -1, -1],
    docked: "",
  }).current;
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), e: new THREE.Euler(), c: new THREE.Color(), c2: new THREE.Color() }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    // the ambient clock: stopped by "Pause animations" and by a reduced-motion preference
    const calm = sim.calm;
    if (!calm) st.amb += dt;
    const amb = st.amb;
    TIME.value = amb;
    const now = performance.now();
    if (st.lastT) {
      sim.frames.push(now - st.lastT);
      if (sim.frames.length > 900) sim.frames.shift();
    }
    st.lastT = now;
    const say = (name: SoundName, v = 1) => audio.play(name, v);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);

    // ---- the view: wide screens see 8.1 units of height, upright phones see more
    const vw = state.size.width;
    const vh = state.size.height;
    const viewH = viewHFor(vw, vh);
    const u = vh / viewH;
    const visW = vw / u;
    const playerAt = playerAtFor(vw, vh);
    const narrow = vw < 640;
    sim.u = u;
    sim.playerAt = playerAt;
    const cam = camera as THREE.PerspectiveCamera;
    if (st.viewH !== viewH) {
      st.viewH = viewH;
      cam.fov = (2 * Math.atan(viewH / 2 / CAM_DIST) * 180) / Math.PI;
      cam.updateProjectionMatrix();
    }
    const L = lenisRef.current;
    const raw = Math.max(0, (L ? L.animatedScroll : window.scrollY) / u);
    // past the summit the scroll no longer moves him: it brings in the final card
    const card = smooth(Math.max(0, Math.min(1, (raw - WORLD_END) / CARD_SCROLL)));
    sim.qa.overview = card;

    // ---- the dragon breathes: its back (and the floor he walks there) rises and falls
    const breath = Math.sin(amb * 0.9);
    for (const b of BREATHING) {
      SOLIDS[b.i].y0 = -b.y0 * (1 + breath * 0.018) * CM;
      SOLIDS[b.i].y1 = -b.y1 * (1 + breath * 0.018) * CM;
    }

    // ---- player: x straight from the scroll, y from the 2D body
    const x = Math.min(WORLD_END, raw);
    const dx = st.started ? x - sim.x : 0;
    const teleport = Math.abs(dx) > 6; // a HUD jump: put him on the ground there
    sim.x = x;
    const body = st.body;
    if (!st.started || teleport) {
      const top = surfaceBelow(SOLIDS, x * CM, -1e6, 0);
      body.y = Number.isFinite(top) ? top : 0;
      body.vy = 0;
      body.onGround = true;
      body.crouch = 0;
    }
    const first = !st.started;
    st.started = true;
    const quiet = first || teleport;
    const swimZone = zoneAt(x, "swim");
    const swimK = swimZone ? smooth(Math.min((x - swimZone.x0) / (swimZone.ease_in ?? 3), (swimZone.x1 - x) / (swimZone.ease_out ?? 3), 1)) : 0;
    // he swims once the water is deep enough to float in; in the shallows at either end he wades
    const swimming = swimK > 0.35 && -body.y / CM < SEA - 0.5;
    const riding = !!zoneAt(x, "ride");
    if (sim.jump) {
      sim.jump = false;
      st.jumpBuf = time;
    }
    if (body.onGround) {
      st.airJumps = 1;
      st.jumped = false;
    }
    // a jump asked for just before he lands still counts, and so does one just after he walks off an edge; in the
    // air he has one more, smaller one
    if (time - st.jumpBuf < 0.14) {
      const late = !body.onGround && !st.jumped && !body.hop && time - st.leftGroundAt < 0.11;
      if (swimming) {
        // a kick upwards
        st.jumpBuf = -9;
        st.liftV = 3.4;
        say("kick");
        for (let k = 0; k < 5; k++) fx.spawn(x + rnd(-0.3, 0.3), sim.y + rnd(0, 0.6), rnd(-0.2, 0.3), rnd(-0.3, 0.3), rnd(0.8, 1.6), 0, 1.3, rnd(0.03, 0.07), 0.02, "#E9FFFB");
      } else if (!riding && (body.onGround || late)) {
        st.jumpBuf = -9;
        body.vy = -JUMP_V;
        body.hop = false;
        body.onGround = false;
        body.crouch = 0;
        body.jumpedAt = time;
        st.jumped = true;
        st.jumpCut = false;
        st.sqV += 2.6;
        say("jump");
      } else if (!riding && !body.onGround && st.airJumps > 0) {
        st.jumpBuf = -9;
        st.airJumps--;
        body.vy = -JUMP_V * 0.82;
        body.hop = false;
        body.jumpedAt = time;
        st.jumped = true;
        st.jumpCut = false;
        st.sqV += 2.2;
        say("jump");
        fx.burst(x, sim.y + 0.1, 0.1, 9, 1.5, 0.4, 0.06, ["#FFFFFF", REALMS[Math.max(0, st.realm)].dust], 0);
      }
    }
    const wasGround = body.onGround;
    const fallV = body.vy;
    // how far the current scroll will still carry him. Unknown while a key is held (the target then moves with him),
    // and the body takes unknown as "far enough", so it hops onto a step as soon as his foot reaches it.
    const remaining = L && !sim.keyDir ? ((L.targetScroll - L.animatedScroll) / u) * CM : Number.NaN;
    stepBody(body, SOLIDS, x * CM, teleport ? 0 : dx * CM, dt, CHAR_H * CM, time, 900, remaining);
    if (wasGround && !body.onGround) st.leftGroundAt = time;
    // letting go of the key early makes it a small hop; holding it gives the full jump
    if (!body.onGround && st.jumped && !st.jumpCut && !sim.jumpHeld && body.vy < -JUMP_V * 0.25 && time - body.jumpedAt > 0.07) {
      body.vy *= 0.5;
      st.jumpCut = true;
    }
    st.liftV -= (st.lift > 0 || st.liftV > 0 ? 7 : 0) * dt;
    st.lift = Math.max(0, st.lift + st.liftV * dt);
    if (st.lift === 0) st.liftV = Math.max(0, st.liftV);
    sim.y = -body.y / CM + swimK * ((swimZone?.hover ?? 1.3) + Math.sin(amb * 1.6) * 0.08 + st.lift);
    const speed = teleport ? 0 : dx / dt;

    // he only turns round after a little real movement the other way
    if (Math.abs(dx) > 0.0005 && !teleport) {
      const nf = dx > 0 ? 1 : -1;
      if (nf === st.facing) st.turnAcc = 0;
      else if ((st.turnAcc += Math.abs(dx)) > 0.05 || Math.abs(dx) > 0.08) {
        st.turnAcc = 0;
        st.facing = nf;
        // turning on his heel at speed kicks up the ground
        if (st.pace > 7 && body.onGround && !swimming && !riding && sim.y > SEA)
          for (let k = 0; k < 4; k++) fx.spawn(x + rnd(-0.15, 0.15), sim.y + 0.06, rnd(-0.2, 0.3), -nf * rnd(0.6, 1.8), rnd(0.4, 1.1), 0, 0.5, 0.05, 0.14, REALMS[Math.max(0, st.realm)].dust, 2);
      }
    }
    st.pace += (Math.abs(speed) - st.pace) * Math.min(1, dt * 10);
    st.running = st.pace > VIEW_H * (st.running ? 0.9 : 1.07);
    st.still = Math.abs(speed) < 0.14 ? st.still + dt : 0;
    const moving = st.still < 0.12;
    const air = !body.onGround && !swimming;
    const skating = !!zoneAt(x, "skate") && body.onGround;
    const climbing = !!zoneAt(x, "climb") && body.onGround;
    // distance-locked cycle that only ever runs forward (walking left he is turned round, never moonwalking)
    st.phase += Math.min(10 * dt, Math.abs(teleport ? 0 : dx) / (st.running ? 2.5 : climbing ? 1.1 : 1.5));
    const mode = swimming ? "swim" : riding ? "ride" : skating ? "skate" : climbing ? "climb" : "walk";
    sim.qa.onGround = body.onGround;
    sim.qa.running = st.running;
    sim.qa.mode = mode;

    // ---- where the camera is, and which realm's sky and light apply. The sea takes over as the camera sinks
    //      below the surface, so that change happens at the water line.
    st.camOff += (camOffset(x) - st.camOff) * Math.min(1, teleport ? 1 : dt * 3.5);
    const under = smooth((SEA + 0.25 - (CAM_Y + st.camOff)) / 1.3);
    const w = realmWeights(x, under, st.weights);
    const realm = w.indexOf(Math.max(...w));

    // ---- what he does makes sound and kicks things up
    if (body.jumpedAt === time && body.hop) say("hop");
    if (body.onGround && !wasGround && !swimming && !quiet) {
      const hard = Math.min(1, Math.max(0, fallV / 900));
      say("land", hard);
      st.sqV -= 2.2 + 3.4 * hard;
      if (hard > 0.45 && !calm) st.shakeV -= 0.9 * hard;
      if (realm === 3) fx.burst(x, sim.y + 0.05, 0.1, 6, 1.4, 0.5, 0.045, ["#FFB04A", "#FF7A2E"], 6);
    }
    const stepI = Math.floor(st.phase * 2);
    if (stepI !== st.stepI) {
      st.stepI = stepI;
      if (body.onGround && moving && !swimming && !riding && !skating && !quiet) {
        say(`step-${surfaceAt(x)}`);
        // sparks under his boots on the hot stone and on the dragon
        if (realm === 3) fx.spawn(x - st.facing * 0.1, sim.y + 0.05, rnd(-0.1, 0.1), -st.facing * rnd(0.3, 1), rnd(0.8, 1.6), 0, 0.4, 0.04, 0, "#FFB04A", 5);
      }
    }
    if (swimming !== st.wasSwim && !quiet) {
      // through the surface of the Gulf, either way: a splash, and bubbles on the way down
      say(swimming ? "splash-in" : "splash-out");
      for (let k = 0; k < 16; k++) fx.spawn(x + rnd(-0.5, 0.5), SEA + 0.05, rnd(-0.3, 0.4), rnd(-1.6, 1.6), rnd(1.8, 4.2), 0, rnd(0.6, 0.95), rnd(0.05, 0.1), 0.02, k % 3 ? "#DFFBFF" : "#FFFFFF", 9);
      if (swimming) for (let k = 0; k < 8; k++) fx.spawn(x + rnd(-0.4, 0.4), SEA - rnd(0.2, 0.9), rnd(-0.2, 0.3), rnd(-0.3, 0.3), rnd(0.5, 1.3), 0, 1.4, rnd(0.03, 0.08), 0.02, "#E9FFFB");
      if (!calm) st.shakeV -= 0.5;
    }
    st.wasSwim = swimming;
    if (skating && !st.wasSkate && !quiet) {
      // the ice takes his weight with a crack and a spray of chips
      say("crack");
      for (let k = 0; k < 12; k++) fx.spawn(x + rnd(-0.3, 0.3), sim.y + 0.05, rnd(-0.3, 0.3), rnd(-2.2, 2.2), rnd(0.8, 2.2), 0, 0.55, rnd(0.03, 0.06), 0, "#FFFFFF", 7);
      if (!calm) st.shakeV -= 0.7;
    }
    st.wasSkate = skating;
    if (riding !== st.wasRide && !quiet) say(riding ? "cable-on" : "cable-off");
    st.wasRide = riding;
    if (swimming && moving && time - st.lastStroke > 0.6) {
      st.lastStroke = time;
      say("stroke");
    }
    // the dragon stirs when he first steps onto its tail
    if (x > DRAGON.x0 + 0.5 && x < DRAGON.x1 && !st.onDragon && !quiet) {
      st.onDragon = true;
      say("growl");
    } else if (x < DRAGON.x0 - 2) st.onDragon = false;
    if (x > DRAGON.x1 + 0.3 && sim.y > NEST.top - 0.4 && !st.atNest) {
      st.atNest = true;
      if (!quiet) say("nest");
    } else if (x < DRAGON.x1 - 3) st.atNest = false;
    // the very top: the flag goes in and the fireworks go up
    if (x > LEVELS.magma.life.flag.x - 1.4 && sim.y > LEVELS.magma.life.top - 0.4 && !st.atTop) {
      st.atTop = true;
      say("fanfare");
      // the flag wakes the dragon: its fire goes up first, and the fireworks burst out of it
      st.wakeAt = time;
      st.roared = false;
      st.fireworks = 9;
      st.nextFw = time + 3.6;
    } else if (x < LEVELS.magma.life.flag.x - 3) {
      st.atTop = false;
      st.wakeAt = -1;
    }
    const wakeT = st.wakeAt >= 0 ? time - st.wakeAt : -1;
    if (wakeT > 1.1 && !st.roared) {
      st.roared = true;
      say("roar");
      if (!calm) st.shakeV -= 1.8;
    }
    if (wakeT > 2.9 && wakeT < 4.4) {
      // a plume of fire from its open jaws, up over his head
      const a = dragonWake(wakeT).lift * DRAGON_LIFT;
      const mx = DRAGON_NECK[0] + DRAGON_MOUTH[0] * Math.cos(a) - DRAGON_MOUTH[1] * Math.sin(a);
      const my = DRAGON_NECK[1] + DRAGON_MOUTH[0] * Math.sin(a) + DRAGON_MOUTH[1] * Math.cos(a);
      for (let k = 0; k < 3; k++) {
        const dir = a + 0.12 + rnd(-0.2, 0.2);
        const v = rnd(7, 11.5);
        fx.spawn(mx, my, 0.4, Math.cos(dir) * v, Math.sin(dir) * v, rnd(-0.7, 0.7), rnd(0.5, 0.85), 0.14, rnd(0.45, 0.7), k ? (k > 1 ? "#FF5A1F" : "#FF9A2E") : "#FFE9A0", -1.4);
      }
      if (!calm) st.shakeV += rnd(-0.45, 0.45);
    }
    if (st.fireworks > 0 && time > st.nextFw) {
      st.fireworks--;
      st.nextFw = time + rnd(0.35, 0.8);
      fx.burst(x + rnd(-7, 2), sim.y + rnd(2.6, 5.2), rnd(-6, -3), 30, 3.4, 1.3, 0.1, [["#CE1126", "#FFFFFF"], ["#FFD24A", "#FFFFFF"], ["#FF8A3C", "#FFD24A"]][st.fireworks % 3], 2.2);
      say("firework");
    }
    if (!calm) {
      // his breath shows in the cold
      if (w[2] > 0.6 && !swimming && time - st.lastBreath > 2.7) {
        st.lastBreath = time;
        for (let k = 0; k < 3; k++) fx.spawn(x + st.facing * (0.5 + k * 0.1), sim.y + 1.2 + k * 0.04, 0.2, st.facing * rnd(0.3, 0.5), rnd(0.1, 0.25), 0, 1.1, 0.05, 0.16 + k * 0.03, "#FFFFFF");
      }
      // the dragon's breath: a slow puff of smoke from its nostril each time it breathes out
      if (st.prevBreath <= 0.92 && breath > 0.92 && lives.current.magma && Math.abs(x - NOSTRIL[0]) < 34) {
        for (let k = 0; k < 5; k++) fx.spawn(NOSTRIL[0] + rnd(-0.1, 0.2), NOSTRIL[1] + k * 0.12, NOSTRIL[2], rnd(0.15, 0.45), rnd(0.5, 0.9), 0, 2.6, 0.12, 0.42 + k * 0.05, "#C9B9C0");
        if (Math.abs(x - NOSTRIL[0]) < 22) say("puff");
      }
      // the lava river spits sparks
      if (w[3] > 0.3 && time - st.lastPop > 0.3) {
        st.lastPop = time;
        const px = sim.camX + rnd(-visW / 2, visW / 2);
        for (let k = 0; k < 3; k++) fx.spawn(px + rnd(-0.2, 0.2), 0.1, 2.5, rnd(-0.6, 0.6), rnd(2.2, 3.8), rnd(-0.3, 0.3), 0.85, 0.05, 0, k ? "#FFB04A" : "#FFE08A", 7);
      }
    }
    st.prevBreath = breath;
    fx.update(dt);

    // the ice is slippery and the cable car is slow: the scroll eases differently there
    if (L) {
      const want = skating ? 0.06 : riding ? 0.1 : 0.14;
      const cur = L.options.lerp ?? 0.14;
      if (cur !== want) L.options.lerp = Math.abs(want - cur) < 0.001 ? want : cur + (want - cur) * Math.min(1, dt * 1.6);
    }

    // ---- his outfit changes at each realm gate, in a puff; the skates go on for the ice
    const outfit = outfitAt(x);
    if (outfit !== st.outfit || skating !== st.skates) {
      if (st.outfit >= 0 && outfit !== st.outfit && !quiet) fx.burst(x, sim.y + 0.9, 0.25, 18, 1.5, 0.55, 0.09, ["#FFFFFF", REALMS[outfit].accent], 0);
      st.outfit = outfit;
      st.skates = skating;
      const show = new Set<string>(["Body", "Body_glow", ...REALMS[outfit].layers, ...(skating ? ["Skates"] : [])]);
      hero.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.visible = show.has(o.name);
      });
    }

    const g = heroRef.current;
    if (g) {
      g.position.set(x, sim.y, 0);
      // profile while moving, turned a little to the camera when he stands
      const turned = !moving && !swimming;
      const want = st.facing > 0 ? (turned ? -0.5 : -0.1) : Math.PI + (turned ? 0.5 : 0.1);
      st.angle += (want - st.angle) * Math.min(1, dt * 11);
      g.rotation.y = st.angle;
      // he leans into his speed, more as he sets off and back as he stops; in the air he tips with the jump, and in
      // the water his nose follows a kick upwards
      const along = teleport ? 0 : speed * st.facing;
      st.accel += ((along - st.prevAlong) / Math.max(dt, 0.004) - st.accel) * Math.min(1, dt * 5);
      st.prevAlong = along;
      const upV = -body.vy / CM;
      const leanTo = quiet || riding || climbing
        ? 0
        : swimming
          ? -Math.max(-0.2, Math.min(0.4, st.liftV * 0.1))
          : air
            ? Math.max(-0.09, Math.min(0.12, -upV * 0.016)) + st.pace * 0.004
            : Math.max(-0.12, Math.min(skating ? 0.24 : 0.17, st.pace * (skating ? 0.013 : 0.006) + st.accel * 0.0035));
      st.lean += (leanTo - st.lean) * Math.min(1, dt * 9);
      g.rotation.z = -st.lean;
      // squash on landing, stretch on take-off
      st.sqV += (-st.sq * 190 - st.sqV * 15) * dt;
      st.sq = Math.max(-0.24, Math.min(0.2, st.sq + st.sqV * dt));
      g.scale.set(CHAR_SCALE * (1 - st.sq * 0.45), CHAR_SCALE * (1 + st.sq), CHAR_SCALE * (1 - st.sq * 0.45));
    }
    const target: Record<string, number> = Object.fromEntries(ANIMS.map((n) => [n, 0]));
    // standing still for a moment, he does something that fits where he is
    const gesture = st.still > 1.6 && body.onGround && !swimming && !riding ? (st.atTop ? "cheer" : gestureAt(x)) : null;
    if (swimming) target.swim = 1;
    else if (riding) target.idle = 1;
    else if (air || body.crouch > 0) target.jump = 1;
    else if (gesture) target[gesture] = 1;
    else if (!moving) target.idle = 1;
    else if (skating) target.skate = 1;
    else if (climbing) target.climb = 1;
    else if (st.running) target.run = 1;
    else target.walk = 1;
    for (const name of ANIMS) {
      const a = actions[name];
      if (!a) continue;
      st.w[name] += (target[name] - st.w[name]) * Math.min(1, dt * (name === "jump" ? 18 : 9));
      a.setEffectiveWeight(st.w[name]);
      const dur = a.getClip().duration;
      if (name === "walk" || name === "run" || name === "climb") a.time = (st.phase % 1) * dur;
      else if (name === "skate") a.timeScale = Math.max(0.5, Math.min(1.5, st.pace / 7));
      else if (name === "swim") a.timeScale = moving ? 1.15 : 0.6;
      else if (name === "idle") a.timeScale = calm ? 0 : 1;
      else if (name === "jump") {
        const rise = Math.min(1, Math.max(0, -body.vy / JUMP_V));
        const fall = Math.min(1, Math.max(0, body.vy / JUMP_V));
        a.time = dur * (body.crouch > 0 ? 0.15 : body.vy < 0 ? 0.6 - 0.25 * rise : 0.6 + 0.22 * fall);
      }
    }

    // ---- camera: side-on, frame shifted up like the Blender look camera; it follows the path's height, dips on a
    //      hard landing, pulls back at the very top, and in the epilogue rises to show the whole walk
    st.shakeV += (-st.shake * 140 - st.shakeV * 13) * dt;
    st.shake += st.shakeV * dt;
    const fin = smooth((x - 271.4) / 2.0);
    const dist = CAM_DIST + 11 * fin;
    sim.zoom = CAM_DIST / dist;
    sim.camY = st.camOff + fin;
    sim.topZ = CAM_Y + sim.camY + (SHIFT + 0.5) * viewH;
    // (the pull-back also slides the view back over the dragon, but never so far that he leaves a narrow screen)
    // it also looks a little ahead of the way he is going, so more of the world is in front of him than behind
    const aheadTo = quiet ? 0 : Math.max(-1, Math.min(1, speed * 0.085)) * Math.min(1.15, visW * 0.065);
    st.ahead += (aheadTo - st.ahead) * Math.min(1, dt * (Math.abs(aheadTo) > Math.abs(st.ahead) ? 1.8 : 1.1));
    sim.camX = x + ((0.5 - playerAt) * visW) / sim.zoom - Math.min(7.5, visW * 0.3) * fin + st.ahead * (1 - fin);
    // on an upright screen the dragon is out of the picture when he stands at the top, so while it wakes the
    // camera goes over to it (the eye, the roar, the fire) and comes back to him for the hatchling and the card
    const toDragon = narrow && wakeT >= 0 ? smooth((wakeT - 0.3) / 1.0) * (1 - smooth((wakeT - 4.9) / 1.0)) : 0;
    sim.camX += (264.6 - sim.camX) * toDragon;
    sim.heroPx = (x - sim.camX) * u * sim.zoom + vw / 2;
    const camDx = quiet ? 0 : sim.camX - st.prevCamX;
    st.prevCamX = sim.camX;
    cam.position.set(sim.camX, CAM_Y + sim.camY + st.shake * 0.12 - 1.2 * toDragon, dist);
    cam.rotation.set(0, 0, 0);
    const pe = cam.projectionMatrix.elements;
    if (Math.abs(pe[9] - 2 * SHIFT) > 1e-6) {
      pe[9] = 2 * SHIFT;
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    }

    // ---- sky and light cross-fade from realm to realm
    let power = 0;
    let hemiPower = 0;
    let ax = 0;
    let ay = 0;
    let az = 0;
    tmp.c.setRGB(0, 0, 0);
    tmp.c2.setRGB(0, 0, 0);
    const hemi = hemiRef.current;
    if (hemi) hemi.groundColor.setRGB(0, 0, 0);
    REALMS.forEach((r, i) => {
      power += w[i] * r.sun.power;
      hemiPower += w[i] * r.hemi.power;
      ax += w[i] * r.sun.at[0];
      ay += w[i] * r.sun.at[1];
      az += w[i] * r.sun.at[2];
      tmp.c.r += pal[i].sun.r * w[i];
      tmp.c.g += pal[i].sun.g * w[i];
      tmp.c.b += pal[i].sun.b * w[i];
      tmp.c2.r += pal[i].sky.r * w[i];
      tmp.c2.g += pal[i].sky.g * w[i];
      tmp.c2.b += pal[i].sky.b * w[i];
      if (hemi) {
        hemi.groundColor.r += pal[i].ground.r * w[i];
        hemi.groundColor.g += pal[i].ground.g * w[i];
        hemi.groundColor.b += pal[i].ground.b * w[i];
      }
      const el = sim.dom.skies[i];
      if (el && Math.abs(st.skyOp[i] - w[i]) > 0.003) el.style.opacity = String((st.skyOp[i] = w[i]));
    });
    if (hemi) {
      hemi.color.copy(tmp.c2);
      hemi.intensity = hemiPower;
    }
    const sun = sunRef.current;
    if (sun) {
      sun.color.copy(tmp.c);
      sun.intensity = power;
      // the shadow box follows the camera in whole texels, so shadow edges do not crawl as he walks
      const texel = 56 / (small || quality > 0 ? 1024 : 2048);
      const sx = Math.round(sim.camX / texel) * texel;
      sun.position.set(sx + ax, ay + st.camOff, az);
      sun.target.position.set(sx, st.camOff, 0);
      sun.target.updateMatrixWorld();
    }
    if (lavaRef.current) {
      lavaRef.current.intensity = 26 * w[3];
      lavaRef.current.position.set(x + 0.6, st.camOff * 0.2 + 0.5, 3.2);
    }
    // the eggs light the nest
    if (nestRef.current) nestRef.current.intensity = lives.current.magma ? 30 + 6 * Math.sin(amb * 2.3) : 0;
    if (sim.dom.sun) sim.dom.sun.style.opacity = String(w[0]);
    if (sim.dom.moon) sim.dom.moon.style.opacity = String(w[2]);
    // under water the whole view takes a blue cast; near the lava the bottom of the screen glows
    if (sim.dom.tint) sim.dom.tint.style.opacity = (under * 0.2).toFixed(3);
    if (sim.dom.heat) sim.dom.heat.style.opacity = (w[3] * (0.55 + 0.12 * Math.sin(amb * 1.7))).toFixed(3);
    if (realm !== st.realm) {
      if (st.realm >= 0 && !teleport) say("realm", realm);
      st.realm = realm;
      sim.qa.realm = realm;
      sim.onRealm?.(realm);
      if (printsRef.current) (printsRef.current.material as THREE.MeshBasicMaterial).color.copy(pal[realm].steps);
      if (dustRef.current) (dustRef.current.material as THREE.MeshLambertMaterial).color.copy(pal[realm].dust);
    }
    audio.update({
      weights: w,
      realm,
      // he hears the sea close over him when his head goes under
      under: swimming ? smooth((SEA - sim.y - 1.1) / 0.5) : 0,
      skate: skating && moving ? Math.min(1, st.pace / 8) : 0,
      ride: riding ? 1 : 0,
      dragon: Math.max(0, 1 - Math.abs(x - 252) / 34),
      breath,
      time,
    });
    if (skyRef.current) skyRef.current.position.set(sim.camX, sim.camY, 0);
    const night = 1;
    sky.starsMat.uniforms.uOpacity.value = Math.min(1, w[2] + w[3] * 0.7) * night;
    sky.aurora[0].uniforms.uOpacity.value = w[2] * 0.6 * night;
    sky.aurora[1].uniforms.uOpacity.value = w[2] * 0.42 * night;
    sky.snowMat.opacity = w[2] * 0.9 * night;
    sky.embersMat.opacity = w[3] * night;
    sky.motesMat.opacity = w[0] * 0.5 * night;
    sky.planktonMat.opacity = under * 0.6 * night;
    HERO_RIM.value.setRGB(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      HERO_RIM.value.r += RIMS[i].r * w[i];
      HERO_RIM.value.g += RIMS[i].g * w[i];
      HERO_RIM.value.b += RIMS[i].b * w[i];
    }
    // what drifts in the air stays in the world as the camera moves past it (it is not stuck to the screen)
    for (const [pts, vy, vx, drift, on, lo, hi] of [
      [snowRef.current, -1.1, -0.35, 0.25, w[2], -1.5, 13],
      [embersRef.current, 0.7, 0.1, 0.15, w[3], -1.5, 13],
      [motesRef.current, 0.06, 0.45, 0.12, w[0], 0.3, 8.5],
      [planktonRef.current, 0.09, -0.12, 0.1, under, -0.2, 2.9],
    ] as const) {
      if (!pts || on < 0.01) continue;
      const p = pts.geometry.attributes.position as THREE.BufferAttribute;
      const still = calm ? 0 : dt;
      for (let i = 0; i < p.count; i++) {
        let py = p.getY(i) + vy * still * (0.6 + (i % 5) * 0.2);
        if (py < lo) py += hi - lo;
        if (py > hi) py -= hi - lo;
        let px = p.getX(i) - camDx + (vx * (0.7 + (i % 4) * 0.2) + Math.sin(amb * 0.8 + i) * drift) * still;
        px = ((((px + 13) % 26) + 26) % 26) - 13;
        p.setXY(i, px, py);
      }
      p.needsUpdate = true;
    }
    // now and then a shooting star crosses the night sky
    const shoot = shootRef.current;
    if (shoot) {
      const dark = Math.min(1, w[2] + w[3]) * night;
      if (!calm && dark > 0.5 && amb > st.shootAt) {
        st.shootAt = amb + rnd(6, 14);
        st.shootT = 0;
        st.shootX = rnd(-34, 14);
        st.shootY = rnd(30, 44);
      }
      if (st.shootT < 0.9) {
        st.shootT += dt;
        const k = st.shootT / 0.9;
        shoot.position.set(st.shootX + 34 * k, st.shootY - 13 * k, -99);
        sky.shootMat.opacity = Math.sin(Math.PI * Math.min(1, k)) * dark * 0.9;
      } else sky.shootMat.opacity = 0;
    }

    // ---- the clouds drift slowly along the whole walk and come round again
    const cl = cloudsRef.current;
    if (cl) {
      clouds.at.forEach((c, i) => {
        const cx = ((((c.x + amb * 0.22 + 30) % 340) + 340) % 340) - 30;
        tmp.m.compose(tmp.v.set(cx, c.y + Math.sin(amb * 0.2 + i) * 0.15, c.z), tmp.q.identity(), tmp.s.set(c.s, c.s, c.s));
        cl.setMatrixAt(i, tmp.m);
      });
      cl.instanceMatrix.needsUpdate = true;
    }
    // ---- gems along the way: they turn and bob, and go with a chime when he touches them
    const gems = gemsRef.current;
    if (gems) {
      if (!st.gemsInit) {
        st.gemsInit = true;
        GEMS.forEach((gm, i) => gems.setColorAt(i, tmp.c.set(LOAD_COLORS[gm.realm])));
        if (gems.instanceColor) gems.instanceColor.needsUpdate = true;
      }
      GEMS.forEach((gm, i) => {
        if (!st.gems[i] && !quiet && Math.abs(gm.x - x) < 0.7 && Math.abs(gm.y - (sim.y + 0.9)) < 0.95) {
          st.gems[i] = true;
          st.gemCount++;
          say("gem");
          fx.burst(gm.x, gm.y, 0.2, 8, 1.8, 0.45, 0.06, ["#FFFFFF", LOAD_COLORS[gm.realm]], 1);
          sim.onGems?.(st.gemCount);
        }
        const k = st.gems[i] || Math.abs(gm.x - sim.camX) > 30 ? 0 : 1;
        tmp.m.compose(tmp.v.set(gm.x, gm.y + Math.sin(amb * 2 + i) * 0.07, 0), tmp.q.setFromEuler(tmp.e.set(0, amb * 1.8 + i, 0)), tmp.s.set(k, k * 1.25, k));
        gems.setMatrixAt(i, tmp.m);
      });
      gems.instanceMatrix.needsUpdate = true;
    }
    // ---- the world reacts: prints behind him (sand, snow, glowing stone), dust and spray, bubbles under water
    const prints = printsRef.current;
    if (prints) {
      if (body.onGround && !swimming && !riding && Math.abs(x - st.lastPrint) > 0.42) {
        st.lastPrint = x;
        const p = st.prints[st.printN++ % st.prints.length];
        p.x = x - st.facing * 0.12;
        p.y = sim.y + 0.014;
        p.z = st.printN % 2 ? 0.12 : -0.12;
        p.born = time;
        p.rot = st.facing > 0 ? 0 : Math.PI;
      }
      st.prints.forEach((p, i) => {
        const k = p.y < SEA ? 0 : Math.max(0, 1 - (time - p.born) / (realm === 3 ? 2.6 : 9));
        tmp.m.compose(tmp.v.set(p.x, p.y, p.z), tmp.q.setFromEuler(tmp.e.set(0, p.rot, 0)), tmp.s.set(k, 1, k));
        prints.setMatrixAt(i, tmp.m);
      });
      prints.instanceMatrix.needsUpdate = true;
    }
    const dust = dustRef.current;
    if (dust) {
      const landed = body.onGround && !wasGround && !swimming && sim.y > SEA;
      if ((body.onGround && !swimming && !riding && (st.running || skating) && moving && sim.y > SEA && time - st.lastDust > 0.07) || landed) {
        st.lastDust = time;
        for (let k = 0; k < (landed ? 4 : 1); k++) {
          const d = st.dust[st.dustN++ % st.dust.length];
          d.x = x - st.facing * 0.2 + (Math.random() - 0.5) * 0.3;
          d.y = sim.y + 0.06;
          d.z = (Math.random() - 0.5) * 0.4;
          d.vx = -st.facing * (0.4 + Math.random() * 0.8) + (landed ? (Math.random() - 0.5) * 2.4 : 0);
          d.vy = 0.5 + Math.random() * 0.6;
          d.born = time;
        }
      }
      st.dust.forEach((d, i) => {
        const age = (time - d.born) / 0.55;
        const k = age < 1 ? Math.sin(Math.PI * age) * 0.16 : 0;
        tmp.m.compose(tmp.v.set(d.x + d.vx * age * 0.5, d.y + d.vy * age * 0.5, d.z), tmp.q.identity(), tmp.s.set(k, k, k));
        dust.setMatrixAt(i, tmp.m);
      });
      dust.instanceMatrix.needsUpdate = true;
    }
    const bubbles = bubblesRef.current;
    if (bubbles) {
      if (swimming && time - st.lastBubble > (moving ? 0.22 : 0.6)) {
        st.lastBubble = time;
        const b = st.bubbles[st.bubbleN++ % st.bubbles.length];
        b.x = x + st.facing * 0.5 + (Math.random() - 0.5) * 0.2;
        b.y = sim.y + 0.7;
        b.z = -0.2 + Math.random() * 0.3;
        b.born = time;
        b.r = 0.03 + Math.random() * 0.05;
        say("bubble");
      }
      st.bubbles.forEach((b, i) => {
        const age = time - b.born;
        const k = age < 2.4 && b.y + age * 1.3 < SEA - 0.15 ? b.r : 0;
        tmp.m.compose(tmp.v.set(b.x + Math.sin(age * 5 + i) * 0.06, b.y + age * 1.3, b.z), tmp.q.identity(), tmp.s.set(k, k, k));
        bubbles.setMatrixAt(i, tmp.m);
      });
      bubbles.instanceMatrix.needsUpdate = true;
    }

    // ---- every realm is loaded and compiled behind the loading screen. Once all four are in, they are drawn there
    //      for a few frames (so their geometry is on the graphics card), and after that only the ones in view are.
    const all = REALMS.every((r) => lives.current[r.id]);
    if (!st.revealed) {
      const got = REALMS.filter((r) => lives.current[r.id]).length;
      if (all && st.warm < 4) st.warm++;
      // a sixth for him, a sixth for each realm, a sixth for the warm-up
      const p = (1 + got + (all ? st.warm / 4 : 0)) / 6;
      if (p !== st.progress) {
        st.progress = p;
        sim.qa.progress = p;
        sim.onProgress?.(p);
      }
      // (a realm that is very slow to arrive does not hold the world shut: it opens with the Desert and the rest join)
      if ((all && st.warm >= 4 && time > 1.2) || (lives.current.desert && time > 25)) {
        st.revealed = true;
        st.qualityAt = time + 4;
        sim.frames.length = 0;
        sim.qa.revealed = true;
        sim.onReveal?.();
      }
    }
    for (const r of REALMS) {
      const live = lives.current[r.id];
      if (!live) continue;
      live.root.visible = (!st.revealed && all) || (sim.camX > r.x0 - 95 && sim.camX < r.x1 + 95);
      if (live.root.visible) live.life.update({ x, y: sim.y, camX: sim.camX, dt, time: amb, running: st.running && moving, breath, wake: wakeT, emit: say });
    }
    sim.qa.loaded = Object.keys(lives.current);

    // ---- a slow machine gets a lighter picture: first fewer pixels and a smaller shadow map, then no shadows
    if (st.revealed && time > st.qualityAt) {
      st.qualityAt = time + 2.5;
      const s = sim.frames.slice(-90).sort((a, b) => a - b);
      if (s.length >= 60 && s[s.length >> 1] > 27 && st.quality < 2) {
        st.quality++;
        st.qualityAt = time + 5;
        sim.qa.quality = st.quality;
        sim.onQuality?.(st.quality);
      }
    }

    // ---- the page elements pinned to the world
    const px = (wx: number) => (wx - sim.camX) * u * sim.zoom + vw / 2;
    // on a phone one card at a time docks in the middle of the screen while its place is in view
    let dock = "";
    if (narrow) {
      let best = vw * 0.5;
      for (const a of ANCHORS) {
        const d = Math.abs(px(a.x) - vw / 2);
        if (d < best) {
          best = d;
          dock = a.id;
        }
      }
      // from the nest to the very top the contact card stays up
      if (x > DRAGON.x1 + 0.3) dock = "contact";
    }
    const shown: string[] = [];
    for (const a of ANCHORS) {
      const b = sim.dom.boards.get(a.id);
      if (!b) continue;
      const sx = px(a.x);
      // boards appear as they reach the screen and go again once they are behind him; the final card replaces them
      const on = (card > 0.25 ? false : narrow ? dock === a.id : sx < vw * 0.9 && sx > vw * 0.07) ? "1" : "0";
      if (b.el.dataset.on !== on) {
        b.el.dataset.on = on;
        if (on === "1" && !quiet) say("board");
      }
      if (on === "1") shown.push(a.id);
      // a card never sits on his head: when it would (a tall card, or he is high on the screen), it steps to the
      // side it is already on and stays there until he has passed
      const base = sx - b.w / 2;
      let off = 0;
      if (!narrow && on === "1") {
        const headY = (sim.topZ - (sim.y + CHAR_H + 0.2)) * u;
        const reach = 0.75 * u;
        if (headY < vh * 0.14 + b.h + 8 && base < sim.heroPx + reach && base + b.w > sim.heroPx - reach) {
          if (!b.side) b.side = sx < sim.heroPx ? -1 : 1;
          off = b.side < 0 ? sim.heroPx - reach - (base + b.w) : sim.heroPx + reach - base;
        } else b.side = 0;
      } else b.side = 0;
      b.off += (off - b.off) * Math.min(1, dt * 7);
      const at = narrow ? (vw - b.w) / 2 : base + b.off;
      if (narrow ? on === "1" || st.docked !== "phone" : sx > -900 && sx < vw + 900) b.el.style.transform = `translate3d(${at.toFixed(1)}px,0,0)`;
    }
    st.docked = narrow ? "phone" : "";
    sim.qa.boards = shown;
    TITLES.forEach((t, i) => {
      const el = sim.dom.titles.get(i);
      const sx = px(t.x);
      if (!el) return;
      // off screen it is parked, so a jump from the HUD never leaves a title standing where it last was
      const near = sx > -1400 && sx < vw + 400;
      // its letters drop in as it comes onto the screen
      const inView = sx > -1400 && sx < vw * 0.97 ? "1" : "0";
      if (el.dataset.in !== inView) el.dataset.in = inView;
      if (near) el.style.transform = `translate3d(${sx.toFixed(1)}px,0,0)`;
      else if (el.dataset.near !== "0") el.style.transform = "translate3d(-300vw,0,0)";
      el.dataset.near = near ? "1" : "0";
    });
    NOTES.forEach((n, i) => {
      const el = sim.dom.notes[i];
      if (!el) return;
      const sx = px(n.x);
      const k = sx > -400 && sx < vw + 400 ? smooth(1.25 - Math.abs(n.x - x) / 5.5) : 0;
      el.style.opacity = k.toFixed(3);
      if (k > 0) el.style.transform = `translate3d(${sx.toFixed(1)}px,${((1 - k) * 14).toFixed(1)}px,0) translate(-50%,0)`;
    });
    if (sim.dom.intro) sim.dom.intro.style.opacity = (1 - smooth((raw - 0.6) / 2.2)).toFixed(3);
    // the last card comes in with the last of the scroll, and its numbers count up
    const fin2 = smooth((card - 0.15) / 0.6);
    if (sim.dom.final) {
      sim.dom.final.style.opacity = fin2.toFixed(3);
      sim.dom.final.style.pointerEvents = fin2 > 0.6 ? "auto" : "none";
      sim.dom.final.style.translate = `-50% ${((1 - fin2) * 18).toFixed(1)}px`;
      sim.dom.final.inert = fin2 < 0.6;
    }
    stats.forEach((sv, i) => {
      const el = sim.dom.nums[i];
      const txt = String(Math.round(Number(sv.value) * smooth((card - 0.45 - i * 0.05) / 0.4)));
      if (el && st.shownNums[i] !== txt) el.textContent = st.shownNums[i] = txt;
    });
    if (sim.dom.trail) sim.dom.trail.style.transform = `scaleX(${(x / WORLD_END).toFixed(4)})`;
    if (sim.dom.sun) sim.dom.sun.style.transform = `translate3d(${(-sim.camX * u * 0.03).toFixed(1)}px,0,0)`;
    if (sim.dom.hint) sim.dom.hint.style.opacity = raw * u > 30 ? "0" : "1";
    if (sim.dom.fps && sim.frames.length > 30 && time % 0.5 < dt) {
      const s = [...sim.frames].sort((a, b) => a - b);
      sim.dom.fps.textContent = `frame p50 ${s[Math.floor(s.length * 0.5)].toFixed(1)} ms · p95 ${s[Math.floor(s.length * 0.95)].toFixed(1)} ms`;
    }
  });

  const lite = small || quality > 0;
  return (
    <>
      <hemisphereLight ref={hemiRef} args={["#C6D6EC", "#B79A6F", 2.67]} />
      <directionalLight
        ref={sunRef}
        intensity={2.6}
        color="#FFE2B8"
        castShadow={quality < 2}
        shadow-mapSize={lite ? [1024, 1024] : [2048, 2048]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={20}
        shadow-camera-bottom={-12}
        shadow-camera-near={1}
        shadow-camera-far={110}
      />
      <pointLight ref={lavaRef} color="#FF7A2A" intensity={0} distance={16} decay={2} />
      <pointLight ref={nestRef} color="#FFD08A" intensity={0} distance={11} decay={2} position={[NEST.x, NEST.top + 1.3, 0.2]} />
      {REALMS.map((r) => (
        <Suspense key={r.id} fallback={null}>
          <RealmScene id={r.id} lives={lives} />
        </Suspense>
      ))}
      <primitive ref={heroRef} object={hero.scene} scale={CHAR_SCALE} />
      <primitive object={fx.mesh} />
      <instancedMesh ref={printsRef} args={[undefined, undefined, 28]} frustumCulled={false}>
        <circleGeometry args={[0.12, 14]} onUpdate={(geo) => geo.rotateX(-Math.PI / 2).scale(1.15, 1, 0.62)} />
        <meshBasicMaterial color="#D2A96F" />
      </instancedMesh>
      <instancedMesh ref={dustRef} args={[undefined, undefined, 18]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial color="#F6E0B6" />
      </instancedMesh>
      <instancedMesh ref={bubblesRef} args={[undefined, undefined, 14]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial color="#E9FFFB" transparent opacity={0.6} />
      </instancedMesh>
      <instancedMesh ref={cloudsRef} args={[clouds.geo, clouds.mat, clouds.at.length]} frustumCulled={false} />
      <instancedMesh ref={gemsRef} args={[undefined, undefined, GEMS.length]} frustumCulled={false}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshBasicMaterial />
      </instancedMesh>
      <group ref={skyRef}>
        <points geometry={sky.stars} material={sky.starsMat} frustumCulled={false} />
        <mesh position={[0, 25, -97]} material={sky.aurora[0]} frustumCulled={false}>
          <planeGeometry args={[170, 24]} />
        </mesh>
        <mesh position={[8, 29, -98]} material={sky.aurora[1]} frustumCulled={false}>
          <planeGeometry args={[170, 22]} />
        </mesh>
        <points ref={snowRef} geometry={sky.snow} material={sky.snowMat} frustumCulled={false} />
        <points ref={embersRef} geometry={sky.embers} material={sky.embersMat} frustumCulled={false} />
        <points ref={motesRef} geometry={sky.motes} material={sky.motesMat} frustumCulled={false} />
        <points ref={planktonRef} geometry={sky.plankton} material={sky.planktonMat} frustumCulled={false} />
        <mesh ref={shootRef} material={sky.shootMat} rotation={[0, 0, -0.365]} frustumCulled={false}>
          <planeGeometry args={[3.4, 0.07]} />
        </mesh>
      </group>
    </>
  );
}
useGLTF.preload(HERO_URL);
for (const r of REALMS) useGLTF.preload(`/world/${r.id}.glb`, DRACO);

/**
 * Keys: hold ← → (or A / D) to walk at a steady pace, Shift to hurry; ↑, W or Space jumps.
 * Touch: scrolling the page walks; a sideways swipe on the world walks too.
 */
function useControls(sim: Sim, stage: { current: HTMLElement | null }) {
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;
  useEffect(() => {
    let dir = 0;
    let held: number[] = [];
    let fast = false;
    let raf = 0;
    let last = 0;
    let goal = 0;
    let ramp = 0;
    const walk = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!dir) return;
      const L = lenisRef.current;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      // he gathers speed over the first quarter of a second instead of starting at full pace
      ramp = Math.min(1, ramp + dt / 0.26);
      goal = Math.max(0, Math.min(max, goal + dir * window.innerHeight * (fast ? 2 : 1) * (0.3 + 0.7 * ramp) * dt));
      if (L) L.scrollTo(goal, { lerp: 0.14 });
      else window.scrollTo(0, goal);
      raf = requestAnimationFrame(walk);
    };
    const setDir = (d: number) => {
      if (d === dir) return;
      // (turning round keeps a little of the pace; a fresh start has none)
      ramp = dir && d ? 0.3 : 0;
      dir = d;
      sim.keyDir = d;
      if (!d) return;
      goal = lenisRef.current ? lenisRef.current.animatedScroll : window.scrollY;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(walk);
    };
    const keyDir = (k: string) => (k === "ArrowRight" || k === "d" || k === "D" ? 1 : k === "ArrowLeft" || k === "a" || k === "A" ? -1 : 0);
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") fast = true;
      if (sim.loading || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("dialog, input, textarea, select")) return;
      const d = keyDir(e.key);
      if (d) {
        e.preventDefault();
        fast = e.shiftKey;
        held = [...held.filter((h) => h !== d), d];
        setDir(d);
        return;
      }
      const jumpKey = e.key === "ArrowUp" || e.key === "w" || e.key === "W" || (e.key === " " && !t?.closest?.("a, button, [role=button]"));
      if (jumpKey && !e.repeat) {
        e.preventDefault();
        sim.jump = true;
        sim.jumpHeld = true;
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") fast = false;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") sim.jumpHeld = false;
      const d = keyDir(e.key);
      if (!d) return;
      held = held.filter((h) => h !== d);
      setDir(held.length ? held[held.length - 1] : 0);
    };
    const stop = () => {
      held = [];
      dir = 0;
      sim.keyDir = 0;
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", stop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", stop);
    };
  }, [sim]);

  // a sideways swipe walks (left = forward), with a short glide when he lets go
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let x0 = 0;
    let y0 = 0;
    let px = 0;
    let goal = 0;
    let vel = 0;
    let lastT = 0;
    let glide = 0;
    let sideways: boolean | null = null;
    const go = (to: number) => {
      goal = Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, to));
      const L = lenisRef.current;
      if (L) L.scrollTo(goal, { lerp: 0.2 });
      else window.scrollTo(0, goal);
    };
    const start = (e: TouchEvent) => {
      if (sim.loading) return;
      cancelAnimationFrame(glide);
      x0 = px = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      sideways = null;
      vel = 0;
      lastT = e.timeStamp;
      goal = lenisRef.current ? lenisRef.current.animatedScroll : window.scrollY;
    };
    const move = (e: TouchEvent) => {
      const t = e.touches[0];
      if (sideways === null) {
        const ax = Math.abs(t.clientX - x0);
        const ay = Math.abs(t.clientY - y0);
        if (Math.hypot(ax, ay) < 10) return;
        // clearly sideways only: an arc that drifts sideways stays a native vertical scroll
        sideways = ax > ay * 1.5;
      }
      if (!sideways || sim.loading) return;
      e.preventDefault();
      e.stopPropagation();
      const dx = t.clientX - px;
      px = t.clientX;
      const dt = Math.max(1, e.timeStamp - lastT);
      lastT = e.timeStamp;
      vel = vel * 0.5 + ((-dx * 1.6) / dt) * 0.5;
      go(goal - dx * 1.6);
    };
    const end = (e: TouchEvent) => {
      if (!sideways || e.timeStamp - lastT > 80) return; // held still before letting go: no glide
      let v = vel * 16;
      const step = () => {
        v *= 0.9;
        if (Math.abs(v) < 0.6) return;
        go(goal + v);
        glide = requestAnimationFrame(step);
      };
      if (Math.abs(v) > 2) glide = requestAnimationFrame(step);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    return () => {
      cancelAnimationFrame(glide);
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
    };
  }, [stage, sim]);
}

/**
 * The loading screen, in the page from the first byte: the opening shot under a veil, the name, one bar per realm
 * that fills as that realm arrives, and how to play. Behind it every realm is loaded, compiled and drawn once, so
 * nothing has to load during the walk. It fades into the live world when all of that is done.
 */
function Loader({ progress, done, sound, onSound, onResume }: { progress: number; done: boolean; sound: boolean; onSound: () => void; onResume: () => void }) {
  const pct = Math.round(progress * 100);
  // a sixth for him, then a sixth for each realm (see the frame loop)
  const step = Math.max(0, Math.min(4, Math.floor(progress * 6 - 1 + 1e-6)));
  return (
    <div data-loader className={`absolute inset-0 z-50 grid place-items-center overflow-hidden transition-opacity duration-700 ${done ? "pointer-events-none opacity-0" : "opacity-100"}`}>
      <picture className="absolute inset-0">
        <source media="(max-width: 640px)" srcSet="/world/first-frame-phone.jpg" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/world/first-frame.jpg" alt="" aria-hidden="true" fetchPriority="high" className="h-full w-full scale-105 object-cover" />
      </picture>
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(14,27,51,0.72),rgba(14,27,51,0.5)_45%,rgba(90,52,20,0.55))] backdrop-blur-[3px]" />
      <div className="relative flex w-[min(30rem,88vw)] flex-col items-center text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sayed-avatar.webp" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full object-cover shadow-[0_0_0_4px_rgba(255,255,255,0.85),0_14px_30px_-10px_rgba(0,0,0,0.7)]" />
        <p className="mt-5 font-display text-[clamp(2.2rem,7vw,3.6rem)] leading-none [text-shadow:0_4px_0_#B9772F,0_12px_28px_rgba(0,0,0,0.4)]">Sayed Jehad World</p>
        <p className="mt-2.5 text-sm font-bold text-white/85 sm:text-base">
          {profile.name} · {profile.title}
        </p>
        <div aria-hidden="true" className="mt-8 grid w-full grid-cols-4 gap-2">
          {REALMS.map((r, i) => (
            <div key={r.id}>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
                <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(0, Math.min(1, progress * 6 - 1 - i)) * 100}%`, background: LOAD_COLORS[i] }} />
              </div>
              <p className="mt-2 text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-white/80">{r.label}</p>
            </div>
          ))}
        </div>
        <p role="status" className="mt-5 text-sm font-bold text-white">
          {LOAD_LINES[step]}
          <span className="text-white/70"> · {pct}%</span>
        </p>
        <button
          type="button"
          onClick={onSound}
          aria-pressed={sound}
          tabIndex={done ? -1 : 0}
          className={`sound-choice mt-7 flex items-center gap-2.5 rounded-full px-6 py-3 font-display text-lg shadow-[0_10px_26px_-10px_rgba(0,0,0,0.7)] transition-colors ${sound ? "bg-[#3FD0C9] text-ink" : "bg-white text-ink hover:bg-[#FFF3D6]"}`}
          data-on={sound ? "1" : "0"}
        >
          <Icon name={sound ? "speaker-on" : "speaker-off"} className="size-5" />
          {sound ? "Sound is on" : "Play with sound"}
        </button>
        <p className="mt-2 text-xs font-bold text-white/70">{sound ? "Music and effects in every realm" : "Best with sound: each realm has its own music"}</p>
        <div className="mt-5">
          <WheelHint />
        </div>
        <button type="button" onClick={onResume} tabIndex={done ? -1 : 0} className="mt-4 rounded-full px-3 py-1.5 text-sm font-bold text-white/85 underline decoration-white/50 underline-offset-4 hover:text-white">
          Or read the plain resume
        </button>
      </div>
    </div>
  );
}

/** For a browser that cannot draw the 3D world: the opening shot as a backdrop and the whole resume as text. */
function PlainResume() {
  return (
    <main className="relative min-h-dvh text-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/world/first-frame.jpg" alt="" aria-hidden="true" className="fixed inset-0 h-full w-full object-cover" />
      <div className="relative mx-auto max-w-4xl p-4 sm:p-8">
        <div className="rounded-3xl bg-[#FFFDF8]/[0.97] p-5 shadow-2xl sm:p-8">
          <p className="mb-4 rounded-xl bg-[#F6DDB6] px-4 py-3 text-sm font-bold">This browser cannot draw the 3D world, so here is the resume itself.</p>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-3xl tracking-wide">{profile.name}</h1>
            <a className="game-btn !px-4 !py-2 !text-base" href={profile.cvHref} download>
              Download CV
            </a>
          </div>
          <ResumeText headingLevel={2} />
        </div>
      </div>
    </main>
  );
}

export function World3D() {
  const sim = useRef<Sim>(createSim()).current;
  const stage = useRef<HTMLDivElement>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [realm, setRealm] = useState(0);
  const [small, setSmall] = useState(false);
  const [quality, setQuality] = useState(0);
  const [progress, setProgress] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loaderGone, setLoaderGone] = useState(false);
  const [gems, setGems] = useState(0);
  const [banner, setBanner] = useState({ key: 0, realm: 0 });
  const opened = useRef(false);
  const [plain, setPlain] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [quick, setQuick] = useState(false);
  const lenis = useLenis();
  const sound = useSoundOn();
  const paused = useMotionPaused();
  useControls(sim, stage);
  sim.onRealm = (i) => {
    setRealm(i);
    // crossing into a realm announces it (not the first one, which the loading screen has just named)
    if (opened.current) setBanner((b) => ({ key: b.key + 1, realm: i }));
  };
  sim.onGems = setGems;
  opened.current = revealed;
  sim.onProgress = setProgress;
  sim.onReveal = () => setRevealed(true);
  sim.onQuality = setQuality;
  sim.calm = paused || reduced;
  sim.loading = !revealed;

  // while the loading screen is up the page does not scroll; once the world is open the screen fades and goes
  useEffect(() => {
    if (plain) return;
    if (!revealed) {
      document.documentElement.style.overflow = "hidden";
      lenis?.stop();
      return () => {
        document.documentElement.style.overflow = "";
        lenis?.start();
      };
    }
    const t = window.setTimeout(() => setLoaderGone(true), 800);
    return () => window.clearTimeout(t);
  }, [revealed, lenis, plain]);

  useEffect(() => {
    // no WebGL 2: show the resume as text instead of an empty sky
    try {
      if (!document.createElement("canvas").getContext("webgl2")) setPlain(true);
    } catch {
      setPlain(true);
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motionPref = () => setReduced(mq.matches);
    motionPref();
    mq.addEventListener("change", motionPref);
    const on = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight });
      // phones and small tablets get a lighter picture: fewer pixels, a smaller shadow map
      setSmall(window.matchMedia("(pointer: coarse)").matches || Math.min(window.innerWidth, window.innerHeight) < 600);
      for (const b of sim.dom.boards.values()) {
        b.w = b.el.offsetWidth;
        b.h = b.el.offsetHeight;
      }
    };
    on();
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      mq.removeEventListener("change", motionPref);
    };
  }, [sim]);
  const u = vp.h ? vp.h / viewHFor(vp.w, vp.h) : 0;
  // Lenis caches the page height: tell it when the world's length in pixels changes
  useEffect(() => {
    lenis?.resize();
  }, [lenis, u]);
  const go = (x: number) => scrollToY(lenis, x * u);

  // for the QA scripts
  useEffect(() => {
    (window as unknown as { __world?: unknown }).__world = {
      sim,
      lenis,
      audio: () => audio.state(),
      end: WORLD_END,
      epilogue: CARD_SCROLL,
      goto: (x: number) => scrollToY(lenis, x * (window.innerHeight / viewHFor(window.innerWidth, window.innerHeight)), true),
      stats: () => {
        const s = [...sim.frames].sort((a, b) => a - b);
        const at = (p: number) => +(s[Math.floor(s.length * p)] ?? 0).toFixed(1);
        return { frames: s.length, p50: at(0.5), p95: at(0.95), worst: at(0.999) };
      },
      reset: () => (sim.frames.length = 0),
    };
  }, [sim, lenis]);

  if (plain) return <PlainResume />;

  const chip = "rounded-full px-2.5 py-1 text-xs font-bold text-ink transition-colors hover:bg-black/10 aria-[current]:bg-ink aria-[current]:text-white sm:px-3.5 sm:py-1.5 sm:text-sm";
  const pill = "pointer-events-auto rounded-full bg-white/85 text-sm font-bold text-ink shadow-md hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
  const round = `${pill} grid h-10 w-10 shrink-0 place-items-center`;
  return (
    <div style={{ height: u ? (WORLD_END + CARD_SCROLL) * u + vp.h : "100vh", background: "#232B63" }}>
      <div
        ref={stage}
        className="sticky top-0 h-dvh w-full touch-pan-y overflow-hidden"
        onPointerDown={(e) => {
          // a click or tap on him makes him jump (or kick upwards in the water)
          if ((e.target as HTMLElement).closest("a, button, article, dialog")) return;
          const dx = e.clientX - sim.heroPx;
          const dy = e.clientY - (sim.topZ - sim.y - CHAR_H / 2) * sim.u;
          if (!sim.loading && Math.abs(dx) < sim.u * 1.0 && Math.abs(dy) < sim.u * 1.5) {
            sim.jump = true;
            sim.jumpHeld = true;
          }
        }}
        onFocusCapture={(e) => {
          // Tab reaches every card: the world travels to the card that takes the focus
          const card = (e.target as HTMLElement).closest<HTMLElement>("article[data-x]");
          if (stage.current) stage.current.scrollLeft = stage.current.scrollTop = 0;
          if (card && card.dataset.on !== "1") go(Number(card.dataset.x) - 0.5);
        }}
        onScroll={(e) => {
          e.currentTarget.scrollLeft = e.currentTarget.scrollTop = 0;
        }}
      >
        {/* one sky per realm, cross-faded as he walks from one to the next */}
        {REALMS.map((r, i) => (
          <div key={r.id} ref={(el) => void (sim.dom.skies[i] = el)} aria-hidden="true" className="absolute inset-0" style={{ background: r.sky, opacity: i === 0 ? 1 : 0 }} />
        ))}
        {/* the low desert sun and the snow moon */}
        <div ref={(el) => void (sim.dom.sun = el)} aria-hidden="true" className="pointer-events-none absolute left-[70%] top-[51%] h-[90vh] w-[90vh] -translate-x-1/2 -translate-y-1/2 max-sm:top-[62%] max-sm:h-[60vh] max-sm:w-[60vh]">
          <div className="h-full w-full rounded-full" style={{ background: "radial-gradient(closest-side, #FFFBEA 0%, #FFF1CF 9%, rgba(255,241,207,0.55) 22%, rgba(255,241,207,0) 70%)" }} />
        </div>
        <div
          ref={(el) => void (sim.dom.moon = el)}
          aria-hidden="true"
          className="pointer-events-none absolute left-[18%] top-[13%] h-[36vh] w-[36vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-0 max-sm:top-[8%] max-sm:h-[22vh] max-sm:w-[22vh]"
          style={{ background: "radial-gradient(closest-side, #FFFFFF 0%, #FFFFFF 17%, rgba(221,232,255,0.5) 22%, rgba(221,232,255,0) 100%)" }}
        />

        <Canvas
          className="!absolute inset-0"
          aria-hidden="true"
          flat
          shadows
          dpr={quality > 1 ? [0.8, 1] : quality > 0 ? [1, 1.25] : small ? [1, 1.5] : [1, 1.75]}
          camera={{ fov: FOV, near: 1, far: 950, position: [0, CAM_Y, CAM_DIST] }}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <Suspense fallback={null}>
            <Scene sim={sim} small={small} quality={quality} />
          </Suspense>
        </Canvas>
        <h1 className="sr-only">
          Sayed Jehad World: the interactive resume of {profile.name}, {profile.title}
        </h1>

        {/* under water the view takes a blue cast; near the lava the bottom of the screen glows */}
        <div ref={(el) => void (sim.dom.tint = el)} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(40,170,190,0.25) 0%, rgba(8,70,96,0.9) 100%)" }} />
        <div ref={(el) => void (sim.dom.heat = el)} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] opacity-0" style={{ background: "linear-gradient(to top, rgba(255,122,31,0.42) 0%, rgba(255,122,31,0) 100%)" }} />

        {/* one soft frame of shade round the picture, the same in every realm */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 58%, rgba(6,10,30,0.22) 100%)" }} />

        {TITLES.map((t, i) => {
          const r = REALMS.find((x) => x.id === t.realm) ?? REALMS[0];
          return (
            <h2
              key={t.text}
              ref={(el) => void (el ? sim.dom.titles.set(i, el) : sim.dom.titles.delete(i))}
              style={{ "--accent": r.accent, transform: "translate3d(-300vw,0,0)" } as React.CSSProperties}
              aria-label={t.text}
              data-in="0"
              className="world-title pointer-events-none absolute left-0 top-[31%] whitespace-nowrap font-display text-[clamp(2.5rem,7vh,5rem)] leading-none text-white [text-shadow:0_3px_0_var(--accent),0_10px_24px_rgba(0,0,0,0.3)] will-change-transform max-sm:top-[59%] max-sm:text-[2rem]"
            >
              {[...t.text].map((ch, k) => (
                <span key={k} aria-hidden="true" style={{ "--i": k } as React.CSSProperties}>
                  {ch === " " ? "\u00A0" : ch}
                </span>
              ))}
            </h2>
          );
        })}

        {/* the first screen says who he is before a single step */}
        <div ref={(el) => void (sim.dom.intro = el)} className="pointer-events-none absolute left-[4%] top-[19%] max-w-[min(34rem,60vw)] text-white max-sm:inset-x-0 max-sm:left-0 max-sm:top-[9.75rem] max-sm:max-w-none max-sm:px-5 max-sm:text-center">
          <p className="font-display text-[clamp(2rem,6.2vh,3.6rem)] leading-[1.05] [text-shadow:0_3px_0_#B9772F,0_10px_24px_rgba(0,0,0,0.3)]">{profile.name}</p>
          <p className="mt-2 inline-block rounded-full bg-ink/75 px-4 py-1.5 text-sm font-extrabold sm:text-base">
            {profile.subtitle} · {profile.base}
          </p>
        </div>

        {/* a line to read on the stretches that have no card */}
        {NOTES.map((n, i) => (
          <p
            key={n.x}
            ref={(el) => void (sim.dom.notes[i] = el)}
            className="pointer-events-none absolute left-0 top-[30%] whitespace-nowrap rounded-full bg-white/90 px-4 py-1.5 font-display text-[clamp(0.95rem,2.6vh,1.35rem)] text-ink opacity-0 shadow-lg max-sm:top-[24%] max-sm:text-sm"
          >
            {n.text}
          </p>
        ))}

        {/* the last card: the walk is over, here is how to reach him */}
        <section
          ref={(el) => void (sim.dom.final = el)}
          aria-label="Contact"
          style={{ opacity: 0, pointerEvents: "none" }}
          className="final-card absolute left-1/2 top-[9%] w-[min(40rem,92vw)] lg:left-[26%] lg:w-[min(36rem,46vw)] -translate-x-1/2 rounded-3xl border border-white/80 bg-[#FFFDF8]/[0.97] px-6 py-6 text-center text-ink shadow-[0_30px_70px_-24px_rgba(0,0,0,0.7)] max-sm:top-[7.25rem] max-sm:px-4 max-sm:py-4"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#C2401E]">From the first dune to the dragon’s nest</p>
          <h2 className="mt-1 font-display text-[clamp(1.9rem,5vh,3rem)] leading-tight">Let’s talk</h2>
          <p className="text-sm font-bold text-ink-3 sm:text-base">
            {profile.name} · {profile.title} · {profile.base}
          </p>
          <dl className="mt-4 grid grid-cols-4 gap-2 max-sm:mt-3">
            {stats.map((sv, i) => (
              <div key={sv.label} className="rounded-2xl bg-black/[0.045] px-1 py-2.5">
                <dd ref={(el) => void (sim.dom.nums[i] = el)} className="font-display text-[clamp(1.6rem,4.4vh,2.6rem)] leading-none" style={{ color: ["#B9772F", "#0F7F8C", "#3F5BB5", "#C2401E"][i] }}>
                  0
                </dd>
                <dt className="mt-1 text-[0.68rem] font-bold leading-tight text-ink-2 sm:text-xs">{sv.label}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 max-sm:mt-3.5">
            <a href={profile.linkedin} target="_blank" rel="noreferrer" className="game-btn !bg-none !px-5 !py-2.5 !text-base" style={{ background: "#0A66C2", borderColor: "#084C92", boxShadow: "0 2px 0 rgb(255 255 255 / 0.35) inset, 0 6px 0 #084C92, 0 14px 22px -8px rgb(0 0 0 / 0.45)" }}>
              <Icon name="linkedin" className="size-5" />
              Connect on LinkedIn
            </a>
            <a href={`mailto:${profile.email}`} className="flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-white px-4 py-2.5 text-sm font-extrabold hover:border-ink/40">
              <Icon name="envelope" className="size-4" />
              Email
            </a>
            <a href={profile.cvHref} download className="flex items-center gap-2 rounded-xl border-2 border-ink/15 bg-white px-4 py-2.5 text-sm font-extrabold hover:border-ink/40">
              <Icon name="download" className="size-4" />
              CV
            </a>
            <button type="button" onClick={() => go(0)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-extrabold text-ink-3 hover:bg-black/5">
              <Icon name="arrow-counter-clockwise" className="size-4" />
              Play again
            </button>
          </div>
        </section>

        {/* crossing into a realm: its number and name, for a moment */}
        {banner.key > 0 && (
          <p key={banner.key} aria-hidden="true" className="realm-banner pointer-events-none absolute left-1/2 top-[4.75rem] whitespace-nowrap rounded-full px-5 py-2 font-display text-lg text-white shadow-lg max-sm:top-[7.25rem]" style={{ background: REALMS[banner.realm].accent }}>
            Realm {banner.realm + 1} · {REALMS[banner.realm].label}
          </p>
        )}

        {ANCHORS.map((a) => {
          const r = REALMS.findIndex((x) => x.id === a.realm);
          const b = BOARDS[a.id];
          if (!b) return null;
          return (
            <article
              key={a.id}
              ref={(el) => void (el ? sim.dom.boards.set(a.id, { el, w: el.offsetWidth, h: el.offsetHeight, off: 0, side: 0 }) : sim.dom.boards.delete(a.id))}
              data-on="0"
              data-x={a.x}
              data-realm={a.realm}
              style={{ "--accent": REALMS[r].accent, "--tint": TINTS[r], transform: "translate3d(-300vw,0,0)" } as React.CSSProperties}
              className={`absolute left-0 top-[14%] ${b.wide ? "w-[min(34rem,44vw)]" : "w-[min(28rem,36vw)]"} rounded-2xl border border-white/70 bg-[#FFFDF8]/[0.97] p-5 text-ink shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)] transition-[opacity,translate] duration-500 will-change-transform data-[on=0]:pointer-events-none data-[on=0]:translate-y-3 data-[on=0]:opacity-0 max-sm:top-[7.5rem] max-sm:max-h-[42%] max-sm:w-[92vw] max-sm:overflow-y-auto max-sm:p-4`}
            >
              {b.node}
            </article>
          );
        })}

        <header className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-2 sm:flex-nowrap sm:gap-3 sm:p-3">
          <button type="button" onClick={() => go(0)} aria-label={`${profile.shortName}: back to the start`} className={`${pill} flex items-center gap-2 py-1 pl-1 pr-1 sm:pr-3.5`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sayed-avatar.webp" alt="" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
            <span className="max-sm:hidden">{profile.shortName}</span>
          </button>
          <nav aria-label="Realms" className="pointer-events-auto relative mx-auto flex gap-0.5 overflow-hidden rounded-full bg-white/85 p-1 shadow-md max-sm:order-last max-sm:w-full max-sm:justify-center sm:gap-1">
            {/* how far along the whole walk he is */}
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10">
              <span ref={(el) => void (sim.dom.trail = el)} className="block h-full origin-left scale-x-0 bg-[linear-gradient(90deg,#F2B45C,#3FD0C9,#9DB4FF,#FF7A3D)]" />
            </span>
            {REALMS.map((r, i) => (
              <button key={r.id} type="button" aria-current={realm === i ? "step" : undefined} onClick={() => go(STARTS[i])} className={chip}>
                {r.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 max-sm:ml-auto">
            <p aria-label={`${gems} of ${GEMS.length} gems found`} title="Gems found along the way" className={`${pill} flex h-10 items-center gap-1.5 px-3 tabular-nums max-sm:hidden`}>
              <Icon name="sparkle" className="size-4 text-[#B9772F]" />
              {gems}/{GEMS.length}
            </p>
            <button type="button" onClick={() => go(CONTACT_X)} aria-label="Contact" title="Skip to the contact card" className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-[#C2401E] px-3.5 text-sm font-extrabold text-white shadow-md hover:bg-[#A93518] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
              <Icon name="envelope" className="size-4" />
              <span className="max-sm:hidden">Contact</span>
            </button>
            <button type="button" onClick={() => setQuick(true)} aria-label="Quick resume" title="Read the resume as plain text" className={round}>
              <Icon name="list" className="size-5" />
            </button>
            <button type="button" onClick={motion.toggle} aria-pressed={paused} aria-label="Pause animations" title={paused ? "Play the animations" : "Pause the animations"} className={round}>
              <Icon name={paused ? "play" : "pause"} className="size-5" />
            </button>
            <button type="button" onClick={sfx.toggle} aria-pressed={sound} aria-label="Sound" title={sound ? "Mute the sound" : "Play the sound"} className={round}>
              <Icon name={sound ? "speaker-on" : "speaker-off"} className="size-5" />
            </button>
            <a href={profile.cvHref} download className={`${pill} px-3 py-2.5 sm:px-4`}>
              CV
            </a>
          </div>
        </header>
        <div ref={(el) => void (sim.dom.hint = el)} className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 transition-opacity duration-500 max-sm:top-[6.5rem]">
          <WheelHint />
        </div>
        <p ref={(el) => void (sim.dom.fps = el)} data-fps className="pointer-events-none absolute bottom-2 left-3 hidden rounded bg-black/40 px-1.5 font-mono text-xs text-white" />
        {!loaderGone && <Loader progress={progress} done={revealed} sound={sound} onSound={sfx.toggle} onResume={() => setQuick(true)} />}
      </div>
      <QuickResumeDialog open={quick} onClose={() => setQuick(false)} />
    </div>
  );
}
