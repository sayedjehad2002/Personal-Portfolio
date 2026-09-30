import { surfaceBelow, surfaceReachable, type Solid } from "./spec";

/**
 * Tiny platformer body for the player. Horizontal position comes straight
 * from the scroll; vertical motion is real time-based physics, so jumps and
 * falls finish on their own like in Robby Leonardi's resume, even if the
 * visitor stops scrolling mid-air.
 *
 * He stands on his centre of mass: a short span either side of his centre has
 * to be over a surface, so he never ends up resting on one toe at a box's lip.
 *
 * Hops onto higher ground:
 *  - with room to spare (the scroll still has enough travel left to carry him
 *    onto the step), he spots it early, crouches (anticipation) and pushes off;
 *  - otherwise he walks up to it and hops the moment his front foot reaches
 *    the edge, if the scroll will still carry him onto it (a tiny nudge just
 *    leaves him standing at the foot of the step).
 * Because the smooth scroll keeps carrying him while airborne, a jump aims at
 * the highest surface across the stretch he will cover in the air, and a
 * falling body meeting a ledge just above its feet steps up onto it.
 */
export type Body = {
  y: number;
  vy: number;
  onGround: boolean;
  landedAt: number;
  /** seconds left in the pre-jump crouch (0 = not crouching) */
  crouch: number;
  /** set on the frame a crouch starts / the frame he leaves the ground */
  crouchedAt: number;
  jumpedAt: number;
  /** the current airtime is an automatic hop onto a step (snappier gravity than a free jump) */
  hop?: boolean;
};

export const CROUCH = 0.085;

export function createBody(y: number): Body {
  return { y, vy: 0, onGround: true, landedAt: -1, crouch: 0, crouchedAt: -1, jumpedAt: -1 };
}

/** Highest reachable surface anywhere between x0 and x1 (sampled). */
function highestAcross(solids: Solid[], x0: number, x1: number, feet: number, maxUp: number) {
  let best = Infinity;
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const y = surfaceReachable(solids, x0 + ((x1 - x0) * i) / n, feet, maxUp);
    if (y < best) best = y;
  }
  return best;
}

/**
 * One physics step.
 * @param remaining scroll travel still to come (px, signed; NaN when unknown): how far the current
 *   scroll will carry him, so a hop is only started early when it can actually reach the step.
 */
