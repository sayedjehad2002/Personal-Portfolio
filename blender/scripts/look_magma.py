"""Phase 0 look: Realm 4, Magma, at night. The sleeping dragon, the egg nest above it, the top beyond."""
from math import sin, radians as rad
from kit import (B, mat, mix, terrain, ridge, backdrop, glow, at, sun, lamp, ambient, camera, setup, clear, render, post, sky_band)
import surfaces as S
from sayed import sayed
import props_snow as ps
import props_magma as pm
from dragon import dragon

GROUND, HAZE = '#2E2632', '#6E2A22'


def build(out, res=(1600, 900)):
    clear()
    setup(res)
    camera()
    backdrop([(-1.3, '#F08A3A'), (1.3, '#E0662A'), (2.3, '#93302A'), (3.9, '#3E1728'), (6.9, '#140B1B')])
    ps.stars(26, 4, 5.0, 6.8, '#FFE9D2')
    v = at(-3.2, 1.2, 84)
    pm.volcano(v, 24, 20, mix('#231A26', HAZE, 0.45))
    pm.plume((v.x, v.y - 2, v.z + 20.5), 3.4)
    sky_band(3.5, 5.0, S.band('#1A1020', 0.7, 2.6, 1.4), 90, 0.5)
    sky_band(4.9, 6.7, S.band('#120A18', 0.75, 2.0, 1.2), 91, 2.2)
    sun((-0.55, 0.62, -0.34), 2.3, '#FF9552', 12)
    sun((0.5, -0.45, -0.72), 0.6, '#8A7BE0', 10)
    ambient('#4A2C48', 0.65)

    terrain('Ground', -60, 60, -22, 13.4, 4, 4, lambda x, y: 0.0, S.obsidian(GROUND, '#3B3140', '#FF7A1F'))
    ridge('Ridge1', lambda x: 2.6 + 1.1 * sin(x * 0.16 + 1.0) + 0.5 * sin(x * 0.47), 13.0, 7.0,
          S.obsidian(mix(GROUND, HAZE, 0.22), mix('#3B3140', HAZE, 0.22), '#FF7A1F', 0.9, 0.3))
    ridge('Ridge2', lambda x: 5.0 + 1.6 * sin(x * 0.09 + 2.6), 26, 12, mat(mix(GROUND, HAZE, 0.5)), -110, 110)
    ridge('Ridge3', lambda x: 7.5 + 2.4 * sin(x * 0.05 + 0.4), 46, 16, mat(mix(GROUND, HAZE, 0.75)), -170, 170)
    pm.lavafall((-13, 19.6, 0.3), 0.45, 3.0)
    pm.lavafall((14.5, 19.7, 0.3), 0.4, 2.4)
    pm.lavafall((-30, 37.5, 0.5), 1.6, 5.5, 2.0)

    # the lava river in the foreground lights everything from below
    pm.lava_stream(-12, 12, -2.5, 1.7)
    for x in (-5.5, -1.5, 2.5, 6.0):
        glow((x, -2.35, 0.05), 2.6, '#FF8A3A', 0.5, 2.0, flat=True)
        lamp((x, -2.3, 0.5), '#FF7A2A', 320, 0.5)
    pm.shards((-6.6, -1.2, 0), 3, 0.5, 1)
    pm.shards((6.4, -1.3, 0), 3, 0.55, 2)
    pm.shards((0.6, -1.25, 0), 2, 0.35, 3)
    pm.shards((-8.2, 4.5, 0), 4, 1.5, 4)
    pm.shards((8.6, 1.6, 0), 3, 1.1, 5)

    # the dragon, and the nest on the spire above it
    dragon()
    pm.smoke([(3.2, 2.35, 1.15, 0.16), (3.05, 2.3, 1.55, 0.22), (3.15, 2.25, 2.05, 0.3), (2.9, 2.2, 2.65, 0.38),
              (3.1, 2.2, 3.35, 0.46)])
    pm.spire((8.0, 12.6, 0), 2.6, 8.3, 6)
    pm.spire((5.2, 13.0, 0), 1.7, 6.0, 7, top=0.5)
    pm.spire((10.6, 12.2, 0), 1.6, 5.2, 8, top=0.5)
    pm.nest((8.0, 12.4, 8.3), 1.35)
    lamp((8.0, 11.2, 9.6), '#FFD08A', 500, 0.5)
    glow((8.0, 11.6, 9.0), 3.4, '#FFD08A', 0.55, 2.2)

    # small life: fire-lizard hatchlings scatter, a rock tortoise pulls its head in, embers drift
    pm.lizard((0.2, -0.75, 0.0), rad(20), 1.3)
    pm.lizard((-5.3, -0.55, 0.0), rad(200), 1.1)
    pm.lizard((6.3, 0.3, 0.0), rad(-30), 1.2)
    pm.tortoise((-6.4, 0.5, 0), rad(-15), 1.25)
    pm.embers(48, 2)

    pm.glow_steps(-7.4, -3.2)
    sayed('walk', 'magma', (-2.9, 0, 0), rad(-24), 1.15)
    post(0.36)
    return render(out)
