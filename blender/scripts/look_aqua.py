"""Phase 0 look: Realm 2, Aqua, under the Gulf at midday."""
from math import sin, radians as rad
from kit import (B, mat, mix, terrain, ridge, backdrop, glow, at, sun, ambient, camera, setup, clear, render, post, quad)
import surfaces as S
from sayed import sayed
import props
import props_aqua as pa
import life_aqua as la

FLOOR, DEEP = '#86CDBE', '#157389'


def build(out, res=(1600, 900)):
    clear()
    setup(res)
    camera()
    backdrop([(-1.3, '#0C4660'), (1.3, '#147590'), (3.4, '#1F9FB2'), (5.4, '#62D2D2'), (6.9, '#C4F5EC')])
    glow(at(1.5, 7.4, 110), 60, '#E6FFF6', 0.9, 2.2)
    sun((0.12, 0.3, -1.0), 2.3, '#EAFFF7', 22)
    ambient('#49BCC8', 1.0)

    terrain('SeaBed', -60, 60, -22, 3.4, 60, 12, lambda x, y: 0.05 * sin(x * 1.4 + y * 0.7) * (1 if y > -1 else 0.3),
            S.seabed(FLOOR, mix(FLOOR, DEEP, 0.3), '#E4FFF6'))
    ridge('Reef1', lambda x: 0.55 + 0.4 * sin(x * 0.3 + 0.4) + 0.2 * sin(x * 0.8), 3.0, 4.5,
          S.seabed(mix(FLOOR, DEEP, 0.22), mix(FLOOR, DEEP, 0.45), '#D0FBF0', 0.3, 0.4))
    ridge('Reef2', lambda x: 1.7 + 0.9 * sin(x * 0.15 + 2.0) + 0.3 * sin(x * 0.4), 9.0, 7.0,
          S.seabed(mix(FLOOR, DEEP, 0.5), mix(FLOOR, DEEP, 0.66), '#B4F0EA', 0.2, 0.24, 0.35))
    ridge('Reef3', lambda x: 3.4 + 1.5 * sin(x * 0.08 + 1.0), 22, 12, mat(mix(FLOOR, DEEP, 0.74)), -110, 110)
    ridge('Reef4', lambda x: 5.5 + 2.2 * sin(x * 0.05 + 3.3), 44, 16, mat(mix(FLOOR, DEEP, 0.9)), -170, 170)

    quad('Surface', (-90, -8, 9.2), (90, -8, 9.2), (90, 75, 9.2), (-90, 75, 9.2), S.water_surface(alpha=0.38))
    pa.shafts([(-5.5, 3, 1.3, 1.6), (-2.2, 9, 2.2, 2.4), (1.4, 5, 1.0, 1.4), (4.2, 14, 2.6, 3.0), (7.5, 7, 1.5, 1.8),
                  (-9, 18, 3.0, 3.5), (11, 22, 3.2, 3.6)])
    pa.dhow_hull(at(-4.3, 6.75, 7), 1.05)

    # reef garden
    pa.coral((-6.3, 1.9, 0), '#F27E8A', 1, 1.5)
    pa.coral((-5.0, 2.8, 0.2), '#F6A55B', 2, 1.1)
    pa.brain_coral((-4.2, 1.6, 0), 0.55, '#E9C46A')
    pa.sponge((-6.9, 0.9, 0), '#8E6BC7', 0.9, 3)
    pa.coral((5.6, 2.2, 0), '#F6A55B', 4, 1.6)
    pa.coral((6.7, 1.4, 0), '#F27E8A', 5, 1.0)
    pa.sponge((4.3, 1.5, 0), '#8E6BC7', 1.1, 6)
    pa.brain_coral((2.6, 2.3, 0.1), 0.45, '#F29CB0')
    pa.coral((0.5, 6.5, 1.0), mix('#F27E8A', DEEP, 0.4), 7, 2.0)
    pa.coral((-9.5, 7.5, 1.2), mix('#F6A55B', DEEP, 0.45), 8, 2.4)
    pa.seagrass([(-3.0, 1.2, 0), (-1.2, 1.9, 0), (1.3, 1.3, 0), (3.4, 0.9, 0), (7.0, 0.6, 0), (-7.3, -0.6, 0),
                    (5.4, -1.2, 0)], '#3FA47A', 1.0, 1)
    pa.seagrass([(-2.2, 4.2, 0.3), (2.0, 4.6, 0.3), (6.5, 4.2, 0.4)], mix('#3FA47A', DEEP, 0.35), 1.4, 2)
    props.rocks((-2.4, 2.4, 0), 3, 0.42, mix('#7FA9A0', DEEP, 0.2), 9, flat=True)
    props.rocks((7.3, 2.8, 0), 3, 0.5, mix('#7FA9A0', DEEP, 0.25), 10, flat=True)

    # the timeline: pearl oysters opening along the path
    for x, a in ((-0.3, 20), (2.1, -15), (4.6, 10)):
        pa.oyster((x, 0.75, 0.02), rad(180 + a), 1.15)

    # life: a school parting around him, a turtle keeping pace, a ray, a hamour, a far dugong, jellyfish
    la.parting_school(46, -8.5, 8.5, 0.9, 2.0, -2.0, '#FFD166', 3, 0.85, 1.25, 'SchoolGold')
    la.parting_school(26, -14, 14, 9.0, 4.2, 30, mix('#9AD7F0', DEEP, 0.3), 5, 1.3, 0.4, 'SchoolBlue')
    la.turtle((1.6, 1.3, 3.3), rad(8), 1.5, rad(-8))
    la.ray((3.3, 0.1, 1.25), rad(172), 1.3, rad(-14))
    la.hamour((-5.6, 2.2, 1.0), rad(-18), 1.0)
    la.dugong(at(4.4, 3.4, 26), rad(180), 2.6, mix('#8FA3AE', DEEP, 0.62))
    for x, z, s in ((5.8, 5.4, 1.0), (6.6, 4.5, 0.7), (-0.6, 5.7, 0.6)):
        la.jellyfish((x, 4.0, z), s * 1.4, '#F7A8C4', int(x * 10))

    pa.bubbles([(-1.5, -0.1, 2.75, 0.07), (-1.35, 0.1, 3.15, 0.05), (-1.55, 0, 3.6, 0.085), (-1.3, 0.1, 4.15, 0.04),
                   (-1.5, 0, 4.7, 0.06), (-3.5, 0.2, 2.05, 0.04), (-3.9, 0.1, 2.3, 0.03)])
    sayed('swim', 'aqua', (-2.4, 0, 1.75), rad(-16), 1.15)
    post(0.18)
    return render(out)
