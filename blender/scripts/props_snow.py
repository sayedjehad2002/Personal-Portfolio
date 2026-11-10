"""Set pieces for Realm 3, Snow."""
import random
from math import sin, cos, pi
from mathutils import Vector
from kit import B, G, mat, mix, root, glow, strip, fade_mat, at, sky_band
import surfaces as S


def pine(loc, h=3.0, seed=0, green='#2F6657', snow='#F2F7FD'):
    """Snow pine: five tiers of boughs that droop a little, each carrying snow, on a trunk with a root flare."""
    rnd = random.Random(seed)
    R = root('Pine', loc)
    g = G('pine')
    g('#6B5240').cone((0, 0, 0), (0, 0, h * 0.3), 0.075 * h, 0.05 * h, seg=8)
    g('#6B5240').cone((0, 0, -0.03), (0, 0, h * 0.07), 0.11 * h, 0.07 * h, seg=8)
    tiers = 5
    dark = mix(green, '#0E2A24', 0.35)
    for i in range(tiers):
        t = i / (tiers - 1)
        z0 = h * (0.16 + 0.16 * i)
        hh = h * (0.34 - 0.03 * i)
        r = h * (0.3 - 0.21 * t) * rnd.uniform(0.94, 1.06)
        g(dark if i % 2 else green).cone((0, 0, z0 - hh * 0.06), (0, 0, z0 + hh), r, 0.0, seg=11, caps=True)
        k = rnd.uniform(0.4, 0.52)
        g(snow).cone((0, 0, z0 + hh * k), (0, 0, z0 + hh * 1.02), r * (1 - k) * 1.14, 0.0, seg=11, caps=True)
        # lumps of snow sitting out on the boughs
        for a in range(3):
            az = rnd.uniform(0, 6.28)
            g(snow).ball((cos(az) * r * 0.72, sin(az) * r * 0.72, z0 + hh * 0.13), (r * 0.2, r * 0.2, r * 0.09), seg=8, rings=5)
    g.done(parent=R)
    return R


def peak(loc, r, h, col, cap='#F4F8FE', seed=0, cap_from=0.55):
    """Faceted ice mountain with a snow cap."""
    rnd = random.Random(seed)
    for c, z0, rr, name in ((col, 0.0, r, 'Peak'), (cap, cap_from, r * (1 - cap_from) * 1.06, 'PeakCap')):
        b = B()
        b.cone((loc[0], loc[1], loc[2] + h * z0), (loc[0], loc[1], loc[2] + h * 1.0), rr, r * 0.03, seg=7)
        for v in b.bm.verts:
            v.co.x += rnd.uniform(-0.12, 0.12) * r
            v.co.z += rnd.uniform(-0.03, 0.03) * h
        b.build(name, mat(c), smooth=False, shadow=False)


def cabin(loc, s=1.0):
    """The Discipline Lab as a small modern cabin with a lit window."""
    R = root('Cabin', loc, scale=s)
    g = G('cabin')
    wall, trim = '#2D3957', '#3D4B70'
    g(wall).rbox((0, 0, 0.95), (3.3, 2.2, 1.9), 0.05)
    for sgn in (1, -1):
        g(trim).rbox((0, sgn * 0.62, 2.28), (3.7, 1.6, 0.14), 0.04, rot=(sgn * -0.62, 0, 0))
        g('#F2F7FD').rbox((0, sgn * 0.62, 2.42), (3.76, 1.62, 0.2), 0.09, rot=(sgn * -0.62, 0, 0))
    g(wall).rbox((0, 0, 2.05), (3.3, 1.5, 0.5), 0.04)
    g('#FFD58A', emit=1.8).rbox((-0.55, -1.11, 1.05), (1.45, 0.05, 0.85), 0.03)
    g(trim).rbox((-0.55, -1.13, 1.05), (0.05, 0.05, 0.85), 0.01).rbox((-0.55, -1.13, 1.05), (1.45, 0.05, 0.05), 0.01)
    g('#B23A3A').rbox((1.05, -1.11, 0.62), (0.62, 0.05, 1.24), 0.03)
    g('#FF5A5A', emit=3.0).rbox((1.05, -1.12, 1.42), (0.62, 0.04, 0.06), 0.02)
    g(trim).rbox((-1.1, 0.3, 2.9), (0.34, 0.34, 0.8), 0.04)
    g('#F2F7FD').rbox((-1.1, 0.3, 3.32), (0.42, 0.42, 0.1), 0.045)
    g('#F2F7FD').ball((0, -1.25, 0.05), (2.0, 0.35, 0.16))
    g.done(parent=R)
    g2 = G('smoke')
    for i, (dx, dz, r) in enumerate(((0, 0.3, 0.16), (0.14, 0.62, 0.22), (0.36, 1.0, 0.28))):
        g2('#EAF0FA', alpha=0.55 - 0.12 * i).ball((-1.1 + dx, 0.3, 3.4 + dz), r)
    g2.done(parent=R, shadow=False)
    return R


