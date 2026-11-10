"""Realm 2, Aqua (x 62 to 124): down the beach, across the sea bed past the pearls of the Road to Lumofy, up to the ice."""
from math import sin, radians as rad
from kit import B, G, mat, mix, root, smoothstep, terrain
import props
import props_aqua as pa
import life_aqua as la
import gamekit as gk
import levelkit as lk

FLOOR, DEEP = '#86CDBE', '#157389'
X0, X1 = lk.AQUA
BED = lk.SEA_BED
BEACH0, BEACH1, RISE0, RISE1 = 60.5, 70.0, 114.0, 123.2
EXIT = -0.95  # the sea bed under the ice hole: he stands chest-deep there and hops out onto the ice


def bed(x):
    """Height of the sea bed along the walk: down the beach, flat, then up under the ice."""
    if x <= BEACH0:
        return 0.0
    if x < BEACH1:
        return BED * smoothstep((x - BEACH0) / (BEACH1 - BEACH0))
    if x <= RISE0:
        return BED
    if x < RISE1:
        return BED + (EXIT - BED) * smoothstep((x - RISE0) / (RISE1 - RISE0))
    return EXIT


def deep(x):
    """1 in deep water, 0 in the shallows: reefs and plants only grow where it is deep."""
    return smoothstep((x - 66) / 5) * smoothstep((118 - x) / 6)


def _reef(i, y0, depth, h, k):
    o = terrain('Reef%d' % i, 56 - k * 60, 130 + k * 60, y0, y0 + depth, int((74 + k * 120) * 0.9), 10,
                lambda x, y: bed(x) - 0.3 + (h(x) * deep(x) + 0.3) * smoothstep((y - y0) / depth), mat(FLOOR))
    gk.named_material(o, 'SeaReef%d' % i, mix(FLOOR, DEEP, k))
    return o


def _fish(name, col, s=1.0):
    R = root(name)
    for o in la.school([((0, 0, 0), 0.0, 0.0)], col, s, name + '.part'):
        o.parent = R
    return R


