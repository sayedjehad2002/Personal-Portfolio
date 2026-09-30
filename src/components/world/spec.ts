import type { CharacterState } from "@/components/character/Character";
import { certificates, roles } from "@/data/resume";

/**
 * The whole world, Robby-Leonardi style. Scroll distance `s` maps 1:1 onto a
 * camera path with three phases, like his horizontal → vertical corner turn:
 *   1. walk   (0 .. H):        camera moves right, the player walks/skates/jumps
 *   2. ride   (H .. H+D):      the player rides a cable car up the Ice Mountain;
 *                              the camera climbs the diagonal cable with him
 *   3. arrive (H+D .. maxS):   he steps off at the top and walks to the peak
 * World coordinates: x grows right, y grows down, and y equals the screen y
 * while the camera is at y = 0 (the whole ground-level world). The mountain
 * top lives at negative y. Sizes derive from the viewport height `u`.
 */

export type Theme = "forest" | "waterfront" | "gulf" | "gym" | "office" | "yard" | "ride" | "sky";

export type Zone = {
  kind: "scene" | "corridor";
  theme: Theme;
  level: number; // 0-based level index this zone belongs to
  x0: number;
  x1: number;
  /** walkable surface (world y) for flat zones */
  ground: number;
};

export type SceneImg = {
  id: string;
  src: string;
  alt: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** soft-fade the left / right edge into the world (outdoor scenes): true = 0.2u wide, a number = its width in u */
  fade: { l: boolean | number; r: boolean | number };
  /** fractions of the art's width trimmed off the left / right edge (x, w stay the full art's box) */
  crop?: { l: number; r: number };
};

/** A walkable top surface from (x0, y0) to (x1, y1); flat when y0 === y1. */
export type Solid = { x0: number; x1: number; y0: number; y1: number; kind: "ground" | "platform" | "rock" };

export type Placement = {
  name: string;
  x: number; // centre x
  ground: number; // world y the prop stands on (bottom edge)
  h: number; // rendered height px
  w?: number; // explicit width (else from the art's aspect)
  flip?: boolean;
  layer?: "back" | "front";
  /** ambient animation */
  fx?: "sway" | "bob" | "glow" | "servers" | "holo" | "flag";
  /** something he can stand on: squashes and bounces when he lands on it or pushes off */
  platform?: boolean;
  /** text painted on a blank sign in the art: box = [x0, y0, x1, y1] as fractions of the art */
  label?: { text: string; box: [number, number, number, number]; tone: "neon" | "wood" };
};

export type Anchor = { x: number; ground: number };

export type Bubble = { x0: number; x1: number; text: string; side?: "left" | "right"; /** height above the feet in charH (default 1.08: over the head) */ dy?: number };

/** Wildlife and moving kit: flamingos and bulbuls fly off, the hare hops away, the bag swings, fish swim under the ice. */
export type Critter = {
  kind: "flamingo" | "bulbul" | "hare" | "camel" | "bag" | "fish" | "fish2" | "oyster";
  x: number;
  /** world y of the feet (for the bag: its hang point) */
  ground: number;
  h: number;
  flip?: boolean;
  aspect?: number;
};

/** A section title planted in the world like Robby's giant letters: icy letters outdoors, a neon sign indoors. */
export type Title = { x: number; ground: number; h: number; text: string; tone: "ice" | "neon" };

export type Ride = {
  /** scroll offsets of the phase boundaries */
  H: number;
  D: number;
  maxS: number;
  /** cabin floor at the valley station (d = 0) and at the top station (d = D) */
  bx: number;
  by: number;
  tx: number;
  ty: number;
  cos: number;
  sin: number;
  /** cable height above the cabin floor */
  grip: number;
  /** screen y of the cabin floor while cruising */
  cruiseFeet: number;
  /** world y of the summit art's top edge (camera y during the arrival walk) */
  Sy: number;
  /** clouds you pass through (d range) */
  cloud: { d0: number; d1: number };
  pylons: { x: number; base: number; top: number }[];
  slope: [number, number][];
};

export type World = {
  vw: number;
  vh: number;
  u: number;
  cx: number; // player's fixed screen x
  charH: number;
  unit: number; // px per character viewBox unit
  zones: Zone[];
  scenes: SceneImg[];
  solids: Solid[];
  props: Placement[];
  doors: { x: number; w: number; floorY: number; kind: "gym" | "lab" | "lift" }[];
  pillars: { x: number; floorY: number; kind: "gym" | "office" }[];
  anchors: Record<string, Anchor>;
  bubbles: Bubble[];
  titles: Title[];
  critters: Critter[];
  ride: Ride;
  /** scroll offset where each level starts (HUD checkpoints) and where each HUD jump lands */
  levelStarts: number[];
  levelJumps: number[];
  worldX0: number;
  worldX1: number;
  idlePose: (x: number) => CharacterState;
  summitSign: { x: number; y: number; w: number; h: number };
  gulf: { x0: number; x1: number };
};