def signpost(loc, s=1.0):
    R = root('Sign', loc, scale=s)
    g = G('sign')
    g('#8A6A4A').rbox((0, 0, 0.75), (0.1, 0.1, 1.5), 0.03)
    g('#A07C55').rbox((0.18, -0.04, 1.2), (0.8, 0.06, 0.26), 0.03)
    g('#A07C55').cone((0.58, -0.04, 1.2), (0.82, -0.04, 1.2), 0.19, 0.0, seg=4)
    g('#F2F7FD').rbox((0.18, -0.04, 1.36), (0.84, 0.1, 0.08), 0.035).ball((0, 0, 1.52), (0.09, 0.09, 0.05))
    g.done(parent=R)
    return R


def gondola(loc, s=1.0, col='#C83A36'):
    R = root('Gondola', loc, scale=s)
    g = G('gondola')
    g(col).rbox((0, 0, 0), (1.5, 0.85, 1.1), 0.16)
    g('#CFE6FF', emit=0.5, rough=0.2).rbox((0, -0.4, 0.14), (1.2, 0.08, 0.42), 0.05)
    g(mix(col, '#000000', 0.35)).rbox((0, 0, 0.6), (1.56, 0.9, 0.12), 0.05).rbox((0, 0, -0.55), (1.3, 0.8, 0.1), 0.04)
    g('#39445C').limb((0, 0, 0.62), (0, 0, 1.25), 0.045).rbox((0, 0, 1.3), (0.5, 0.14, 0.14), 0.04)
    g.done(parent=R, shadow=False)
    return R


def cable(p0, p1, sag=0.6, r=0.035, col='#39445C'):
    p0, p1 = Vector(p0), Vector(p1)
    pts = [p0.lerp(p1, i / 14) - Vector((0, 0, sag * sin(pi * i / 14))) for i in range(15)]
    b = B()
    b.chain(pts, [r] * 15, seg=6)
    return b.build('Cable', mat(col), shadow=False)


def pylon(loc, h, s=1.0, col='#39445C'):
    b = B()
    x, y, z = loc
    b.limb((x - 0.5 * s, y, z), (x, y, z + h), 0.09 * s, 0.06 * s).limb((x + 0.5 * s, y, z), (x, y, z + h), 0.09 * s, 0.06 * s)
    b.rbox((x, y, z + h), (1.4 * s, 0.14 * s, 0.14 * s), 0.03)
    return b.build('Pylon', mat(col))


def ice_sheet(cx, cy, rx, ry):
    b = B()
    b.ball((cx, cy, 0.0), (rx, ry, 0.014), seg=64, rings=8)
    return b.build('Ice', S.ice('#BEE2F4', '#F4FCFF', '#86BEE4'), shadow=False)


def ice_hole(loc, r=0.55):
    g = G('hole')
    x, y, z = loc
    g('#2C5E8C', rough=0.15).ball((x, y, z + 0.016), (r, r * 0.8, 0.008), seg=24, rings=6)
    for i in range(12):
        a = 2 * pi * i / 12
        g('#F2F7FD').ball((x + cos(a) * r * 1.04, y + sin(a) * r * 0.84, z + 0.03), (0.13, 0.11, 0.07), seg=10, rings=6)
    return g.done(shadow=False)


def skate_trails(x0, x1, y=0.0, col='#F2FAFF'):
    """Two blade lines curving away behind him on the ice."""
    b = B()
    for off, ph in ((-0.13, 0.0), (0.13, 1.4)):
        pts = [(x0 + (x1 - x0) * i / 24, y + off + 0.1 * sin(i * 0.5 + ph), 0.016) for i in range(25)]
        for a, c in zip(pts, pts[1:]):
            b.poly(((a[0], a[1] - 0.012, a[2]), (c[0], c[1] - 0.012, c[2]), (c[0], c[1] + 0.012, c[2]), (a[0], a[1] + 0.012, a[2])))
    return b.build('Trails', mat(col, rough=0.6), smooth=False, shadow=False)


def dots(points, r, col='#FFFFFF', emit=1.0, alpha=1.0, name='Dots'):
    b = B()
    for p in points:
        b.ball(p[:3], r if len(p) == 3 else p[3], seg=8, rings=5)
    return b.build(name, mat(col, emit=emit, alpha=alpha), shadow=False)


def stars(n=46, seed=0, z0=3.6, z1=6.8, col='#FFFFFF', big=0.16):
    rnd = random.Random(seed)
    b = B()
    for _ in range(n):
        p = at(rnd.uniform(-7.1, 7.1), rnd.uniform(z0, z1), 100)
        b.ball(p, rnd.uniform(0.05, big) * (2.2 if rnd.random() < 0.08 else 1.0), seg=6, rings=4)
    return b.build('Stars', mat(col, emit=1.5), shadow=False)


def aurora(zs0, zs1, col, alpha=0.5, phase=0.0, amp=0.5, y=96):
    return sky_band(zs0, zs1, S.curtain(col, '#B58CFF', alpha), y, phase, amp)


def snowfall(n=70, seed=1):
    rnd = random.Random(seed)
    pts = [(rnd.uniform(-9, 9), rnd.uniform(-3, 9), rnd.uniform(0.1, 7.5)) for _ in range(n)]
    return dots(pts, 0.028, '#FFFFFF', 0.6, 0.9, 'Snowfall')
