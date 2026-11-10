"""Set pieces for Realm 2, Aqua."""
import random
from math import sin
from mathutils import Vector
from kit import B, G, mat, mix, root, quad, fade_mat


def coral(loc, col, seed=0, h=1.0, n=5):
    rnd = random.Random(seed)
    b = B()

    def branch(p, d, L, r, depth):
        q = p + d * L
        b.limb(p, q, r, r * 0.78, seg=8)
        if depth > 0:
            for _ in range(2):
                d2 = (d + Vector((rnd.uniform(-0.7, 0.7), rnd.uniform(-0.4, 0.4), rnd.uniform(0.0, 0.5)))).normalized()
                branch(q, d2, L * 0.72, r * 0.78, depth - 1)

    for _ in range(n):
        d = Vector((rnd.uniform(-0.6, 0.6), rnd.uniform(-0.3, 0.3), 1)).normalized()
        base = Vector(loc) + Vector((rnd.uniform(-0.2, 0.2) * h, rnd.uniform(-0.15, 0.15) * h, 0))
        branch(base, d, 0.42 * h, 0.08 * h, 2)
    return b.build('Coral', mat(col))


def brain_coral(loc, r, col):
    b = B()
    b.ball((loc[0], loc[1], loc[2] + r * 0.45), (r, r * 0.9, r * 0.62))
    return b.build('BrainCoral', mat(col))


def sponge(loc, col, s=1.0, seed=0):
    rnd = random.Random(seed)
    g = G('sponge')
    for _ in range(4):
        x, y = loc[0] + rnd.uniform(-0.3, 0.3) * s, loc[1] + rnd.uniform(-0.2, 0.2) * s
        hh = s * rnd.uniform(0.5, 1.1)
        lean = rnd.uniform(-0.15, 0.15) * s
        g(col).cone((x, y, loc[2]), (x + lean, y, loc[2] + hh), 0.09 * s, 0.16 * s, seg=12)
        g(mix(col, '#10202A', 0.6)).ball((x + lean, y, loc[2] + hh), (0.13 * s, 0.13 * s, 0.03 * s), seg=12, rings=6)
    return g.done()


def seagrass(points, col='#3FA47A', h=1.0, seed=0, bend=0.35):
    rnd = random.Random(seed)
    b = B()
    for (x, y, z) in points:
        for _ in range(6):
            bx, by = x + rnd.uniform(-0.25, 0.25), y + rnd.uniform(-0.15, 0.15)
            hh = h * rnd.uniform(0.6, 1.15)
            w = 0.05
            rows = []
            for i in range(6):
                t = i / 5
                cx = bx + bend * hh * t * t + 0.06 * sin(t * 6 + bx)
                rows.append(((cx - w * (1 - t * 0.85), by, z + hh * t), (cx + w * (1 - t * 0.85), by, z + hh * t)))
            for (l0, r0), (l1, r1) in zip(rows, rows[1:]):
                b.poly((l0, r0, r1, l1))
    return b.build('Seagrass', mat(col), smooth=False)


def oyster(loc, rz=0.0, s=1.0, shell='#C4B6A8'):
    R = root('Oyster', loc, rz, s)
    g = G('oyster')
    g(shell).ball((0, 0, 0.07), (0.30, 0.24, 0.10), keep=lambda v: v.z < 0.09)
    g(mix(shell, '#FFFFFF', 0.45)).ball((0, 0, 0.075), (0.26, 0.2, 0.05))
    g(shell).ball((-0.13, 0, 0.30), (0.30, 0.24, 0.07), rot=(0, -1.0, 0))
    g('#FFFFFF', rough=0.15, emit=0.55).ball((0.04, 0, 0.16), 0.085)
    g.done(parent=R)
    return R


def dhow_hull(loc, s=1.0, col='#2F4250'):
    """A dhow seen from below."""
    R = root('Dhow', loc, scale=s)
    g = G('dhow')
    g(col).ball((0, 0, 0), (3.4, 0.95, 0.85), keep=lambda v: v.z < 0.3, seg=28, rings=16)
    g(mix(col, '#000000', 0.25)).rbox((0, 0, -0.85), (5.6, 0.12, 0.2), 0.04)
    g.done(parent=R, shadow=False)
    return R


def bubbles(points, col='#E9FFFB'):
    b = B()
    for (x, y, z, r) in points:
        b.ball((x, y, z), r, seg=12, rings=8)
    return b.build('Bubbles', mat(col, rough=0.1, emit=0.35, alpha=0.6), shadow=False)


def shafts(specs, col='#E3FFF4', alpha=0.16):
    """Light shafts from the surface. specs = [(x, y, width, slant)]."""
    m = fade_mat(col, 1.0, alpha, 'down', 1.4)
    for (x, y, w, sl) in specs:
        quad('Shaft', (x - sl - w * 0.8, y, -0.5), (x - sl + w * 0.8, y, -0.5), (x + w / 2, y, 11), (x - w / 2, y, 11), m)