// Source art sizes and the measured walk lines (fractions of the image height).
const ART = {
  base: { src: "/scenes/base-camp.webp", w: 1600, h: 905, feet: 752 / 905 },
  bahrain: { src: "/scenes/bahrain.webp", w: 1600, h: 900, feet: 748 / 900 },
  gym: { src: "/scenes/gym.webp", w: 1600, h: 870, feet: 708 / 870 },
  lab: { src: "/scenes/ai-lab.webp", w: 1600, h: 898, feet: 766 / 898 },
  summit: { src: "/scenes/summit.webp", w: 1600, h: 777, feet: 469 / 777 },
} as const;

// The outdoor paintings with their painted sky and clouds cut out (public/scenes/open, made by scripts/cut-sky.mjs),
// so the world's one sky, drifting clouds and far mountains run on behind them: no seam where a painting starts.
const OPEN: Partial<Record<keyof typeof ART, string>> = {
  base: "/scenes/open/base-camp.webp",
  bahrain: "/scenes/open/bahrain.webp",
  summit: "/scenes/open/summit.webp",
};

const ALT: Record<keyof typeof ART, string> = {
  base: "Snowy base camp with a wooden sign reading Sayed Jehad World, pine trees and a frozen lake",
  bahrain: "Snow-covered Manama skyline with the Bahrain World Trade Center towers across the water",
  gym: "Gym with a No Excuses window, a loaded barbell, and posters reading Discipline Builds Freedom and Better Than Yesterday",
  lab: "Office with a Bahrain flag, a laptop, a window onto the World Trade Center, and a large whiteboard",
  summit: "Snowy mountain peak with a wooden sign reading I Reached the Top of the Ice Mountain",
};

