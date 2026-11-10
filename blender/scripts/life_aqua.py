"""Animals of Realm 2, Aqua. Each faces +X with its origin at its centre."""
import random
from math import cos, sin, pi, exp
from mathutils import Vector, Matrix, Euler
import bmesh
from kit import B, G, mat, mix, root

EYE = '#1E1614'


def school(points, col='#FFD166', s=1.0, name='School'):
    """Many small fish in one mesh. points = [(position, yaw, pitch)]."""
    body, belly, fins, eyes, rings = B(), B(), B(), B(), B()
    for pos, yaw, pitch in points:
        M = Matrix.Translation(Vector(pos)) @ Euler((0, pitch, yaw)).to_matrix().to_4x4() @ Matrix.Diagonal((s, s, s, 1))
        bmesh.ops.create_uvsphere(body.bm, u_segments=10, v_segments=6, radius=1.0,
                                  matrix=M @ Matrix.Diagonal((0.2, 0.055, 0.1, 1)))
        bmesh.ops.create_uvsphere(belly.bm, u_segments=10, v_segments=6, radius=1.0,
                                  matrix=M @ Matrix.Translation((0.01, 0, -0.03)) @ Matrix.Diagonal((0.17, 0.057, 0.065, 1)))
        fins.poly([M @ Vector(p) for p in ((-0.16, 0, 0), (-0.34, 0, 0.11), (-0.29, 0, 0), (-0.34, 0, -0.11))])
        fins.poly([M @ Vector(p) for p in ((0.06, 0, 0.085), (-0.09, 0, 0.17), (-0.1, 0, 0.07))])
        for y in (-1, 1):
            bmesh.ops.create_uvsphere(rings.bm, u_segments=8, v_segments=5, radius=0.03 * s,
                                      matrix=Matrix.Translation(M @ Vector((0.115, y * 0.04, 0.02))))
            bmesh.ops.create_uvsphere(eyes.bm, u_segments=6, v_segments=4, radius=0.018 * s,
                                      matrix=Matrix.Translation(M @ Vector((0.122, y * 0.056, 0.02))))
    return [body.build(name, mat(col, rough=0.5)),
            belly.build(name + '.belly', mat(mix(col, '#FFFFFF', 0.55), rough=0.5)),
            rings.build(name + '.rings', mat('#FFFFFF')),
            fins.build(name + '.fins', mat(mix(col, '#FFFFFF', 0.25)), smooth=False),
            eyes.build(name + '.eyes', mat(EYE))]


def parting_school(n, x0, x1, y0, zc, xc, col, seed=0, s=1.0, spread=1.2, name='School'):
    """A school flowing left to right that splits around the point (xc, zc) and closes again."""
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        x = x0 + (x1 - x0) * (i + rnd.uniform(-0.4, 0.4)) / n
        side = 1 if i % 2 else -1
        f = lambda xx: side * (0.25 + spread * exp(-((xx - xc) / 2.2) ** 2))
        z = zc + f(x) + rnd.uniform(-0.28, 0.28)
        dz = f(x + 0.3) - f(x - 0.3)
        pts.append(((x, y0 + rnd.uniform(0.0, 2.2), z), rnd.uniform(-0.12, 0.12), -dz * 1.3))
    school(pts, col, s, name)


def turtle(loc, rz=0.0, scale=1.0, pitch=0.0):
    R = root('Turtle', loc, rz, scale, rot=(0, pitch, rz))
    g = G('turtle')
    g('#5E8C5A').ball((0, 0, 0.03), (0.36, 0.29, 0.15))
    g('#4A7548').ball((0, 0, 0.0), (0.39, 0.32, 0.055))
    g('#E3D9A6').ball((0, 0, -0.03), (0.33, 0.26, 0.1))
    g('#8FB57C').ball((0.42, 0, 0.02), (0.12, 0.09, 0.08))
    for s in (1, -1):
        g('#8FB57C').ball((-0.3, s * 0.2, -0.02), (0.13, 0.07, 0.025), rot=(0, 0, s * -0.6))
        g(EYE).ball((0.49, s * 0.065, 0.05), 0.02)
    for x, y in ((0.12, 0), (-0.1, 0.1), (-0.1, -0.1), (0.02, 0.17), (0.02, -0.17)):
        g('#4A7548').ball((x, y, 0.14), (0.085, 0.075, 0.04))
    g.done(parent=R)
    # front flippers on their own roots, so they can paddle
    for s, side in ((1, 'L'), (-1, 'R')):
        F = root('Turtle.flip' + side, (0.2, s * 0.26, -0.02), parent=R)
        f = G('flip' + side)
        f('#8FB57C').ball((0, s * 0.1, 0), (0.24, 0.1, 0.028), rot=(0, 0, s * 0.75))
        f.done(parent=F)
    return R


