"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";

/**
 * Sayed's in-game avatar, redrawn from his character sheet as a layered SVG so every limb can be
 * animated independently. Standing, emoting, a standing jump and the drop-in use the sheet's 3/4 FRONT
 * RIGHT view; walking, running, skating and hops made while moving use the sheet's right-facing PROFILE
 * sprites (like Robby's sprite sheets). View changes are debounced and eased with a short turn-squash.
 *
 * Coordinate frame (viewBox units): he faces right, is centred on x=60, the boot soles rest on y=180
 * and the beanie top is at y≈0. The head (beanie + headset) is ~50% of his height, like the sheet.
 * The mouth sits at about (79.5, 72.5) in the 3/4 view (104.5, 73 in profile).
 *
 * The scroll engine calls `update()` once per frame. It only writes attributes on elements that
 * already exist (no React re-render per frame). Walking is driven by distance travelled (not time),
 * so the feet don't slide at normal speeds and scrubbing backwards plays the cycle in reverse; very
 * fast scrolls are rate-limited into a held dash pose instead of strobing.
 */

export type CharacterState = "idle" | "walk" | "run" | "skate" | "jump" | "wave" | "lift" | "point" | "flag" | "cheer";

/** Facial expressions from the sheet. Picked from the state unless `CharacterFrame.expression` forces one. */
export type Expression = "neutral" | "happy" | "serious" | "surprised" | "angry";

export type CharacterFrame = {
  state: CharacterState;
  /** walk-cycle phase in radians (distance / stride * 2π) */
  phase: number;
  /** +1 facing right, -1 facing left */
  facing: 1 | -1;
  /** height above ground in character units (0 = standing / unknown) */
  air: number;
  /** seconds since page load, for idle loops */
  time: number;
  dt: number;
  /** landing impact 0..1 (1 = the frame he lands). Drives squash & stretch; undefined = 0. */
  impact?: number;
  /** force an expression (lab / cut-scenes); otherwise chosen from `state` */
  expression?: Expression;
};

export type CharacterHandle = {
  update: (f: CharacterFrame) => void;
  /** stride length in viewBox units for one full walk cycle */
  strideUnits: number;
};

/* ------------------------------------------------------------------ palette (sampled from the sheet) */
const C = {
  ol: "#080C18",
  warmOl: "#4A1E18",
  crown: "#272A39",
  crownHi: "#33374A",
  crownSh: "#1C1F2C",
  crownRim: "#4A4F63",
  cuff: "#2F3345",
  cuffHi: "#3E4255",
  cuffSh: "#222535",
  cuffUnder: "#161826",
  cuffEnd: "#161A28",
  sheen: "#4E4F5B",
  band: "#1A1E2B",
  bandFill: "#262A36",
  gear: "#5E606D",
  cup: "#262A37",
  cupFace: "#242736",
  cupRim: "#13161F",
  cupHi: "#3C3E4B",
  cupRecess: "#1B1E2B",
  bevel: "#747682",
  mic: "#2B2F3B",
  micRing: "#86403C",
  tag: "#A8323A",
  redSh: "#7A2427",
  skin: "#F9AD78",
  skinHi: "#FDC49E",
  skinSh: "#E8955F",
  skinSh2: "#C9714D",
  skinDeep: "#9E463C",
  foreheadSh: "#C06A4E",
  jawSh: "#D8815F",
  neckSh: "#A54735",
  fistSide: "#D47657",
  nose: "#F29C6A",
  mole: "#8E4A36",
  hair: "#1B1618",
  hairHi: "#3A3033",
  curl: "#2B2A33",
  eyeW: "#F8F2EA",
  iris: "#2F1C12",
  irisHi: "#662C22",
  pupil: "#0D0909",
  lip: "#D9785C",
  lipLine: "#6E281E",
  mouth: "#5E1D1A",
  smile: "#C9503E",
  smileHi: "#E88A6C",
  tongue: "#C4524A",
  teeth: "#FBF4EC",
  jacket: "#243652",
  jacketHi: "#33496C",
  jacketSh: "#1B283D",
  jacketDeep: "#101A2B",
  rim: "#4A5E80",
  zip: "#1A1D27",
  zipHi: "#7A7C88",
  pack: "#292A36",
  packHi: "#3A3B47",
  packSh: "#1E2029",
  strap: "#34343D",
  strapSh: "#26262F",
  buckle: "#6E717C",
  clipFrame: "#15171F",
  clipRed: "#8C3034",
  pants: "#1D304A",
  pantsHi: "#27405F",
  pantsSh: "#132136",
  pantsCuff: "#182438",
  boot: "#262833",
  bootTop: "#3F404C",
  bootDark: "#1A1C26",
  toeRim: "#6A6E7C",
  sole: "#12151F",
  soleLip: "#343744",
  neckDeep: "#3A1A1C",
  jawDeep: "#7A3229",
  bell: "#6D7486",
  plate: "#20232B",
  farShade: "#050B16",
} as const;

const OL = 1.15; // main outline width (the sheet's outlines are ~1 unit of near-black navy)
const WOL = 1; // warm outline on skin

/* ------------------------------------------------------------------ rig */

// Pose = joint angles in degrees. Negative swings a hanging limb forward (toward +x);
// a negative elbow bends the forearm forward, a positive knee folds the shin back.
// footN/footF are ABSOLUTE sole tilts (0 = flat, + = toe down). tyN/tyF lift a whole leg (swing foot),
// `lift` raises the whole body off the ground (hops, run flight), `bodyY`/`lean` move the upper body only.
type Pose = {
  bodyY: number;
  lift: number;
  lean: number;
  head: number;
  headY: number;
  armN: number;
  armF: number;
  elbowN: number;
  elbowF: number;
  legN: number;
  legF: number;
  kneeN: number;
  kneeF: number;
  footN: number;
  footF: number;
  tyN: number;
  tyF: number;
  bells: number;
};

const ZERO: Pose = {
  bodyY: 0,
  lift: 0,
  lean: 0,
  head: 0,
  headY: 0,
  armN: 0,
  armF: 0,
  elbowN: 0,
  elbowF: 0,
  legN: 0,
  legF: 0,
  kneeN: 0,
  kneeF: 0,
  footN: 0,
  footF: 0,
  tyN: 0,
  tyF: 0,
  bells: 0,
};
const POSE_KEYS = Object.keys(ZERO) as (keyof Pose)[];
const LEG_KEYS = new Set<keyof Pose>(["legN", "legF", "kneeN", "kneeF", "footN", "footF", "tyN", "tyF", "lift"]);

// Joint pivots in viewBox units (N = near side, drawn in front; F = far side).
const NECK = [64, 86] as const;
const SHOULDER_N = [25, 95] as const;
const ELBOW_N = [24.7, 114] as const;
const FIST_N = [23.8, 138] as const;
const SHOULDER_F = [97, 95] as const;
const ELBOW_F = [97.2, 114] as const;
const FIST_F = [98.5, 137.5] as const;
const HIP_N = [43, 134] as const;
const KNEE_N = [43, 159] as const;
const ANKLE_N = [43, 166] as const;
const HIP_F = [78, 134] as const;
const KNEE_F = [78, 159] as const;
const ANKLE_F = [78, 166] as const;
const UPPER_PIVOT = [60, 146] as const; // lean pivot: the hips
const SOLE_Y = 180.2; // bottom of the sole rects
const SOLE_N = [25.6, 59.8]; // near sole bottom corners (heel, toe)
const SOLE_F = [62.4, 100.6];

// Profile view: limbs gather under the torso centre (the 3/4 view spreads them 35 units apart).
const PROFILE_LEG_N = 18;
const PROFILE_LEG_F = -17;
const PROFILE_ARM = 36;
// ...and the legs are longer under a shorter jacket, like the sheet's WALK / RUN sprites: the hips sit 7 units
// and the knees 5 units higher (thigh 27, shin 12 instead of 25 / 7); the boots stay put, so the soles stay on y=180.
const THIGH_P = -5;
const PROFILE_SLIM = 0.82;
const HIP_NP = [43, 127] as const;
const KNEE_NP = [43, 154] as const;
const HIP_FP = [78, 127] as const;
const KNEE_FP = [78, 154] as const;

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** raised-cosine bump of width w (radians) centred on c, for cyclic phase x */
const bump = (x: number, c: number, w: number) => {
  const d = Math.abs(wrapA(x - c));
  return d < w ? Math.cos((d / w) * (Math.PI / 2)) ** 2 : 0;
};

/** walk/run leg set in profile: thigh swing, knee fold + leg lift in the swing phase, heel-strike / toe-off tilts */
function gait(ph: number, amp: number, knee: number, lift: number, toeOff: number, heel: number) {
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  // near leg swings forward while cos > 0, far leg while cos < 0
  return {
    legN: -amp * s,
    legF: amp * s,
    kneeN: knee * Math.pow(Math.max(0, c), 1.3),
    kneeF: knee * Math.pow(Math.max(0, -c), 1.3),
    tyN: -lift * Math.pow(Math.max(0, c), 1.5),
    tyF: -lift * Math.pow(Math.max(0, -c), 1.5),
    footN: toeOff * bump(ph, 1.5 * Math.PI + 0.35, 1) - heel * bump(ph, 0.5 * Math.PI - 0.25, 0.8),
    footF: toeOff * bump(ph + Math.PI, 1.5 * Math.PI + 0.35, 1) - heel * bump(ph + Math.PI, 0.5 * Math.PI - 0.25, 0.8),
  };
}

// held pose for very fast scrolls (HUD level jumps, hard flicks): full stride, strong lean
const DASH: Pose = {
  ...ZERO,
  lean: 14,
  head: -6,
  legN: -34,
  kneeN: 8,
  footN: -8,
  tyN: -3,
  legF: 32,
  kneeF: 32,
  footF: 22,
  armN: 42,
  elbowN: -70,
  armF: -48,
  elbowF: -84,
};

type JumpInfo = { u: number; vy: number; hasAir: boolean };

