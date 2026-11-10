"""Animals of Realm 1, the Desert. Each faces +X with its origin on the ground (or at its centre if it flies)."""
from math import pi
from kit import G, root, eye

EYE, WHITE = '#1E1614', '#FFFFFF'


def _eyes(g, x, y, z, r):
    for s in (1, -1):
        eye(g(EYE), g(WHITE, emit=0.8), x, s * y, z, r)


def camel(loc, rz=0.0, scale=1.0, head_turn=0.0):
    R = root('Camel', loc, rz, scale)
    g = G('camel')
    c, d, l, hoof = '#CDA06A', '#B58A55', '#E2BF8E', '#8A6A44'
    g(c).ball((0, 0, 1.32), (0.82, 0.40, 0.46)).ball((-0.02, 0, 1.74), (0.40, 0.30, 0.34))
    g(l).ball((0.02, 0, 1.16), (0.7, 0.36, 0.32))
    g(d).ball((-0.02, 0, 2.07), (0.17, 0.15, 0.06))
    g(c).chain([(0.62, 0, 1.40), (0.92, 0, 1.62), (1.02, 0, 2.0), (1.10, 0, 2.28)], [0.24, 0.18, 0.14, 0.13], n=10)
    for x, z in ((0.7, 1.24), (0.82, 1.36), (0.93, 1.5)):
        g(d).ball((x, 0, z), (0.09, 0.1, 0.09))
    for s in (1, -1):
        for x in (0.52, -0.52):
            g(d).chain([(x, s * 0.2, 1.12), (x + 0.05, s * 0.2, 0.64), (x, s * 0.2, 0.12)], [0.14, 0.075, 0.062])
            g(d).ball((x + 0.05, s * 0.2, 0.64), 0.098)
            g(hoof).ball((x + 0.05, s * 0.2, 0.06), (0.15, 0.12, 0.065))
    # Sadu blanket: red with white and black bands (spheres turned so their rings run across the back).
    r90 = (0, pi / 2, 0)
    g('#B23A3A').ball((0, 0, 1.34), (0.50, 0.43, 0.66), rot=r90, seg=28, rings=40, keep=lambda v: v.z > 1.36)
    for x, col in ((0.40, '#F4EFE6'), (-0.40, '#F4EFE6'), (0.22, '#1E1A1C'), (-0.22, '#1E1A1C'), (0.0, '#E9B44C')):
        g(col).ball((0, 0, 1.34), (0.508, 0.438, 0.672), rot=r90, seg=28, rings=44,
                    keep=lambda v, x=x: v.z > 1.36 and abs(v.x - x) < 0.065)
    for i in range(7):
        for s in (1, -1):
            g('#F4EFE6').limb((-0.48 + i * 0.16, s * 0.435, 1.36), (-0.48 + i * 0.16, s * 0.445, 1.24), 0.014, seg=6)
            g('#B23A3A').ball((-0.48 + i * 0.16, s * 0.445, 1.22), 0.035, seg=8, rings=6)
    g.done(parent=R)
    # the tail on its own root, so it can swish
    T = root('Camel.tail', (-0.8, 0, 1.42), parent=R)
    t = G('cameltail')
    t(d).limb((0, 0, 0), (-0.15, 0, -0.47), 0.045, 0.03)
    t(hoof).ball((-0.16, 0, -0.54), (0.06, 0.06, 0.09))
    t.done(parent=T)
    # head on its own root so it can turn towards the player
    H = root('Camel.head', (1.10, 0, 2.28), parent=R, rot=(0, 0, head_turn))
    h = G('camelhead')
    h(c).ball((0.14, 0, 0.05), (0.26, 0.16, 0.16))
    h(l).ball((0.35, 0, -0.01), (0.16, 0.135, 0.125))
    h(d).ball((0.06, 0, 0.2), (0.11, 0.1, 0.05))
    for s in (1, -1):
        h(c).ball((0.0, s * 0.14, 0.2), (0.05, 0.03, 0.085), rot=(s * 0.4, 0, 0))
        h(c).ball((0.22, s * 0.128, 0.135), (0.06, 0.03, 0.022))
        h('#3A2A22').ball((0.47, s * 0.05, 0.02), (0.02, 0.025, 0.02), seg=8, rings=6)
    _eyes(h, 0.23, 0.138, 0.085, 0.036)
    h('#B23A3A').ball((0.27, 0, 0.0), (0.035, 0.152, 0.142))
    h('#B23A3A').limb((0.27, 0, -0.13), (0.27, 0, -0.24), 0.018, seg=6).ball((0.27, 0, -0.275), 0.042)
    h.done(parent=H)
    return R


