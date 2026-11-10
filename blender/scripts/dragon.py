"""The sleeping dragon of Realm 4, curled around the foot of the volcano.

Built in world coordinates. The tail tip lies across the walk plane; the climb goes tail, hip, back spines,
folded wing, neck and horns.
"""
from mathutils import Vector
from kit import B, G, mat, mix, root, spline
import surfaces as S

BODY, BELLY, DARK, BONE, WING = '#A2322D', '#E4A86C', '#5E1D22', '#EFDDBA', '#6E2129'

# x, y, z, radius: tail tip -> hip -> back -> shoulder -> neck
PATH = [
    (2.3, -0.05, 0.07, 0.035), (1.0, 0.1, 0.13, 0.10), (-0.7, 0.4, 0.22, 0.19), (-2.6, 1.0, 0.34, 0.31),
    (-4.4, 2.0, 0.52, 0.48), (-5.9, 3.6, 0.85, 0.72), (-6.3, 5.6, 1.45, 1.15), (-5.3, 7.6, 2.4, 1.8),
    (-3.1, 9.0, 3.3, 2.2), (0.0, 9.6, 3.8, 2.35), (3.1, 9.0, 3.6, 2.15), (5.6, 7.5, 2.9, 1.6),
    (6.6, 5.5, 2.1, 1.2), (6.25, 3.95, 1.45, 1.0), (5.85, 3.35, 1.0, 0.9),
]


def dragon():
    pts, rr = spline([p[:3] for p in PATH], [p[3] for p in PATH], 84)
    body, belly, spines = B(), B(), B()
    body.chain(pts, rr, seg=20)
    n = len(pts)
    for i in range(n):
        p, r = pts[i], rr[i]
        if r > 0.3:
            belly.ball(p + Vector((0, -0.2 * r, -0.52 * r)), 0.6 * r, seg=18, rings=10)
        if r > 0.12 and i % 3 == 1 and i < n - 6:
            tan = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
            up = Vector((0, -0.12, 1)).normalized()
            base = p + up * (r * 0.86)
            h = 0.62 * r + 0.14
            spines.cone(base, base + up * h - tan * (h * 0.4), 0.24 * r + 0.035, 0.0, seg=8)
    body.build('Dragon.body', S.scales(BODY, '#6E1F22', '#D0563C'))
    belly.build('Dragon.belly', mat(BELLY, rough=0.8))
    spines.build('Dragon.spines', mat(BONE))

    g = G('Dragon.legs')
    limb = mix(BODY, '#000000', 0.12)
    # hind leg, folded
    g(limb).ball((-5.75, 5.5, 1.35), (1.55, 1.0, 1.35))
    g(limb).chain([(-5.2, 4.5, 0.85), (-4.1, 3.75, 0.5)], [0.62, 0.44], seg=16)
    g(limb).ball((-3.55, 3.5, 0.3), (0.62, 0.46, 0.3))
    for k in (-1, 0, 1):
        g(BONE).cone((-3.15, 3.42 + 0.24 * k, 0.2), (-2.6, 3.36 + 0.3 * k, 0.07), 0.14, 0.0, seg=8)
    # foreleg, tucked beside the head
    g(limb).ball((5.35, 6.3, 1.7), (1.25, 0.95, 1.25))
    g(limb).chain([(4.75, 5.3, 0.95), (3.7, 4.55, 0.48)], [0.56, 0.4], seg=16)
    g(limb).ball((3.1, 4.3, 0.3), (0.56, 0.42, 0.28))
    for k in (-1, 0, 1):
        g(BONE).cone((2.72, 4.24 + 0.22 * k, 0.2), (2.2, 4.2 + 0.28 * k, 0.07), 0.13, 0.0, seg=8)
    g.done()

    # folded wing lying along the flank that faces the camera
    W0, W1, W2 = Vector((3.0, 7.2, 5.0)), Vector((0.9, 7.0, 6.1)), Vector((-1.3, 6.75, 5.65))
    F = [Vector((-4.5, 6.45, 4.7)), Vector((-4.2, 6.15, 3.85)), Vector((-2.7, 6.0, 3.3)), Vector((-0.3, 6.3, 3.75))]
    w = B()
    for a, b_ in zip(F, F[1:]):
        mid = (a + b_) / 2
        mid = mid + (W2 - mid) * 0.2
        w.poly((W2, a, mid))
        w.poly((W2, mid, b_))
    w.poly((W2, F[3], W1))
    w.poly((W1, F[3], W0))
    w.build('Dragon.wing', mat(WING, rough=0.85), smooth=False)
    bones = B()
    bones.chain([W0, W1, W2], [0.2, 0.17, 0.13], seg=10)
    for f in F:
        bones.limb(W2, f, 0.11, 0.035, seg=8)
    bones.cone(W1, W1 + Vector((0.15, -0.1, 0.55)), 0.11, 0.0, seg=8)
    bones.build('Dragon.wingbones', mat(mix(BODY, '#000000', 0.2)))

    # head, asleep on the ground, facing the player
    H = root('Dragon.head', (5.85, 3.25, 0.05), 3.14159 + 0.3, 1.6)
    h = G('Dragon.headparts')
    h(BODY, rough=0.7).ball((0.1, 0, 0.56), (0.72, 0.6, 0.5)).ball((0.95, 0, 0.42), (0.72, 0.44, 0.33))
    h(BODY, rough=0.7).ball((1.5, 0, 0.4), (0.3, 0.36, 0.27))
    h(BELLY).ball((0.75, 0, 0.2), (0.85, 0.42, 0.19))
    for s in (1, -1):
        h(DARK).ball((1.63, s * 0.17, 0.53), (0.1, 0.08, 0.07))
        h(DARK).ball((0.42, s * 0.42, 0.86), (0.32, 0.16, 0.13), rot=(0, 0.25, s * -0.2))
        for k in range(17):
            u = k / 16
            h('#1A1014').ball((0.32 + 0.36 * u, s * (0.5 + 0.02 * (1 - (2 * u - 1) ** 2)), 0.69 - 0.07 * (1 - (2 * u - 1) ** 2)),
                              0.036, seg=8, rings=6)
        h(mix(BODY, '#FFFFFF', 0.12)).ball((0.5, s * 0.45, 0.6), (0.2, 0.1, 0.09))
        h('#FF8A3C', emit=3.0).ball((1.66, s * 0.17, 0.52), (0.05, 0.045, 0.04))
        h(BONE).chain([(-0.25, s * 0.36, 0.92), (-0.85, s * 0.52, 1.3), (-1.4, s * 0.56, 1.42)], [0.17, 0.11, 0.02], n=8)
        h(BONE).cone((-0.3, s * 0.52, 0.45), (-0.82, s * 0.72, 0.5), 0.13, 0.0, seg=8)
        h(BONE).cone((-0.2, s * 0.48, 0.25), (-0.62, s * 0.62, 0.22), 0.1, 0.0, seg=8)
        for x in (0.75, 1.0, 1.25):
            h(BONE).cone((x, s * 0.36, 0.3), (x + 0.02, s * 0.38, 0.14), 0.045, 0.0, seg=6)
    for x in (0.2, -0.15, -0.45):
        h(BONE).cone((x, 0, 1.0), (x - 0.15, 0, 1.34), 0.1, 0.0, seg=8)
    for x in (1.15, 1.38):
        h(BONE).cone((x, 0, 0.66), (x - 0.04, 0, 0.82), 0.06, 0.0, seg=8)
    h.done(parent=H)
    return H
