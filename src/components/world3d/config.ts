import type { Solid } from "./solids";
// written by blender/scripts/level_*.py together with the .glb of each realm
import desert from "../../../public/world/desert.json";
import aqua from "../../../public/world/aqua.json";
import snow from "../../../public/world/snow.json";
import magma from "../../../public/world/magma.json";

/**
 * World 2: one continuous walk through four realms (Desert, Aqua, Snow, Magma), x = 0 to WORLD_END.
 * Units are Blender units (he is about 1.9 tall); the scroll maps 1:1 onto x.
 */

// Camera: 8.1 world units fit top to bottom at the walk plane, on any screen.
export const VIEW_H = 8.1;
export const CAM_DIST = 20;
export const CAM_Y = 1.3;
/** the frame's centre sits this fraction of its height above the camera axis (Blender's lens shift) */
export const SHIFT = 0.1867;
export const FOV = (2 * Math.atan(VIEW_H / 2 / CAM_DIST) * 180) / Math.PI;
/** world height at the top edge of the screen when the camera is at its base height */
export const TOP_Z = CAM_Y + SHIFT * VIEW_H + VIEW_H / 2;
/** his fixed place across the screen */
export const PLAYER_AT = 0.46;
export const CHAR_SCALE = 1.15;
export const CHAR_H = 1.63 * CHAR_SCALE;
/** the 2D physics (physics.ts) runs in centimetres with y pointing down, like the pixel world it was written for */
export const CM = 100;

/** Narrow screens (phones held upright) see more of the world's height, so there is room to look ahead. */
export function viewHFor(vw: number, vh: number) {
  const aspect = vw / Math.max(1, vh);
  return aspect >= 1.3 ? VIEW_H : Math.min(13, VIEW_H * Math.pow(1.3 / aspect, 0.75));
}
export const playerAtFor = (vw: number, vh: number) => (vw / Math.max(1, vh) >= 1.3 ? PLAYER_AT : 0.42);

/** What his feet are on at x (for footstep sounds). */
export function surfaceAt(x: number): "sand" | "ice" | "snow" | "stone" | "scale" {
  return x < 123.2 ? "sand" : x < 142 ? "ice" : x < 191 ? "snow" : x < 226 ? "stone" : x < 265.2 ? "scale" : "stone";
}

export type RealmId = "desert" | "aqua" | "snow" | "magma";
export type Mode = "swim" | "skate" | "ride" | "climb";
export type Zone = { mode: Mode; x0: number; x1: number; hover?: number; ease_in?: number; ease_out?: number };

export const LEVELS = { desert, aqua, snow, magma };
export const WORLD_END: number = magma.life.end;
/** extra scroll after the summit: he stays at the top while the camera pulls back over the whole walk */
export const EPILOGUE = 12;

/** Sky gradient (bottom to top of the screen), light and outfit of each realm. Colours come from blender/scripts/look_*.py. */
export const REALMS = [
  {
    id: "desert" as RealmId,
    label: "Desert",
    x0: desert.x0,
    x1: desert.x1,
    sky: "linear-gradient(to top, #F6DDB6 0%, #FCE9C8 31%, #F9D7AC 46%, #D3DCE2 68%, #8DB7DB 100%)",
    accent: "#B9772F",
    sun: { color: "#FFE2B8", power: 2.6, at: [24.8, 20, 20] },
    hemi: { sky: "#C6D6EC", ground: "#B79A6F", power: 2.67 },
    layers: ["Pack", "Desert"],
    steps: "#D2A96F",
    dust: "#F6E0B6",
  },
  {
    id: "aqua" as RealmId,
    label: "Aqua",
    x0: aqua.x0,
    x1: aqua.x1,
    sky: "linear-gradient(to top, #0C4660 0%, #147590 31%, #1F9FB2 58%, #62D2D2 83%, #C4F5EC 100%)",
    accent: "#0F7F8C",
    sun: { color: "#F2FFFA", power: 2.1, at: [-3, 40, 10] },
    hemi: { sky: "#BFEFF0", ground: "#6FC3C0", power: 2.3 },
    layers: ["Aqua", "Aqua_glow"],
    steps: "#6FB3A8",
    dust: "#E9FFFB",
  },
  {
    id: "snow" as RealmId,
    label: "Snow",
    x0: snow.x0,
    x1: snow.x1,
    sky: "linear-gradient(to top, #C9CFEA 0%, #DCCFE6 31%, #A8B5E3 44%, #596DB6 65%, #232B63 100%)",
    accent: "#3F5BB5",
    sun: { color: "#D5E3FF", power: 2.1, at: [-20, 25, 22] },
    hemi: { sky: "#7088CC", ground: "#8FA0D0", power: 2.98 },
    layers: ["Pack"],
    steps: "#C3D2EE",
    dust: "#FFFFFF",
  },
  {
    id: "magma" as RealmId,
    label: "Magma",
    x0: magma.x0,
    x1: magma.x1,
    sky: "linear-gradient(to top, #F08A3A 0%, #E0662A 31%, #93302A 44%, #3E1728 64%, #140B1B 100%)",
    accent: "#C2401E",
    sun: { color: "#FF9552", power: 2.7, at: [22, 13.6, 25] },
    hemi: { sky: "#5A3A5C", ground: "#6A3226", power: 3.0 },
    layers: ["Pack", "Magma", "Magma_glow"],
    steps: "#FF8A3C",
    dust: "#FFB04A",
  },
];