function targetPose(f: CharacterFrame, ph: number, j: JumpInfo, prof: boolean): Pose {
  const t = f.time;
  const s = Math.sin(ph);
  const breath = Math.sin(t * 2.2);
  switch (f.state) {
    case "walk": {
      // a real stride like the sheet's WALK sprite: legs reach wide, the back boot rolls onto its toe,
      // and the legs stretch a little at full split so the hips don't sink into a shuffle
      const g = gait(ph, 37, 32, 6, 26, 16);
      const st = 4.4 * Math.abs(s);
      return {
        ...ZERO,
        ...g,
        tyN: g.tyN + st,
        tyF: g.tyF + st,
        lean: 4,
        head: Math.sin(ph * 2) * 1.2,
        headY: -Math.abs(Math.cos(ph)) * 0.8,
        armN: s * 32,
        armF: -s * 32,
        elbowN: -14 - Math.max(0, -s) * 18,
        elbowF: -14 - Math.max(0, s) * 18,
      };
    }
    case "run": {
      const g = gait(ph, 43, 36, 10, 30, 12);
      const st = 3 * Math.abs(s);
      // planted through the passing position (|s| small), airborne only around full split
      return {
        ...ZERO,
        ...g,
        tyN: g.tyN + st,
        tyF: g.tyF + st,
        lift: -3.4 * smooth(0.5, 0.95, Math.abs(s)),
        lean: 9,
        head: -4,
        armN: s * 44 - 4,
        armF: -s * 42 - 4,
        elbowN: -80,
        elbowF: -84,
      };
    }
    case "skate": {
      // push-and-glide: one leg drives back while the other glides flat, arms swing wide
      const push = Math.sin(ph);
      const pN = Math.max(0, push);
      const pF = Math.max(0, -push);
      return {
        ...ZERO,
        bodyY: 1.5 - Math.abs(Math.cos(ph)) * 1.2,
        lean: 14,
        head: -6 + Math.sin(ph * 2) * 1,
        legN: -16 + pN * 50,
        legF: -16 + pF * 50,
        kneeN: 26 - pN * 20,
        kneeF: 26 - pF * 20,
        tyN: -4 * pN * pN,
        tyF: -4 * pF * pF,
        footN: 6 * pN * pN,
        footF: 6 * pF * pF,
        armN: -push * 50 - 4,
        armF: push * 44 - 4,
        elbowN: -20,
        elbowF: -20,
      };
    }
    case "jump": {
      // rise: stretched, legs trailing · apex: tucked (from the sheet) · fall: legs reach down, arms up
      // (without a height from the engine, time in the air stands in for the arc: gym-box hops last ~0.7-1.2 s)
      const wr = j.hasAir ? smooth(20, 120, j.vy) : 1 - smooth(0.1, 0.28, j.u);
      const wf = j.hasAir ? smooth(20, 120, -j.vy) : smooth(0.55, 0.8, j.u);
      const wt = clamp(1 - wr - wf, 0, 1);
      const mix = (r: number, tk: number, fl: number) => r * wr + tk * wt + fl * wf;
      if (prof) {
        // moving hop (plyo boxes, ledges) in PROFILE, like the sheet's JUMP sprite: the far (lead) knee
        // driven up, the near leg trailing on its toe, the near fist up by the chin, the far arm swung back;
        // on the way down the lead leg reaches for the landing heel-first
        return {
          ...ZERO,
          lift: mix(-1, -2, 0),
          lean: mix(9, 6, 3),
          head: mix(-4, -3, 1),
          legF: mix(-46, -56, -30),
          kneeF: mix(58, 82, 22),
          tyF: mix(-3, -6, 0),
          footF: mix(6, 12, -6),
          legN: mix(26, 14, 10),
          kneeN: mix(16, 50, 34),
          tyN: mix(0, -3, -1),
          footN: mix(42, 30, 16),
          armN: mix(-62, -72, -36),
          elbowN: mix(-86, -78, -50),
          armF: mix(46, 34, 16),
          elbowF: mix(-30, -50, -64),
        };
      }
      return {
        ...ZERO,
        lift: mix(-1, -2, 0),
        lean: mix(2, 4, 0),
        head: mix(-2, -4, 2),
        legN: mix(-8, -40, -12),
        kneeN: mix(10, 35, 6),
        tyN: mix(0, -9, -1),
        footN: mix(22, -4, 8),
        legF: mix(12, 16, 8),
        kneeF: mix(20, 32, 8),
        tyF: mix(0, -3, 0),
        footF: mix(26, 22, 10),
        armN: mix(-30, -22, 118),
        elbowN: mix(-50, -96, 28),
        armF: mix(-70, -58, -112),
        elbowF: mix(-70, -92, -24),
      };
    }
    case "wave":
      // the far arm goes up and out, clear of the face and the ear cups; the forearm waves
      return {
        ...ZERO,
        bodyY: breath * 0.6,
        head: 4 + Math.sin(t * 1.3) * 2,
        armN: 3,
        elbowN: -6,
        armF: -125,
        elbowF: -32 + Math.sin(t * 8) * 16,
      };
    case "lift": {
      // dumbbell shoulder press: elbows out, both fists drive up together, slight dip at the bottom
      const c = (Math.sin(t * 2.8 - Math.PI / 2) + 1) / 2;
      const arm = 60 + c * 75;
      const elbow = 110 - c * 80;
      return {
        ...ZERO,
        bodyY: (1 - c) * 1.6 + breath * 0.3,
        head: -2 - c * 2,
        armN: arm,
        elbowN: elbow,
        armF: -arm,
        elbowF: -elbow,
        legN: -3,
        legF: 3,
        bells: 1,
      };
    }
    case "point":
      return {
        ...ZERO,
        bodyY: breath * 0.5,
        head: -3 + Math.sin(t * 1.1) * 1.5,
        armN: 3,
        elbowN: -8,
        armF: -82 + Math.sin(t * 2.4) * 5,
        elbowF: -4,
      };
    case "flag":
      // hand on hip, the far fist gripping the planted pole
      return {
        ...ZERO,
        bodyY: breath * 0.5,
        lean: -2,
        head: -5,
        armN: 25,
        elbowN: -70,
        armF: 20,
        elbowF: -85,
        legN: 8,
        legF: -6,
      };
    case "cheer": {
      // 2.5 Hz hops that really land, fists pumping in time
      const p = (t * 2.5) % 1;
      const u = p / 0.55;
      const hop = p < 0.55 ? 4 * 6 * u * (1 - u) : 0;
      const pump = Math.sin(p * TAU);
      return {
        ...ZERO,
        lift: -hop,
        head: -6,
        armN: 135 + pump * 6,
        elbowN: 35 + pump * 10,
        armF: -135 - pump * 6,
        elbowF: -35 - pump * 10,
        tyN: -hop * 0.25,
        kneeN: hop * 1.5,
        tyF: -hop * 0.25,
        kneeF: hop * 1.5,
      };
    }
    case "idle":
    default:
      return {
        ...ZERO,
        bodyY: breath * 0.7,
        head: Math.sin(t * 0.9) * 1.5,
        armN: 1.5 + breath,
        elbowN: -4,
        armF: 1 - breath,
        elbowF: 0,
      };
  }
}

const EXPRESSION_FOR: Record<CharacterState, Expression> = {
  idle: "neutral",
  walk: "neutral",
  skate: "neutral",
  point: "neutral",
  wave: "neutral",
  cheer: "happy",
  flag: "happy",
  run: "serious",
  lift: "serious",
  // hops are deliberate: determined, not shocked. Long falls switch to "surprised" (see update()).
  jump: "serious",
};
const EXPRESSIONS: Expression[] = ["neutral", "happy", "serious", "surprised", "angry"];

const rot = (a: number, [x, y]: readonly [number, number]) => `rotate(${a.toFixed(2)} ${x} ${y})`;
const f2 = (n: number) => n.toFixed(2);

function rotPt(x: number, y: number, deg: number, cx: number, cy: number): [number, number] {
  const a = deg * RAD;
  const cs = Math.cos(a);
  const sn = Math.sin(a);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cs - dy * sn, cy + dx * sn + dy * cs];
}

/** lowest sole point of one leg (forward kinematics through hip → knee → ankle), in legs-group coords */
function soleLow(
  sole: number[],
  dx: number,
  ty: number,
  leg: number,
  knee: number,
  footRel: number,
  H: readonly [number, number],
  K: readonly [number, number],
  A: readonly [number, number],
) {
  let lo = -1e9;
  for (const x0 of sole) {
    let p = rotPt(x0, SOLE_Y, footRel, A[0], A[1]);
    p = rotPt(p[0], p[1], knee, K[0], K[1]);
    p = rotPt(p[0], p[1], leg, H[0], H[1]);
    lo = Math.max(lo, p[1] + ty);
  }
  return lo;
}

type Spring = { x: number; v: number };
/** damped spring step (semi-implicit Euler, sub-stepped so long frames stay stable) */
function spring(sp: Spring, target: number, k: number, damp: number, dt: number) {
  const n = dt > 0.017 ? Math.ceil(dt / 0.017) : 1;
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    sp.v += ((target - sp.x) * k - sp.v * damp) * h;
    sp.x += sp.v * h;
  }
}

/* ------------------------------------------------------------------ static geometry helpers */

type Pt = [number, number];
type Seg = [Pt, Pt, Pt];
/** y on a chain of quadratic béziers (each monotonic in x) at a given x */
function yOn(segs: Seg[], x: number) {
  const seg = segs.find(([a, , c]) => x >= Math.min(a[0], c[0]) && x <= Math.max(a[0], c[0])) ?? (x < segs[0][0][0] ? segs[0] : segs[segs.length - 1]);
  const [p0, p1, p2] = seg;
  const inc = p2[0] > p0[0];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 28; i++) {
    const t = (lo + hi) / 2;
    const xt = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    if (xt < x === inc) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
}
/** closed band between two edge functions sampled from x0 to x1 */
function band(x0: number, x1: number, top: (x: number) => number, bot: (x: number) => number, step = 2) {
  const xs: number[] = [];
  for (let x = x0; x < x1; x += step) xs.push(x);
  xs.push(x1);
  const up = xs.map((x, i) => `${i ? "L" : "M"}${f2(x)} ${f2(top(x))}`).join(" ");
  const dn = xs
    .slice()
    .reverse()
    .map((x) => `L${f2(x)} ${f2(bot(x))}`)
    .join(" ");
  return `${up} ${dn} Z`;
}
const dots = (pts: Pt[], r: number) => pts.map(([x, y]) => `M${f2(x - r)} ${f2(y)} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`).join(" ");

// ---- 3/4 view: the beanie's folded cuff. Its bottom edge arches up over the forehead like the sheet.
// (the far end rolls round from the top edge, like the sheet: the cuff only reaches full width by y≈22)
const CUFF_D =
  "M28 27 Q30 25 36 25 Q46 24 52 20.4 Q62 17 80 15.4 Q90 15.1 95.6 15.9 Q102.4 17 104.2 22.6 L104.5 34 Q104.3 38.6 100.2 39.4 Q93 35.2 80 35 Q64 35.4 52 40.5 Q46 44.6 39 45 Q31.6 45 30.2 38.5 Z";
const CUFF_TOP: Seg[] = [
  [[28, 27], [30, 25], [36, 25]],
  [[36, 25], [46, 24], [52, 20.4]],
  [[52, 20.4], [62, 17], [80, 15.4]],
  [[80, 15.4], [90, 15.1], [95.6, 15.9]],
  [[95.6, 15.9], [102.4, 17], [104.2, 22.6]],
];
const CUFF_BOT: Seg[] = [
  [[30.2, 38.5], [31.6, 45], [39, 45]],
  [[39, 45], [46, 44.6], [52, 40.5]],
  [[52, 40.5], [64, 35.4], [80, 35]],
  [[80, 35], [93, 35.2], [100.2, 39.4]],
];
const cuffTop = (x: number) => yOn(CUFF_TOP, x);
const cuffBot = (x: number) => yOn(CUFF_BOT, x);
const RIB_X = [42, 52, 62, 72, 82, 92];
const RIB_SEAMS = RIB_X.map((x) => `M${x} ${f2(cuffTop(x) + 3.2)} L${f2(x - 0.4)} ${f2(cuffBot(x) - 4.6)}`).join(" ");
const RIB_LIGHTS = RIB_X.map((x) => `M${f2(x + 2.2)} ${f2(cuffTop(x) + 4.6)} L${f2(x + 1.9)} ${f2(cuffBot(x) - 5.8)}`).join(" ");
const CUFF_RIDGE = band(33, 99, (x) => cuffTop(x) + 0.5, (x) => cuffTop(x) + 2.5, 3);
const CUFF_FOOT = band(39, 100, (x) => cuffBot(x) - 4, (x) => cuffBot(x) - 0.2);
const UNDER_CUFF = band(43, 99.4, (x) => cuffBot(x) - 1, (x) => cuffBot(x) + 3);
// sparse bouclé bumps on the cuff instead of printed stitch marks
const BOUCLE = dots(
  Array.from({ length: 30 }, (_, i): Pt => {
    const x = 38 + ((i * 53) % 61) + (i % 3) * 0.5;
    const fr = ((i * 37) % 17) / 17;
    return [x, cuffTop(x) + 4.2 + fr * (cuffBot(x) - cuffTop(x) - 10)];
  }),
  0.6,
);

// the band runs over the crown and rolls out of sight past its far curve (the sheet shows no band on the far side)
const BAND_D = "M31 41 L31.6 27 Q32.4 12 42 5.6 Q53 1.8 68.4 2.2 Q79.6 2.6 87 4.9";

// ---- profile view: the cuff sits level-ish, higher at the forehead than at the nape
const topP = (x: number) => 29.6 + (x - 29.4) * -0.1627;
const botP = (x: number) => 50.8 + (x - 34) * -0.1154;
const RIB_XP = [38, 50, 62, 74, 86, 98];
const RIB_SEAMS_P = RIB_XP.map((x) => `M${x} ${f2(topP(x) + 3.2)} L${f2(x - 0.4)} ${f2(botP(x) - 4.4)}`).join(" ");
const RIB_LIGHTS_P = RIB_XP.map((x) => `M${f2(x + 2.2)} ${f2(topP(x) + 4.6)} L${f2(x + 1.9)} ${f2(botP(x) - 5.6)}`).join(" ");
const CUFF_RIDGE_P = band(30, 105, (x) => topP(x) + 0.5, (x) => topP(x) + 2.5, 3);
const CUFF_FOOT_P = band(34, 106, (x) => botP(x) - 3.8, (x) => botP(x) - 0.2, 4);
const UNDER_CUFF_P = band(60, 106.4, (x) => botP(x) - 1, (x) => botP(x) + 3, 4);
const BOUCLE_P = dots(
  Array.from({ length: 26 }, (_, i): Pt => {
    const x = 34 + ((i * 53) % 72);
    const fr = ((i * 37) % 17) / 17;
    return [x, topP(x) + 4.2 + fr * (botP(x) - topP(x) - 9.5)];
  }),
  0.6,
);

/** Bahrain flag cloth with a travelling wave (the pole's right edge is x=114.6) */
function clothD(t: number) {
  const a = Math.sin(t * 3.1) * 2.2;
  const b = Math.sin(t * 3.1 - 1.2) * 3;
  const w = Math.sin(t * 4.3) * 1.5;
  return `M114.6 -60 C136 ${f2(-60 - a)} 158 ${f2(-60 + a)} ${f2(180 + w)} ${f2(-60 + b)} Q${f2(186 + w)} -39 ${f2(180 + w)} ${f2(-18 + b)} C158 ${f2(-18 + a)} 136 ${f2(-18 - a)} 114.6 -18 Z`;
}

/* ------------------------------------------------------------------ component */