export function stepBody(
  b: Body,
  solids: Solid[],
  x: number,
  dx: number,
  dt: number,
  charH: number,
  time: number,
  floorLimit: number,
  remaining = Number.NaN,
) {
  const G = 9 * charH;
  // hops onto steps are quick and low; free jumps (↑, a click) keep the floatier arc
  const GH = 14 * charH;
  const stepUp = Math.max(4, charH * 0.07);
  const maxUp = charH * 1.05;
  const ledgeGrab = charH * 0.28;
  const foot = charH * 0.13;
  // his centre of mass: this much either side of his centre must be over a surface for him to stand on it
  const support = foot * 0.35;

  /** highest surface under his centre of mass at or below `feet` */
  const underFeet = (feet: number, tol: number) =>
    Math.min(surfaceBelow(solids, x - support, feet, tol), surfaceBelow(solids, x, feet, tol), surfaceBelow(solids, x + support, feet, tol));
  /**
   * The ground to stand on while walking: the surface under his centre when the ground around it is continuous
   * (a flat floor or a slope: on a slope the span's higher end would hold him in the air), and the higher one
   * when there is an edge inside his support span (a box lip: his centre of mass is still over the box).
   */
  const groundUnder = (feet: number, tol: number) => {
    const uc = surfaceBelow(solids, x, feet, tol);
    const us = Math.min(surfaceBelow(solids, x - support, feet, tol), surfaceBelow(solids, x + support, feet, tol));
    return Number.isFinite(uc) && Math.abs(us - uc) <= stepUp ? uc : Math.min(uc, us);
  };
  /**
   * Distance (0..span) ahead of his centre where the ground rises in one jump by more than a step (a box, a
   * ledge), or -1. A slope rises gradually and never counts, so he walks up it instead of hopping.
   */
  const edgeAhead = (dirn: number, from: number, span: number) => {
    let prev = surfaceReachable(solids, x + dirn * from, b.y, maxUp);
    for (let d = from + 3; d <= span; d += 3) {
      const y = surfaceReachable(solids, x + dirn * d, b.y, maxUp);
      if (prev - y > stepUp * 0.8 && y < b.y - stepUp) return d;
      prev = y;
    }
    return -1;
  };

  const jumpTo = (top: number) => {
    const rise = Math.max(stepUp, b.y - top);
    // just enough headroom for the boots to clear the lip, more for taller steps
    const h = rise + Math.min(charH * 0.26, charH * 0.08 + rise * 0.3);
    b.vy = -Math.sqrt(2 * GH * h);
    b.onGround = false;
    b.crouch = 0;
    b.jumpedAt = time;
    b.hop = true;
  };

  const dir = Math.sign(dx) || Math.sign(remaining) || 1;
  const left = Number.isFinite(remaining) && Math.sign(remaining) === dir ? Math.abs(remaining) : Number.isFinite(remaining) ? 0 : Infinity;
  // how far he will travel during a hop: the scroll still to come when known, else a guess from his speed
  const reach = Math.min(Number.isFinite(left) ? left : Math.abs(dx) * 34, charH * 1.6);

  if (b.onGround && b.crouch > 0) {
    // crouching: push off when it ends (or at once if the step is already at his front foot)
    b.crouch -= dt;
    const atFoot = edgeAhead(dir, 0, foot) >= 0;
    if (b.crouch <= 0 || atFoot) {
      const top = highestAcross(solids, x, x + dir * (foot + reach), b.y, maxUp);
      if (top < b.y - stepUp) jumpTo(top);
      else b.crouch = 0; // he turned back: no jump
    }
    if (b.crouch > 0) return b;
  }

  if (b.onGround) {
    // a step at his front foot: hop onto it now (lands with the front foot over the edge)
    const here = surfaceReachable(solids, x + dir * foot, b.y, maxUp);
    // where a real step (not a slope) starts, measured from his centre
    const gap = edgeAhead(dir, 0, foot);
    // (hop if the scroll brings his centre of mass over the step; otherwise he stops at its foot)
    if (gap >= 0 && left >= gap - support + 2) {
      jumpTo(Math.min(here, highestAcross(solids, x, x + dir * (foot + reach), b.y, maxUp)));
    } else {
      const under = groundUnder(b.y, stepUp);
      if (!Number.isFinite(under)) {
        b.onGround = false;
        b.vy = 0;
      } else if (under - b.y > stepUp * 2.5) {
        b.onGround = false; // walked off a ledge
        b.vy = 0;
      } else {
        b.y = under; // follow floors and slopes
      }
      // look ahead in the walking direction: if there is a step and the scroll will carry him onto it,
      // crouch now and push off early (anticipation)
      if (b.onGround && Math.abs(dx) > 0.2) {
        const look = charH * 0.32 + Math.min(Math.abs(dx) * 5 + Math.abs(dx / dt) * CROUCH, charH * 0.9);
        const edge = edgeAhead(dir, foot, look);
        if (edge >= 0 && left >= edge + foot) {
          b.crouch = CROUCH;
          b.crouchedAt = time;
        }
      }
    }
  }

  if (!b.onGround) {
    const prev = b.y;
    b.vy += (b.hop ? GH : G) * dt;
    b.y += b.vy * dt;
    if (b.vy >= 0) {
      // land on anything under either foot, or step up onto a ledge that is just above the feet
      const land = underFeet(prev - ledgeGrab, stepUp);
      if (b.y >= land) {
        b.y = land;
        b.vy = 0;
        b.onGround = true;
        b.landedAt = time;
        b.hop = false;
      }
    }
    // safety net: never fall out of the world
    if (b.y > floorLimit) {
      const land = surfaceBelow(solids, x, -1e6, 0);
      b.y = Number.isFinite(land) ? land : floorLimit;
      b.vy = 0;
      b.onGround = true;
      b.landedAt = time;
      b.hop = false;
    }
  }
  return b;
}
