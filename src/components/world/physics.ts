import { surfaceBelow, surfaceReachable, type Solid } from "./spec";

/**
 * Tiny platformer body for the player. Horizontal position comes straight
 * from the scroll; vertical motion is real time-based physics, so jumps and
 * falls finish on their own like in Robby Leonardi's resume, even if the
 * visitor stops scrolling mid-air.
 *
 * He stands on two feet (a small span either side of his centre): he stays on
 * a box until both feet are off it and lands if either foot is over it.
 *
 * Hops onto higher ground:
 *  - with room to spare (the scroll still has enough travel left to carry him
 *    onto the step), he spots it early, crouches (anticipation) and pushes off;
 *  - otherwise he walks up to it and hops the moment his front foot reaches
 *    the edge, so slow, notch-by-notch scrolling never makes him hop in place
 *    in front of a box and land short.
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
  const stepUp = Math.max(4, charH * 0.07);
  const maxUp = charH * 1.05;
  const clearance = charH * 0.3;
  const ledgeGrab = charH * 0.28;
  const foot = charH * 0.13;

  /** highest surface under either foot (or the centre) at or below `feet` */
  const underFeet = (feet: number, tol: number) =>
    Math.min(surfaceBelow(solids, x - foot, feet, tol), surfaceBelow(solids, x, feet, tol), surfaceBelow(solids, x + foot, feet, tol));

  const jumpTo = (top: number) => {
    const h = Math.max(stepUp, b.y - top) + clearance;
    b.vy = -Math.sqrt(2 * G * h);
    b.onGround = false;
    b.crouch = 0;
    b.jumpedAt = time;
  };

  const dir = Math.sign(dx) || Math.sign(remaining) || 1;
  const left = Number.isFinite(remaining) && Math.sign(remaining) === dir ? Math.abs(remaining) : Number.isFinite(remaining) ? 0 : Infinity;
  // distance the scroll will carry him during a jump (~0.55s of flight at the current speed)
  const reach = Math.min(Math.max(Math.abs(dx) * 34, Math.min(left, charH)), charH * 1.6);

  if (b.onGround && b.crouch > 0) {
    // crouching: push off when it ends (or at once if the step is already at his front foot)
    b.crouch -= dt;
    const atFoot = surfaceReachable(solids, x + dir * foot, b.y, maxUp) < b.y - stepUp;
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
    if (here < b.y - stepUp && (Math.abs(dx) > 0.2 || left > 0)) {
      jumpTo(Math.min(here, highestAcross(solids, x, x + dir * (foot + reach), b.y, maxUp)));
    } else {
      const under = underFeet(b.y, stepUp);
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
        let edge = -1;
        for (let d = foot; d <= look; d += 6) {
          if (surfaceReachable(solids, x + dir * d, b.y, maxUp) < b.y - stepUp) {
            edge = d;
            break;
          }
        }
        if (edge >= 0 && left >= edge + foot) {
          b.crouch = CROUCH;
          b.crouchedAt = time;
        }
      }
    }
  }

  if (!b.onGround) {
    const prev = b.y;
    b.vy += G * dt;
    b.y += b.vy * dt;
    if (b.vy >= 0) {
      // land on anything under either foot, or step up onto a ledge that is just above the feet
      const land = underFeet(prev - ledgeGrab, stepUp);
      if (b.y >= land) {
        b.y = land;
        b.vy = 0;
        b.onGround = true;
        b.landedAt = time;
      }
    }
    // safety net: never fall out of the world
    if (b.y > floorLimit) {
      const land = surfaceBelow(solids, x, -1e6, 0);
      b.y = Number.isFinite(land) ? land : floorLimit;
      b.vy = 0;
      b.onGround = true;
      b.landedAt = time;
    }
  }
  return b;
}