const smooth = (t: number) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

/**
 * How much of each realm's sky and light applies: realms cross-fade as he passes from one to the next.
 * The sea is different: its look takes over as the camera sinks below the surface (`under`, 0..1) and lets go as
 * it rises again, so the change happens at the water line, not at a place on the map. Above water the desert sky
 * turns into the snow sky far out over the Gulf, where he cannot see it happen.
 */
export function realmWeights(x: number, under: number, out: number[]) {
  const s = smooth((x - 84) / 22);
  const m = smooth((x - 195) / 9);
  const land = 1 - under;
  out[0] = (1 - s) * land;
  out[1] = under;
  out[2] = s * (1 - m) * land;
  out[3] = m * land;
  return out;
}

/** What he does when he stands still for a moment, by where he is. */
export function gestureAt(x: number): "wave" | "lift" | "point" | null {
  return x < 32 ? "wave" : x > 143 && x < 167 ? "lift" : x > 168 && x < 189.5 ? "point" : null;
}

/** Which realm's outfit he wears at x. */
export function outfitAt(x: number): number {
  return x < 64.3 ? 0 : x < 123.2 ? 1 : x < 203.6 ? 2 : 3;
}

type RawSolid = { x0: number; x1: number; y0: number; y1: number; kind: string };
const raw: RawSolid[] = [...desert.solids, ...aqua.solids, ...snow.solids, ...magma.solids];
/** Every surface he can stand on, in physics units (cm, y down). */
export const SOLIDS: Solid[] = raw.map((s) => ({ x0: s.x0 * CM, x1: s.x1 * CM, y0: -s.y0 * CM, y1: -s.y1 * CM, kind: s.kind === "ground" ? "ground" : "platform" }));
/** The dragon's back rises and falls as it breathes: index into SOLIDS plus the resting heights (units). */
export const BREATHING = raw.map((s, i) => ({ i, y0: s.y0, y1: s.y1, on: s.kind === "breath" })).filter((s) => s.on);

const camPts: number[][] = [...desert.cam, ...aqua.cam, ...snow.cam, ...magma.cam].sort((a, b) => a[0] - b[0]);
/** How far the camera sits above (or below) its base height at x: it sinks under the sea, lifts on the ride and the climb. */
export function camOffset(x: number) {
  if (x <= camPts[0][0]) return camPts[0][1];
  for (let i = 1; i < camPts.length; i++) {
    if (x <= camPts[i][0]) {
      const [x0, y0] = camPts[i - 1];
      const [x1, y1] = camPts[i];
      return y0 + (y1 - y0) * smooth((x - x0) / (x1 - x0));
    }
  }
  return camPts[camPts.length - 1][1];
}

export const ZONES: Zone[] = [...(desert.zones as Zone[]), ...(aqua.zones as Zone[]), ...(snow.zones as Zone[]), ...(magma.zones as Zone[])];
export const zoneAt = (x: number, mode: Mode) => ZONES.find((z) => z.mode === mode && x >= z.x0 && x < z.x1);

export const ANCHORS = REALMS.flatMap((r) => LEVELS[r.id].anchors.map((a) => ({ id: a.id, x: a.x, realm: r.id })));
export const TITLES = REALMS.flatMap((r) => LEVELS[r.id].titles.map((t) => ({ text: t.text, x: t.x, realm: r.id })));
export { smooth };
