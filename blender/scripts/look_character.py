"""Phase 0 look: character turnaround and the four realm outfits."""
from math import radians as rad
import kit
from kit import mat, terrain, backdrop, sun, ambient, camera, setup, clear, render
from sayed import sayed


def _studio(res):
    clear()
    setup(res)
    camera(y=-11.0, z=1.0, shift_y=0.045)
    backdrop([(0.0, '#C6D2E6'), (0.32, '#DAE3F0'), (1.0, '#F2F5FA')], y=30, half=60, z0=-10, z1=30, screen=False)
    terrain('Floor', -30, 30, -14, 30, 2, 2, lambda x, y: 0.0, mat('#C3CEDF'))
    sun((0.45, 0.7, -0.62), 2.2, '#FFF6EA', 10)
    ambient('#E6EDF8', 0.75)


def turnaround(out, res=(1600, 900)):
    _studio(res)
    for x, a in ((-2.7, -90), (-0.9, -45), (0.9, 0), (2.7, 135)):
        sayed('idle', 'snow', (x, 0, 0), rad(a))
    return render(out)


def outfits(out, res=(1600, 900)):
    _studio(res)
    sayed('walk', 'desert', (-2.75, 0, 0), rad(-28))
    sayed('swim', 'aqua', (-0.95, 0, 0.75), rad(-20))
    sayed('skate', 'snow', (0.95, 0, 0), rad(-24))
    sayed('climb', 'magma', (2.75, 0, 0), rad(-30))
    return render(out)
