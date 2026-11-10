"""Set pieces and small life for Realm 4, Magma."""
import random
from math import sin, cos, pi
from mathutils import Vector
from kit import B, G, mat, mix, root, glow, at

ROCK, LAVA = '#2A2230', '#FF7A1F'


def spire(loc, r, h, seed=0, col=ROCK, top=0.42):
    """Faceted obsidian column with a flat top."""
    rnd = random.Random(seed)
    b = B()
    x, y, z = loc
    b.cone((x, y, z), (x, y, z + h), r, r * top, seg=7)
    for v in b.bm.verts:
        v.co.x += rnd.uniform(-0.1, 0.1) * r
        v.co.y += rnd.uniform(-0.1, 0.1) * r
    return b.build('Spire', mat(col, rough=0.55), smooth=False)


def shards(loc, n=4, s=1.0, seed=0, col=ROCK):
    rnd = random.Random(seed)
    b = B()
    for _ in range(n):
        x, y = loc[0] + rnd.uniform(-1, 1) * s, loc[1] + rnd.uniform(-0.5, 0.5) * s
        hh = s * rnd.uniform(0.5, 1.5)
        lean = rnd.uniform(-0.3, 0.3) * hh
        b.cone((x, y, loc[2]), (x + lean, y, loc[2] + hh), 0.24 * s * rnd.uniform(0.7, 1.2), 0.0, seg=5)
    return b.build('Shards', mat(col, rough=0.5), smooth=False)


def lava_stream(x0, x1, y, width=0.9, z=0.02, phase=0.0, emit=3.2):
    b = B()
    n = 60
    rows = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        c = y + 0.35 * sin(x * 0.55 + phase) + 0.15 * sin(x * 1.3 + phase)
        w = width * (0.75 + 0.3 * sin(x * 0.8 + phase * 2))
        rows.append(((x, c - w / 2, z), (x, c + w / 2, z)))
    for (a0, b0), (a1, b1) in zip(rows, rows[1:]):
        b.poly((a0, a1, b1, b0))
    return b.build('Lava', mat(LAVA, emit=emit), smooth=False, shadow=False)


def lavafall(loc, w, h, emit=2.6):
    b = B()
    x, y, z = loc
    b.poly(((x - w / 2, y, z), (x + w / 2, y, z), (x + w * 0.35, y, z + h), (x - w * 0.35, y, z + h)))
    return b.build('Lavafall', mat(LAVA, emit=emit), smooth=False, shadow=False)


def volcano(loc, r, h, col):
    rnd = random.Random(5)
    b = B()
    x, y, z = loc
    b.cone((x, y, z), (x, y, z + h), r, r * 0.2, seg=11)
    for v in b.bm.verts:
        v.co.x += rnd.uniform(-0.06, 0.06) * r
    b.build('Volcano', mat(col), smooth=False, shadow=False)
    glow((x, y - 1, z + h + r * 0.05), r * 0.75, '#FF8A3A', 1.2, 2.0)
    # lava lines that follow the slope facing the camera
    for a, t0, w in ((-0.18, 0.35, 0.035), (0.1, 0.5, 0.03), (0.3, 0.62, 0.022)):
        s = B()
        rows = []
        for i in range(9):
            t = t0 + (1.0 - t0) * i / 8
            rad_t = r * (1 - 0.8 * t)
            cx = x + a * rad_t * (1 + 0.25 * sin(i * 1.1))
            rows.append(((cx - w * r * (1.3 - t), y - rad_t, z + h * t), (cx + w * r * (1.3 - t), y - rad_t, z + h * t)))
        for (a0, b0), (a1, b1) in zip(rows, rows[1:]):
            s.poly((a0, b0, b1, a1))
        s.build('LavaLine', mat(LAVA, emit=2.2), smooth=False, shadow=False)


