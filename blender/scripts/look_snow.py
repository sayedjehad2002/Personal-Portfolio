"""Phase 0 look: Realm 3, Snow, at blue hour under the aurora."""
from math import sin, radians as rad
from kit import (B, mat, mix, terrain, ridge, backdrop, glow, at, sun, lamp, ambient, camera, setup, clear, render, relief, post,
                 sky_band, smoothstep)
import surfaces as S
from sayed import sayed
import props
import props_snow as ps
import life
import life_snow as ls

SNOW, HAZE = '#EAF1FB', '#AFBDE3'


def build(out, res=(1600, 900)):
    clear()
    setup(res)
    camera()
    backdrop([(-1.3, '#C9CFEA'), (1.3, '#DCCFE6'), (2.3, '#A8B5E3'), (4.0, '#596DB6'), (6.9, '#232B63')])
    ps.stars(80, 2)
    sky_band(1.7, 2.9, S.band('#E9E2F6', 0.32, 2.2, 1.0), 93, 1.0)
    glow(at(-4.6, 5.9, 112), 12, '#DDE8FF', 0.8, 3.0)
    glow(at(-4.6, 5.9, 111), 2.3, '#FFFFFF', 1.3, 0.3)
    ps.aurora(3.9, 6.3, '#63F0BE', 0.55, 0.0, 0.45)
    ps.aurora(4.5, 6.9, '#7CC6FF', 0.4, 2.1, 0.4, 97)
    sun((0.5, 0.55, -0.62), 2.1, '#D5E3FF', 9)
    ambient('#7088CC', 0.95)

    shade = '#C4D5F3'
    bumps = relief(0.12, 0.05, seed=2.0)
    terrain('Ground', -60, 60, -22, 3.4, 160, 40, lambda x, y: bumps(x, y) * smoothstep((x + 1.0) / 2.5), S.snow(SNOW, shade))
    ridge('Hill1', lambda x: 0.7 + 0.45 * sin(x * 0.2 + 2.0) + 0.2 * sin(x * 0.55), 3.0, 5.0, S.snow(mix(SNOW, HAZE, 0.14), mix(shade, HAZE, 0.14), 1.0))
    ridge('Hill2', lambda x: 2.0 + 1.0 * sin(x * 0.11 + 0.7) + 0.35 * sin(x * 0.3), 9.5, 8.0, S.snow(mix(SNOW, HAZE, 0.4), mix(shade, HAZE, 0.4), 0.5))
    ridge('Hill3', lambda x: 3.6 + 1.4 * sin(x * 0.07 + 3.0), 24, 12, mat(mix(SNOW, HAZE, 0.66)), -110, 110)
    for xs, y, r, h, sd in ((-6.4, 62, 9, 10, 1), (-3.3, 74, 11, 13, 2), (-0.4, 58, 7.5, 8, 3), (2.4, 70, 9, 10.5, 6),
                            (5.3, 66, 13, 19, 4), (8.4, 80, 10, 11, 5)):
        k = 0.5 + 0.004 * y
        ps.peak(at(xs, 1.0, y), r, h, mix('#9DB7E2', HAZE, k), mix('#F4F8FE', HAZE, k * 0.6), sd)

    # the frozen Gulf on the left, with skate lines, fish under the ice and a seal at an ice hole
    ps.ice_sheet(-13.0, -2.0, 12.5, 5.2)
    ps.skate_trails(-7.4, -2.7)
    for x, y, a in ((-3.6, -0.7, 0.2), (-1.9, -1.0, -0.1), (-4.6, 0.7, 0.4), (-2.6, 0.9, 0.0)):
        B().ball((x, y, 0.017), (0.2, 0.07, 0.004), rot=(0, 0, a), seg=12, rings=5).build(
            'FishShadow', mat('#8FBEDD', rough=0.3), shadow=False)
    ps.ice_hole((-5.6, 1.5, 0.0))
    ls.seal((-5.6, 1.5, 0.05), rad(-40), 1.0)

    # the snow shore: pines, the Discipline Lab cabin, the cable car up the Ice Mountain
    ps.pine((-0.2, 3.2, 0.1), 3.6, 1)
    ps.pine((0.9, 4.0, 0.3), 2.6, 2)
    ps.pine((7.3, 3.0, 0.2), 4.2, 3)
    ps.pine((2.4, 4.6, 0.5), 3.0, 4)
    ps.pine((-7.8, 5.4, 0.6), 3.2, 5)
    ps.cabin((4.5, 2.9, 0.0), 0.95)
    lamp((4.0, 1.1, 1.0), '#FFC27A', 240, 0.4)
    glow((3.98, 1.8, 1.0), 1.5, '#FFD58A', 0.5, 2.2)
    ps.signpost((0.5, 1.5, 0.0), 1.0)
    c0, c1 = at(7.6, 1.7, 8), at(5.1, 5.25, 64)
    ps.cable(c0, c1, 0.0, 0.05)
    cg = c0.lerp(c1, 0.42)
    ps.gondola((cg.x, cg.y, cg.z - 1.35 * 1.25), 1.25)
    props.rocks((-7.0, 3.0, 0), 2, 0.3, '#B9C6DE', 6)

    # life: the fox pounces ahead of him, the owl watches, a snow hare waits
    ls.fox((1.5, 0.3, 0.55), rad(-8), 1.25, rad(22), leap=True)
    ps.dots([(2.35, 0.3, 0.06, 0.07), (2.5, 0.2, 0.1, 0.05), (2.2, 0.4, 0.04, 0.06)], 0.05, '#FFFFFF', 0.2, 1.0, 'Puff')
    ls.owl((0.65, 1.46, 1.53), rad(-150), 1.15, rad(40))
    life.hare((6.6, 0.5, 0), rad(-160), 1.1, '#F6F9FD')
    ps.snowfall(80, 3)

    # ice spray behind the blade, and his breath
    ps.dots([(-3.25, -0.15, 0.1), (-3.45, -0.1, 0.2), (-3.6, -0.2, 0.08), (-3.75, -0.12, 0.26), (-3.95, -0.18, 0.14)],
            0.035, '#FFFFFF', 0.5, 0.9, 'Spray')
    ps.dots([(-1.55, -0.3, 1.36, 0.09), (-1.36, -0.32, 1.45, 0.12), (-1.12, -0.3, 1.57, 0.15)], 0.1, '#FFFFFF', 0.3, 0.4, 'Breath')
    sayed('skate', 'snow', (-2.5, 0, 0.06), rad(-22), 1.15)
    post(0.3)
    return render(out)
