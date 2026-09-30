import { GENERATED_PROPS } from "./props.generated";

/**
 * Art registry for the world. Props are standalone SVGs in /public/props
 * (drawn to match Sayed's scene art), tiles are seamless strips cut from the
 * scene art itself in /public/tiles.
 * `aspect` = width / height of the SVG viewBox; `sink` = fraction of the
 * height that sits below the ground line (e.g. snow drifts).
 */
export type PropMeta = { src: string; aspect: number; sink?: number };

export const PROPS: Record<string, PropMeta> = {
  ...GENERATED_PROPS,
  ...(GENERATED_PROPS["snow-drift"] ? { "snow-drift": { ...GENERATED_PROPS["snow-drift"], sink: 0.34 } } : {}),
  // the Bahrain heritage trail (drawn 30 Sep 2026)
  "qalat-al-bahrain": { src: "/props/heritage/qalat-al-bahrain.svg", aspect: 640 / 267 },
  "arad-fort": { src: "/props/heritage/arad-fort.svg", aspect: 393 / 193 },
  "tree-of-life": { src: "/props/heritage/tree-of-life.svg", aspect: 480 / 320 },
  "big-flag-pole": { src: "/props/heritage/big-flag-pole.svg", aspect: 64 / 576 },
};

type Tile = {
  src: string;
  w: number;
  h: number;
  /** height of the source plate the tile was cut from (sets the scale: rendered at vh / srcH) */
  srcH: number;
  /** y of the walkable surface inside the tile, in source pixels */
  surfaceY: number;
  fallback: string;
};

type Wall = { src: string; w: number; h: number; srcH: number; floorY: number; fallback: string };

export const TILES = {
  sky: "linear-gradient(180deg, #1897ec 0%, #25a8f2 38%, #5cc2f7 66%, #a9defb 88%, #d8f1ff 100%)",
  // from Base Camp (y 752..905) and Manama (y 746..900)
  groundIce: { src: "/tiles/ground-ice.webp", w: 486, h: 153, srcH: 905, surfaceY: 2, fallback: "#3c4f7a" } satisfies Tile,
  groundIceCity: { src: "/tiles/ground-ice-city.webp", w: 459, h: 154, srcH: 900, surfaceY: 2, fallback: "#3c4f7a" } satisfies Tile,
  // gym floor from y 694 (wall/floor junction); boots stand at 708
  groundGym: { src: "/tiles/ground-gym.webp", w: 616, h: 176, srcH: 870, surfaceY: 14, fallback: "#1f2633" } satisfies Tile,
  // office floor from the baseboard at y 725; boots stand at 766
  groundOffice: { src: "/tiles/ground-office.webp", w: 216, h: 173, srcH: 898, surfaceY: 41, fallback: "#606687" } satisfies Tile,
  // glossy sea ice for skating the frozen Gulf: 640x150 tile rendered 0.2vh tall, walkable rim at y=6
  groundGulf: { src: "/tiles/frozen-gulf.svg", w: 640, h: 150, srcH: 750, surfaceY: 6, fallback: "linear-gradient(180deg, #ffffff 0 3px, #bfe9ff 3px, #7fd0f9 30%, #3fa8e8 70%, #1b6fb3)" } satisfies Tile,
  wallGym: { src: "/tiles/wall-gym.webp", w: 320, h: 694, srcH: 870, floorY: 694, fallback: "#2b3446" } satisfies Wall,
  wallOffice: { src: "/tiles/wall-office.webp", w: 480, h: 725, srcH: 898, floorY: 725, fallback: "#7a7890" } satisfies Wall,
  farMountains: { src: "/tiles/far-mountains.svg" },
  farSkyline: { src: "/tiles/far-skyline.svg" },
  midHills: { src: "/tiles/mid-hills.svg" },
  frozenSea: { src: "/tiles/frozen-sea.svg" },
  // the summit sign redrawn as a vector (crisp at any size); sits in front of the player so he walks behind it
  summitSign: { src: "/scenes/lettering/summit-sign.svg" },
};
