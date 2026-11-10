"""Realm 3, Snow (x 124 to 204): the frozen Gulf, the Discipline Lab cabin, the AI Lab ice cave, the cable car over the gorge."""
from math import sin, cos, pi, radians as rad
from kit import B, G, mat, mix, relief, root, smoothstep
import props
import props_snow as ps
import life
import life_snow as ls
import gamekit as gk
import levelkit as lk

SNOW, HAZE, ICE = '#EAF1FB', '#AFBDE3', '#BEE2F4'
X0, X1 = lk.SNOW
ICE0, ICE1 = 112.0, 142.0                      # the frozen Gulf (it starts over the end of the Aqua realm)
HOLE = (120.8, 123.2, 1.3)                     # the hole he surfaces through: x0, x1, half depth
RIDE0, RIDE_TOP, RIDE1, RIDE_H = 190.5, 197.0, 203.5, 3.0


def ride_height(x):
    """Floor of the cable car along its ride over the gorge."""
    if x <= RIDE0 or x >= RIDE1:
        return 0.0
    return RIDE_H * sin(pi * (x - RIDE0) / (RIDE1 - RIDE0)) ** 1.0


def gorge(x):
    return -7.5 * smoothstep((x - 190.6) / 1.4) * smoothstep((203.4 - x) / 1.4)


def _gondola():
    """Open cable car: a floor, a back wall and a roof, so he stays visible while he rides."""
    R = root('Gondola', (RIDE0, 0, 0))
    g = G('gondola')
    red, dark = '#C83A36', '#39445C'
    g(red).rbox((0, 0.1, -0.09), (3.0, 1.5, 0.16), 0.05)
    g(red).rbox((0, 0.82, 0.55), (3.0, 0.1, 1.2), 0.04)
    g('#CFE6FF', emit=0.4).rbox((0, 0.8, 1.55), (2.7, 0.06, 0.8), 0.03)
    g(mix(red, '#000000', 0.3)).rbox((0, 0.1, 2.38), (3.2, 1.7, 0.16), 0.06)
    for sx in (-1.42, 1.42):
        g(dark).rbox((sx, 0.82, 1.2), (0.1, 0.1, 2.4), 0.03)
        g(dark).rbox((sx, -0.6, 0.45), (0.08, 0.08, 1.0), 0.03)
    g(dark).rbox((0, -0.6, 0.95), (2.92, 0.07, 0.07), 0.02)
    g(dark).limb((0, 0.1, 2.45), (0, 0.1, 3.25), 0.07).rbox((0, 0.1, 3.3), (0.7, 0.2, 0.2), 0.05)
    g.done(parent=R)
    return R


def _station(x, col='#2D3957'):
    g = G('station')
    g(col).rbox((x, 2.6, 1.1), (2.4, 1.6, 2.2), 0.05)
    g('#F2F7FD').rbox((x, 2.6, 2.32), (2.8, 2.0, 0.24), 0.1)
    g('#FFD58A', emit=1.6).rbox((x, 1.78, 1.2), (1.0, 0.05, 0.7), 0.03)
    g('#39445C').limb((x - 0.6, 1.3, 0), (x, 1.3, 3.5), 0.1, 0.07).limb((x + 0.6, 1.3, 0), (x, 1.3, 3.5), 0.1, 0.07)
    return g.done()


