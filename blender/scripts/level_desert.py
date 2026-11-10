"""Realm 1, the Desert (x 0 to 62): about me, player stats and the Bahrain heritage trail, down to the shore."""
from math import sin, radians as rad
from kit import B, G, mat, mix, relief, root, smoothstep
import props
import life
import levelkit as lk

SAND, HAZE, ROCK = '#EEC88F', '#FBE6C4', '#C4A57C'
X0, X1 = lk.DESERT

# stone steps he hops onto: x0, x1, top
STEPS = [(24.0, 26.4, 0.55), (26.4, 29.2, 1.1), (29.2, 31.4, 0.55)]


def _steps():
    """Weathered sandstone: each step is a stack of soft-edged slabs, with sand drifted against its foot."""
    g = G('steps')
    for i, (x0, x1, top) in enumerate(STEPS):
        cx, w = (x0 + x1) / 2, x1 - x0
        n = max(1, round(top / 0.28))
        for k in range(n):
            z0, z1 = top * k / n, top * (k + 1) / n
            g(('#C9A877', '#BE9C6B', '#D2B383')[(i + k) % 3]).rbox((cx + 0.03 * (k % 2), 0.1, (z0 + z1) / 2 - 0.02),
                                                                  (w + 0.1 - 0.06 * (k % 2), 2.3 + 0.12 * (k % 2), z1 - z0 + 0.03), 0.09, seg=2)
        g('#DCC090').rbox((cx, 0.1, top - 0.03), (w + 0.12, 2.42, 0.06), 0.03, seg=2)
    g.done()
    drift = B()
    for x, y in ((STEPS[0][0] - 0.1, 1.5), (STEPS[0][0] + 0.2, -1.5), (STEPS[-1][1] + 0.1, 1.5), (STEPS[-1][1] - 0.2, -1.5), (STEPS[1][0], 1.7)):
        drift.ball((x, y, -0.06), (1.2, 0.7, 0.26))
    drift.build('Drift', mat(SAND))


def signpost(loc, arrow=1, wood='#8A6A4A', board='#A8845C'):
    R = root('Sign', loc)
    g = G('sign')
    g(wood).rbox((0, 0, 0.8), (0.11, 0.11, 1.6), 0.03)
    g(board).rbox((0.2 * arrow, -0.05, 1.3), (0.9, 0.07, 0.3), 0.03)
    g(board).cone((0.64 * arrow, -0.05, 1.3), (0.92 * arrow, -0.05, 1.3), 0.21, 0.0, seg=4)
    g.done(parent=R)
    return R