def nest(loc, s=1.0):
    """The egg nest: a ring of charred branches holding three glowing eggs, one of them hatching."""
    rnd = random.Random(11)
    R = root('Nest', loc, scale=s)
    g = G('nest')
    for i in range(34):
        a = 2 * pi * i / 34 + rnd.uniform(-0.1, 0.1)
        r0 = rnd.uniform(0.95, 1.25)
        a2 = a + rnd.uniform(0.5, 0.9) * rnd.choice((-1, 1))
        z0 = rnd.uniform(0.02, 0.32)
        g('#4A3428' if i % 2 else '#6B4A34').limb((r0 * cos(a), r0 * 0.75 * sin(a), z0),
                                                    (r0 * 1.05 * cos(a2), r0 * 0.8 * sin(a2), z0 + rnd.uniform(0.05, 0.3)),
                                                    0.06, 0.035, seg=6)
    for x, y, tilt in ((-0.45, -0.1, 0.25), (0.42, -0.05, -0.2)):
        g('#F6E7C6', emit=0.55, rough=0.5).ball((x, y, 0.5), (0.3, 0.3, 0.42), rot=(0, tilt, 0))
        for k in range(5):
            a = k * 1.3
            g('#FF9A3C', emit=2.0).ball((x + 0.2 * cos(a), y - 0.22, 0.45 + 0.25 * sin(a * 1.7)), 0.035, seg=8, rings=5)
    # the hatching egg: lower shell with a baby dragon looking out
    g('#F6E7C6', emit=0.55, rough=0.5).ball((0, -0.25, 0.42), (0.32, 0.32, 0.42), keep=lambda v: v.z < 0.48)
    g('#D8463A').ball((0.02, -0.25, 0.68), (0.2, 0.19, 0.17)).ball((0.2, -0.27, 0.64), (0.13, 0.12, 0.09))
    for sgn in (1, -1):
        g('#F6E7C6').cone((-0.08, -0.25 + sgn * 0.1, 0.8), (-0.16, -0.25 + sgn * 0.13, 0.95), 0.035, 0.0, seg=6)
        g('#FFE08A', emit=2.0).ball((0.13, -0.25 + sgn * 0.1, 0.74), 0.035, seg=8, rings=6)
    g.done(parent=R)
    return R


def embers(n=70, seed=2, x0=-8.5, x1=8.5, y0=-2.5, y1=9.0, z0=0.1, z1=4.6):
    rnd = random.Random(seed)
    b = B()
    for _ in range(n):
        b.ball((rnd.uniform(x0, x1), rnd.uniform(y0, y1), z0 + (z1 - z0) * rnd.random() ** 1.8), rnd.uniform(0.012, 0.03), seg=6, rings=4)
    return b.build('Embers', mat('#FFB04A', emit=5.0), shadow=False)


def glow_steps(x0, x1, y=0.0, step=0.5):
    """Stones that light up under each step and cool behind him."""
    i, x = 0, x1
    while x > x0:
        k = (x - x0) / (x1 - x0)
        b = B()
        b.ball((x, y + (0.11 if i % 2 else -0.11), 0.012), (0.15, 0.09, 0.012), seg=12, rings=6)
        b.build('Step', mat(mix('#4A2A2A', '#FF8A3C', k), emit=0.2 + 3.0 * k * k), shadow=False)
        x -= step
        i += 1


def smoke(points, col='#B9A9B0'):
    g = G('smoke')
    for i, (x, y, z, r) in enumerate(points):
        g(col, alpha=max(0.12, 0.5 - 0.07 * i)).ball((x, y, z), r)
    return g.done(shadow=False)


def lizard(loc, rz=0.0, scale=1.0):
    """Fire-lizard hatchling."""
    R = root('Lizard', loc, rz, scale)
    g = G('lizard')
    c = '#FF7A2E'
    g(c, emit=0.5).chain([(0.25, 0, 0.08), (0, 0, 0.1), (-0.25, 0, 0.07), (-0.5, 0.06, 0.04), (-0.72, 0.0, 0.03)],
                         [0.06, 0.078, 0.055, 0.03, 0.012], n=10, seg=10)
    g(c, emit=0.5).ball((0.34, 0, 0.1), (0.085, 0.065, 0.055))
    for s in (1, -1):
        g('#1E1614').ball((0.38, s * 0.045, 0.13), 0.016)
        for x in (0.15, -0.18):
            g(c, emit=0.5).limb((x, s * 0.05, 0.07), (x + 0.05, s * 0.17, 0.015), 0.022, 0.015, seg=6)
    for x in (0.12, 0.0, -0.12, -0.24):
        g('#FFD24A', emit=2.5).cone((x, 0, 0.16), (x - 0.03, 0, 0.24), 0.025, 0.0, seg=6)
    g.done(parent=R)
    return R