def _ai_lab(x):
    """The AI Lab: an ice cave. Two ice pillars and a lintel hung with icicles frame its mouth; inside, racks glow."""
    B().ico((x, 6.6, 1.2), (6.4, 3.6, 4.5), sub=2, jitter=0.12, seed=4).build('Cave', mat('#CFE3F7', rough=0.4), smooth=False)
    g = G('lab')
    g('#0F1A30').rbox((x, 3.0, 1.5), (4.6, 0.5, 3.1), 0.2)
    ice = '#E3F1FC'
    for sx in (-2.55, 2.55):
        g(ice).cone((x + sx, 2.6, 0), (x + sx * 0.93, 2.6, 3.5), 0.52, 0.32, seg=6)
    g(ice).rbox((x, 2.6, 3.6), (5.8, 0.75, 0.5), 0.12, seg=1)
    for i in range(9):
        g('#F4FAFF').cone((x - 2.0 + i * 0.5, 2.5, 3.4), (x - 2.0 + i * 0.5, 2.5, 3.0 - 0.25 * (i % 3)), 0.09, 0.0, seg=6)
    g('#7FE9FF', emit=1.6, alpha=0.8).rbox((x, 2.7, 2.05), (1.9, 0.04, 1.0), 0.03)
    for sx in (-1.6, 1.6):
        g('#1E2B44').rbox((x + sx, 2.6, 0.9), (0.85, 0.6, 1.8), 0.05)
        for k in range(6):
            g('#63F0BE' if k % 2 else '#7CC6FF', emit=2.2).rbox((x + sx, 2.29, 0.28 + 0.26 * k), (0.6, 0.03, 0.05), 0.01)
    g('#7FE9FF', emit=1.0, alpha=0.5).rbox((x, 2.0, 0.02), (3.4, 0.9, 0.03), 0.01)
    return g.done()