def export(folder):
    lk.start()
    bumps = relief(0.13, 0.05)
    flat = lambda x: 0.0 if STEPS[0][0] - 1.5 < x < STEPS[-1][1] + 1.5 else 1.0
    # the land runs out at the shore: the dunes sink towards the sea
    shore = lambda x: smoothstep((X1 + 12 - x) / 14)
    keep = [lk.floor('Ground', 'SandGround', SAND, -45, X1 + 1.5, lambda x, y: bumps(x, y) * flat(x))]
    keep += lk.hills('Dune', 'SandDune', SAND, HAZE, [
        (lambda x: -0.3 + (1.05 + 0.45 * sin(x * 0.22 + 1.0) + 0.2 * sin(x * 0.61)) * shore(x), 3.0, 5.0, 0.12),
        (lambda x: -0.3 + (2.4 + 1.0 * sin(x * 0.12 + 2.2) + 0.35 * sin(x * 0.31)) * shore(x), 9.5, 8.0, 0.36),
        (lambda x: -0.3 + (4.3 + 1.7 * sin(x * 0.07 + 0.5)) * shore(x - 6), 24, 12, 0.6),
        (lambda x: -0.3 + (6.9 + 2.4 * sin(x * 0.045 + 4.0)) * shore(x - 14), 46, 18, 0.8),
    ], -45, X1 + 30)

    # the heritage trail: Qal'at al-Bahrain far off on its mound, the Tree of Life, Arad Fort with the flag
    props.fort((33.0, 34.0, 4.6), mix('#DDBE92', HAZE, 0.5), 1.25)
    props.tree_of_life((45.5, 14.6, 2.75), 0.95)
    props.fort((55.5, 21.5, 2.3), mix('#DDBE92', HAZE, 0.3), 0.8)
    props.flag_bahrain((59.9, 20.9, 5.4), 3.0, 2.0, 1.2)
    props.skyline((74.0, 70.0, 0.4), mix('#C9B7A6', HAZE, 0.62), 1.15)
    for x, z, s, c, sd in ((-30, 26, 3.2, '#FFF6E8', 1), (-4, 30, 2.3, '#FFFFFF', 2), (16, 21, 1.9, '#FFEBD2', 3), (38, 28, 2.7, '#FFF6E8', 4),
                           (58, 23, 2.2, '#FFFFFF', 5), (78, 30, 3.0, '#FFF6E8', 6), (98, 22, 2.0, '#FFEBD2', 7)):
        props.cloud((x, 95, z), s, c, sd)

    palms = [props.palm((x, y, 0.1), h, lean, sd) for x, y, h, lean, sd in (
        (-4.2, 2.4, 4.6, 0.7, 1), (-2.9, 3.4, 3.4, -0.5, 2), (10.2, 2.9, 3.9, 0.6, 3), (20.6, 2.6, 4.4, -0.6, 4), (21.9, 3.5, 3.2, 0.5, 5),
        (34.2, 2.8, 4.1, 0.6, 6), (41.0, 3.2, 3.6, -0.5, 7), (50.5, 2.5, 4.5, 0.6, 8), (52.0, 3.4, 3.3, -0.4, 9), (58.6, 2.7, 4.0, 0.5, 10))]
    for x, y, n, s, sd in ((-5.0, 1.5, 3, 0.34, 4), (7.0, 1.7, 2, 0.3, 5), (18.2, 1.6, 3, 0.36, 6), (33.0, 1.5, 2, 0.3, 7),
                           (42.5, 1.8, 3, 0.34, 8), (48.0, 1.5, 2, 0.32, 9), (57.0, 1.6, 3, 0.4, 10), (12.5, -1.9, 2, 0.28, 11), (38.0, -2.0, 2, 0.3, 12)):
        props.rocks((x, y, 0), n, s, ROCK, sd)
    props.tufts([(-1.9, 1.3), (5.8, 1.0), (2.0, 1.9), (8.6, 0.9), (-5.2, -1.6), (3.9, -2.2), (13.6, 1.4), (17.0, -1.7), (22.8, 1.2),
                 (32.2, 1.1), (36.5, 1.7), (41.2, -1.9), (46.0, 1.3), (50.4, 1.0), (54.2, -1.8), (57.4, 1.4)])
    signpost((2.6, 1.5, 0.0))
    _steps()

    camel = life.camel((16.4, 1.5, 0), rad(168), 1.0)
    hare = life.hare((6.2, 0.45, 0), 0.0, 1.0)
    falcon = life.falcon((4.0, 7.0, 5.6), 0.0, 1.25)
    # flamingos wade in the shallows where the desert meets the Gulf
    birds = [life.flamingo((62.6, 2.6, -0.5), rad(200), 1.2), life.flamingo((64.0, 3.4, -1.0), rad(160), 1.2, bent=True),
             life.flamingo((63.3, 5.0, -0.65), rad(20), 1.1)]
    live = [camel, hare, falcon] + birds + palms
    return lk.finish('desert', folder, keep, live, dict(
        x0=X0, x1=X1,
        solids=[dict(x0=-10.0, x1=60.5, y0=0.0, y1=0.0, kind='ground')] + [dict(x0=a, x1=b, y0=t, y1=t, kind='platform') for a, b, t in STEPS],
        cam=[[X0, 0.0], [X1 - 2, 0.0]],
        zones=[],
        anchors=[dict(id='about', x=9.5), dict(id='stats', x=20.4), dict(id='qalat', x=36.0), dict(id='tree', x=45.6), dict(id='arad', x=55.0)],
        titles=[dict(text='ABOUT ME', x=3.6)],
        life=dict(camel=dict(x=16.4), hare=dict(x=6.2, y=0.45, min=2.5, max=21.5), falcon=dict(x=4.0, height=5.6, depth=7.0)),
    ))
