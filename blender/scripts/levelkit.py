"""Shared pieces for the four game levels (level_*.py): named floors the game adds shaders to, packing, export.

World axes: X along the walk (one continuous coordinate for all four realms), Y into the screen, Z up.
The player walks on the plane y = 0. The whole walk runs from x = 0 to x = WORLD_END.
"""
import json
import os
from kit import mat, mix, terrain, ridge, clear, setup, smoothstep
import gamekit as gk

# where each realm starts and ends along the walk
DESERT, AQUA, SNOW, MAGMA = (0.0, 62.0), (62.0, 124.0), (124.0, 204.0), (204.0, 275.0)
WORLD_END = 273.5
SEA_LEVEL, SEA_BED = -0.25, -3.4


def start():
    clear()
    setup()


def floor(name, matname, color, x0, x1, fn, y0=-22.0, y1=3.4, nx=None, ny=40):
    o = terrain(name, x0, x1, y0, y1, nx or int((x1 - x0) * 1.6), ny, fn, mat(color))
    gk.named_material(o, matname, color)
    return o


def hills(prefix, matprefix, color, haze, specs, x0, x1, base=-0.3, fade=None, sink=0.3):
    """Rows of hills behind the path. specs = [(top(x), y0, depth, haze amount)]. Far rows reach further sideways.

    fade = (in0, in1, out0, out1): the range rises out of the ground between in0 and in1 and sinks back between
    out0 and out1 (None for an end that just runs on), so one realm's hills never stand behind its neighbour's.
    """
    out = []
    for i, (top, y0, depth, k) in enumerate(specs, 1):
        xa, xb = x0 - k * 150, x1 + k * 150
        if fade:
            in0, in1, out0, out1 = fade
            xa = xa if in0 is None else in0 - 1
            xb = xb if out0 is None else out1 + 1
            low = base - sink

            def top(x, top=top, low=low):
                a = 1.0 if in0 is None else smoothstep((x - in0) / (in1 - in0))
                b = 1.0 if out0 is None else smoothstep((out1 - x) / (out1 - out0))
                return low + (top(x) - low) * a * b
        o = ridge('%s%d' % (prefix, i), top, y0, depth, mat(color), xa, xb, int((xb - xa) * 0.8), 10, base)
        gk.named_material(o, '%s%d' % (matprefix, i), mix(color, haze, k))
        out.append(o)
    return out


def finish(realm, folder, keep, live, data):
    for r in live:
        gk.pack_live(r)
    gk.pack_static('Static', list(keep) + list(live))
    info = gk.export_glb(os.path.join(folder, realm + '.glb'), draco=True)
    data = dict(id=realm, **data)
    with open(os.path.join(folder, realm + '.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
    return dict(kb=info['kb'], triangles=info['triangles'], draw_calls=info['draw_calls'], nodes=info['nodes'], materials=info['materials'])