def export(folder):
    lk.start()
    bumps = relief(0.12, 0.05, seed=2.0)
    keep = [lk.floor('Ground', 'SnowGround', SNOW, 139.0, 205.0,
                     lambda x, y: bumps(x, y) * smoothstep((x - 142) / 2.5) * smoothstep((189.5 - x) / 2) + gorge(x))]
    shade = '#C4D5F3'
    keep += lk.hills('Hill', 'SnowHill', SNOW, HAZE, [
        (lambda x: 0.7 + 0.45 * sin(x * 0.2 + 2.0) + 0.2 * sin(x * 0.55), 3.0, 5.0, 0.14),
        (lambda x: 2.0 + 1.0 * sin(x * 0.11 + 0.7) + 0.35 * sin(x * 0.3), 9.5, 8.0, 0.4),
        (lambda x: 3.6 + 1.4 * sin(x * 0.07 + 3.0), 24, 12, 0.66),
    ], 105, 215, fade=(100, 116, 200, 214), sink=0.2)

    # the frozen Gulf: one slab of ice with the hole he climbs out of
    ice = B()
    hx0, hx1, hd = HOLE
    for x0, x1, y0, y1 in ((ICE0, hx0, -22, 40), (hx1, ICE1, -22, 40), (hx0, hx1, hd, 40), (hx0, hx1, -22, -hd)):
        ice.rbox(((x0 + x1) / 2, (y0 + y1) / 2, -0.2), (x1 - x0, y1 - y0, 0.4), 0)
    slab = ice.build('Ice', mat(ICE, rough=0.12), smooth=False)
    gk.named_material(slab, 'IceSheet', ICE, 0.12)
    keep.append(slab)
    rim = B()
    for i in range(18):
        a = 2 * pi * i / 18
        rim.ball(((hx0 + hx1) / 2 + 1.45 * cos(a), hd * 1.12 * sin(a), 0.03), (0.22, 0.18, 0.09), seg=10, rings=6)
    rim.build('HoleRim', mat('#F2F7FD'))
    ps.ice_hole((133.0, 1.7, 0.0), 0.6)

    for i, (xs, y, r, h, sd) in enumerate(((118, 62, 9, 10, 1), (133, 74, 11, 13, 2), (146, 58, 7.5, 8, 3), (160, 70, 9, 10.5, 6),
                                          (176, 66, 13, 19, 4), (192, 80, 10, 11, 5), (207, 64, 9, 12, 7))):
        k = 0.5 + 0.004 * y
        ps.peak((xs, y, 0.4), r, h, mix('#9DB7E2', HAZE, k), mix('#F4F8FE', HAZE, k * 0.6), sd)

    for x, y, h, sd in ((143.6, 3.2, 3.6, 1), (144.8, 4.0, 2.6, 2), (156.6, 3.0, 4.2, 3), (158.2, 4.6, 3.0, 4), (139.0, 5.4, 3.2, 5),
                        (163.5, 3.3, 3.8, 6), (169.0, 4.2, 3.0, 7), (172.4, 3.0, 4.4, 8), (186.4, 3.6, 3.4, 9), (127.0, 6.0, 2.8, 10)):
        ps.pine((x, y, 0.15), h, sd)
    ps.cabin((151.0, 2.9, 0.0), 0.95)
    _ai_lab(180.5)
    _station(188.8)
    props.rocks((166.0, 1.4, 0), 2, 0.3, '#B9C6DE', 6)
    props.rocks((175.0, -1.8, 0), 2, 0.28, '#B9C6DE', 7)
    ps.signpost((146.0, 1.5, 0.0), 1.0)

    # the cable over the gorge, and the gorge itself: lava far below, steam where it meets the ice
    cable = B()
    pts = [(RIDE0 - 1.7 + (RIDE1 - RIDE0 + 3.4) * i / 30, 0.1, 0) for i in range(31)]
    cable.chain([(x, y, ride_height(x) + 3.3 + (0.2 if x < RIDE0 or x > RIDE1 else 0)) for x, y, _ in pts], [0.04] * 31, seg=6)
    cable.build('Cable', mat('#39445C'), shadow=False)
    B().poly(((191.5, -6, -7.2), (202.5, -6, -7.2), (202.5, 12, -7.2), (191.5, 12, -7.2))).build('GorgeLava', mat('#FF7A1F', emit=3.0), smooth=False, shadow=False)
    steam = G('steam')
    for i, (x, y, z, r) in enumerate(((193.0, 3.0, -4.6, 1.2), (195.5, 4.0, -3.2, 1.5), (198.5, 3.4, -4.0, 1.3), (201.0, 4.4, -2.8, 1.6), (196.8, 5.6, -1.6, 1.9))):
        steam('#EAF0FA', alpha=0.34).ball((x, y, z), (r * 1.2, r, r * 0.8))
    steam.done(shadow=False)

    owl = ls.owl((146.15, 1.46, 1.53), rad(-150), 1.15)
    fox = ls.fox((149.5, 0.35, 0.0), 0.0, 1.25)
    hare = life.hare((161.0, 0.5, 0), rad(180), 1.1, '#F6F9FD')
    seal = ls.seal((133.0, 1.7, 0.05), rad(-40), 1.0)
    gondola = _gondola()
    live = [owl, fox, hare, seal, gondola]

    ride = [RIDE0 + (RIDE1 - RIDE0) * i / 12 for i in range(13)]
    solids = [dict(x0=hx1, x1=RIDE0, y0=0.0, y1=0.0, kind='ground')]
    solids += [dict(x0=a, x1=b, y0=ride_height(a), y1=ride_height(b), kind='platform') for a, b in zip(ride, ride[1:])]
    return lk.finish('snow', folder, keep, live, dict(
        x0=X0, x1=X1, solids=solids,
        cam=[[X0, 0.0], [RIDE0 - 1.5, 0.0], [RIDE_TOP, 2.6], [RIDE1 + 1.5, 0.0]],
        zones=[dict(mode='skate', x0=X0, x1=ICE1 - 0.6), dict(mode='ride', x0=RIDE0, x1=RIDE1)],
        anchors=[dict(id='values', x=147.6), dict(id='skills-build', x=157.4), dict(id='skills-people', x=165.6),
                 dict(id='role', x=173.4), dict(id='projects', x=180.6), dict(id='stack', x=187.2)],
        titles=[dict(text='DISCIPLINE LAB', x=137.6), dict(text='AI LAB', x=167.0)],
        life=dict(owl=dict(x=146.15), fox=dict(x=149.5, y=0.35, min=148.0, max=168.0), hare=dict(x=161.0, y=0.5, min=154.0, max=171.0),
                  seal=dict(x=133.0), gondola=dict(x0=RIDE0, x1=RIDE1, top=RIDE_H)),
    ))