/** Cable-car geometry in character units (the cabin art is drawn at the character's scale). */
export const CABIN = { w: 320, h: 430, floor: 400, gripY: 14 };
const THETA = (38 * Math.PI) / 180;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export function buildWorld(vw: number, vh: number): World {
  const u = vh;
  const charH = Math.round(vh * 0.25);
  const unit = charH / 180;
  const cx = Math.round(vw * 0.46);

  const zones: Zone[] = [];
  const scenes: SceneImg[] = [];
  const solids: Solid[] = [];
  const props: Placement[] = [];
  const anchors: Record<string, Anchor> = {};
  const bubbles: Bubble[] = [];
  const titles: Title[] = [];
  const critters: Critter[] = [];
  const doors: World["doors"] = [];
  const pillars: World["pillars"] = [];
  const levelGates: number[] = [];

  const scale = (k: keyof typeof ART) => vh / ART[k].h;
  const sceneW = (k: keyof typeof ART) => ART[k].w * scale(k);
  const groundOf = (k: keyof typeof ART) => ART[k].feet * vh;

  let x = 0;
  const addScene = (k: keyof typeof ART, level: number, theme: Theme, fade: SceneImg["fade"], crop = { l: 0, r: 0 }) => {
    const w = sceneW(k);
    const vis = w * (1 - crop.l - crop.r);
    scenes.push({ id: k, src: OPEN[k] ?? ART[k].src, alt: ALT[k], x: x - crop.l * w, y: 0, w, h: vh, fade, crop });
    const z: Zone = { kind: "scene", theme, level, x0: x, x1: x + vis, ground: groundOf(k) };
    zones.push(z);
    x += vis;
    return z;
  };
  const addCorridor = (theme: Theme, level: number, len: number, ground: number) => {
    const z: Zone = { kind: "corridor", theme, level, x0: x, x1: x + len, ground };
    zones.push(z);
    x += len;
    return z;
  };
  const AUTO_FX: Record<string, Placement["fx"]> = {
    "palm-snow": "sway",
    "palm-snow-2": "sway",
    "pine-tall": "sway",
    "pine-small": "sway",
    dhow: "bob",
    "lamp-post": "glow",
    "fanoos-lamp": "glow",
    "server-rack": "servers",
    "holo-screen": "holo",
  };
  const prop = (name: string, px: number, ground: number, hU: number, extra: Partial<Placement> = {}) =>
    props.push({ name, x: px, ground, h: hU * u, fx: AUTO_FX[name], ...extra });
  const flat = (x0: number, x1: number, y: number, kind: Solid["kind"] = "platform") => solids.push({ x0, x1, y0: y, y1: y, kind });

  const OUT = groundOf("base");
  const GYM = groundOf("gym");
  const LAB = groundOf("lab");

  // ================= Level 1: Base Camp =================
  const baseW = sceneW("base");
  x = cx - 0.5 * baseW;
  const pre = { x0: x - vw * 1.2, x1: x };
  zones.push({ kind: "corridor", theme: "forest", level: 0, x0: pre.x0, x1: pre.x1, ground: OUT });
  // a short left fade: at the start that edge is at the screen's left edge (a wide one would ghost the painted pines);
  // on ultra-wide screens a real pine stands in front of it
  const base = addScene("base", 0, "forest", { l: 0.06, r: true });
  prop("pine-tall", base.x0 - 0.1 * u, OUT, 0.6, { layer: "back" });
  anchors.start = { x: base.x0 + 0.5 * baseW, ground: OUT };
  bubbles.push({ x0: pre.x0, x1: base.x0 + baseW * 0.62, text: "Hey, I’m Sayed, AI System Developer at Lumofy, from Bahrain. This is my interactive resume!", dy: 0.6 }); // beside his shoulder, clear of the start sign above

  const T1 = 1.3 * u; // room for the title
  const forest = addCorridor("forest", 0, 3.9 * u + T1, OUT);
  prop("pine-cluster", forest.x0 + 0.02 * u, OUT, 0.62);
  titles.push({ x: forest.x0 + 0.34 * u, ground: OUT, h: 0.15 * u, text: "ABOUT ME", tone: "ice" });
  const fx0 = forest.x0 + T1;
  prop("rock-cliff", fx0 + 0.34 * u, OUT, 0.44, { layer: "back" });
  anchors.player = { x: fx0 + 0.62 * u, ground: OUT };
  prop("snow-drift", fx0 + 0.95 * u, OUT, 0.08);
  prop("lamp-post", fx0 + 1.12 * u, OUT, 0.42);
  prop("wood-fence", fx0 + 1.34 * u, OUT, 0.15, { layer: "back" });
  prop("wood-fence", fx0 + 1.62 * u, OUT, 0.15, { layer: "back" });
  anchors.about = { x: fx0 + 1.55 * u, ground: OUT };
  prop("pine-tall", fx0 + 1.98 * u, OUT, 0.58, { layer: "back" });
  prop("snow-rock", fx0 + 2.18 * u, OUT, 0.13);
  anchors.stats = { x: fx0 + 2.25 * u, ground: OUT };
  // a snowy rock ledge to hop onto (walkable top 12% below the art's top edge), with the snowman on it
  const ledge = { x: fx0 + 3.25 * u, h: 0.16 * u, w: 0.16 * u * 2.2 };
  const ledgeTop = OUT - ledge.h * 0.88;
  prop("snow-ledge", ledge.x, OUT, ledge.h / u, { w: ledge.w, platform: true });
  flat(ledge.x - ledge.w * 0.44, ledge.x + ledge.w * 0.44, ledgeTop);
  prop("snowman", ledge.x + ledge.w * 0.5 + 0.1 * u, OUT, 0.2, { layer: "back" });
  critters.push({ kind: "hare", x: fx0 + 2.98 * u, ground: OUT, h: 0.09 * u });
  critters.push({ kind: "bulbul", x: fx0 + 1.3 * u, ground: OUT - 0.138 * u, h: 0.042 * u });
  critters.push({ kind: "bulbul", x: fx0 + 1.7 * u, ground: OUT - 0.138 * u, h: 0.038 * u, flip: true });
  prop("pine-tall", fx0 + 3.72 * u, OUT, 0.5, { layer: "back" });

  // ================= Level 2: Bahrain =================
  levelGates.push(forest.x1);
  const gate = addCorridor("waterfront", 1, 0.95 * u, OUT);
  prop("bab-al-bahrain", gate.x0 + 0.46 * u, OUT, 0.62, { layer: "back" });
  prop("palm-snow", gate.x0 + 0.05 * u, OUT, 0.55, { layer: "back" });
  prop("palm-snow-2", gate.x1 - 0.02 * u, OUT, 0.5, { layer: "back" });
  // the painting's own edges (a palm + signpost on the left, a palm + rock on the right, both cut in half by the
  // frame) are trimmed off; the sea and skyline fade into the world's, and real palms stand at both joins
  addScene("bahrain", 1, "waterfront", { l: true, r: true }, { l: 250 / 1600, r: 145 / 1600 });
  const manama = scenes[scenes.length - 1];
  bubbles.push({ x0: gate.x0 - 0.2 * u, x1: manama.x + manama.w * 0.55, text: "This is home: Bahrain." });

  // the Bahrain heritage trail: three historic places and the flag, between Manama and the frozen Gulf
  const trail = addCorridor("waterfront", 1, 6.9 * u, OUT);
  prop("palm-snow", trail.x0 + 0.02 * u, OUT, 0.52, { layer: "back" });
  titles.push({ x: trail.x0 + 0.3 * u, ground: OUT, h: 0.12 * u, text: "BAHRAIN HERITAGE", tone: "ice" });
  const sites = [
    { key: "qalat-al-bahrain", x: trail.x0 + 2.75 * u, h: 0.46 },
    { key: "arad-fort", x: trail.x0 + 4.15 * u, h: 0.42 },
    { key: "tree-of-life", x: trail.x0 + 5.35 * u, h: 0.5 },
  ];
  sites.forEach((st, k) => {
    prop(st.key, st.x, OUT + 0.004 * u, st.h, { layer: "back" });
    anchors[`heritage-${k}`] = { x: st.x, ground: OUT };
  });
  prop("palm-snow-2", trail.x0 + 3.52 * u, OUT, 0.42, { layer: "back" });
  prop("snow-rock", trail.x0 + 4.75 * u, OUT, 0.08);
  critters.push({ kind: "camel", x: trail.x0 + 6.0 * u, ground: OUT, h: 0.26 * u, flip: true });
  prop("big-flag-pole", trail.x0 + 6.55 * u, OUT, 0.74, { layer: "back", fx: "flag" });
  bubbles.push({ x0: trail.x0 + 1.95 * u, x1: trail.x0 + 2.4 * u, text: "Bahrain’s story starts here: Dilmun, forts and the Tree of Life." });
  bubbles.push({ x0: trail.x0 + 6.25 * u, x1: trail.x1, text: "Proud to be from Bahrain.", dy: 0.9 });

  const prom = addCorridor("waterfront", 1, 0.85 * u, OUT);
  prop("palm-snow", prom.x0 + 0.05 * u, OUT, 0.5, { layer: "back" });
  prop("fanoos-lamp", prom.x0 + 0.38 * u, OUT, 0.44);
  prop("bench-snow", prom.x0 + 0.62 * u, OUT, 0.14);
  prop("skate-sign", prom.x1 - 0.08 * u, OUT, 0.26);
  bubbles.push({ x0: prom.x0 + 0.1 * u, x1: prom.x1 + 0.5 * u, text: "The Gulf froze over. Let’s skate the road to Lumofy!" });

  // the frozen Gulf: he skates past education + every earlier role
  const stops = roles.length + 1;
  const G = 1.9 * u; // room for the title (and the flamingos)
  const gulf = addCorridor("gulf", 1, (0.75 + stops * 0.95) * u + G, OUT);
  const gx0 = gulf.x0 + G;
  titles.push({ x: gulf.x0 + 0.32 * u, ground: OUT, h: 0.13 * u, text: "ROAD TO LUMOFY", tone: "ice" });
  for (let k = 0; k < stops; k++) anchors[`stop-${k}`] = { x: gx0 + (0.72 + k * 0.95) * u, ground: OUT };
  [1.18, 1.32, 1.48].forEach((f, k) => critters.push({ kind: "flamingo", x: gx0 + f * u, ground: OUT + 0.004 * u, h: [0.2, 0.185, 0.21][k] * u, flip: k === 1 }));
  for (let k = 0; k < 7; k++)
    critters.push({ kind: k % 2 ? "fish2" : "fish", x: gulf.x0 + (0.9 + k * 1.05) * u, ground: OUT + (0.045 + (k % 3) * 0.028) * u, h: (k % 2 ? 0.036 : 0.05) * u, flip: k % 3 === 1 });
  prop("dhow", gx0 + 2.2 * u, OUT, 0.34, { layer: "back" });
  // pearl oysters frozen into the ice (Bahrain's pearling heritage): they open and show their pearl as he skates by
  [4.05, 5.8].forEach((f) => critters.push({ kind: "oyster", x: gx0 + f * u, ground: OUT + 0.006 * u, h: 0.075 * u }));
  prop("dhow", gx0 + 5.05 * u, OUT, 0.3, { layer: "back", flip: true });
  prop("snowman", gulf.x1 - 0.3 * u, OUT, 0.22);
  // shore banks hide the land/ice joins (art: walk line flat with the ground, join at x=94 of 192)
  prop("frozen-gulf-shore", gulf.x0 + 0.002667 * u, OUT + 0.178667 * u, 0.186667);
  prop("frozen-gulf-shore", gulf.x1 - 0.002667 * u, OUT + 0.178667 * u, 0.186667, { flip: true });
  // a snowy rock frozen into the ice, between two stops: skate up, jump it, land and glide on
  {
    const rx = gx0 + (0.72 + 2.5 * 0.95) * u;
    const rh = 0.1 * u;
    const rw = rh * 2.2;
    prop("snow-ledge", rx, OUT, rh / u, { w: rw, platform: true });
    flat(rx - rw * 0.44, rx + rw * 0.44, OUT - rh * 0.88);
  }

  const shore = addCorridor("waterfront", 1, 0.6 * u, OUT);
  prop("palm-snow-2", shore.x0 + 0.12 * u, OUT, 0.46, { layer: "back" });
  prop("bahrain-flag-pole", shore.x1 - 0.22 * u, OUT, 0.5, { layer: "back" });

  // ================= Level 3: Discipline Lab (gym) =================
  levelGates.push(shore.x1);
  const gymScene = addScene("gym", 2, "gym", { l: false, r: false });
  doors.push({ x: gymScene.x0, w: Math.max(170, 0.26 * u), floorY: Math.max(OUT, GYM), kind: "gym" });
  const gs = gymScene.x0;
  const gw = sceneW("gym");
  anchors["value-0"] = { x: gs + 0.135 * gw, ground: GYM };
  anchors["value-2"] = { x: gs + 0.5 * gw, ground: GYM };
  anchors["value-1"] = { x: gs + 0.865 * gw, ground: GYM };
  bubbles.push({ x0: gs + 0.02 * gw, x1: gs + 0.4 * gw, text: "My training arc: from HR to AI. The skills loadout is just ahead.", dy: 0.86 });

  const S = 1.15 * u; // room for the title
  const hall = addCorridor("gym", 2, 3.0 * u + S, GYM);
  pillars.push({ x: hall.x0, floorY: GYM, kind: "gym" });
  prop("locker-row", hall.x0 + 0.42 * u, GYM, 0.44, { layer: "back" });
  titles.push({ x: hall.x0 + 0.16 * u, ground: GYM - 0.5 * u, h: 0.12 * u, text: "SKILLS", tone: "neon" });
  critters.push({ kind: "bag", x: hall.x0 + 0.98 * u, ground: 0.12 * u, h: 0.56 * u });
  const hx0 = hall.x0 + S;
  anchors["skills-build"] = { x: hx0 + 0.62 * u, ground: GYM };
  // plyo boxes: jump up the steps, drop off the far side
  // art: 200 wide, heights 90 / 144 / 198, walkable top = top edge
  const box = { w: 0.2 * u, hs: [0.09, 0.144, 0.198].map((f) => f * u) };
  ["plyo-box-low", "plyo-box-mid", "plyo-box-high"].forEach((name, k) => {
    const bxk = hx0 + 1.12 * u + k * box.w;
    prop(name, bxk, GYM, box.hs[k] / u, { w: box.w, platform: true });
    flat(bxk - box.w / 2, bxk + box.w / 2, GYM - box.hs[k]);
  });
  prop("dumbbell-rack", hx0 + 0.98 * u, GYM, 0.2, { layer: "back" });
  anchors["skills-people"] = { x: hx0 + 2.2 * u, ground: GYM }; // clear of the high plyo box, so the board never meets his head
  prop("neon-sign-frame", hx0 + 1.3 * u, GYM - 0.52 * u, 0.12, { layer: "back", label: { text: "LEVEL UP", box: [0.13, 0.3, 0.88, 0.82], tone: "neon" } });
  prop("kettlebells", hx0 + 1.8 * u, GYM, 0.1);
  prop("trophy-cabinet", hx0 + 2.18 * u, GYM, 0.4, { layer: "back" });
  prop("squat-rack", hx0 + 2.6 * u, GYM, 0.46, { layer: "back" }); // stays inside the hall (0.71u wide), clear of the AI LAB door

  // ================= Level 4: AI Lab (office) =================
  levelGates.push(hall.x1);
  const lobby = addCorridor("office", 3, 1.25 * u, LAB);
  doors.push({ x: lobby.x0, w: Math.max(170, 0.26 * u), floorY: Math.max(GYM, LAB), kind: "lab" });
  anchors.role = { x: lobby.x0 + 0.72 * u, ground: LAB };
  prop("office-plant", lobby.x0 + 0.24 * u, LAB, 0.3, { layer: "back" });
  prop("office-window", lobby.x0 + 0.72 * u, LAB - 0.16 * u, 0.42, { layer: "back" });
  prop("office-desk", lobby.x0 + 0.98 * u, LAB, 0.26, { layer: "back" });
  prop("water-cooler", lobby.x1 - 0.14 * u, LAB, 0.3, { layer: "back" });

  const office = addScene("lab", 3, "office", { l: false, r: false });
  pillars.push({ x: office.x0, floorY: LAB, kind: "office" });
  const ow = sceneW("lab");
  anchors.whiteboard = { x: office.x0 + 0.482 * ow, ground: LAB };
  bubbles.push({
    x0: office.x0 + 0.1 * ow,
    x1: office.x0 + 0.55 * ow,
    text: "Welcome to my lab. 4 of my 5 live projects are on this board.",
  });

  const lab = addCorridor("office", 3, 2.55 * u, LAB);
  pillars.push({ x: lab.x0, floorY: LAB, kind: "office" });
  anchors.stack = { x: lab.x0 + 0.55 * u, ground: LAB };
  prop("server-rack", lab.x0 + 0.18 * u, LAB, 0.46, { layer: "back" });
  prop("server-rack", lab.x0 + 0.36 * u, LAB, 0.46, { layer: "back" });
  prop("holo-screen", lab.x0 + 1.48 * u, LAB, 0.44, { layer: "back" });
  prop("office-window", lab.x0 + 1.98 * u, LAB - 0.16 * u, 0.42, { layer: "back" });
  prop("bookshelf", lab.x0 + 2.34 * u, LAB, 0.42, { layer: "back" });

  // ================= Level 5: the lift and the summit =================
  levelGates.push(lab.x1);
  const yard = addCorridor("yard", 4, 1.35 * u, LAB);
  doors.push({ x: yard.x0, w: Math.max(170, 0.26 * u), floorY: LAB, kind: "lift" });
  prop("pine-small", yard.x0 + 0.34 * u, LAB, 0.3, { layer: "back" });
  const bx = yard.x1 - 0.2 * u; // cabin waits here, inside the valley station
  // valley station art (1040 x 650 character units): cabin waits at x 820, deck top at y 606
  {
    const sw0 = 1040 * unit;
    const left = bx - 820 * unit;
    prop("station-valley", left + sw0 / 2, LAB + (650 - 606) * unit, (650 * unit) / u, {
      layer: "back",
      w: sw0,
      label: { text: "ICE MOUNTAIN", box: [112 / 1040, 248 / 650, 448 / 1040, 308 / 650], tone: "wood" },
    });
  }
  anchors.lift = { x: bx - 0.35 * u, ground: LAB };
  bubbles.push({ x0: yard.x0 + 0.15 * u, x1: bx + 0.02 * u, text: "Last stretch: the lift to the top of the Ice Mountain!" });

  // ride geometry
  const by = LAB;
  const cos = Math.cos(THETA);
  const sin = Math.sin(THETA);
  const lead = 0.9 * u;
  const gap = 0.47 * u;
  const D = lead + certificates.length * gap + 0.8 * u;
  const tx = bx + D * cos;
  const ty = by - D * sin;
  const grip = (CABIN.floor - CABIN.gripY) * unit;
  const cruiseFeet = 0.72 * vh;

  // the summit art sits so the top station floor lands at 84% of its height and the
  // station (760 units wide, cabin docked at 206) ends just left of the summit sign
  const sw = sceneW("summit");
  const Sx = tx + (760 - 206) * unit + 0.02 * u - 0.215 * sw;
  const Sy = ty - 0.84 * vh;
  zones.push({ kind: "corridor", theme: "ride", level: 4, x0: bx, x1: tx, ground: by });
  bubbles.push({ x0: bx + 0.05 * u, x1: bx + lead * cos, text: "Hold on tight! Certificates earned on the way up." });

  // the mountainside under the cable: a steady slope, then it closes in under the
  // arriving cabin and flattens into the plateau the top station stands on
  const tan = Math.tan(THETA);
  const slopeRise = (px: number) => by - (px - (bx + 0.35 * u)) * tan;
  const plateau = ty + 40 * unit;
  const slope: [number, number][] = [
    [bx - 0.4 * u, by],
    [bx + 0.35 * u, by],
    [tx - 1.5 * u, slopeRise(tx - 1.5 * u)],
    [tx - 0.9 * u, ty + 0.9 * u * tan + 0.06 * u],
    [tx, plateau],
    [Sx + 0.45 * sw, plateau],
  ];
  const slopeAt = (px: number) => {
    for (let i = 0; i < slope.length - 1; i++) {
      const [x0, y0] = slope[i];
      const [x1, y1] = slope[i + 1];
      if (px >= x0 && px <= x1) return y0 + ((px - x0) / (x1 - x0)) * (y1 - y0);
    }
    return plateau;
  };
  // certificates are pennants planted in the snow below-right of the cable. Each one
  // sits, at the moment the cabin is level with it, in the free space right of the
  // cabin (top-left 0.62u right / 0.3u below the grip), so it drifts in from the upper
  // right and passes under the cabin without touching it (perpendicular gap > cabin).
  certificates.forEach((_, i) => {
    const d = lead + (i + 0.5) * gap;
    const gx = bx + d * cos;
    const gy = by - d * sin - grip;
    anchors[`cert-${i}`] = { x: gx + 0.62 * u, ground: gy + 0.3 * u };
  });
  const pylons = [0.33, 0.62, 0.88].map((f) => {
    const d = f * D;
    const px = bx + d * cos + 0.06 * u;
    const floorAt = by - (px - bx) * Math.tan(THETA);
    return { x: px, base: slopeAt(px), top: floorAt - grip };
  });
  // slope decoration: pines and snowy rocks the whole way up
  [0.08, 0.2, 0.34, 0.5, 0.64, 0.76].forEach((f, k) => {
    const px = bx + 0.6 * u + f * (tx - bx);
    prop(k % 2 ? "snow-rock" : "pine-small", px, slopeAt(px) + 0.012 * u, k % 2 ? 0.12 : 0.28, { layer: "back" });
  });

  const summitScene: SceneImg = { id: "summit", src: OPEN.summit ?? ART.summit.src, alt: ALT.summit, x: Sx, y: Sy, w: sw, h: vh, fade: { l: true, r: true } };
  scenes.push(summitScene);
  zones.push({ kind: "scene", theme: "sky", level: 4, x0: tx, x1: Sx + sw, ground: ty });
  x = Sx + sw;
  const sx = (f: number) => Sx + f * sw;
  const sy = (f: number) => Sy + f * vh;
  // top station art (760 x 580 character units): docked cabin at x 206, deck top at y 540
  const topLeft = tx - 206 * unit;
  prop("station-top", topLeft + (760 * unit) / 2, ty + (580 - 540) * unit, (580 * unit) / u, { layer: "back", w: 760 * unit });
  const standX = sx(0.6375);
  anchors.contact = { x: standX, ground: sy(0.611) }; // the end of the path: he plants the flag here
  // only once he is out from behind the sign (it ends at 0.529 of the painting), so the bubble never covers its words
  bubbles.push({ x0: sx(0.575), x1: Sx + sw + vw, text: "Made it! Let’s build something together.", side: "left" });
  const rock: [number, number][] = [
    [0.18, 0.83],
    [0.27, 0.775],
    [0.35, 0.765],
    [0.47, 0.76],
    [0.53, 0.728],
    [0.575, 0.651],
    [0.6, 0.611],
    [0.74, 0.611],
    [0.8, 0.68],
    [0.95, 0.85],
  ];
  const summitSign = { x: sx(364 / 1600), y: sy(270 / 777), w: (482 / 1600) * sw, h: (340 / 777) * vh };
  const tail = addCorridor("sky", 4, vw * 1.2, sy(0.85));

  // ================= solids =================
  // where a door joins two floors of different heights, a gentle ramp spans the doorway (no invisible step)
  const ramps = doors.flatMap((d) => {
    const l = zones.find((z) => Math.abs(z.x1 - d.x) < 1);
    const r = zones.find((z) => Math.abs(z.x0 - d.x) < 1);
    return l && r && Math.abs(l.ground - r.ground) > 1 ? [{ x: d.x, half: d.w / 2, y0: l.ground, y1: r.ground }] : [];
  });
  for (const z of zones) {
    if (z.theme === "ride" || z.theme === "sky") continue;
    let a0 = z.x0;
    let a1 = z.x1;
    for (const rp of ramps) {
      if (Math.abs(rp.x - z.x0) < 1) a0 += rp.half;
      if (Math.abs(rp.x - z.x1) < 1) a1 -= rp.half;
    }
    flat(a0, a1, z.ground, "ground");
  }
  for (const rp of ramps) solids.push({ x0: rp.x - rp.half, x1: rp.x + rp.half, y0: rp.y0, y1: rp.y1, kind: "ground" });
  const deckEnd = Math.max(sx(0.18), topLeft + 752 * unit);
  flat(topLeft + 8 * unit, deckEnd, ty, "platform"); // top station deck onto the rocks
  // the rock path starts where the deck ends, at the deck's height (it used to start 0.01 vh higher: a one-frame pop)
  const rockPts: [number, number][] = [[deckEnd, ty], ...rock.map(([fx, fy]): [number, number] => [sx(fx), sy(fy)]).filter(([px]) => px > deckEnd + 0.04 * u)];
  for (let i = 0; i < rockPts.length - 1; i++) {
    solids.push({ x0: rockPts[i][0], x1: rockPts[i + 1][0], y0: rockPts[i][1], y1: rockPts[i + 1][1], kind: "rock" });
  }
  flat(tail.x0, tail.x1, sy(0.85), "ground");

  // ================= scroll → camera =================
  const H = bx - cx;
  const Wk = standX - tx;
  const maxS = H + D + Wk;
  const levelStarts = [0, ...levelGates.map((g) => clamp(g - cx, 0, maxS))];
  // a HUD level jump lands just past the level's gate, far enough that the previous level's last board is fully
  // off-screen (a board half cut by the left edge looks broken); the skills loadout is the only one that reaches
  // that close to its gate (its width: boardW(0.95, 380, 720) x the tall-screen zoom in sections.tsx)
  const Zb = Math.min(1.6, Math.max(1, vh / 950));
  const lastBoardRight = [0, 0, anchors["skills-people"].x + (Math.max(380, Math.min(720, 0.95 * u)) * Zb) / 2 + 12];
  const levelJumps = [0, ...levelGates.slice(0, 3).map((g, i) => clamp(Math.max(g - cx + 0.35 * u, lastBoardRight[i]), 0, maxS)), maxS];

  const idlePose = (px: number): CharacterState => {
    if (px < base.x1) return "wave";
    if (px >= gymScene.x0 && px < hall.x1) return "lift";
    if (px >= office.x0 + 0.25 * ow && px < office.x1) return "point";
    if (px > bx + 4 && px < tx - 4) return "wave";
    if (px >= standX - 4) return "flag";
    return "idle";
  };

  return {
    vw,
    vh,
    u,
    cx,
    charH,
    unit,
    zones,
    scenes,
    solids: solids.sort((a, b) => a.x0 - b.x0),
    props,
    doors,
    pillars,
    anchors,
    bubbles,
    titles,
    critters,
    ride: { H, D, maxS, bx, by, tx, ty, cos, sin, grip, cruiseFeet, Sy, cloud: { d0: D * 0.42, d1: D * 0.62 }, pylons, slope },
    levelStarts,
    levelJumps,
    worldX0: pre.x0,
    worldX1: tail.x1,
    idlePose,
    summitSign,
    gulf: { x0: gulf.x0, x1: gulf.x1 },
  };
}