def export(folder):
    lk.start()
    keep = [lk.floor('Ground', 'SeaGround', FLOOR, 59, 127, lambda x, y: bed(x) - (0.1 if x < 61.7 else 0.0) + 0.05 * sin(x * 1.4 + y * 0.7) * deep(x) * (1 if y > -1 else 0.3))]  # sits just under the desert sand where they overlap
    keep += [
        _reef(1, 3.0, 4.5, lambda x: 0.55 + 0.4 * sin(x * 0.3 + 0.4) + 0.2 * sin(x * 0.8), 0.22),
        _reef(2, 9.0, 7.0, lambda x: 1.4 + 0.7 * sin(x * 0.15 + 2.0) + 0.25 * sin(x * 0.4), 0.5),
        _reef(3, 22.0, 12.0, lambda x: 2.2 + 0.6 * sin(x * 0.08 + 1.0), 0.74),
    ]
    # the surface of the Gulf (the ice of the Snow realm takes over at x = 112)
    water = B().poly(((60.6, -22, lk.SEA_LEVEL), (112.4, -22, lk.SEA_LEVEL), (112.4, 150, lk.SEA_LEVEL), (60.6, 150, lk.SEA_LEVEL))).build(
        'Water', mat('#3FB6C8'), smooth=False, shadow=False)
    gk.named_material(water, 'WaterSurface', '#3FB6C8', 0.2)
    keep.append(water)
    # a line of foam where the Gulf meets the beach
    foam = B()
    for i in range(26):
        y = -22 + i * 1.0
        x = 61.95 + 0.12 * sin(y * 1.3)
        foam.poly(((x - 0.28, y, lk.SEA_LEVEL + 0.02), (x + 0.22, y, lk.SEA_LEVEL + 0.02), (x + 0.22 + 0.1 * sin(y), y + 1.0, lk.SEA_LEVEL + 0.02),
                   (x - 0.28 + 0.1 * sin(y), y + 1.0, lk.SEA_LEVEL + 0.02)))
    foam.build('Foam', mat('#FFFFFF', emit=0.5, alpha=0.7), smooth=False, shadow=False)

    # light shafts from the surface
    shafts = B()
    for x, y, w, sl in ((73, 3, 1.3, 1.6), (78, 9, 2.2, 2.4), (84, 5, 1.0, 1.4), (90, 14, 2.6, 3.0), (95, 7, 1.5, 1.8), (101, 4, 1.2, 1.5),
                        (106, 11, 2.4, 2.6), (111, 6, 1.4, 1.7), (87, 20, 3.0, 3.4), (99, 22, 3.2, 3.6)):
        shafts.poly(((x - sl - w * 0.8, y, BED - 0.2), (x - sl + w * 0.8, y, BED - 0.2), (x + w / 2, y, lk.SEA_LEVEL), (x - w / 2, y, lk.SEA_LEVEL)))
    shafts.build('Shafts', mat('#E3FFF4', emit=1.0, alpha=0.09), smooth=False, shadow=False)

    # a dhow on the surface with its anchor line down to the sea bed
    pa.dhow_hull((93.0, 13.0, lk.SEA_LEVEL + 0.25), 1.0)
    B().limb((95.4, 13.0, lk.SEA_LEVEL), (97.6, 12.4, bed(97.6) + 1.5), 0.03).build('Rope', mat('#C9B99A'), shadow=False)
    B().limb((97.6, 12.4, BED + 2.0), (97.6, 12.4, BED + 1.4), 0.05).limb((97.2, 12.4, BED + 1.5), (98.0, 12.4, BED + 1.5), 0.05).build(
        'Anchor', mat('#3A4652'))

    # the reef garden, in clusters along the path
    reds, golds = ('#F27E8A', '#F29CB0'), ('#F6A55B', '#E9C46A')
    for i, x in enumerate((71.5, 78.0, 86.5, 94.5, 102.5, 110.0)):
        z = bed(x)
        pa.coral((x, 2.0 + 0.5 * (i % 2), z), reds[i % 2], i + 1, 1.5 - 0.2 * (i % 3))
        pa.coral((x + 1.4, 2.9, z + 0.15), golds[i % 2], i + 11, 1.1)
        pa.brain_coral((x + 2.3, 1.7, z), 0.5, golds[(i + 1) % 2])
        pa.sponge((x - 1.2, 1.1, z), '#8E6BC7', 0.9, i + 3)
        pa.coral((x + 4.0, 6.5, bed(x + 4) + 0.9), mix(reds[i % 2], DEEP, 0.4), i + 21, 2.0)
        props.rocks((x + 3.2, 2.5, z), 3, 0.42, mix('#7FA9A0', DEEP, 0.2), i + 9, flat=True)
    pa.seagrass([(x, y, bed(x)) for x, y in ((72.6, 1.2), (75.0, 1.9), (80.3, 1.3), (83.4, 0.9), (88.0, 1.4), (91.5, 1.0), (96.3, 1.6), (100.2, 1.1),
                                           (104.6, 1.5), (108.2, 0.9), (112.0, 1.3), (76.7, -0.9), (89.4, -1.2), (98.0, -1.0), (107.0, -1.3))], '#3FA47A', 1.0, 1)
    pa.seagrass([(x, 4.4, bed(x) + 0.3) for x in (74.0, 82.0, 93.0, 103.0, 111.0)], mix('#3FA47A', DEEP, 0.35), 1.4, 2)

    # the timeline: one pearl oyster for the degree and one for each earlier role
    stops = (75.0, 83.0, 91.0, 99.0, 107.0, 114.2)
    for i, x in enumerate(stops):
        pa.oyster((x, 0.85, bed(x) + 0.02), rad(180 + (20, -15, 10)[i % 3]), 1.2)

    live = [_fish('FishGold', '#FFD166', 0.85), _fish('FishBlue', '#7FC8EA', 1.2),
            la.turtle((80.0, 1.3, BED + 3.0), 0.0, 1.5), la.ray((96.0, 0.6, BED + 0.5), rad(180), 1.3),
            la.hamour((101.4, 2.2, BED + 0.95), rad(-160), 1.0), la.dugong((120.0, 26.0, BED + 2.2), rad(180), 2.6, mix('#8FA3AE', DEEP, 0.55))]
    live += [la.jellyfish((x, 4.0, BED + z), s, '#F7A8C4', int(x)) for x, z, s in ((77.0, 2.6, 1.3), (89.0, 2.2, 1.0), (104.0, 2.7, 1.4), (110.5, 2.0, 0.9))]

    # the walk follows the sea bed in short straight pieces
    xs = [BEACH0 + (BEACH1 - BEACH0) * i / 8 for i in range(9)] + [RISE0 + (RISE1 - RISE0) * i / 8 for i in range(9)]
    solids = [dict(x0=a, x1=b, y0=bed(a), y1=bed(b), kind='ground') for a, b in zip(xs, xs[1:])]
    return lk.finish('aqua', folder, keep, live, dict(
        x0=X0, x1=X1, solids=solids,
        cam=[[BEACH0 - 0.5, 0.0], [BEACH1 + 1, -3.1], [RISE0, -3.1], [RISE1 + 0.5, 0.0]],
        # he wades in until the water is chest-deep, floats, and stands again in the shallows under the ice hole
        zones=[dict(mode='swim', x0=63.2, x1=123.2, hover=1.35, ease_in=2.6, ease_out=3.2)],
        anchors=[dict(id='education', x=stops[0])] + [dict(id='role-%d' % i, x=x) for i, x in enumerate(stops[1:])],
        titles=[dict(text='ROAD TO LUMOFY', x=63.4)],
        life=dict(turtle=dict(x=80.0, depth=1.3, height=BED + 3.0), ray=dict(x=96.0, depth=0.6, height=BED + 0.5),
                  hamour=dict(x=101.4, depth=2.2, height=BED + 0.95), dugong=dict(x0=128.0, x1=58.0, depth=26.0, height=BED + 2.2),
                  school=dict(x0=68.0, x1=116.0, depth=0.9, height=BED + 1.9), sea_level=lk.SEA_LEVEL, bed=BED),
    ))
