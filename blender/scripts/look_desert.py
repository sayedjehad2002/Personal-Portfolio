"""Phase 0 look: Realm 1, the Desert at sunrise."""
from math import sin, radians as rad
from kit import (B, mat, mix, terrain, ridge, backdrop, glow, at, sun, ambient, camera, setup, clear, render, relief, post,
                 sky_band)
import surfaces as S
from sayed import sayed
import props
import life

SAND, HAZE = '#EEC88F', '#FBE6C4'


def build(out, res=(1600, 900)):
    clear()
    setup(res)
    camera()
    backdrop([(-1.3, '#F6DDB6'), (1.3, '#FCE9C8'), (2.5, '#F9D7AC'), (4.3, '#D3DCE2'), (6.9, '#8DB7DB')])
    glow(at(3.3, 2.75, 117), 26, '#FFF1CF', 1.0, 2.6)
    glow(at(3.3, 2.75, 116), 3.3, '#FFFBEA', 1.4, 0.25)
    sun((-0.62, 0.5, -0.5), 2.6, '#FFE2B8', 6)
    ambient('#C6D6EC', 0.85)

    shade, lite = '#CFA067', '#F9E0B4'
    terrain('Ground', -60, 60, -22, 3.4, 160, 40, relief(0.13, 0.05), S.sand(SAND, shade, lite, 0.4, 0.45, 0.3))
    ridge('Dune1', lambda x: 0.75 + 0.45 * sin(x * 0.22 + 1.0) + 0.2 * sin(x * 0.61), 3.0, 5.0,
          S.sand(mix(SAND, HAZE, 0.12), mix(shade, HAZE, 0.12), mix(lite, HAZE, 0.12), 0.22, 0.26, 0.15))
    ridge('Dune2', lambda x: 2.1 + 1.0 * sin(x * 0.12 + 2.2) + 0.35 * sin(x * 0.31), 9.5, 8.0,
          S.sand(mix(SAND, HAZE, 0.36), mix(shade, HAZE, 0.36), mix(lite, HAZE, 0.36), 0.12, 0.2, 0.1))
    ridge('Dune3', lambda x: 4.0 + 1.7 * sin(x * 0.07 + 0.5), 24, 12, mat(mix(SAND, HAZE, 0.6)), -110, 110)
    ridge('Dune4', lambda x: 6.6 + 2.4 * sin(x * 0.045 + 4.0), 46, 18, mat(mix(SAND, HAZE, 0.8)), -170, 170)

    # sky: soft clouds, a thin haze band, birds over the city
    props.cloud(at(-4.7, 5.5, 95), 3.2, '#FFF6E8', 1)
    props.cloud(at(0.6, 6.25, 96), 2.3, '#FFFFFF', 2)
    props.cloud(at(3.1, 4.75, 95), 1.9, '#FFEBD2', 3)
    props.cloud(at(6.4, 5.9, 96), 2.7, '#FFF6E8', 4)
    sky_band(1.5, 2.7, S.band('#FFF4DE', 0.4, 2.5, 1.0), 94)
    props.flock(at(2.3, 4.1, 60), 7, 1.5)

    # far: Manama skyline in the haze, the fort, the Tree of Life on a crest
    props.skyline(at(4.9, 1.3, 70), mix('#C9B7A6', HAZE, 0.62), 1.15)
    props.fort((-13.5, 21.5, 2.6), mix('#DDBE92', HAZE, 0.3), 0.8)
    props.flag_bahrain((-9.1, 20.9, 5.7), 3.0, 2.0, 1.2)
    props.pool((6.9, 8.3, 0.98), 2.6, 1.1)
    props.tree_of_life((1.2, 14.6, 2.55), 0.95)

    # near: palms, the camel watching him, a hare bolting ahead, a falcon overhead
    props.palm((-5.9, 2.4, 0), 4.6, 0.7, 1)
    props.palm((-4.6, 3.4, 0.3), 3.4, -0.5, 2)
    props.palm((6.3, 2.9, 0.2), 3.9, 0.6, 3)
    props.rocks((-6.6, 1.5, 0), 3, 0.34, '#C4A57C', 4)
    props.rocks((5.2, 1.7, 0), 2, 0.3, '#C4A57C', 5)
    props.tufts([(-3.6, 1.3), (4.1, 1.0), (0.3, 1.9), (6.9, 0.9), (-6.9, -1.6), (2.2, -2.2)])
    life.camel((3.3, 1.5, 0), rad(168), 1.0, head_turn=rad(-28))
    life.hare((0.4, 0.35, 0.16), rad(0), 1.0, rot=(0, rad(-20), 0))
    life.falcon(at(-3.6, 5.2, 4), rad(-15), 1.5)
    life.flamingo((6.2, 8.2, 0.95), rad(200), 1.2)
    life.flamingo((7.4, 8.6, 0.95), rad(160), 1.2, bent=True)

    props.footprints(-7.4, -2.6)
    sayed('walk', 'desert', (-2.3, 0, 0), rad(-24), 1.15)
    post(0.2)
    return render(out)