export type Cam = { camX: number; camY: number; x: number; phase: "walk" | "ride" | "arrive"; d: number };

/** Camera and player x for a scroll offset `s` (the heart of the corner turn). */
export function camAt(W: World, s: number): Cam {
  const R = W.ride;
  s = clamp(s, 0, R.maxS);
  if (s <= R.H) return { camX: s, camY: 0, x: s + W.cx, phase: "walk", d: 0 };
  if (s <= R.H + R.D) {
    const d = s - R.H;
    const fx = R.bx + d * R.cos;
    const fy = R.by - d * R.sin;
    // cabin floor rises from the ground line to the cruise height, then settles at the top station's height
    const ramp = 0.8 * W.u;
    let feet = R.by + (R.cruiseFeet - R.by) * ease(clamp(d / ramp, 0, 1));
    const end = 0.84 * W.vh;
    feet += (end - R.cruiseFeet) * ease(clamp((d - (R.D - ramp)) / ramp, 0, 1));
    return { camX: fx - W.cx, camY: fy - feet, x: fx, phase: "ride", d };
  }
  const w = s - R.H - R.D;
  return { camX: R.tx - W.cx + w, camY: R.Sy, x: R.tx + w, phase: "arrive", d: R.D };
}

/** Cabin floor position for a ride distance. */
export function cabinAt(W: World, d: number) {
  const R = W.ride;
  const dd = clamp(d, 0, R.D);
  return { x: R.bx + dd * R.cos, y: R.by - dd * R.sin };
}

/** Highest walkable surface at x that lies at or below `feet` (screen y grows downward). */
export function surfaceBelow(solids: Solid[], x: number, feet: number, tol = 2) {
  let best = Infinity;
  for (const s of solids) {
    if (x < s.x0 || x > s.x1) continue;
    const t = s.x1 > s.x0 ? (x - s.x0) / (s.x1 - s.x0) : 0;
    const y = s.y0 + (s.y1 - s.y0) * t;
    if (y >= feet - tol && y < best) best = y;
  }
  return best;
}

/** Highest surface at x that is reachable by a jump from `feet`. */
export function surfaceReachable(solids: Solid[], x: number, feet: number, maxUp: number) {
  let best = Infinity;
  for (const s of solids) {
    if (x < s.x0 || x > s.x1) continue;
    const t = s.x1 > s.x0 ? (x - s.x0) / (s.x1 - s.x0) : 0;
    const y = s.y0 + (s.y1 - s.y0) * t;
    if (y >= feet - maxUp && y < best) best = y;
  }
  return best;
}
