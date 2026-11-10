"""Animals of Realm 3, Snow. Each faces +X with its origin on the ground."""
import random
from kit import G, mix, root, eye

EYE, WHITE = '#1E1614', '#FFFFFF'


def _eyes(g, x, y, z, r):
    for s in (1, -1):
        eye(g(EYE), g(WHITE, emit=0.8), x, s * y, z, r)


def fox(loc, rz=0.0, scale=1.0, pitch=0.0, col='#F6F9FD', leap=False):
    """Arctic fox. With leap=True it is caught mid-pounce: legs stretched, tail up."""
    R = root('Fox', loc, rz, scale, rot=(0, pitch, rz))
    g = G('fox')
    shade = mix(col, '#B9C6DC', 0.55)
    g(col).ball((0, 0, 0.36), (0.34, 0.15, 0.17)).ball((0.2, 0, 0.38), (0.18, 0.15, 0.18))
    g(col).ball((0.4, 0, 0.52), (0.14, 0.12, 0.115))
    g(col).cone((0.48, 0, 0.5), (0.63, 0, 0.46), 0.065, 0.03, seg=10)
    g(EYE).ball((0.645, 0, 0.462), 0.03)
    tail = [(-0.3, 0, 0.4), (-0.55, 0, 0.62), (-0.76, 0, 0.78)] if leap else [(-0.3, 0, 0.38), (-0.55, 0, 0.48), (-0.8, 0, 0.4)]
    for s in (1, -1):
        g(col).cone((0.36, s * 0.07, 0.6), (0.34, s * 0.09, 0.78), 0.052, 0.0, seg=8)
        g('#C9D3E6').cone((0.375, s * 0.072, 0.62), (0.352, s * 0.088, 0.74), 0.03, 0.0, seg=8)
        g(col).ball((0.37, s * 0.105, 0.47), (0.07, 0.05, 0.06))
        if leap:
            g(shade).limb((0.2, s * 0.08, 0.3), (0.46, s * 0.08, 0.14), 0.04, 0.03)
            g(shade).limb((-0.22, s * 0.09, 0.3), (-0.5, s * 0.09, 0.2), 0.045, 0.03)
        else:
            g(shade).limb((0.2, s * 0.08, 0.3), (0.24, s * 0.08, 0.03), 0.04, 0.03)
            g(shade).limb((-0.22, s * 0.09, 0.3), (-0.2, s * 0.09, 0.03), 0.045, 0.03)
    _eyes(g, 0.5, 0.078, 0.56, 0.022)
    g.done(parent=R)
    # the brush on its own root, so it can wag
    T = root('Fox.tail', tail[0], parent=R)
    t = G('foxtail')
    t(col).chain([(0, 0, 0)] + [(p[0] - tail[0][0], 0, p[2] - tail[0][2]) for p in tail[1:]], [0.09, 0.15, 0.07], n=8)
    t.done(parent=T)
    return R


def owl(loc, rz=0.0, scale=1.0, head_turn=0.0):
    rnd = random.Random(4)
    R = root('Owl', loc, rz, scale)
    g = G('owl')
    w, d = '#F4F6FA', '#D5DCE8'
    g(w).ball((0, 0, 0.22), (0.15, 0.17, 0.23))
    for s in (1, -1):
        g(d).ball((-0.02, s * 0.15, 0.22), (0.1, 0.04, 0.19))
        g('#3A3A44').limb((0.06, s * 0.05, 0.02), (0.1, s * 0.05, 0.0), 0.02)
    g(d).ball((-0.14, 0, 0.08), (0.08, 0.1, 0.03))
    for _ in range(14):
        y, z = rnd.uniform(-0.1, 0.1), rnd.uniform(0.08, 0.34)
        g('#8D97A8').ball((0.145 * (1 - (y / 0.17) ** 2 - ((z - 0.22) / 0.23) ** 2) ** 0.5, y, z), (0.01, 0.022, 0.012), seg=6, rings=4)
    g.done(parent=R)
    H = root('Owl.head', (0.02, 0, 0.5), parent=R, rot=(0, 0, head_turn))
    h = G('owlhead')
    h(w).ball((0, 0, 0), (0.15, 0.165, 0.13))
    h(WHITE).ball((0.07, 0, 0.0), (0.09, 0.15, 0.115))
    for s in (1, -1):
        h('#F2C14E').ball((0.135, s * 0.068, 0.02), (0.02, 0.055, 0.055))
        eye(h(EYE), h(WHITE, emit=0.8), 0.15, s * 0.068, 0.02, 0.028)
        h('#8D97A8').ball((0.14, s * 0.07, 0.085), (0.015, 0.055, 0.012), rot=(s * 0.35, 0, 0))
    h('#3A3A44').cone((0.15, 0, -0.01), (0.2, 0, -0.055), 0.028, 0.0, seg=8)
    h.done(parent=H)
    return R


def seal(loc, rz=0.0, scale=1.0):
    """A seal popping up through a hole in the ice (the origin is the water line)."""
    R = root('Seal', loc, rz, scale)
    g = G('seal')
    c, b, d = '#8E9BAE', '#C9D2DE', '#6F7C90'
    g(c).chain([(0, 0, -0.3), (0, 0, 0.2), (0.07, 0, 0.5)], [0.25, 0.23, 0.17], n=6)
    g(b).ball((0.1, 0, 0.2), (0.17, 0.17, 0.26))
    g(c).ball((0.12, 0, 0.63), (0.18, 0.16, 0.15))
    g(b).ball((0.27, 0, 0.59), (0.095, 0.1, 0.075))
    g(EYE).ball((0.36, 0, 0.61), 0.03)
    for x, y, z in ((-0.12, 0.1, 0.4), (-0.16, -0.05, 0.25), (-0.1, -0.14, 0.5), (-0.03, 0.12, 0.72), (-0.05, -0.08, 0.74)):
        g(d).ball((x, y, z), (0.03, 0.04, 0.04), seg=8, rings=6)
    for s in (1, -1):
        eye(g(EYE), g(WHITE, emit=0.8), 0.235, s * 0.105, 0.69, 0.038)
        g(c).ball((0.12, s * 0.24, 0.16), (0.1, 0.05, 0.16), rot=(s * -0.5, 0, 0))
        for k in (-1, 0, 1):
            g(WHITE).limb((0.33, s * 0.07, 0.58), (0.4, s * 0.2, 0.58 + 0.035 * k), 0.006, seg=5)
    g.done(parent=R)
    return R
