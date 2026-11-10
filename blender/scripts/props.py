"""Set pieces for the four realms. Everything is built at `loc` facing +X unless noted."""
import random
from math import sin, cos, pi, radians as rad
from mathutils import Vector
from kit import B, G, mat, mix, root, glow, quad, strip, fade_mat


# ------------------------------------------------------------------ desert

def _frond(b, top, az, length, width, droop, n=7):
    top = Vector(top)
    d = Vector((cos(az), sin(az), 0))
    p = Vector((-sin(az), cos(az), 0))
    rows = []
    for i in range(n + 1):
        t = i / n
        c = top + d * (length * t) + Vector((0, 0, length * (0.42 * sin(pi * t * 0.6) - droop * t * t)))
        w = width * (sin(pi * min(t * 1.1 + 0.05, 1.0)) ** 0.7) * (1 - 0.45 * t) + 0.012
        sag = Vector((0, 0, -0.35 * w))
        rows.append((c, c + p * w + sag, c - p * w + sag))
    for (c0, l0, r0), (c1, l1, r1) in zip(rows, rows[1:]):
        b.poly((c0, c1, l1, l0))
        b.poly((c0, r0, r1, c1))


def palm(loc, h=4.2, lean=0.5, seed=0, trunk='#A2835B', leaf='#5F9160', leaf2='#7BAE6C', snow=None):
    rnd = random.Random(seed)
    R = root('Palm', loc)
    g = G('palm')
    top = (lean, 0, h)
    g(trunk).chain([(0, 0, 0), (lean * 0.15, 0, h * 0.35), (lean * 0.55, 0, h * 0.7), top],
                   [0.19, 0.16, 0.13, 0.12], n=10, seg=10)
    g(trunk).ball((lean, 0, h + 0.02), 0.2)
    n = 9
    for i in range(n):
        az = 2 * pi * i / n + rnd.uniform(-0.2, 0.2)
        _frond(g(leaf if i % 2 else leaf2), top, az, h * rnd.uniform(0.42, 0.52), 0.26, rnd.uniform(0.75, 1.05))
    for i in range(5):
        az = 2 * pi * i / 5 + 0.3
        _frond(g(leaf2), (lean, 0, h + 0.05), az, h * 0.3, 0.2, 0.25)
    for i in range(5):
        g('#B9772F').ball((lean + 0.16 * cos(i * 1.3), 0.16 * sin(i * 1.3), h - 0.16), 0.07, seg=10, rings=6)
    if snow:
        g(snow).ball((lean, 0, h + 0.22), (0.5, 0.5, 0.14))
    for o in g.done(parent=R):
        pass
    return R


def tree_of_life(loc, s=1.0):
    R = root('TreeOfLife', loc, scale=s)
    g = G('tol')
    bark = '#8A6E52'
    g(bark).chain([(0, 0, 0), (0.15, 0, 0.9), (-0.2, 0.1, 1.7), (-0.9, 0, 2.3)], [0.42, 0.3, 0.2, 0.1], n=10)
    g(bark).chain([(0.15, 0, 0.9), (0.8, -0.1, 1.6), (1.6, 0, 2.2)], [0.26, 0.18, 0.09], n=8)
    g(bark).chain([(0, 0, 1.2), (0.2, 0.2, 2.2), (0.3, 0, 2.9)], [0.2, 0.13, 0.07], n=6)
    for x, y, z, r, c in ((-1.3, 0, 2.6, 1.0, 0), (0.2, 0.2, 3.2, 1.25, 1), (1.7, 0, 2.6, 1.05, 0), (-0.5, -0.3, 3.0, 0.9, 1),
                          (1.0, -0.3, 3.1, 0.9, 0), (-2.1, 0.1, 2.2, 0.7, 1), (2.5, 0, 2.2, 0.7, 1)):
        g('#6F9258' if c else '#84A766').ball((x, y, z), (r, r * 0.8, r * 0.62))
    g.done(parent=R)
    return R


def fort(loc, col='#D9B98C', s=1.0):
    R = root('Fort', loc, scale=s)
    g = G('fort')
    dark = mix(col, '#5A4030', 0.55)
    g(col).rbox((0, 0, 1.3), (11, 3, 2.6), 0.06)
    for i in range(-6, 7):
        g(col).rbox((i * 0.8, -1.4, 2.8), (0.42, 0.25, 0.42), 0.03)
    for x in (-5.5, 5.5):
        g(col).cone((x, -0.6, 0), (x, -0.6, 3.7), 1.35, 1.2, seg=20)
        for k in range(8):
            a = 2 * pi * k / 8
            g(col).rbox((x + 1.15 * cos(a), -0.6 + 1.15 * sin(a), 3.9), (0.42, 0.42, 0.45), 0.03)
    g(dark).rbox((0, -1.5, 0.9), (1.5, 0.1, 1.8), 0.04).ball((0, -1.5, 1.8), (0.75, 0.06, 0.6))
    for x in (-3, 3):
        g(dark).rbox((x, -1.5, 1.7), (0.3, 0.06, 0.6), 0.02)
    g.done(parent=R)
    return R