export const Character = forwardRef<CharacterHandle, { className?: string; title?: string }>(function Character(
  { className = "", title = "Sayed's avatar" },
  ref,
) {
  const svg = useRef<SVGSVGElement>(null);
  const root = useRef<SVGGElement>(null);
  const squash = useRef<SVGGElement>(null);
  const upperBack = useRef<SVGGElement>(null);
  const upper = useRef<SVGGElement>(null);
  const legs = useRef<SVGGElement>(null);
  const pack34 = useRef<SVGGElement>(null);
  const packP = useRef<SVGGElement>(null);
  const torso34 = useRef<SVGGElement>(null);
  const torsoP = useRef<SVGGElement>(null);
  const head = useRef<SVGGElement>(null);
  const head34 = useRef<SVGGElement>(null);
  const headP = useRef<SVGGElement>(null);
  const beanie = useRef<SVGGElement>(null);
  const beanieP = useRef<SVGGElement>(null);
  const armN = useRef<SVGGElement>(null);
  const armF = useRef<SVGGElement>(null);
  const foreN = useRef<SVGGElement>(null);
  const foreF = useRef<SVGGElement>(null);
  const legN = useRef<SVGGElement>(null);
  const legF = useRef<SVGGElement>(null);
  const thighN = useRef<SVGGElement>(null);
  const thighF = useRef<SVGGElement>(null);
  const cuffN = useRef<SVGGElement>(null);
  const cuffF = useRef<SVGGElement>(null);
  const shinN = useRef<SVGGElement>(null);
  const shinF = useRef<SVGGElement>(null);
  const footN = useRef<SVGGElement>(null);
  const footF = useRef<SVGGElement>(null);
  const shadow = useRef<SVGEllipseElement>(null);
  const flag = useRef<SVGGElement>(null);
  const cloth = useRef<SVGPathElement>(null);
  const bellN = useRef<SVGGElement>(null);
  const bellF = useRef<SVGGElement>(null);

  // expressions: pre-built groups toggled with `display`
  const exNeutral = useRef<SVGGElement>(null);
  const exHappy = useRef<SVGGElement>(null);
  const exSerious = useRef<SVGGElement>(null);
  const exSurprised = useRef<SVGGElement>(null);
  const exAngry = useRef<SVGGElement>(null);
  const eyesNeutral = useRef<SVGGElement>(null);
  const eyesSerious = useRef<SVGGElement>(null);
  const eyesSurprised = useRef<SVGGElement>(null);
  const eyesAngry = useRef<SVGGElement>(null);
  const eyesP = useRef<SVGGElement>(null);
  const browP = useRef<SVGGElement>(null);
  const browPSerious = useRef<SVGGElement>(null);

  const cur = useRef<Pose>({ ...ZERO });
  const blink = useRef({ next: 2.5, until: 0, on: false });
  const expr = useRef<{ cur: Expression; since: number; want: Expression; wantSince: number }>({
    cur: "neutral",
    since: -1e9,
    want: "neutral",
    wantSince: -1e9,
  });
  const sec = useRef({
    init: false,
    clock: 0,
    face: 1 as 1 | -1,
    flipT: 1,
    popT: 1,
    prof: false,
    viewSet: false,
    wantProf: false,
    wantT: 0,
    viewT: 1,
    moved: false,
    moveRate: 0,
    ph: 0,
    rawPh: 0,
    dash: 0,
    dashOn: false,
    jumpT: 0,
    wasJump: false,
    prevImp: 0,
    hold: 0,
    prevAir: 0,
    prevBodyY: 0,
    cheerP: 0,
    shOp: 1,
    flagOn: false,
    flagOp: 0,
    flagY: { x: -40, v: 0 } as Spring,
    sq: { x: 0, v: 0 } as Spring,
    hat: { x: 0, v: 0 } as Spring,
    bag: { x: 0, v: 0 } as Spring,
    nod: { x: 0, v: 0 } as Spring,
    far: [] as Element[],
  });

  useImperativeHandle(
    ref,
    () => ({
      // one full walk cycle: the distance a planted boot travels back over two steps (measured on the gait with
      // the profile's longer legs and 37° reach), so the boots don't slide at walking speed
      strideUnits: 104,
      update(f) {
        const dt = clamp(f.dt || 0, 0, 0.05);
        const S = sec.current;
        if (!S.init) {
          S.init = true;
          S.face = f.facing;
          S.ph = S.rawPh = f.phase || 0;
          S.far = svg.current ? Array.from(svg.current.querySelectorAll("[data-far]")) : [];
          expr.current.since = expr.current.wantSince = -1e9;
        }
        S.clock += dt;

        // ---- walk phase: follow the distance, but never step more than ~0.5 rad a frame (no strobing);
        // far above run speed hold a dash pose until the scroll slows down
        let dRaw = (f.phase || 0) - S.rawPh;
        S.rawPh = f.phase || 0;
        if (!Number.isFinite(dRaw)) dRaw = 0;
        const maxStep = 32 * Math.max(dt, 1 / 240);
        S.ph += clamp(dRaw, -maxStep, maxStep);
        const loco = f.state === "walk" || f.state === "run";
        const rate = dt > 0 ? Math.abs(dRaw) / dt : 0;
        S.dashOn = loco && (S.dashOn ? rate > 110 : rate > 190);
        S.dash += ((S.dashOn ? 1 : 0) - S.dash) * (1 - Math.exp(-dt * 14));

        // ---- jump bookkeeping: take-off stretch, time in the air, vertical speed when the engine passes `air`
        const air = Math.max(0, f.air || 0);
        const vy = dt > 0 ? (air - S.prevAir) / dt : 0;
        S.prevAir = air;
        const isJump = f.state === "jump";
        if (isJump && !S.wasJump) {
          S.jumpT = 0;
          S.sq.x = -0.32; // stretch on launch
          S.sq.v = 0;
        }
        S.wasJump = isJump;
        S.jumpT = isJump ? S.jumpT + dt : 0;

        // ---- view: PROFILE for anything that travels (walk / run / skate, and hops made while moving, so
        // back-to-back box hops never flip between views), 3/4 FRONT for standing, gestures, a standing
        // jump and the drop-in. Hysteresis: a new view must be wanted for a moment and each view is held
        // for at least 0.18 s, so it never flickers for 1-3 frames.
        S.moveRate += (rate - S.moveRate) * (1 - Math.exp(-dt * 12));
        const locoView = f.state === "walk" || f.state === "run" || f.state === "skate";
        // spawn: the engine reports "walk" for its first frames even when he is standing still, so until he
        // has really moved, a walk/run with no distance behind it keeps the 3/4 view (no profile flash, then
        // a flip to 3/4, on page load). Any view change in the first 0.4 s is applied without the turn-squash.
        const spawn = S.clock < 0.4;
        if (rate > 0.5) S.moved = true;
        const standingWalk = spawn && !S.moved && (f.state === "walk" || f.state === "run");
        const wantProf = (locoView && !standingWalk) || (isJump && (S.prof || S.moveRate > 2));
        if (wantProf !== S.wantProf) {
          S.wantProf = wantProf;
          S.wantT = 0;
        }
        S.wantT += dt;
        S.viewT += dt;
        const need = wantProf ? (locoView ? 0 : 0.06) : 0.16;
        if (!S.viewSet || (wantProf !== S.prof && ((spawn && !S.moved) || (S.wantT >= need && S.viewT >= 0.18)))) {
          if (S.viewSet && !spawn) {
            S.popT = 0;
            S.viewT = 0;
          }
          S.viewSet = true;
          S.prof = wantProf;
          const on = (g: { current: SVGGElement | null }, v: boolean) => g.current?.setAttribute("display", v ? "inline" : "none");
          on(head34, !wantProf);
          on(torso34, !wantProf);
          on(pack34, !wantProf);
          on(headP, wantProf);
          on(torsoP, wantProf);
          on(packP, wantProf);
          for (const el of S.far) el.setAttribute("opacity", wantProf ? "0.32" : "0");
          // profile legs: the thigh (and its knee disc) rides up with the higher hip and knee
          // and the trouser legs are slimmer seen from the side (the boots keep their size)
          const slim = (cx: number, k: number, dy: number) => (wantProf ? `translate(${cx} ${dy}) scale(${k} 1) translate(${-cx} 0)` : "translate(0 0)");
          thighN.current?.setAttribute("transform", slim(42, PROFILE_SLIM, THIGH_P));
          thighF.current?.setAttribute("transform", slim(78, PROFILE_SLIM, THIGH_P));
          cuffN.current?.setAttribute("transform", slim(41.7, PROFILE_SLIM + 0.04, 0));
          cuffF.current?.setAttribute("transform", slim(77.8, PROFILE_SLIM + 0.04, 0));
        }
        const prof = S.prof;

        // ---- target pose + easing
        let tgt = targetPose(standingWalk ? { ...f, state: "idle" } : f, S.ph, { u: S.jumpT, vy, hasAir: air > 0 }, prof);
        if (loco && S.dash > 0.001) {
          const w = S.dash;
          const mixed = { ...tgt };
          for (const key of POSE_KEYS) mixed[key] = tgt[key] + (DASH[key] - tgt[key]) * w;
          tgt = mixed;
        }
        const imp = clamp(f.impact ?? 0, 0, 1);
        // landing: squash starts at full strength on the contact frame, the spring only recovers
        if (imp > 0 && S.prevImp === 0) {
          S.sq.x = Math.max(S.sq.x, imp);
          S.sq.v = 0;
        }
        S.prevImp = imp;
        S.hold = Math.max(imp, S.hold - dt * 4.5);
        // cheer hops land with a little squash too
        if (f.state === "cheer") {
          const p = (f.time * 2.5) % 1;
          if (S.cheerP < 0.55 && p >= 0.55) {
            S.sq.x = Math.max(S.sq.x, 0.35);
            S.sq.v = 0;
          }
          S.cheerP = p;
        }

        const c = cur.current;
        const k = loco || f.state === "cheer" || f.state === "wave" ? 30 : f.state === "skate" ? 16 : f.state === "jump" ? 18 : 9;
        const a = 1 - Math.exp(-dt * k);
        const aLeg = S.hold > 0.05 ? Math.max(a, 1 - Math.exp(-dt * 28)) : a;
        for (const key of POSE_KEYS) c[key] += (tgt[key] - c[key]) * (LEG_KEYS.has(key) ? aLeg : a);
        // the run's flight is phase-locked (not eased), so the planted frames really touch the ground
        if (loco && S.dash < 0.05) c.lift = tgt.lift;

        const dxN = prof ? PROFILE_LEG_N : 0;
        const dxF = prof ? PROFILE_LEG_F : 0;
        const ax = prof ? PROFILE_ARM : 0;
        const hipN = prof ? HIP_NP : HIP_N;
        const hipF = prof ? HIP_FP : HIP_F;
        const kneeN = prof ? KNEE_NP : KNEE_N;
        const kneeF = prof ? KNEE_FP : KNEE_F;

        // ---- legs: forward kinematics, then keep the lowest sole exactly on the ground (no sinking / floating)
        const footRelN = c.footN - c.legN - c.kneeN;
        const footRelF = c.footF - c.legF - c.kneeF;
        // (in the air the boots may hang higher, but never below the physics feet line)
        const lowN = soleLow(SOLE_N, dxN, c.tyN, c.legN, c.kneeN, footRelN, hipN, kneeN, ANKLE_N);
        const lowF = soleLow(SOLE_F, dxF, c.tyF, c.legF, c.kneeF, footRelF, hipF, kneeF, ANKLE_F);
        const snap = SOLE_Y - Math.max(lowN, lowF);
        const hip = (isJump ? Math.min(0, snap) : snap) + c.lift;

        // ---- squash & stretch (around the feet)
        const rising = isJump ? (air > 0 ? smooth(20, 160, vy) : 1 - smooth(0.08, 0.26, S.jumpT)) : 0;
        const stretch = isJump ? (air > 0.5 ? Math.min(0.5, Math.abs(vy) / 300) : 0.22 * rising) : 0;
        spring(S.sq, -stretch, 380, 20, dt);
        const q = clamp(S.sq.x, -0.7, 1.2);
        const sx = 1 + q * 0.11;
        const sy = 1 - q * 0.13;

        // ---- secondary motion: beanie lags + wobbles, backpack bounces, head bobs behind the body
        const upY = hip + c.bodyY;
        const vb = dt > 0 ? (upY - S.prevBodyY) / dt : 0;
        S.prevBodyY = upY;
        spring(S.hat, q * 1.1 - clamp(vb * 0.012, -0.5, 0.5), 240, 10, dt);
        spring(S.bag, upY, 170, 9, dt);
        spring(S.nod, upY, 320, 17, dt);
        const hat = clamp(S.hat.x, -0.9, 1.3);
        const bagOff = clamp(S.bag.x - upY, -3, 3);
        const nodOff = clamp(S.nod.x - upY, -2.5, 2.5);

        // ---- facing: flip instantly (never squeeze through scaleX 0) with a 70 ms squash-and-settle;
        // the 3/4 ↔ profile swap gets a smaller pop
        if (f.facing !== S.face) {
          S.face = f.facing;
          S.flipT = 0;
        }
        S.flipT += dt;
        S.popT += dt;
        const fe = S.flipT >= 0.07 ? 1 : easeOut(S.flipT / 0.07);
        // view swap: a short turn-squash (narrow and a touch taller, easing back over 0.12 s)
        const pe = S.popT >= 0.12 ? 1 : easeOut(S.popT / 0.12);
        const tsx = (1 - 0.2 * (1 - fe)) * (1 - 0.1 * (1 - pe));
        const tsy = 1 + 0.05 * (1 - fe) + 0.03 * (1 - pe);

        root.current?.setAttribute("transform", `translate(60 180) scale(${(S.face * tsx).toFixed(4)} ${tsy.toFixed(4)}) translate(-60 -180)`);
        squash.current?.setAttribute("transform", `translate(60 180) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-60 -180)`);
        const upT = `translate(0 ${upY.toFixed(2)}) ${rot(c.lean, UPPER_PIVOT)}`;
        upper.current?.setAttribute("transform", upT);
        upperBack.current?.setAttribute("transform", upT);
        legs.current?.setAttribute("transform", `translate(0 ${hip.toFixed(2)})`);
        const packT = `translate(0 ${bagOff.toFixed(2)}) rotate(${(bagOff * 1.4).toFixed(2)} 28 88)`;
        pack34.current?.setAttribute("transform", packT);
        packP.current?.setAttribute("transform", packT);
        head.current?.setAttribute("transform", `translate(0 ${(c.headY + nodOff * 0.9).toFixed(2)}) ${rot(c.head - nodOff * 0.5, NECK)}`);
        const hatT = `translate(64 40) scale(${(1 + hat * 0.035).toFixed(4)} ${(1 - hat * 0.05).toFixed(4)}) translate(-64 -40)`;
        beanie.current?.setAttribute("transform", hatT);
        beanieP.current?.setAttribute("transform", hatT);
        armN.current?.setAttribute("transform", `translate(${ax} 0) ${rot(c.armN, SHOULDER_N)}`);
        armF.current?.setAttribute("transform", `translate(${-ax} 0) ${rot(c.armF, SHOULDER_F)}`);
        foreN.current?.setAttribute("transform", rot(c.elbowN, ELBOW_N));
        foreF.current?.setAttribute("transform", rot(c.elbowF, ELBOW_F));
        legN.current?.setAttribute("transform", `translate(${dxN} ${c.tyN.toFixed(2)}) ${rot(c.legN, hipN)}`);
        legF.current?.setAttribute("transform", `translate(${dxF} ${c.tyF.toFixed(2)}) ${rot(c.legF, hipF)}`);
        shinN.current?.setAttribute("transform", rot(c.kneeN, kneeN));
        shinF.current?.setAttribute("transform", rot(c.kneeF, kneeF));
        footN.current?.setAttribute("transform", rot(footRelN, ANKLE_N));
        footF.current?.setAttribute("transform", rot(footRelF, ANKLE_F));
        // dumbbells stay level whatever the arm does
        bellN.current?.setAttribute("opacity", c.bells.toFixed(2));
        bellF.current?.setAttribute("opacity", c.bells.toFixed(2));
        bellN.current?.setAttribute("transform", rot(-(c.armN + c.elbowN), FIST_N));
        bellF.current?.setAttribute("transform", rot(-(c.armF + c.elbowF), FIST_F));

        // ---- the Bahrain flag: planted with a quick drop, then a world prop that stays while he cheers
        const wantFlag = f.state === "flag" || (f.state === "cheer" && S.flagOn);
        if (wantFlag && !S.flagOn) {
          S.flagOn = true;
          S.flagY.x = -44;
          S.flagY.v = 0;
          S.flagOp = 1;
        } else if (!wantFlag && S.flagOn) S.flagOn = false;
        spring(S.flagY, S.flagOn ? 0 : -24, 320, 17, dt);
        S.flagOp = S.flagOn ? 1 : Math.max(0, S.flagOp - dt * 9);
        if (flag.current) {
          flag.current.setAttribute("opacity", S.flagOp.toFixed(2));
          if (S.flagOp > 0) {
            flag.current.setAttribute("transform", `translate(0 ${Math.min(0.8, S.flagY.x).toFixed(2)})`);
            cloth.current?.setAttribute("d", clothD(f.time));
          }
        }

        // ---- contact shadow: shrinks with height; in the air without a known height it fades away
        const sh = Math.max(0.35, 1 - air / 90);
        const shTarget = isJump && air <= 0 ? 0 : 1;
        S.shOp += (shTarget - S.shOp) * (1 - Math.exp(-dt * (shTarget ? 30 : 16)));
        shadow.current?.setAttribute("transform", `translate(60 ${(180 + air).toFixed(2)}) scale(${(sh * sx).toFixed(3)} ${sh.toFixed(3)})`);
        if (shadow.current) shadow.current.style.opacity = ((0.25 + sh * 0.2) * S.shOp).toFixed(3);

        // ---- expression: a new face must be wanted for 0.1 s and the current one held for 0.15 s
        // (no one-frame flashes between hops); long falls turn surprised
        let want = f.expression ?? EXPRESSION_FOR[f.state] ?? "neutral";
        if (!f.expression && isJump && S.jumpT > 1) want = "surprised";
        const ex = expr.current;
        if (want !== ex.want) {
          ex.want = want;
          ex.wantSince = S.clock;
        }
        if (want !== ex.cur && (f.expression || ex.since < -1e8 || (S.clock - ex.wantSince >= 0.1 && S.clock - ex.since >= 0.15))) {
          const groups = [exNeutral, exHappy, exSerious, exSurprised, exAngry];
          EXPRESSIONS.forEach((name, i) => groups[i].current?.setAttribute("display", name === want ? "inline" : "none"));
          const stern = want === "serious" || want === "angry";
          browP.current?.setAttribute("display", stern ? "none" : "inline");
          browPSerious.current?.setAttribute("display", stern ? "inline" : "none");
          ex.cur = want;
          ex.since = S.clock;
        }

        // ---- blink (the happy face has its eyes shut already)
        const b = blink.current;
        if (f.time > b.next || f.time < b.next - 8) {
          b.until = f.time + 0.12;
          b.next = f.time + 2.2 + ((Math.sin(f.time * 12.9898) + 1) / 2) * 3;
        }
        const shut = f.time < b.until;
        if (shut !== b.on) {
          b.on = shut;
          const tr = shut ? "translate(0 53.2) scale(1 0.1) translate(0 -53.2)" : "";
          for (const e of [eyesNeutral, eyesSerious, eyesSurprised, eyesAngry, eyesP]) e.current?.setAttribute("transform", tr);
        }
      },
    }),
    [],
  );

  return (
    <svg ref={svg} viewBox="-40 -80 200 264" className={className} role="img" aria-label={title} overflow="visible">
      <ellipse ref={shadow} cx="0" cy="0" rx="40" ry="5" fill="#0a1a33" opacity="0.4" transform="translate(60 180)" />

      <g ref={root} strokeLinejoin="round">
        {/* ---------- Bahrain flag: planted in the ground behind him (a prop, not part of the body) ---------- */}
        <g ref={flag} opacity="0">
          <rect x="110" y="-64" width="4.6" height="244" rx="2" fill="#8a5a2b" stroke={C.ol} strokeWidth="1.2" />
          <path d="M111.4 -60 L111.4 176" stroke="#b07a43" strokeWidth="1" opacity="0.8" />
          <circle cx="112.3" cy="-66" r="4" fill="#ffbb33" stroke={C.ol} strokeWidth="1.1" />
          <path ref={cloth} d={clothD(0)} fill="#d7262e" stroke={C.ol} strokeWidth="1.3" />
          {/* white band with the five serrations */}
          <path
            d="M114.6 -59.4 L131.6 -59.4 L139.6 -55.6 L131.6 -51.6 L139.6 -47.4 L131.6 -43.2 L139.6 -39 L131.6 -34.8 L139.6 -30.6 L131.6 -26.4 L139.6 -22.4 L131.6 -18.6 L114.6 -18.6 Z"
            fill="#ffffff"
          />
        </g>

        <g ref={squash}>
          {/* ---------- backpack (3/4): tucked behind the near shoulder ---------- */}
          <g ref={upperBack}>
            <g ref={pack34}>
              <path d="M23.4 92 Q23.4 86.4 28.6 86.4 L33 86.4 Q36.5 86.4 36.5 90 L36.5 134 L22 134 Q19 134 19 130 L20.8 104 Q21.4 97 23.4 92 Z" fill={C.pack} stroke={C.ol} strokeWidth={OL} />
              <path d="M23.4 92 Q23.4 86.4 28.6 86.4 L33 86.4 Q36.5 86.4 36.5 90 L36.5 97 L22.2 97 Z" fill={C.packSh} stroke={C.ol} strokeWidth="1" />
              <path d="M25.4 88.6 Q28.4 87.8 31.6 88.2" stroke={C.packHi} strokeWidth="1.1" fill="none" />
              <rect x="22" y="95" width="5.6" height="6.6" rx="1" fill={C.buckle} stroke={C.ol} strokeWidth="0.9" />
              <path d="M21 108 L21 128" stroke={C.packSh} strokeWidth="2" />
            </g>
          </g>

          {/* ---------- legs (never leaned: the soles stay flat on the ground) ---------- */}
          <g ref={legs}>
            {/* far leg */}
            <g ref={legF}>
              <g ref={thighF}>
                {/* knee cap: a disc on the knee pivot fills the joint whatever the fold */}
                <circle cx={KNEE_F[0]} cy={KNEE_F[1]} r="15" fill={C.pants} stroke={C.ol} strokeWidth={OL} />
                <path d="M63 129 Q63 125 67 125 L89 125 Q93 125 93 129 L93 161 L63 161 Z" fill={C.pants} stroke={C.ol} strokeWidth={OL} />
                <path d="M63.9 141 L68.5 141 L68.5 160 L63.9 160 Z" fill={C.pantsSh} />
                <path d="M91.8 141.4 L91.8 159.6" stroke={C.rim} strokeWidth="1" opacity="0.7" />
                <path data-far="" d="M63 129 Q63 125 67 125 L89 125 Q93 125 93 129 L93 161 L63 161 Z" fill={C.farShade} opacity="0" />
              </g>
              <g ref={shinF}>
                <g ref={footF}>
                  <Boot h={62.4} t={100.4} far />
                </g>
                <g ref={cuffF}>
                  <rect x="61.6" y="156" width="32.4" height="9" rx="1.5" fill={C.pantsCuff} stroke={C.ol} strokeWidth={OL} />
                  <path d="M63 158 L92.6 158" stroke={C.pants} strokeWidth="1.3" />
                  <rect data-far="" x="61.6" y="156" width="32.4" height="9" rx="1.5" fill={C.farShade} opacity="0" />
                </g>
              </g>
            </g>

            {/* near leg */}
            <g ref={legN}>
              <g ref={thighN}>
                <circle cx={KNEE_N[0] - 1} cy={KNEE_N[1]} r="13.6" fill={C.pants} stroke={C.ol} strokeWidth={OL} />
                <path d="M28 129 Q28 125 32 125 L52 125 Q56 125 56 129 L56 161 L28 161 Z" fill={C.pants} stroke={C.ol} strokeWidth={OL} />
                <path d="M30 142 L33.5 142 L33.5 159 L30 159 Z" fill={C.pantsHi} />
                <path d="M51.6 141 L55.2 141 L55.2 160 L51.6 160 Z" fill={C.pantsSh} />
              </g>
              <g ref={shinN}>
                <g ref={footN}>
                  <Boot h={26} t={59.9} />
                </g>
                <g ref={cuffN}>
                  <rect x="26" y="156" width="31.4" height="9" rx="1.5" fill={C.pantsCuff} stroke={C.ol} strokeWidth={OL} />
                  <path d="M27.5 158 L55.9 158" stroke={C.pantsHi} strokeWidth="1.3" />
                </g>
              </g>
            </g>
          </g>

          <g ref={upper}>
            {/* ---------- far arm (behind the torso) ---------- */}
            <g ref={armF}>
              <circle cx="93.4" cy={ELBOW_F[1]} r="9" fill={C.jacket} stroke={C.ol} strokeWidth={OL} />
              <path d="M84.4 94 Q85.2 87 89.2 86.6 Q92.6 87 93.8 91.2 L96.6 97.8 L103.4 117 L86.9 117 Z" fill={C.jacket} stroke={C.ol} strokeWidth={OL} />
              <path d="M93.8 93.6 L96.4 99.6 L102.4 116.4" stroke={C.rim} strokeWidth="1" opacity="0.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M90.6 103 q3.5 1.4 7 -0.2" stroke={C.jacketSh} strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path data-far="" d="M84.4 94 Q85.2 87 89.2 86.6 Q92.6 87 93.8 91.2 L96.6 97.8 L103.4 117 L86.9 117 Z" fill={C.farShade} opacity="0" />
              <g ref={foreF}>
                <path d="M86.9 108 L101.4 108 L105.4 123 L86.7 123 Z" fill={C.jacket} />
                <path d="M86.9 108.5 L86.7 123 M101.4 108.2 L105.4 123" stroke={C.ol} strokeWidth={OL} />
                <path d="M101 109.4 L104.5 122.4" stroke={C.rim} strokeWidth="1" opacity="0.7" />
                <rect x="85.4" y="121" width="22.2" height="10" rx="1.6" fill={C.jacket} stroke={C.ol} strokeWidth={OL} />
                <path d="M86.6 122.8 L106.4 122.8" stroke={C.jacketHi} strokeWidth="1.4" />
                <path d="M86.6 129.2 L106.4 129.2" stroke={C.jacketSh} strokeWidth="1.6" />
                <path d="M106.6 123.4 L106.6 129.6" stroke={C.rim} strokeWidth="1" opacity="0.7" />
                <path data-far="" d="M86.7 108 L101.4 108 L105.8 121 L107.6 131 L85.4 131 Z" fill={C.farShade} opacity="0" />
                <g ref={bellF} opacity="0">
                  <rect x="78.5" y="135.5" width="40" height="4" rx="1.5" fill={C.bell} stroke={C.ol} strokeWidth="1" />
                  <rect x="73" y="128.5" width="8" height="18" rx="2" fill={C.plate} stroke={C.ol} strokeWidth="1.1" />
                  <rect x="116" y="128.5" width="8" height="18" rx="2" fill={C.plate} stroke={C.ol} strokeWidth="1.1" />
                </g>
                {/* fist as a small cube: lit front, deep warm outer side, knuckle crease */}
                <path d="M91 130 L105.5 130 L107.6 132.6 L107.6 142.2 L105 145.2 L92.4 145.2 L89.6 142.6 L89.6 132.2 Z" fill={C.skin} stroke={C.warmOl} strokeWidth={WOL} />
                <path d="M107.2 132.8 L101 131.2 L101 144.8 L105 144.8 L107.2 142.2 Z" fill={C.fistSide} />
                <path d="M90.4 142.4 L106.8 142.4 L104.8 144.6 L92.6 144.6 Z" fill={C.skinSh2} />
                <path d="M93 135.4 L97.4 135.4 L96.4 137.8 L97.6 140.4 L93.6 140.4 Z" fill={C.skinDeep} />
                <path data-far="" d="M91 130 L105.5 130 L107.6 132.6 L107.6 142.2 L105 145.2 L92.4 145.2 L89.6 142.6 L89.6 132.2 Z" fill={C.farShade} opacity="0" />
              </g>
            </g>

            {/* ---------- backpack (profile): on his back, over the far arm ---------- */}
            <g ref={packP} display="none">
              <path d="M19.6 95 Q19.6 88.6 26 88.6 L38 88.6 L38 130 L25.6 130 Q19.6 130 19.6 124 Z" fill={C.pack} stroke={C.ol} strokeWidth={OL} />
              <path d="M19.6 95 Q19.6 88.6 26 88.6 L38 88.6 L38 100 L19.6 100 Z" fill={C.packSh} stroke={C.ol} strokeWidth="1" />
              <path d="M22.4 91.4 Q27 90 32 90.4" stroke={C.packHi} strokeWidth="1.1" fill="none" />
              <rect x="23" y="98.2" width="6" height="7" rx="1" fill={C.buckle} stroke={C.ol} strokeWidth="0.9" />
              <path d="M22.6 108 L22.6 125" stroke={C.packSh} strokeWidth="2" />
              <path d="M20.6 104 L20.6 122" stroke={C.packHi} strokeWidth="1" opacity="0.6" />
            </g>

            {/* ---------- torso (3/4) ---------- */}
            <g ref={torso34}>
              {/* hood gathered behind the neck */}
              <path d="M23 100 Q19 84 30 78.4 Q48 72.8 70 74 Q84 74.4 88.6 77.6 Q92 81 91.8 88 L91.6 100 Z" fill={C.jacketSh} stroke={C.ol} strokeWidth={OL} />
              <path d="M31 91 Q35.5 82.5 50 80" stroke={C.redSh} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M26.6 85 Q37.6 75.6 62 75.2" stroke={C.jacket} strokeWidth="1.4" fill="none" opacity="0.8" />
              {/* neck, deep in the shadow of the beard and the collar */}
              <path d="M45 70 L68 78 L72 94 L44 94 Z" fill={C.neckDeep} stroke={C.ol} strokeWidth="1.1" />
              {/* jacket */}
              <path
                d="M29.5 97 Q30.5 88.5 40 86.5 L86 86.5 Q91.8 87.2 93.4 91.6 L95 100 L94.6 144.6 Q94.2 148.5 90.8 148.5 L32 148.5 Q29.3 148.5 29.3 146 Z"
                fill={C.jacket}
                stroke={C.ol}
                strokeWidth={OL}
              />
              <path d="M86.6 88.4 Q91.4 89 92.6 92.6 L94.2 100.4 L94.2 138.5 L87.6 138.5 Z" fill={C.jacketSh} />
              <path d="M40.5 89 L84 88.8 L83 92.2 L41 92.8 Z" fill={C.jacketHi} />
              <path d="M56 87.2 L74.3 96 L87 87.2" stroke={C.jacketDeep} strokeWidth="1.4" fill="none" />
              {/* hem band */}
              <path d="M29.4 139 L94.7 139 L94.6 144.6 Q94.2 148 90.8 148 L32 148 Q29.4 148 29.4 146 Z" fill={C.jacketSh} />
              <path d="M29.8 139 L94.6 139" stroke={C.jacketDeep} strokeWidth="1.3" />
              {/* zipper */}
              <path d="M74.3 94 L74.3 145" stroke={C.zip} strokeWidth="2.4" />
              <path d="M74.3 95 L74.3 144" stroke={C.zipHi} strokeWidth="1" strokeDasharray="0.9 1.5" />
              <rect x="72.7" y="96.5" width="3.2" height="6.5" rx="0.9" fill={C.zipHi} stroke={C.ol} strokeWidth="0.8" />
              <rect x="72.7" y="138.4" width="3.2" height="6" rx="0.9" fill={C.zipHi} stroke={C.ol} strokeWidth="0.8" />
              {/* pockets + badge */}
              <path d="M83 118.5 L91.5 118.5 L91.5 136.5 L83 136.5 Z" fill="none" stroke={C.jacketDeep} strokeWidth="1.1" />
              <path d="M82.4 118.2 L92 118.2 L92 122 L82.4 122 Z" fill={C.jacketSh} stroke={C.jacketDeep} strokeWidth="1" />
              <path d="M55.5 121 L55.5 136.5 M50 121 L57.4 121" stroke={C.jacketDeep} strokeWidth="1.1" />
              <rect x="79.4" y="104.4" width="3" height="2.6" rx="0.5" fill="#C9D3EA" opacity="0.75" />
              {/* backpack straps (grey webbing), ladder-lock buckles and a small black side-release clip with a dull red tab */}
              <path d="M49 86 C52 96 53.6 106 50.6 116 C47.6 124 40 130 32 133" stroke={C.ol} strokeWidth="7.6" fill="none" strokeLinecap="round" />
              <path d="M49 86 C52 96 53.6 106 50.6 116 C47.6 124 40 130 32 133" stroke={C.strap} strokeWidth="5.2" fill="none" strokeLinecap="round" />
              <path d="M51.2 90 C53.4 99 54 107 51.8 115" stroke={C.strapSh} strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <path d="M87 86.4 C89 98 90.2 110 92 123" stroke={C.ol} strokeWidth="7" fill="none" strokeLinecap="round" />
              <path d="M87 86.4 C89 98 90.2 110 92 123" stroke={C.strap} strokeWidth="4.6" fill="none" strokeLinecap="round" />
              <path d="M88.6 90 C90.2 100 91.2 110 92.8 120" stroke={C.strapSh} strokeWidth="1.3" fill="none" strokeLinecap="round" />
              <rect x="48.2" y="101.8" width="8.6" height="8.8" rx="1.2" fill={C.buckle} stroke={C.ol} strokeWidth="1" />
              <rect x="50.4" y="104" width="4.2" height="3.6" fill={C.strapSh} />
              <rect x="85.2" y="101.6" width="7.6" height="8" rx="1.2" fill={C.buckle} stroke={C.ol} strokeWidth="1" />
              <rect x="87.2" y="103.9" width="3.6" height="3.4" fill={C.strapSh} />
              <rect x="45" y="117" width="7.4" height="5.4" rx="1.2" fill={C.clipFrame} stroke={C.ol} strokeWidth="0.9" transform="rotate(28 48.7 119.7)" />
              <rect x="47.5" y="118.8" width="2.6" height="1.9" rx="0.4" fill={C.clipRed} transform="rotate(28 48.7 119.7)" />
            </g>

            {/* ---------- torso (profile) ---------- */}
            <g ref={torsoP} display="none">
              <path d="M36 101 Q32 86 44 79.4 Q56 74 68 75.4 Q78 76.6 82 81.6 L84 88 L60 92 L40 100 Z" fill={C.jacketSh} stroke={C.ol} strokeWidth={OL} />
              <path d="M40 92 Q43 83 56 79.6" stroke={C.redSh} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path d="M64 72 L84 78 L86 92 L64 92 Z" fill={C.skinSh2} stroke={C.ol} strokeWidth="1.1" />
              {/* (the profile jacket is ~10 units shorter than the 3/4 one: more leg shows, like the sheet's walk sprites) */}
              <path
                d="M36.4 98 Q37.6 88.6 47 87 L80 86.6 Q87.8 87.8 88.4 96 L88.8 131.5 Q88.8 134 86.3 134 L38.6 134 Q36 134 36 131.5 Z"
                fill={C.jacket}
                stroke={C.ol}
                strokeWidth={OL}
              />
              <path d="M37.4 96 Q38 90.4 42 88.6 L42.6 125.2 L37 125.2 Z" fill={C.jacketSh} />
              <path d="M84.6 91.6 Q87.2 93 87.4 96.4 L87.8 125 L85.2 125 Z" fill={C.jacketHi} />
              <path d="M46 89.4 L79 89 L78.4 92 L46.4 92.6 Z" fill={C.jacketHi} />
              <path d="M36.2 125.4 L88.8 125.4 L88.8 131.5 Q88.8 133.5 86.3 133.5 L38.6 133.5 Q36.2 133.5 36.2 131.5 Z" fill={C.jacketSh} />
              <path d="M36.6 125.4 L88.6 125.4" stroke={C.jacketDeep} strokeWidth="1.3" />
              <path d="M83.4 93 L83.8 131.4" stroke={C.zip} strokeWidth="2.2" />
              <path d="M83.4 94 L83.8 130.4" stroke={C.zipHi} strokeWidth="0.9" strokeDasharray="0.9 1.5" />
              <rect x="81.9" y="96.2" width="3.2" height="6.4" rx="0.9" fill={C.zipHi} stroke={C.ol} strokeWidth="0.8" />
              <path d="M66 110.4 L78 110.4 L78 123 L66 123 Z" fill="none" stroke={C.jacketDeep} strokeWidth="1.1" />
              <path d="M65.4 110.1 L78.6 110.1 L78.6 113.9 L65.4 113.9 Z" fill={C.jacketSh} stroke={C.jacketDeep} strokeWidth="1" />
              <rect x="76" y="103.4" width="3" height="2.6" rx="0.5" fill="#C9D3EA" opacity="0.75" />
              {/* strap over the shoulder, down the chest and back under the arm to the pack */}
              <path d="M60 86 C66 95 71 104 69 111 C66 118 52 122 38 122" stroke={C.ol} strokeWidth="7.6" fill="none" strokeLinecap="round" />
              <path d="M60 86 C66 95 71 104 69 111 C66 118 52 122 38 122" stroke={C.strap} strokeWidth="5.2" fill="none" strokeLinecap="round" />
              <path d="M62.4 89.6 C67 96 70.6 104 70 110" stroke={C.strapSh} strokeWidth="1.4" fill="none" strokeLinecap="round" />
              <rect x="65" y="98.4" width="8.6" height="8.8" rx="1.2" fill={C.buckle} stroke={C.ol} strokeWidth="1" />
              <rect x="67.2" y="100.6" width="4.2" height="3.6" fill={C.strapSh} />
              <rect x="63.6" y="112.8" width="7.4" height="5.4" rx="1.2" fill={C.clipFrame} stroke={C.ol} strokeWidth="0.9" transform="rotate(40 67.3 115.5)" />
              <rect x="66" y="114.6" width="2.6" height="1.9" rx="0.4" fill={C.clipRed} transform="rotate(40 67.3 115.5)" />
            </g>

            {/* ---------- head ---------- */}
            <g ref={head}>
              {/* ===== 3/4 front-right head ===== */}
              <g ref={head34}>
                {/* far ear cup, behind the face */}
                <path d="M98.6 41 L101.2 39.6 L103.4 43.2 L103.4 61.8 L101 65.4 L98.6 65 Z" fill={C.cup} stroke={C.ol} strokeWidth={OL} />
                {/* the near side of the jaw turning away in soft skin shadow, and the curly hair under the near cup
                    (it runs into the jaw-line beard); no flat maroon plate */}
                <path d="M36.4 54 L45.6 54 L47.8 74.8 Q44.4 78.8 39.6 78 L36.4 74 Z" fill={C.skinSh2} />
                <path d="M41.6 56 L45.4 56 L46.6 70 Q44.6 71.6 42.4 70.6 Z" fill={C.jawSh} opacity="0.8" />
                <path
                  d="M31.4 64 L39.6 64 Q39.8 69.4 42.6 72.8 Q45.2 76.6 49.6 78.6 Q47.4 81.4 44 80.6 Q42.2 83.2 38.8 81.8 Q36 83.4 33.6 81 Q30.6 80.8 30.6 77.6 Q28.6 75 30.4 72.2 Q29.2 68 31.4 64 Z"
                  fill={C.hair}
                />
                <path d="M33 74.4 Q35 73 37 74.4 Q36.4 76.8 37.4 78.4 Q35 79.2 33.6 77.8 Q32.4 76.2 33 74.4 Z" fill={C.curl} opacity="0.8" />
                {/* face */}
                <path
                  d="M43 32 L99.4 30 L99.4 68 Q99 74.5 95.6 78 L91.6 81.2 L67 82 Q57 79.6 50.5 77 Q44 73.5 43 66 Z"
                  fill={C.skin}
                  stroke={C.warmOl}
                  strokeWidth={WOL}
                />
                <path d="M43.6 44 L49 44 L49.8 76.4 Q45 73 43.6 66 Z" fill={C.skinSh} />
                <path d={UNDER_CUFF} fill={C.foreheadSh} />
                <path d="M44.6 66 Q46.2 73.2 51.4 76 L50.4 73.4 Q47.2 70.6 46.6 66 Z" fill={C.jawSh} />
                <path d="M96.6 40 L99 40 L99 68 Q98.6 74 95.6 77.6 Q97.2 73 97.1 67.5 Z" fill={C.skinSh} opacity="0.8" />
                {/* one small mole on the far cheek (in all the sheet's faces) */}
                <circle cx="95.4" cy="58.8" r="0.72" fill={C.mole} />
                {/* nose: soft bulb, lit upper-right, warm underside, nostril hint lower-left */}
                <path d="M75 60 Q79.6 56 84.6 58.6 Q87 61.4 85.6 63.8 Q83 66 79.4 65.8 Q75.6 65.6 74.6 63 Z" fill={C.nose} />
                <path d="M76 63.6 Q79.6 66.4 85.2 63.8 Q83 65.9 79.4 65.9 Q76.6 65.7 76 63.6 Z" fill={C.skinSh2} opacity="0.55" />
                <path d="M80.6 58.6 Q83.4 58.4 84.4 60.6 L82 61 Z" fill={C.skinHi} />
                <path d="M75.2 63.6 Q77 65.8 80 66" stroke={C.skinSh2} strokeWidth="1.2" fill="none" strokeLinecap="round" />
                {/* anchor beard: moustache with thin side bars down to a chin block (skin shows either side of the soul patch) */}
                <path
                  d="M67.2 81 L67.2 71.5 Q69 65.8 75.5 65.2 L85 65.2 Q90.6 65.6 91.3 70.5 L91.3 80.5 L88.2 80.5 L88 72.8 Q84.5 70.6 79.5 70.6 Q73.5 70.6 70.2 72.8 L70.2 81 Z"
                  fill={C.hair}
                />
                {/* full chin beard: rounded and heavier toward the near side, wrapping back along the jaw
                    to the hair under the cup (the sheet's beard is not a narrow block) */}
                <path
                  d="M66.4 80.4 L88.2 80.2 L91.3 79.8 Q91.4 84.6 88.4 87.2 Q86.2 89 83.8 89.4 L82.8 88.4 L81.6 90.2 Q76 91.6 70.4 90.8 L69.4 89.6 L68.2 90.6 Q61.6 89.8 57.2 86.6 Q51.4 83.2 47.2 78.8 Q44.6 75.8 43.6 71.6 L45.6 71 Q47.8 75.4 52.6 77.8 Q58.6 80.8 66.4 80.4 Z"
                  fill={C.hair}
                />
                <path d="M60 84.4 Q65 87.2 71.4 87.8" stroke={C.hairHi} strokeWidth="0.8" fill="none" opacity="0.6" strokeLinecap="round" />
                <path d="M72.4 67.2 Q79.5 66.2 87 67.2" stroke={C.hairHi} strokeWidth="0.9" fill="none" />

                {/* ---------- expressions (eyes first, brows over the lids) ---------- */}
                <g ref={exNeutral}>
                  <g ref={eyesNeutral}>
                    <Eyes top={48.6} />
                  </g>
                  <path d="M55 45.4 Q55.4 41.8 59.6 40.4 Q64 39.8 68 40.9 L76.2 42.8 L77.2 48 L74 46.6 Q71.4 45.2 67 45 L58 45.2 Z" fill={C.hair} />
                  <path d="M82.6 48 L83.2 44.2 Q84.4 42.8 87 42.6 L98.6 39.8 Q100.2 39.8 100.3 41 L100.3 44.2 L88 46.2 Q85.6 46.6 84.6 48.4 Z" fill={C.hair} />
                  <path d="M71.5 71.4 Q79.5 70.6 87.5 71.4 L86.5 73.6 Q79.5 75.8 72.5 73.6 Z" fill={C.lip} />
                  <path d="M71.8 71.8 Q79.5 72.8 87.2 71.8" stroke={C.lipLine} strokeWidth="1" fill="none" strokeLinecap="round" />
                  <path d="M76.4 77 Q80 74.6 83.4 77 L82.6 80.4 L77.2 80.4 Z" fill={C.hair} />
                </g>

                <g ref={exHappy} display="none">
                  <path d="M58 55.4 Q65 49 72.2 55 M86.6 55.2 Q91.2 49.6 95.8 54.8" stroke={C.hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
                  <path d="M55 43.9 Q55.4 40.3 59.6 38.9 Q64 38.3 68 39.4 L76.2 41.3 L77 45.6 L74 44.6 Q71.4 43.6 67 43.4 L58 43.7 Z" fill={C.hair} />
                  <path d="M82.6 46.4 L83.2 42.7 Q84.4 41.3 87 41.1 L98.6 38.3 Q100.2 38.3 100.3 39.5 L100.3 42.7 L88 44.7 Q85.6 45.1 84.6 46.8 Z" fill={C.hair} />
                  <path d="M72.4 71.4 Q79.5 73.4 87 71.4 Q85.6 76.2 79.5 76.4 Q74 76.2 72.4 71.4 Z" fill={C.smile} />
                  <path d="M75.4 75 Q79.5 76.4 84 75" stroke={C.smileHi} strokeWidth="0.9" fill="none" strokeLinecap="round" />
                  <path d="M76.4 77.6 Q80 75.8 83.4 77.6 L82.6 80.4 L77.2 80.4 Z" fill={C.hair} />
                </g>

                <g ref={exSerious} display="none">
                  <g ref={eyesSerious}>
                    <Eyes top={48.6} slant={2.5} />
                  </g>
                  <path d="M55 44.8 Q55.2 41.4 59.2 40 Q63 39.6 67 41 L76.4 44.8 L77.4 50.2 L74 48.6 Q71 46.8 66.6 46.2 L58 45.6 Z" fill={C.hair} />
                  <path d="M82.4 50.2 L83 46.4 Q84.2 44.8 86.8 44.2 L98.6 39.8 Q100.2 39.8 100.3 41 L100.3 44.6 L88 48.2 Q85.4 48.8 84.4 50.6 Z" fill={C.hair} />
                  <path d="M72.5 72 L86.5 72 L86 73.8 Q79.5 74.6 73 73.8 Z" fill={C.lip} />
                  <path d="M72.2 72.2 L86.8 72.2" stroke={C.lipLine} strokeWidth="1.1" strokeLinecap="round" />
                  <path d="M76.4 77 Q80 74.6 83.4 77 L82.6 80.4 L77.2 80.4 Z" fill={C.hair} />
                </g>

                <g ref={exSurprised} display="none">
                  <g ref={eyesSurprised}>
                    <WideEye x0={57} x1={73.2} top={46.2} bot={59.4} pc={65.4} r={3.3} />
                    <WideEye x0={85.8} x1={96.8} top={46.6} bot={59.2} pc={91.5} r={2.8} />
                  </g>
                  <path d="M56 44.6 Q59.6 39.4 66 39 Q72.6 39 76.2 42 L75.8 44.8 Q71.6 42.4 66 42.6 Q61 42.8 57.6 46 Z" fill={C.hair} />
                  <path d="M83.4 45.4 Q86.6 40.4 92 40 Q97.6 39.8 100.3 42 L100.3 44.6 Q97 43 92.2 43.2 Q87.8 43.6 85.2 46.6 Z" fill={C.hair} />
                  <ellipse cx="79.5" cy="75.2" rx="5.6" ry="3.8" fill={C.mouth} />
                  <path d="M75.4 72.6 Q79.5 71 83.6 72.6 L83.2 73.9 Q79.5 72.9 75.8 73.9 Z" fill={C.teeth} />
                  <path d="M76.4 77.6 Q79.5 75.8 82.6 77.6 Q79.5 79 76.4 77.6 Z" fill={C.tongue} />
                  <path d="M77.4 79.6 Q79.8 78.8 82 79.6 L81.7 80.8 L77.7 80.8 Z" fill={C.hair} />
                </g>

                <g ref={exAngry} display="none">
                  <g ref={eyesAngry}>
                    <Eyes top={48.6} slant={3.5} />
                  </g>
                  <path d="M55 43.2 Q55.4 40.2 59 39.6 L68 42.2 L77 46.6 L77.6 51.6 L73.6 49.8 L66.4 47 L57.6 45.4 Z" fill={C.hair} />
                  <path d="M82.4 51.6 L82.6 48.2 Q83.8 46.4 86.6 45.6 L99 40.4 L100.3 41.2 L100.3 45 L87.6 49.8 Q85.2 50.6 84.2 52 Z" fill={C.hair} />
                  <path d="M72.5 74 Q79.5 70.6 86.5 74 L86.5 75.4 Q79.5 72.8 72.5 75.4 Z" fill={C.mouth} />
                  <path d="M74 73.6 Q79.5 71.6 85 73.6" stroke={C.teeth} strokeWidth="0.9" fill="none" />
                  <path d="M76.4 77.4 Q80 75.4 83.4 77.4 L82.6 80.4 L77.2 80.4 Z" fill={C.hair} />
                </g>

                {/* ---------- beanie + headset band (wobbles a little on its own) ---------- */}
                <g ref={beanie}>
                  <path d="M20 40 Q16.5 21 27 10 Q40 -1.4 55 -1.2 Q73 -0.8 85.6 3.4 Q95.2 7 97.8 13.6 L99 18 L99 27 L32 37 Z" fill={C.crown} stroke={C.ol} strokeWidth={OL} />
                  <path d="M29 12.6 Q40 2.4 55 1.4 L56.4 6.4 Q44 7.4 33.4 15 Z" fill={C.crownHi} />
                  <path d="M60 1.8 Q76 2 86 6.4 L83.4 11 Q73.6 8.2 61 7.8 Z" fill={C.crownHi} opacity="0.5" />
                  <path d="M87.6 5.2 Q94.8 8 97 13.4 L98.2 17.4 L94 16.6 Q92 11.8 86 8.6 Z" fill={C.crownSh} />
                  {/* cool rim light down the far side of the crown (the sheet's grey edge) */}
                  <path d="M89.4 5.6 Q95.2 8.6 97 13.6" stroke={C.crownRim} strokeWidth="0.9" fill="none" opacity="0.7" strokeLinecap="round" />
                  <path d="M21 38 Q18 22 26 11 L29.4 13 Q23.4 23 26.6 38 Z" fill={C.crownSh} />
                  <path d="M28.6 11.4 Q40.6 0.4 55 0.2 Q72.6 0.6 85.4 4.6" stroke={C.crownRim} strokeWidth="1" fill="none" opacity="0.6" strokeLinecap="round" />
                  {/* the chunky folded cuff */}
                  <path d={CUFF_D} fill={C.cuff} stroke={C.ol} strokeWidth={OL} />
                  <path d={CUFF_RIDGE} fill={C.cuffHi} opacity="0.8" />
                  <path d={CUFF_FOOT} fill={C.cuffUnder} />
                  <path d="M28.6 27 Q30.4 25.6 36 25.5 L42 25.1 L42 44.6 Q39.4 44.8 39 45 Q32 45 30.6 38.4 Z" fill={C.cuffEnd} />
                  <path d={RIB_SEAMS} stroke={C.cuffSh} strokeWidth="1.1" fill="none" opacity="0.75" />
                  <path d={RIB_LIGHTS} stroke={C.cuffHi} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.25" />
                  <path d={BOUCLE} fill={C.cuffHi} opacity="0.3" />
                  <path d="M98.4 17.6 Q102 18.8 103.1 22.8 L103.4 33.6 Q103.2 36.8 100.6 37.8" stroke={C.cuffSh} strokeWidth="2" fill="none" />
                  <path d="M99.4 16.9 Q103.2 18.4 104 22.8 L104.1 33" stroke={C.crownRim} strokeWidth="0.8" fill="none" opacity="0.6" strokeLinecap="round" />
                  <rect x="83.6" y="21.4" width="7.4" height="4.8" rx="0.7" fill={C.sheen} stroke={C.ol} strokeWidth="0.8" transform="rotate(-6 87.3 23.8)" />
                  {/* headset band over the beanie, with the yoke above the cup */}
                  <path d={BAND_D} stroke={C.ol} strokeWidth="4.8" fill="none" strokeLinecap="round" />
                  <path d={BAND_D} stroke={C.bandFill} strokeWidth="2.8" fill="none" strokeLinecap="round" />
                  <path d="M33.2 32 L33.6 26 Q34.4 12 43 6.4 Q53 2.8 64 2.4" stroke={C.gear} strokeWidth="0.8" fill="none" opacity="0.8" />
                  <rect x="19.6" y="30.5" width="14" height="9.5" rx="1.5" fill={C.bandFill} stroke={C.ol} strokeWidth="1.1" />
                  <path d="M21.8 32.2 L21.8 38.4 M31.2 32.2 L31.2 38.4" stroke={C.band} strokeWidth="0.9" />
                  <path d="M20.8 31.6 L32.4 31.6" stroke={C.gear} strokeWidth="0.7" opacity="0.7" />
                </g>

                {/* near ear cup: octagonal plate over a cushion, subtle oval recess + bright bevel */}
                <g transform="translate(2.8 0)">
                  <path d="M29 41 L35.8 41.4 Q38.5 42.4 38.5 46 L38.5 62.6 Q38.4 66.2 35.8 66.8 L29 67 Z" fill={C.cupRim} stroke={C.ol} strokeWidth={OL} />
                  <path d="M35.6 45.4 L37.2 45.8 L37.2 55 L35.6 55 Z" fill={C.cupHi} />
                  <path d="M19 39.2 L29.4 38.4 L34.4 43.6 L34.6 63.4 L29.6 69 L20.2 69.4 L14.6 64.2 L14.2 45 Z" fill={C.cup} stroke={C.ol} strokeWidth={OL} />
                  <path d="M19.8 42 L28.4 41.4 L31.8 45.4 L32 62.4 L28.6 66.4 L20.8 66.8 L17 63 L16.8 46.2 Z" fill={C.cupFace} />
                  <path d="M15.6 45.4 L19.4 40.6 L28.8 39.8" stroke={C.gear} strokeWidth="1" fill="none" opacity="0.7" />
                  <path d="M15 63.8 L20.4 68.4 L29.2 68 L33.8 63" stroke={C.cupRim} strokeWidth="1.2" fill="none" />
                  <ellipse cx="22.3" cy="53.8" rx="3" ry="5" fill={C.cupRecess} />
                  <path d="M24.6 50 Q25.8 53.8 24.6 57.6" stroke={C.cupHi} strokeWidth="1" fill="none" />
                  <rect x="31.8" y="46.6" width="3.6" height="5" rx="0.6" fill={C.bevel} />
                </g>

                {/* mic boom along the jaw to the goatee's corner, dull red ring near the cup */}
                <path d="M29.6 69.4 Q33.4 76.6 43.6 78.9 Q52.4 80.8 60.6 81" stroke={C.ol} strokeWidth="3.8" fill="none" strokeLinecap="round" />
                <path d="M29.6 69.4 Q33.4 76.6 43.6 78.9 Q52.4 80.8 60.6 81" stroke={C.mic} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M30.4 72.6 L33 71.4" stroke={C.micRing} strokeWidth="2.6" />
                <rect x="60.2" y="78.4" width="7.2" height="5.2" rx="2.4" fill="#1A1D26" stroke={C.ol} strokeWidth="1" />
                <rect x="61.6" y="79.5" width="2.6" height="1.3" rx="0.6" fill={C.cupHi} />
              </g>

              {/* ===== profile head (walk / run / skate), facing right ===== */}
              <g ref={headP} display="none">
                <path d="M40 62 L64 62 L66 78 Q60 82.6 50 82 L41 79 Z" fill={C.neckSh} />
                {/* bushy curly hair behind and under the ear cup (the sheet's side views): a wide lumpy mass
                    flush with the back of the beanie, bulging past the cup and ending on the hood at ~v76 */}
                <path
                  d="M24.8 45 Q22.2 47.2 22.6 50.6 Q19.8 53.2 21 56.8 Q19.2 60.4 20.9 63.6 Q20 67.6 22.8 69.8 Q22.6 73.6 26 74.8 Q27.6 77.6 31.2 76.6 Q33.6 78.8 36.8 77.2 Q39.8 79.2 43 77.2 Q46.4 78.8 49.4 76.6 Q52.6 77.4 55 75.6 L58 70 L58 50 L44 44 Z"
                  fill={C.hair}
                  stroke={C.ol}
                  strokeWidth="0.9"
                />
                {/* a few soft lighter clumps (no curl marks) and the shadow the cup casts on the hair */}
                <path d="M23.6 50.8 Q25.6 48.8 28.2 49.8 Q26.8 52.4 27.4 55.2 Q24.8 55.8 23.4 54.8 Q22.6 52.8 23.6 50.8 Z" fill={C.curl} />
                <path d="M22.8 60.8 Q25 59 27.4 60.4 Q26.4 63.4 27.6 65.8 Q25 66.8 23.4 65.2 Q22.2 63 22.8 60.8 Z" fill={C.curl} opacity="0.85" />
                <path d="M27.8 70.6 Q30 69.4 32 71 Q31.4 73.4 32.4 74.8 Q30 75.6 28.4 74.4 Q27.2 72.6 27.8 70.6 Z" fill={C.curl} opacity="0.75" />
                <path d="M31.4 48 L35 48 L35 72 Q34 76 30.6 75.4 Q32.6 70 31.4 62 Z" fill={C.ol} opacity="0.35" />
                <path
                  d="M60 36 L106 34 L106.4 50 Q106.6 54.4 108.4 57 Q112.8 59.4 114 62.6 Q114.6 65.8 111.8 67.2 Q109 68.2 106.4 67.4 L106.8 72 Q106.6 78 103 82 Q98 85.6 90 85.4 L80 84 Q70 81.6 64.6 76 Q61 72 60.6 66 Z"
                  fill={C.skin}
                  stroke={C.warmOl}
                  strokeWidth={WOL}
                />
                <path d={UNDER_CUFF_P} fill={C.foreheadSh} />
                <path d="M63 47 L67 46.6 L67.8 74 Q64.4 71 63.4 66 Z" fill={C.skinSh} />
                <path d="M66 72 Q70 79 78 82 L77.6 79.6 Q71.6 77 68.4 72 Z" fill={C.jawSh} />
                <path d="M63 45 L69 44.4 L69.4 62 Q66.6 64.2 63.4 62.6 Z" fill={C.hair} />
                {/* nose bulb light + underside */}
                <path d="M109.6 58.6 Q112.2 60 113 62.4" stroke={C.skinHi} strokeWidth="1.3" fill="none" strokeLinecap="round" />
                <path d="M107 66.8 Q110.4 67.8 112.8 66" stroke={C.skinSh2} strokeWidth="1.1" fill="none" strokeLinecap="round" />
                <path d="M107.6 64.4 Q108.8 65.6 110.4 65.4" stroke={C.skinSh2} strokeWidth="1" fill="none" strokeLinecap="round" />
                {/* eye: iris at the front, heavy lid */}
                <g ref={eyesP}>
                  <path d="M89.4 53.6 Q93 50.8 100.8 51.8 L100.6 58.6 Q97.6 60 93.4 59.6 Q89.6 58.4 89.4 53.6 Z" fill={C.eyeW} />
                  <rect x="94.4" y="51.6" width="6.2" height="8" rx="3" fill={C.iris} />
                  <rect x="95.2" y="55.8" width="4.6" height="3.4" rx="1.7" fill={C.irisHi} opacity="0.6" />
                  <circle cx="97.8" cy="55.6" r="2.1" fill={C.pupil} />
                  <circle cx="96.4" cy="54" r="0.95" fill="#fff" />
                  <path d="M88.2 54.8 Q91.8 49 101.6 50.4 L101.4 52.4 Q93.6 51.6 89.8 55.4 Z" fill={C.hair} />
                </g>
                <g ref={browP}>
                  <path d="M85.4 49.4 Q85.8 45 90.8 44.4 L101.4 45 Q105.4 45.6 106.2 48.8 L106 51.4 L101.2 49.8 L90.6 49.4 Q88 49.6 86.6 51.6 Z" fill={C.hair} />
                </g>
                <g ref={browPSerious} display="none">
                  <path d="M85.4 48.2 Q85.8 44 90.4 43.8 L101 46.2 Q105 47.6 106.2 51 L106 53.6 L101 51.6 L90.6 49 Q88 48.8 86.6 50.8 Z" fill={C.hair} />
                </g>
                {/* beard in profile */}
                <path
                  d="M96.4 80 L96.4 71.4 Q97.2 67.6 101.2 67.2 L106.8 67.2 Q109.4 67.4 109.2 69.6 L108.6 71.8 Q104.8 70.8 101.8 71.4 Q99.6 72 99.4 74 L99.4 80 Z"
                  fill={C.hair}
                />
                <path d="M101.6 72.4 Q104.8 71.8 107.8 72.8 L107.2 74.4 Q104.4 75.2 101.8 74.4 Z" fill={C.lip} />
                <path d="M102.2 75.8 Q104.6 75 106.6 76 L106 78.8 L102.8 78.8 Z" fill={C.hair} />
                <path
                  d="M94.4 80.8 Q94.8 78.8 97.4 78.6 L105.6 78.4 Q107.8 78.6 107.6 81.2 L106.8 85 Q105.2 88.4 100.8 88.6 L99.6 88.6 L99 87.4 L98 88.7 L96.4 88.5 Q94.6 88 94.4 85.2 Z"
                  fill={C.hair}
                />
                <path d="M70.4 79.2 Q80.4 85 94.6 84.2 L94.6 88.6 Q82.4 89.8 71.2 83.2 Z" fill={C.hair} opacity="0.92" />

                <g ref={beanieP}>
                  <path d="M22 46 Q15 24 27 10 Q41 -2 62 -1.4 Q84 -1 99 7 Q108 12.6 109.4 22 L109.4 30 L34 42 Z" fill={C.crown} stroke={C.ol} strokeWidth={OL} />
                  <path d="M30 12 Q42 2.6 60 1.4 L61 6.4 Q45 7.4 34 15 Z" fill={C.crownHi} />
                  <path d="M64 1.8 Q82 2.2 95 8.2 L91.6 12.6 Q80 8.2 65 7.8 Z" fill={C.crownHi} opacity="0.5" />
                  <path d="M23.6 44 Q18 24 27.6 11.6 L31 13.6 Q23 24.6 27.6 44 Z" fill={C.crownSh} />
                  <path d="M95 6 Q106 11 108.4 18 L109.4 24 L102 21 Q99.4 13.6 92.4 10 Z" fill={C.crownSh} />
                  <path d="M29.6 11.4 Q42 0.4 62 0.2 Q83 0.6 97.4 7.8" stroke={C.crownRim} strokeWidth="1" fill="none" opacity="0.6" strokeLinecap="round" />
                  <path
                    d="M24 34 Q24.6 30.2 29.4 29.6 L104.4 17.4 Q111 16.8 111.4 22.4 L111.4 37.4 Q111.2 42 106.8 42.4 L34 50.8 Q27.6 51.2 26.4 46.2 Z"
                    fill={C.cuff}
                    stroke={C.ol}
                    strokeWidth={OL}
                  />
                  <path d={CUFF_RIDGE_P} fill={C.cuffHi} opacity="0.8" />
                  <path d={CUFF_FOOT_P} fill={C.cuffUnder} />
                  <path d={RIB_SEAMS_P} stroke={C.cuffSh} strokeWidth="1.1" fill="none" opacity="0.75" />
                  <path d={RIB_LIGHTS_P} stroke={C.cuffHi} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.25" />
                  <path d={BOUCLE_P} fill={C.cuffHi} opacity="0.3" />
                  <path d="M106.6 19.4 Q110 20 110.2 23.4 L110.2 36.8 Q110 40.2 107 40.8" stroke={C.cuffSh} strokeWidth="2" fill="none" />
                  <rect x="94.4" y="23.4" width="7.4" height="4.8" rx="0.7" fill={C.sheen} stroke={C.ol} strokeWidth="0.8" transform="rotate(-9 98.1 25.8)" />
                  {/* band over the top, down to the round cup */}
                  <path d="M49 42 L48.6 24 Q48.8 7 58.6 -0.6" stroke={C.ol} strokeWidth="5.4" fill="none" strokeLinecap="round" />
                  <path d="M49 42 L48.6 24 Q48.8 7 58.6 -0.6" stroke={C.bandFill} strokeWidth="3.2" fill="none" strokeLinecap="round" />
                  <path d="M50.4 34 L50 24 Q50.2 9 58.4 1.8" stroke={C.gear} strokeWidth="0.8" fill="none" opacity="0.8" />
                  <path d="M49.4 12.4 L49.8 16.6" stroke={C.tag} strokeWidth="1.8" />
                  <rect x="43.4" y="35.4" width="11.2" height="7.2" rx="1.4" fill={C.bandFill} stroke={C.ol} strokeWidth="1.1" />
                </g>
                {/* round-ish octagon cup seen face-on, centred on the side of the head */}
                <path d="M41 40 L57 40 L64 47 L64 67 L57 74 L41 74 L34 67 L34 47 Z" fill={C.cup} stroke={C.ol} strokeWidth={OL} />
                <path d="M42.4 43.2 L55.6 43.2 L60.8 48.4 L60.8 65.6 L55.6 70.8 L42.4 70.8 L37.2 65.6 L37.2 48.4 Z" fill={C.cupFace} />
                <path d="M35 66.6 L41.4 73 L56.6 73 L63 66.6" stroke={C.cupRim} strokeWidth="1.2" fill="none" />
                <circle cx="49" cy="57" r="6" fill={C.cupRecess} stroke={C.cupHi} strokeWidth="1" />
                <circle cx="49" cy="57" r="2.4" fill={C.cup} />
                <path d="M57.6 41.6 L62.8 46.8 L61.6 48 L56.4 42.8 Z" fill={C.bevel} />
                <path d="M35.4 47.4 L41.4 41.4" stroke={C.gear} strokeWidth="1" opacity="0.7" />
                {/* mic */}
                <path d="M60.6 70 Q63.6 78.6 72 81.6 Q80 84 88.6 83.4" stroke={C.ol} strokeWidth="3.8" fill="none" strokeLinecap="round" />
                <path d="M60.6 70 Q63.6 78.6 72 81.6 Q80 84 88.6 83.4" stroke={C.mic} strokeWidth="1.8" fill="none" strokeLinecap="round" />
                <path d="M61.2 72.8 L63.2 75.4" stroke={C.micRing} strokeWidth="3" />
                <rect x="86" y="80.8" width="7.4" height="5.2" rx="2.4" fill="#1A1D26" stroke={C.ol} strokeWidth="1" />
              </g>
            </g>

            {/* ---------- near arm (in front) ---------- */}
            <g ref={armN}>
              <circle cx={ELBOW_N[0]} cy={ELBOW_N[1]} r="12.6" fill={C.jacket} stroke={C.ol} strokeWidth={OL} />
              {/* (the shoulder drops steeply from the collar, then slopes out to the elbow, like the sheet) */}
              <path d="M23.4 91.6 Q24.6 87.3 30 87.2 Q35.6 87.4 37.2 95 L37.6 117 L12.2 117 Q14 105.4 19.6 99 Q22.6 95.6 23.4 91.6 Z" fill={C.jacket} stroke={C.ol} strokeWidth={OL} />
              <path d="M24.4 92.2 Q25.8 88.8 29.2 88.5 Q25.6 94 22.6 100 Q19.6 107 18.6 116 L13.4 116 Q15 105.8 20.4 99.8 Q23.2 96.4 24.4 92.2 Z" fill={C.jacketHi} />
              <path d="M33.8 90 Q36.4 91.8 36.6 95 L36.8 116 L33.6 116 Z" fill={C.jacketSh} />
              <path d="M21.6 101.5 q4 1.6 8 -0.4 M18.5 108 q3 1.2 6 0" stroke={C.jacketSh} strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <g ref={foreN}>
                <path d="M12.2 108 L37.6 108 L37.8 123 L12 123 Z" fill={C.jacket} />
                <path d="M13.4 108 L19 108 L19 123 L13 123 Z" fill={C.jacketHi} />
                <path d="M33.6 108 L36.9 108 L37 123 L33.6 123 Z" fill={C.jacketSh} />
                <path d="M21.5 116.5 q4.5 1.6 9 -0.2" stroke={C.jacketSh} strokeWidth="1.2" fill="none" strokeLinecap="round" />
                <path d="M12.2 108.5 L12 123 M37.6 108.5 L37.8 123" stroke={C.ol} strokeWidth={OL} />
                <rect x="9.6" y="121" width="30.2" height="10" rx="1.6" fill={C.jacket} stroke={C.ol} strokeWidth={OL} />
                <path d="M10.8 122.8 L38.6 122.8" stroke={C.jacketHi} strokeWidth="1.4" />
                <path d="M10.8 129.2 L38.6 129.2" stroke={C.jacketSh} strokeWidth="1.6" />
                <g ref={bellN} opacity="0">
                  <rect x="4" y="136" width="39.6" height="4" rx="1.5" fill={C.bell} stroke={C.ol} strokeWidth="1" />
                  <rect x="-2" y="129" width="8" height="18" rx="2" fill={C.plate} stroke={C.ol} strokeWidth="1.1" />
                  <rect x="41.6" y="129" width="8" height="18" rx="2" fill={C.plate} stroke={C.ol} strokeWidth="1.1" />
                </g>
                <path d="M13.4 130 L34 130 L37 133 L37 143 L34 146.5 L14 146.5 L10.6 143 L10.6 133 Z" fill={C.skin} stroke={C.warmOl} strokeWidth={WOL} />
                <path d="M11 133.2 L19.5 131.2 L19.5 145.8 L14.2 146 L11 142.8 Z" fill={C.fistSide} />
                <path d="M11.8 143.4 L35.8 143.4 L33.6 145.6 L14.2 145.6 Z" fill={C.skinSh2} />
                <path d="M28.6 136 L33 136 L31.8 138.4 L33 141 L29 141 Z" fill={C.skinDeep} />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
});

/**
 * Chunky boot like the sheet's BOOT DETAIL: a tall shaded ankle block at the heel that runs up under the
 * trouser cuff, and in front of it a separate, LOWER toe box: the instep drops in a shaded step to the toe
 * box's lit top plane, whose front corner is bevelled down to the toe; all on a thick sole with a lit lip.
 * h = heel x, t = toe x (the sole rect is fixed for the ground-contact maths).
 */
function Boot({ h, t, far = false }: { h: number; t: number; far?: boolean }) {
  // silhouette: ankle top under the cuff, a step down in front of the ankle, flat toe-box top, bevel, toe
  const out =
    `M${f2(h + 1)} 163.5 L${f2(t - 10.6)} 163.5 Q${f2(t - 9)} 163.6 ${f2(t - 8.4)} 165.2 L${f2(t - 8)} 166.8 ` +
    `L${f2(t - 5)} 166.8 Q${f2(t - 4)} 166.8 ${f2(t - 3.3)} 167.6 L${f2(t - 0.5)} 170.4 Q${f2(t)} 170.9 ${f2(t)} 171.8 ` +
    `L${f2(t)} 177.2 L${f2(h)} 177.2 L${f2(h)} 167 Z`;
  const sx = h - 1; // sole
  const sw = t - h + 1.5;
  return (
    <>
      <path d={out} fill={C.boot} stroke={C.ol} strokeWidth={OL} />
      {/* ankle block (shaded) */}
      <path d={`M${f2(h + 1.2)} 164.4 L${f2(h + 10.6)} 164.4 Q${f2(h + 9.6)} 170 ${f2(h + 10)} 176.4 L${f2(h + 1.2)} 176.4 Z`} fill={C.bootDark} />
      {/* instep in shadow between the cuff and the toe box */}
      <path d={`M${f2(h + 10.4)} 164.4 L${f2(t - 9.4)} 164.4 L${f2(t - 8.6)} 167.2 L${f2(h + 13.4)} 168 Q${f2(h + 11.2)} 168.2 ${f2(h + 10.8)} 169.6 Z`} fill={C.bootDark} opacity="0.85" />
      {/* the toe box: lit top plane with a rim light along its top edge and round the bevel */}
      <path
        d={`M${f2(h + 11)} 169.8 Q${f2(h + 11.4)} 168.2 ${f2(h + 13.6)} 168 L${f2(t - 5.4)} 167.6 L${f2(t - 1.2)} 171.4 Q${f2(t - 12)} 171 ${f2(h + 11.2)} 171.8 Z`}
        fill={C.bootTop}
      />
      <path
        d={`M${f2(h + 12.4)} 168.1 L${f2(t - 5.5)} 167.7 L${f2(t - 1.1)} 171.5 L${f2(t - 0.9)} 174.4`}
        stroke={C.toeRim}
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* the toe box's back edge against the ankle */}
      <path d={`M${f2(h + 10.9)} 169.6 Q${f2(h + 10.2)} 172.8 ${f2(h + 10.8)} 176.2`} stroke={C.ol} strokeWidth="0.8" fill="none" opacity="0.7" />
      <path d={`M${f2(h + 12)} 173.4 L${f2(t - 1.6)} 173.4`} stroke={C.bootDark} strokeWidth="0.8" opacity="0.6" />
      <rect x={f2(sx)} y="176" width={f2(sw)} height="4.2" rx="1.2" fill={C.sole} stroke={C.ol} strokeWidth="1" />
      <path d={`M${f2(sx + 1.2)} 176.9 L${f2(sx + sw - 1)} 176.9`} stroke={C.soleLip} strokeWidth="0.9" />
      {far && <path data-far="" d={out} fill={C.farShade} opacity="0" />}
    </>
  );
}

/**
 * One open eye: almond white with an arched upper lid, big dark-brown iris, pupil, catch-lights.
 * `slant` lowers the lid at the inner corner (toward the nose) for the stern faces.
 */
function Eye({
  x0,
  x1,
  top,
  bot,
  ix,
  iw,
  slant = 0,
  inner,
}: {
  x0: number;
  x1: number;
  top: number;
  bot: number;
  ix: number;
  iw: number;
  slant?: number;
  inner: "left" | "right";
}) {
  const w = x1 - x0;
  const mid = (x0 + x1) / 2;
  const ax = x0 + 0.4 * w;
  const pc = ix + iw / 2;
  const cy = top + (bot - top) * 0.54;
  // the lid line runs from the outer corner (kept at ~top) to the inner corner (lowered by `slant`)
  const [xo, xi] = inner === "right" ? [x0 - 1.4, x1 + 1.2] : [x1 + 1.4, x0 - 1.2];
  const yo = top + 0.3;
  const yi = top + slant + 0.9;
  return (
    <>
      <path
        d={`M${f2(x0)} ${f2(top + 1.6)} Q${f2(ax)} ${f2(top - 1.4)} ${f2(x1)} ${f2(top + 1.2)} L${f2(x1 - 0.4)} ${f2(bot - 2.6)} Q${f2(x1 - 1.4)} ${f2(bot)} ${f2(mid + 2.6)} ${f2(bot)} L${f2(mid - 2.6)} ${f2(bot)} Q${f2(x0 + 0.8)} ${f2(bot)} ${f2(x0 + 0.2)} ${f2(bot - 2.8)} Z`}
        fill={C.eyeW}
      />
      <rect x={f2(ix)} y={f2(top - 0.3)} width={f2(iw)} height={f2(bot - top)} rx={f2(iw / 2 - 0.2)} fill={C.iris} />
      <rect x={f2(ix + 0.7)} y={f2(cy + 0.6)} width={f2(iw - 1.4)} height={f2(bot - cy - 1.1)} rx={f2(iw / 2 - 0.9)} fill={C.irisHi} opacity="0.6" />
      <circle cx={f2(pc)} cy={f2(cy)} r={f2(iw * 0.34)} fill={C.pupil} />
      <circle cx={f2(pc - iw * 0.2)} cy={f2(cy - 1.8)} r={f2(iw * 0.14)} fill="#fff" />
      <circle cx={f2(pc + iw * 0.24)} cy={f2(cy + 2)} r="0.55" fill="#fff" opacity="0.8" />
      {slant > 0 ? (
        <>
          {/* skin lid pulled down toward the nose, then a heavy straight lash line */}
          <path d={`M${f2(xo)} ${f2(top - 3.6)} L${f2(xi)} ${f2(top - 3.6)} L${f2(xi)} ${f2(yi)} L${f2(xo)} ${f2(yo)} Z`} fill={C.skin} />
          <path d={`M${f2(xo)} ${f2(yo + 0.9)} L${f2(xi)} ${f2(yi + 0.7)} L${f2(xi)} ${f2(yi - 1.3)} L${f2(xo)} ${f2(yo - 1.2)} Z`} fill={C.hair} />
        </>
      ) : (
        <path
          d={`M${f2(x0 - 1.3)} ${f2(top + 2.2)} Q${f2(ax)} ${f2(top - 4)} ${f2(x1 + 1)} ${f2(top + 1)} L${f2(x1 - 0.5)} ${f2(top + 1.7)} Q${f2(ax)} ${f2(top - 0.9)} ${f2(x0 + 0.6)} ${f2(top + 2)} Z`}
          fill={C.hair}
        />
      )}
    </>
  );
}

/** Surprised eye: opened into a round oval, the iris floating in white, a lash line on top and a faint lower lid. */
function WideEye({ x0, x1, top, bot, pc, r }: { x0: number; x1: number; top: number; bot: number; pc: number; r: number }) {
  // a rounded oval (vertical tangents at the corners, so no pointed lemon ends), a touch fuller on top
  const cy = (top + bot) / 2 + 0.3;
  const w = x1 - x0;
  const ht = cy - top;
  const hb = bot - cy;
  const up = `M${f2(x0)} ${f2(cy)} C${f2(x0)} ${f2(cy - ht * 0.58)} ${f2(x0 + w * 0.2)} ${f2(top)} ${f2(x0 + w * 0.48)} ${f2(top)} C${f2(x1 - w * 0.18)} ${f2(top)} ${f2(x1)} ${f2(cy - ht * 0.6)} ${f2(x1)} ${f2(cy)}`;
  const low = `C${f2(x1)} ${f2(cy + hb * 0.6)} ${f2(x1 - w * 0.2)} ${f2(bot)} ${f2(x0 + w * 0.5)} ${f2(bot)} C${f2(x0 + w * 0.2)} ${f2(bot)} ${f2(x0)} ${f2(cy + hb * 0.6)} ${f2(x0)} ${f2(cy)}`;
  const ic = cy;
  return (
    <>
      <path d={`${up} ${low} Z`} fill={C.eyeW} />
      <circle cx={f2(pc)} cy={f2(ic)} r={f2(r)} fill={C.iris} />
      <circle cx={f2(pc + 0.2)} cy={f2(ic + r * 0.35)} r={f2(r * 0.62)} fill={C.irisHi} opacity="0.5" />
      <circle cx={f2(pc)} cy={f2(ic)} r={f2(r * 0.56)} fill={C.pupil} />
      <circle cx={f2(pc - r * 0.38)} cy={f2(ic - r * 0.42)} r={f2(r * 0.3)} fill="#fff" />
      <path d={up} stroke={C.hair} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path
        d={`M${f2(x1)} ${f2(cy)} ${low}`}
        stroke={C.lipLine}
        strokeWidth="0.7"
        fill="none"
        opacity="0.55"
        strokeLinecap="round"
      />
    </>
  );
}

/** The pair of open eyes: near eye full width, far eye a little narrower (it is turned away). */
function Eyes({ top, slant = 0 }: { top: number; slant?: number }) {
  const bot = 57.4;
  return (
    <>
      <Eye x0={57.2} x1={72.8} top={top} bot={bot} ix={62.2} iw={8.4} slant={slant} inner="right" />
      <Eye x0={86} x1={96.4} top={top} bot={bot} ix={88.2} iw={6.4} slant={slant} inner="left" />
    </>
  );
}