def tortoise(loc, rz=0.0, scale=1.0):
    """Rock tortoise: the glow inside shows through the cracks in its shell."""
    R = root('Tortoise', loc, rz, scale)
    B().ico((0, 0, 0.3), (0.5, 0.42, 0.3), sub=2, jitter=0.13, seed=3).build(
        'Tortoise.shell', mat(ROCK, rough=0.5), smooth=False, parent=R)
    g = G('tortoise')
    g(LAVA, emit=3.0).ball((0, 0, 0.3), (0.455, 0.382, 0.27))
    g('#40343C').ball((0.52, 0, 0.26), (0.14, 0.11, 0.1))
    for s in (1, -1):
        g('#FFD24A', emit=2.5).ball((0.6, s * 0.07, 0.3), 0.02)
        for x in (0.3, -0.3):
            g('#40343C').ball((x, s * 0.34, 0.1), (0.12, 0.1, 0.1))
    g.done(parent=R)
    return R


def plume(base, s=1.0, n=9, drift=0.55):
    """Smoke rising from the crater and leaning with the wind, lit from below."""
    g = G('plume')
    x, y, z = base
    for i in range(n):
        t = i / (n - 1)
        r = s * (0.55 + 1.5 * t)
        g(mix('#8A3A2C', '#241826', min(1.0, t * 1.4)), alpha=0.85 - 0.45 * t).ball(
            (x + drift * s * 6 * t * t + 0.4 * s * sin(i * 1.9), y, z + s * 5.2 * t), (r * 1.15, r, r * 0.85))
    return g.done(shadow=False)


def ribs(loc, s=1.0, rz=0.0, n=6, col='#E6D6B4'):
    """The rib cage of something the dragon ate: a spine on the ground and arched ribs, half sunk in the rock."""
    R = root('Ribs', loc, rz, s)
    b = B()
    b.chain([(-1.6, 0, 0.12), (0, 0, 0.2), (1.7, 0, 0.1)], [0.1, 0.13, 0.07], seg=8)
    for i in range(n):
        x = -1.3 + 2.6 * i / (n - 1)
        h = 1.25 - 0.35 * abs(x) / 1.3
        for sd in (1, -1):
            b.chain([(x, 0, 0.15), (x - 0.12, sd * 0.55, h * 0.75), (x - 0.2, sd * 0.38, h), (x - 0.22, sd * 0.12, h * 1.02)], [0.07, 0.06, 0.045, 0.02], seg=6, n=7)
    o = b.build('RibsMesh', mat(col, rough=0.7))
    o.parent = R
    return R


def lava_pool(loc, r=1.5, seed=0, emit=3.0):
    """A pool of lava in the rock, with a rim of broken stone."""
    rnd = random.Random(seed)
    x, y, z = loc
    pts = []
    n = 11
    for i in range(n):
        a = 2 * pi * i / n
        k = r * rnd.uniform(0.75, 1.1)
        pts.append((x + cos(a) * k, y + sin(a) * k * 0.62, z))
    B().poly(pts).build('LavaPool', mat(LAVA, emit=emit), smooth=False, shadow=False)
    rim = B()
    for (px, py, _) in pts:
        rim.ico((x + (px - x) * 1.08, y + (py - y) * 1.08, z), r * rnd.uniform(0.1, 0.2), sub=1, seed=rnd.randint(0, 99))
    return rim.build('LavaRim', mat(ROCK, rough=0.55), smooth=False)


def crystals(loc, n=4, s=1.0, seed=0, col='#FF9A3C', emit=1.7):
    """Fire crystals: shards that glow from inside."""
    rnd = random.Random(seed)
    b = B()
    for _ in range(n):
        x, y = loc[0] + rnd.uniform(-0.6, 0.6) * s, loc[1] + rnd.uniform(-0.3, 0.3) * s
        hh = s * rnd.uniform(0.4, 1.1)
        b.cone((x, y, loc[2]), (x + rnd.uniform(-0.25, 0.25) * hh, y, loc[2] + hh), 0.16 * s * rnd.uniform(0.7, 1.2), 0.0, seg=5)
    return b.build('Crystals', mat(col, emit=emit, rough=0.3), smooth=False, shadow=False)