def flag_bahrain(loc, h=3.2, w=1.5, fh=0.9):
    """Bahrain flag: white at the hoist, red field, five white points between them."""
    R = root('Flag', loc)
    g = G('flag')
    g('#E9EEF2').limb((0, 0, 0), (0, 0, h), 0.035).ball((0, 0, h + 0.05), 0.07)
    z0 = h - fh - 0.05
    a, d = w * 0.25, w * 0.13
    g('#CE1126').poly(((a, 0.004, z0), (w, 0.004, z0), (w, 0.004, z0 + fh), (a, 0.004, z0 + fh)))
    g('#FFFFFF').poly(((0.03, 0, z0), (a, 0, z0), (a, 0, z0 + fh), (0.03, 0, z0 + fh)))
    for k in range(5):
        zz = z0 + fh * k / 5
        for y in (-0.004, 0.012):
            g('#FFFFFF').poly(((a, y, zz), (a + d, y, zz + fh / 10), (a, y, zz + fh / 5)))
    g.done(parent=R, smooth=False)
    return R


def skyline(loc, col, s=1.0):
    """Far Manama silhouette: the twin sail towers with their three turbines, plus plain towers."""
    R = root('Skyline', loc, scale=s)
    g = G('sky')
    for sx in (-1, 1):
        g(col).cone((sx * 2.4, 0, 0), (sx * 1.2, 0, 15), 2.3, 0.12, seg=3)
    for z in (4.5, 7.5, 10.2):
        g(col).rbox((0, 0, z), (2.6, 0.3, 0.22), 0.04)
        g(mix(col, '#FFFFFF', 0.35)).cone((0, -0.3, z + 0.1), (0, -0.2, z + 0.1), 0.75, 0.75, seg=20)
    for x, w, hh in ((-9, 2.2, 7), (-6.2, 1.6, 4.5), (6.5, 2, 8.5), (9.5, 2.6, 5.5), (12.5, 1.6, 9.5), (-12, 2.4, 5), (15, 2, 4)):
        g(col).rbox((x, 0, hh / 2), (w, w, hh), 0.1)
    g.done(parent=R, shadow=False)
    return R


def rocks(loc, n=3, s=0.4, col='#B79A76', seed=0, flat=False):
    rnd = random.Random(seed)
    b = B()
    for i in range(n):
        r = s * rnd.uniform(0.6, 1.2)
        b.ico((loc[0] + rnd.uniform(-1, 1) * s * 1.8, loc[1] + rnd.uniform(-1, 1) * s, loc[2] + r * 0.35),
              (r, r * 0.85, r * (0.5 if flat else 0.8)), sub=1, jitter=0.2, seed=seed * 7 + i)
    return b.build('Rocks', mat(col), smooth=False)


def tufts(points, col='#B8A867', h=0.35, seed=0):
    rnd = random.Random(seed)
    b = B()
    for (x, y) in points:
        for k in range(7):
            a = rnd.uniform(0, 2 * pi)
            r = rnd.uniform(0.02, 0.16)
            b.cone((x + r * cos(a), y + r * sin(a), 0), (x + 2.4 * r * cos(a), y + 2.4 * r * sin(a), h * rnd.uniform(0.6, 1.1)),
                   0.022, 0.0, seg=5)
    return b.build('Tufts', mat(col))


def footprints(x0, x1, y=0.0, step=0.42, col='#D2A96F'):
    b = B()
    i, x = 0, x0
    while x < x1:
        b.ball((x, y + (0.1 if i % 2 else -0.1), 0.0), (0.12, 0.07, 0.012), seg=12, rings=6)
        x += step
        i += 1
    return b.build('Footprints', mat(col), shadow=False)


def pool(loc, rx=2.2, ry=0.9, col='#8FD0D6'):
    b = B()
    b.ball(loc, (rx, ry, 0.02), seg=32, rings=8)
    return b.build('Pool', mat(col, rough=0.12), shadow=False)


# ------------------------------------------------------------------ sky

def cloud(center, s=1.0, col='#FFFFFF', seed=0, emit=0.35):
    """Soft cloud with a flat base."""
    rnd = random.Random(seed)
    b = B()
    x, y, z = center
    n = 6
    for i in range(n):
        t = i / (n - 1) - 0.5
        r = s * (1.0 - 1.6 * t * t) * rnd.uniform(0.75, 1.1)
        b.ball((x + t * s * 4.2, y + rnd.uniform(-0.3, 0.3) * s, z + r * 0.35), (r * 1.25, r, r * 0.8), seg=18, rings=12,
               keep=lambda v, z=z: v.z > z - 0.05 * s)
    b.ball((x, y, z - 0.05 * s), (s * 2.5, s * 0.9, s * 0.07))
    return b.build('Cloud', mat(col, emit=emit), shadow=False)


def flock(center, n=6, s=1.0, col='#5A4A44'):
    """Distant birds in a loose V."""
    b = B()
    c = Vector(center)
    for i in range(n):
        k = (i + 1) // 2
        side = 1 if i % 2 else -1
        p = c + Vector((-k * 1.1 * s, 0, side * k * 0.45 * s + 0.1 * s * sin(i * 2.1)))
        for w in (1, -1):
            b.poly((p, p + Vector((-0.15 * s, 0, 0.0)), p + Vector((-0.3 * s + 0.05 * s * w, 0, w * 0.42 * s + 0.12 * s))))
    return b.build('Flock', mat(col), smooth=False, shadow=False)
