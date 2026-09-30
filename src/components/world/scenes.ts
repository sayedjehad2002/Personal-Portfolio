import type { CharacterState } from "@/components/character/Character";
import type { ChapterId } from "@/data/resume";

/**
 * Geometry of each backdrop, in fractions of the source image (0..1), measured
 * on the cleaned 1600px plates in /public/scenes. The engine scales every
 * scene to cover the viewport, anchored to the bottom edge, so these fractions
 * hold at any screen size.
 */
export type SceneDef = {
  id: ChapterId;
  src: string;
  alt: string;
  w: number;
  h: number;
  /** y where boots rest while walking through this scene */
  feet: number;
  /** x where the character stops during this level's hold */
  stand: number;
  /** y that must stay on screen near the bottom when a very wide screen crops the art (defaults to feet) */
  keep?: number;
  /** y where boots rest at the stand spot (defaults to feet) */
  standFeet?: number;
  /** x the camera centres on during the hold */
  focus: number;
  /** snowfall intensity while in this scene */
  snow: number;
  /** pose while standing still in the hold */
  pose: CharacterState;
  /** how many reveal steps the hold has (each costs `stepScreens` of scroll) */
  steps: number;
  /** scroll length of one step, in viewport heights */
  stepScreens: number;
  /** how this scene joins the next one */
  joinNext?: "blend" | "door" | "blizzard";
};

export const SCENES: SceneDef[] = [
  {
    id: "base-camp",
    src: "/scenes/base-camp.webp",
    alt: "Snowy base camp with a wooden sign reading Sayed Jehad World, pine trees and a frozen lake",
    w: 1600,
    h: 905,
    feet: 752 / 905,
    stand: 0.5,
    focus: 0.5,
    snow: 1,
    pose: "wave",
    steps: 2,
    stepScreens: 0.55,
    joinNext: "blend",
  },
  {
    id: "bahrain",
    src: "/scenes/bahrain.webp",
    alt: "Snow-covered Manama skyline with the Bahrain World Trade Center towers across the water",
    w: 1600,
    h: 900,
    feet: 748 / 900,
    stand: 0.5,
    focus: 0.5,
    snow: 0.75,
    pose: "idle",
    steps: 6,
    stepScreens: 0.5,
    joinNext: "door",
  },
  {
    id: "gym",
    src: "/scenes/gym.webp",
    alt: "Gym with a No Excuses window, a loaded barbell, and posters reading Discipline Builds Freedom and Better Than Yesterday",
    w: 1600,
    h: 870,
    feet: 706 / 870,
    stand: 0.5,
    focus: 0.5,
    snow: 0,
    pose: "lift",
    steps: 4,
    stepScreens: 0.6,
    joinNext: "door",
  },
  {
    id: "ai-lab",
    src: "/scenes/ai-lab.webp",
    alt: "Office with a Bahrain flag, a laptop, a window onto the World Trade Center, and a large whiteboard",
    w: 1600,
    h: 898,
    feet: 765 / 898,
    stand: 0.4,
    focus: 0.52,
    snow: 0,
    pose: "point",
    steps: 4,
    stepScreens: 0.6,
    joinNext: "blizzard",
  },
  {
    id: "summit",
    src: "/scenes/summit.webp",
    alt: "Snowy mountain peak with a wooden sign reading I Reached the Top of the Ice Mountain",
    w: 1600,
    h: 777,
    feet: 1, // no walkable floor at the edges: the climb is scripted
    keep: 0.8,
    stand: 0.6375,
    standFeet: 0.612,
    focus: 0.55,
    snow: 1.15,
    pose: "flag",
    steps: 2,
    stepScreens: 0.6,
  },
];

/** Character height as a fraction of the viewport height. */
export const CHAR_VH = 0.25;