def hare(loc, rz=0.0, scale=1.0, col='#C9AE86', rot=None, inner='#E9B7A8'):
    R = root('Hare', loc, rz, scale, rot=rot)
    g = G('hare')
    g(col).ball((0, 0, 0.22), (0.24, 0.13, 0.15)).ball((-0.1, 0, 0.21), (0.17, 0.14, 0.17))
    g(col).ball((0.24, 0, 0.37), (0.115, 0.095, 0.095)).ball((0.31, 0, 0.345), (0.06, 0.06, 0.05))
    for s in (1, -1):
        g(col).ball((0.19, s * 0.045, 0.56), (0.035, 0.025, 0.15), rot=(0, -0.35, 0))
        g(inner).ball((0.2, s * 0.062, 0.56), (0.02, 0.012, 0.11), rot=(0, -0.35, 0))
        g(col).ball((0.14, s * 0.07, 0.05), (0.08, 0.03, 0.04)).ball((-0.14, s * 0.09, 0.05), (0.13, 0.04, 0.045))
    _eyes(g, 0.29, 0.078, 0.4, 0.024)
    g(inner).ball((0.365, 0, 0.36), 0.016, seg=8, rings=6)
    g(WHITE).ball((-0.28, 0, 0.25), 0.06)
    g.done(parent=R)
    return R


def falcon(loc, rz=0.0, scale=1.0, bank=0.25):
    R = root('Falcon', loc, rz, scale, rot=(bank, 0, rz))
    g = G('falcon')
    c, dk, cream = '#7A5B45', '#4A372B', '#EFE2C8'
    g(c).ball((0, 0, 0), (0.32, 0.11, 0.1))
    g(cream).ball((0.06, 0, -0.035), (0.25, 0.095, 0.075))
    g(dk).ball((0.3, 0, 0.035), 0.088)
    g(cream).ball((0.33, 0, 0.0), (0.06, 0.07, 0.05))
    g('#E9B44C').cone((0.37, 0, 0.03), (0.43, 0, 0.02), 0.035, 0.03, seg=8)
    g('#3A3A44').cone((0.43, 0, 0.02), (0.48, 0, -0.03), 0.03, 0.0, seg=8)
    for s in (1, -1):
        for k in range(3):
            g(dk).ball((0.02 + 0.07 * k, s * 0.06, -0.085), (0.012, 0.03, 0.01), seg=6, rings=4)
    _eyes(g, 0.345, 0.062, 0.06, 0.02)
    for k in (-1, 0, 1):
        g(dk).ball((-0.4, k * 0.07, 0), (0.17, 0.045, 0.016), rot=(0, 0, k * 0.25))
    g.done(parent=R)
    # each wing on its own root, so the game can flap it
    for s, side in ((1, 'L'), (-1, 'R')):
        W = root('Falcon.wing' + side, (0.02, s * 0.08, 0.05), parent=R)
        w = G('wing' + side)
        w(c).ball((0, s * 0.22, 0.01), (0.2, 0.3, 0.03), rot=(s * 0.25, 0, 0))
        w(dk).ball((-0.12, s * 0.62, 0.11), (0.13, 0.32, 0.022), rot=(s * 0.36, 0, s * 0.5))
        w.done(parent=W)
    return R


def flamingo(loc, rz=0.0, scale=1.0, bent=False):
    R = root('Flamingo', loc, rz, scale)
    g = G('flamingo')
    p, p2 = '#F6A9AE', '#EE8A93'
    g(p).ball((0, 0, 1.0), (0.30, 0.15, 0.19))
    g(p).chain([(0.22, 0, 1.08), (0.38, 0, 1.3), (0.27, 0, 1.55), (0.38, 0, 1.74)], [0.055, 0.04, 0.035, 0.035], n=12)
    g(p).ball((0.43, 0, 1.76), 0.068)
    g('#F4EFE6').cone((0.47, 0, 1.75), (0.55, 0, 1.69), 0.04, 0.03, seg=8)
    g('#2A2224').cone((0.55, 0, 1.69), (0.6, 0, 1.6), 0.03, 0.005, seg=8)
    _eyes(g, 0.46, 0.052, 1.79, 0.016)
    for s in (1, -1):
        g(p2).ball((-0.04, s * 0.1, 1.03), (0.25, 0.07, 0.14))
        g('#3A2A30').ball((-0.24, s * 0.09, 0.98), (0.1, 0.05, 0.06))
    g(p2).limb((0, 0.05, 0.85), (0.02, 0.05, 0.0), 0.016).ball((0.01, 0.05, 0.45), 0.026)
    if bent:
        g(p2).limb((0, -0.05, 0.85), (0.16, -0.05, 0.6), 0.016).limb((0.16, -0.05, 0.6), (0.0, -0.05, 0.5), 0.016)
        g(p2).ball((0.16, -0.05, 0.6), 0.026)
    else:
        g(p2).limb((0, -0.05, 0.85), (-0.03, -0.05, 0.0), 0.016).ball((-0.015, -0.05, 0.45), 0.026)
    g.done(parent=R)
    return R