def ray(loc, rz=0.0, scale=1.0, bank=0.0):
    R = root('Ray', loc, rz, scale, rot=(bank, 0, rz))
    g = G('ray')
    c = '#6F84AE'
    g(c).ball((0, 0, 0), (0.42, 0.34, 0.075))
    for s in (1, -1):
        g(EYE).ball((0.3, s * 0.1, 0.06), 0.022)
    g(c).limb((-0.38, 0, 0), (-1.15, 0, 0.03), 0.028, 0.006, seg=8)
    g('#D7E0F0').ball((0.02, 0, -0.03), (0.36, 0.28, 0.05))
    for x, y in ((0.1, 0.12), (-0.08, -0.1), (-0.15, 0.2), (0.05, -0.3), (-0.2, -0.38), (-0.05, 0.45)):
        g('#E6EEFA').ball((x, y, 0.07), (0.03, 0.03, 0.012), seg=8, rings=5)
    g.done(parent=R)
    # wings on their own roots, so they can beat
    for s, side in ((1, 'L'), (-1, 'R')):
        W = root('Ray.wing' + side, (-0.03, s * 0.2, 0.02), parent=R)
        w = G('raywing' + side)
        w(c).ball((0, s * 0.22, 0.01), (0.3, 0.36, 0.03), rot=(s * 0.25, 0, 0))
        w.done(parent=W)
    return R


def hamour(loc, rz=0.0, scale=1.0):
    R = root('Hamour', loc, rz, scale)
    g = G('hamour')
    c, d = '#9A7A55', '#6E5438'
    g(c).ball((0, 0, 0), (0.55, 0.2, 0.27)).ball((0.4, 0, -0.03), (0.24, 0.18, 0.21))
    g('#D8C29A').ball((0.5, 0, -0.1), (0.14, 0.14, 0.07))
    g(d).poly(((-0.5, 0, 0), (-0.82, 0, 0.24), (-0.74, 0, 0), (-0.82, 0, -0.24)))
    g(d).poly(((0.2, 0, 0.24), (-0.1, 0, 0.42), (-0.4, 0, 0.2)))
    for s in (1, -1):
        g('#F6F0E2').ball((0.48, s * 0.13, 0.06), 0.045)
        g(EYE).ball((0.5, s * 0.15, 0.06), 0.026)
        for x, z in ((0.1, 0.1), (-0.15, 0.02), (0.0, -0.12), (-0.3, 0.1), (0.22, -0.05)):
            g(d).ball((x, s * 0.19, z), (0.05, 0.02, 0.05), seg=8, rings=6)
        g(d).ball((0.18, s * 0.2, -0.1), (0.13, 0.02, 0.07), rot=(0, 0.5, 0))
    g.done(parent=R)
    return R


def dugong(loc, rz=0.0, scale=1.0, col='#8FA3AE'):
    R = root('Dugong', loc, rz, scale)
    g = G('dugong')
    g(col).chain([(1.25, 0, -0.05), (0.7, 0, 0.05), (0, 0, 0.08), (-0.75, 0, 0.03), (-1.35, 0, 0.0)],
                 [0.27, 0.42, 0.47, 0.3, 0.1], n=14, seg=16)
    g(col).ball((1.5, 0, -0.16), (0.2, 0.22, 0.17))
    g(col).ball((-1.55, 0, 0), (0.2, 0.46, 0.045))
    for s in (1, -1):
        g(col).ball((0.75, s * 0.42, -0.2), (0.24, 0.1, 0.05), rot=(0, 0.5, s * 0.5))
    g.done(parent=R, shadow=False)
    return R


def jellyfish(loc, scale=1.0, col='#F7A8C4', seed=0):
    rnd = random.Random(seed)
    R = root('Jelly', loc, 0, scale)
    g = G('jelly')
    g(col, alpha=0.78, emit=0.35).ball((0, 0, 0), (0.24, 0.24, 0.2), keep=lambda v: v.z > -0.03)
    g(mix(col, '#FFFFFF', 0.5), alpha=0.85, emit=0.5).ball((0, 0, 0.0), (0.2, 0.2, 0.05))
    for i in range(6):
        a = 2 * pi * i / 6
        x, y = 0.15 * cos(a), 0.15 * sin(a)
        L = rnd.uniform(0.45, 0.8)
        g(col, alpha=0.6, emit=0.35).chain([(x, y, 0), (x + 0.05, y, -L * 0.4), (x - 0.04, y, -L * 0.75), (x + 0.03, y, -L)],
                                           [0.018, 0.016, 0.012, 0.006], n=8, seg=6)
    g.done(parent=R, shadow=False)
    return R
