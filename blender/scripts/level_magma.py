"""Realm 4, Magma (x 204 to 272): certificates on the obsidian path, then the climb over the sleeping dragon to the
egg nest and the top.

The dragon lies along the walk with its spine on the walk plane (y = 0), so he climbs its back in plain view: tail,
hips, back, neck, head. Its head rests on a ledge of the spire; the nest is on the next ledge up, the top above that.
"""
import random
import bpy
from math import sin, radians as rad
from mathutils import Vector
from kit import B, G, mat, mix, root, spline
import props
import props_magma as pm
import gamekit as gk
import levelkit as lk

GROUND, HAZE = '#2E2632', '#6E2A22'
BODY, BELLY, DARK, BONE, WING, EMBER = '#8A1E1E', '#C9783C', '#2E0D12', '#EADBB8', '#45121A', '#FF6A1F'
X0, X1 = lk.MAGMA

# the dragon's spine on the walk plane: x, height of its centre, radius
SPINE = [(226, 0.08, 0.05), (230, 0.22, 0.2), (234, 0.5, 0.45), (238, 1.0, 0.9), (242, 1.7, 1.5), (246, 2.3, 2.0), (250, 2.6, 2.2),
         (254, 2.9, 2.0), (257, 3.9, 1.5), (259.5, 5.3, 1.15), (261, 6.5, 1.0)]
HEAD_AT, HEAD_SCALE = (261.0, 0.0, 5.8), 2.2
LEDGE, PEAK = (265.2, 271.2, 8.3), (271.2, 274.8, 9.4)   # x0, x1, top: the nest ledge and the very top


def _dragon():
    """A scarier dragon: dark armour plates with fire glowing in the seams, two rows of spines, heavy claws, a torn
    wing, and a head with an angry brow, long horns and fangs. The head has moving parts for when it wakes: the
    eyelids (Dragon.lid) open over a burning eye and the lower jaw (Dragon.jaw) drops. Its top line is unchanged,
    because he walks on it."""
    R = root('Dragon')
    pts, rr = spline([(x, 0.0, z) for x, z, _ in SPINE], [r for _, _, r in SPINE], 96)
    g = G('dragon')
    g(BODY).chain(pts, rr, seg=20)
    n = len(pts)
    for i in range(n):
        p, r = pts[i], rr[i]
        tan = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if r > 0.3:
            g(BELLY).ball(p + Vector((0, -0.22 * r, -0.5 * r)), 0.6 * r, seg=16, rings=9)
            # armour: dark overlapping plates down the flank that faces the camera, fire showing in the seams
            if i % 2 == 0:
                g(DARK).ball(p + Vector((0, -0.8 * r, 0.22 * r)), (0.34 * r + 0.08, 0.13 * r, 0.46 * r), rot=(0.25, 0, 0), seg=12, rings=8)
            if i % 4 == 1:
                g(EMBER, emit=2.6).ball(p + Vector((0, -0.9 * r, -0.06 * r)), (0.2 * r + 0.04, 0.05 * r, 0.05 * r + 0.02), seg=8, rings=6)
        if r > 0.12 and i < n - 4:
            if i % 3 == 1:
                # the tall row just behind the line he walks, so the spines never hide him
                base = p + Vector((0, 0.6 * r, 0.76 * r))
                h = 0.78 * r + 0.2
                g(BONE).cone(base, base + Vector((0, 0.12 * r, h)) - tan * (h * 0.45), 0.24 * r + 0.04, 0.0, seg=8)
                g(DARK).cone(base, base + Vector((0, 0.03 * r, h * 0.3)) - tan * (h * 0.1), 0.3 * r + 0.05, 0.2 * r + 0.03, seg=8)
            if i % 3 == 2 and r > 0.4:
                # a lower row out of the flank, below his feet
                base = p + Vector((0, -0.72 * r, 0.5 * r))
                h = 0.34 * r + 0.1
                g(BONE).cone(base, base + Vector((0, -0.75 * h, 0.7 * h)) - tan * (h * 0.5), 0.13 * r + 0.03, 0.0, seg=7)
    # a spiked tail tip, on the far side of where he steps on
    for k in range(4):
        tp, tr = pts[4 + k * 3], rr[4 + k * 3]
        g(BONE).cone(tp + Vector((0, 0.5 * tr + 0.05, 0.3 * tr)), tp + Vector((-0.25, 0.9 * tr + 0.5, 0.55 + tr)), 0.07 + 0.2 * tr, 0.0, seg=7)
    limb = mix(BODY, '#000000', 0.22)
    for (tx, tz, ts), (px, pz) in (((243.5, 1.35, 1.0), (247.0, 0.3)), ((254.2, 1.9, 0.75), (257.0, 0.3))):
        g(limb).ball((tx, -1.55, tz), (1.8 * ts, 0.95 * ts, 1.45 * ts))
        g(DARK).ball((tx - 0.2, -2.3, tz + 0.25), (1.2 * ts, 0.25 * ts, 0.9 * ts), seg=12, rings=8)
        g(BONE).cone((tx - 1.3 * ts, -1.9, tz + 0.5 * ts), (tx - 2.0 * ts, -2.2, tz + 1.15 * ts), 0.2 * ts, 0.0, seg=7)
        g(limb).chain([(tx + 0.9, -2.0, tz * 0.6), (px - 0.6, -2.35, 0.5)], [0.62 * ts, 0.44 * ts], seg=14)
        g(limb).ball((px, -2.4, pz), (0.66 * ts, 0.5 * ts, 0.32 * ts))
        for k in (-1.5, -0.5, 0.5, 1.5):
            g(BONE).chain([(px + 0.4, -2.4 + 0.2 * k, 0.26), (px + 0.95, -2.4 + 0.27 * k, 0.3), (px + 1.35, -2.4 + 0.3 * k, 0.03)], [0.13 * ts, 0.1 * ts, 0.01], seg=7, n=6)
    # the wing folded along the flank that faces the camera, kept below his path: torn at the edge, with a hook at the wrist
    W0, W1, W2 = Vector((253.0, -2.0, 3.9)), Vector((249.0, -2.3, 3.6)), Vector((246.0, -2.25, 3.0))
    F = [Vector((240.6, -1.7, 2.5)), Vector((241.4, -1.9, 1.75)), Vector((243.0, -2.1, 1.05)), Vector((245.4, -2.3, 1.0)), Vector((249.0, -2.35, 1.5))]
    for a, b_ in zip(F, F[1:]):
        mid = (a + b_) / 2
        mid = mid + (W2 - mid) * 0.34
        g(WING).poly((W2, a, mid)).poly((W2, mid, b_))
    g(WING).poly((W2, F[-1], W1)).poly((W1, F[-1], W0))
    g(limb).chain([W0, W1, W2], [0.24, 0.2, 0.15], seg=10)
    for f in F:
        g(limb).limb(W2, f, 0.12, 0.03, seg=8)
        g(BONE).cone(f, f + (f - W2).normalized() * 0.4, 0.05, 0.0, seg=6)
    g(BONE).chain([W2 + Vector((0, -0.1, 0.1)), W2 + Vector((-0.5, -0.25, 0.75)), W2 + Vector((-0.95, -0.3, 0.6))], [0.13, 0.09, 0.01], seg=7, n=6)
    g.done(parent=R)

    # the head, asleep on the ledge, its eye towards the camera
    H = root('Dragon.head', HEAD_AT, 0.0, HEAD_SCALE, parent=R)
    h = G('dragonhead')
    h(BODY).ball((0.1, 0, 0.56), (0.72, 0.6, 0.5)).ball((0.95, 0, 0.42), (0.72, 0.44, 0.33)).ball((1.5, 0, 0.4), (0.3, 0.36, 0.27))
    h(DARK).ball((0.9, 0, 0.3), (0.74, 0.47, 0.2))                       # the dark of the upper lip
    for s in (1, -1):
        h(DARK).ball((1.63, s * 0.17, 0.53), (0.1, 0.08, 0.07))
        h(EMBER, emit=3.0).ball((1.66, s * 0.17, 0.52), (0.05, 0.045, 0.04))
        # a heavy brow that slopes down towards the snout: he looks angry even asleep
        h(DARK).ball((0.5, s * 0.45, 0.83), (0.4, 0.17, 0.11), rot=(0, 0.42, s * -0.22))
        h(DARK).cone((0.2, s * 0.5, 0.9), (-0.1, s * 0.68, 1.12), 0.1, 0.0, seg=7)
        # the eye that burns under the lid
        h('#1A0A08').ball((0.52, s * 0.455, 0.63), (0.19, 0.06, 0.12))
        h('#FFB627', emit=4.0).ball((0.52, s * 0.485, 0.63), (0.15, 0.045, 0.09))
        h('#120606').ball((0.53, s * 0.522, 0.63), (0.026, 0.014, 0.085), seg=8, rings=6)
        # horns: a long pair swept back, a shorter pair under them, and spikes along the jaw line
        h(BONE).chain([(-0.2, s * 0.48, 0.8), (-0.85, s * 0.74, 1.12), (-1.45, s * 0.86, 1.2), (-1.85, s * 0.86, 1.02)], [0.21, 0.15, 0.08, 0.01], n=10)
        h(DARK).cone((-0.12, s * 0.46, 0.76), (-0.4, s * 0.57, 0.9), 0.25, 0.2, seg=10)
        h(BONE).chain([(-0.3, s * 0.56, 0.48), (-0.85, s * 0.84, 0.5), (-1.2, s * 0.92, 0.36)], [0.14, 0.09, 0.01], n=8)
        for x, ln in ((-0.15, 0.36), (0.12, 0.3), (0.38, 0.24)):
            h(BONE).cone((x, s * 0.55, 0.3), (x - 0.14, s * (0.6 + ln), 0.2), 0.075, 0.0, seg=6)
        # scars across the snout
        for x, a in ((0.95, 0.5), (1.12, 0.62)):
            h(mix(BODY, '#FFFFFF', 0.28)).ball((x, s * 0.4, 0.5), (0.015, 0.02, 0.16), rot=(0, a, 0), seg=8, rings=6)
        # upper teeth: two long fangs at the front, a row behind them
        h(BONE).cone((1.5, s * 0.24, 0.3), (1.55, s * 0.25, -0.12), 0.07, 0.0, seg=7)
        for k, x in enumerate((0.62, 0.78, 0.94, 1.1, 1.26, 1.4)):
            h(BONE).cone((x, s * 0.39, 0.3), (x + 0.02, s * 0.4, 0.1 if k % 2 else 0.04), 0.05, 0.0, seg=6)
    h.done(parent=H)

    # the eyelids: one node for both, hinged at the top of the eye, so the game can draw them back
    Lid = root('Dragon.lid', (0.52, 0.0, 0.76), parent=H)
    lid = G('dragonlid')
    for s in (1, -1):
        lid(BODY).ball((0, s * 0.475, -0.13), (0.21, 0.075, 0.135))
        for k in range(13):
            u = k / 12
            bow = 1 - (2 * u - 1) ** 2
            lid('#1A1014').ball((-0.18 + 0.36 * u, s * (0.535 + 0.012 * bow), -0.245 + 0.045 * bow), 0.03, seg=8, rings=6)
    lid.done(parent=Lid)

    # the lower jaw: hinged at the back of the mouth, with its own teeth and the fire in the throat
    Jaw = root('Dragon.jaw', (0.22, 0.0, 0.26), parent=H)
    jaw = G('dragonjaw')
    jaw(BELLY).ball((0.53, 0, -0.06), (0.85, 0.42, 0.19))
    jaw(DARK).ball((0.5, 0, 0.03), (0.78, 0.36, 0.1))
    jaw(EMBER, emit=3.4).ball((0.35, 0, 0.07), (0.5, 0.26, 0.06))
    for s in (1, -1):
        jaw(BONE).cone((1.22, s * 0.2, 0.04), (1.24, s * 0.21, 0.36), 0.06, 0.0, seg=7)
        for k, x in enumerate((0.5, 0.68, 0.86, 1.04)):
            jaw(BONE).cone((x, s * 0.34, 0.04), (x, s * 0.35, 0.2 if k % 2 else 0.26), 0.045, 0.0, seg=6)
    jaw.done(parent=Jaw)
    return R


def _top_profile():
    """The line he walks: the top of the dragon's back, then its skull and snout."""
    pts, rr = spline([(x, 0.0, z) for x, z, _ in SPINE], [r for _, _, r in SPINE], 36)
    # the tail tip meets the ground, so he steps onto it without a hop
    line = [(SPINE[0][0] - 0.7, 0.0)] + [(p.x, p.z + r) for p, r in zip(pts, rr)]
    hx, _, hz = HEAD_AT
    S = HEAD_SCALE  # the skull, the snout, the tip of the nose (measured on the head model)
    line += [(hx + 1.0, hz + 1.06 * S), (hx + 0.95 * S + 0.2, hz + 0.75 * S), (hx + 1.75 * S, hz + 0.67 * S), (LEDGE[0], hz + 0.64 * S)]
    return line


def _into(dst, src):
    me = bpy.data.meshes.new('_t')
    src.bm.to_mesh(me)
    src.bm.free()
    dst.bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def _spire():
    """The rock the dragon sleeps against: three tiers built from rough layers, with a lighter ledge on each tier
    and spikes at its foot. The game gives it the same glowing lava veins as the ground (material ObsSpire)."""
    rnd = random.Random(6)
    body, ledges = B(), B()
    for (cx, cy, z0, z1, r0, r1) in ((268.5, 2.8, -0.5, 6.0, 8.0, 6.6), (269.7, 1.0, 6.0, 8.3, 4.9, 4.6), (273.0, 0.6, 8.3, 9.4, 2.2, 1.9)):
        n = max(2, round((z1 - z0) / 1.3))
        for k in range(n):
            a0, a1 = z0 + (z1 - z0) * k / n, z0 + (z1 - z0) * (k + 1) / n
            ra, rb = r0 + (r1 - r0) * k / n, r0 + (r1 - r0) * (k + 1) / n
            t = B()
            t.cone((cx, cy, a0), (cx, cy, a1), ra * rnd.uniform(1.0, 1.07), rb * rnd.uniform(1.0, 1.04), seg=9)
            for v in t.bm.verts:
                v.co.x += rnd.uniform(-0.05, 0.05) * ra
                v.co.y += rnd.uniform(-0.05, 0.05) * ra
            _into(body, t)
        t = B()
        t.cone((cx, cy, z1 - 0.16), (cx, cy, z1), r1 * 1.07, r1 * 1.03, seg=9)
        _into(ledges, t)
    spire = body.build('Spire', mat('#3A2F3E', rough=0.55), smooth=False)
    gk.named_material(spire, 'ObsSpire', '#3A2F3E', 0.55)
    ledges.build('SpireLedges', mat('#5A4B5E', rough=0.6), smooth=False)
    for x, y, n, s_, sd in ((262.2, -3.0, 4, 1.4, 21), (269.5, -4.4, 5, 1.6, 22), (276.6, -2.0, 4, 1.5, 23), (277.5, 4.0, 4, 1.8, 24)):
        pm.shards((x, y, 0), n, s_, sd)
    return spire


def export(folder):
    lk.start()
    keep = [lk.floor('Ground', 'ObsGround', GROUND, 201.0, 280.0, lambda x, y: 0.0, y1=13.4, ny=12)]
    keep += lk.hills('Ridge', 'ObsRidge', GROUND, HAZE, [
        (lambda x: 2.6 + 1.1 * sin(x * 0.16 + 1.0) + 0.5 * sin(x * 0.47), 13.0, 7.0, 0.22),
        (lambda x: 5.0 + 1.6 * sin(x * 0.09 + 2.6), 26, 12, 0.5),
        (lambda x: 7.5 + 2.4 * sin(x * 0.05 + 0.4), 46, 16, 0.75),
    ], 190, 290, fade=(192, 207, None, None), sink=0.4)

    # the volcano behind, with lava lines down the slope facing the camera
    vx, vy, vr, vh = 222.0, 84.0, 24.0, 20.0
    rnd = random.Random(5)
    v = B()
    v.cone((vx, vy, 0), (vx, vy, vh), vr, vr * 0.2, seg=11)
    for vert in v.bm.verts:
        vert.co.x += rnd.uniform(-0.06, 0.06) * vr
    v.build('Volcano', mat(mix('#231A26', HAZE, 0.45)), smooth=False, shadow=False)
    lines = B()
    for a, t0, w in ((-0.18, 0.35, 0.035), (0.1, 0.5, 0.03), (0.3, 0.62, 0.022)):
        rows = []
        for i in range(9):
            t = t0 + (1.0 - t0) * i / 8
            rt = vr * (1 - 0.8 * t)
            cx = vx + a * rt * (1 + 0.25 * sin(i * 1.1))
            rows.append(((cx - w * vr * (1.3 - t), vy - rt, vh * t), (cx + w * vr * (1.3 - t), vy - rt, vh * t)))
        for (a0, b0), (a1, b1) in zip(rows, rows[1:]):
            lines.poly((a0, b0, b1, a1))
    lines.build('LavaLines', mat(pm.LAVA, emit=2.2), smooth=False, shadow=False)
    pm.plume((vx, vy - 2, vh + 0.5), 3.4)
    for x, y, w, h in ((214.0, 19.6, 0.45, 3.0), (238.0, 19.7, 0.4, 2.4), (252.0, 19.5, 0.5, 3.4)):
        pm.lavafall((x, y, 0.3), w, h)

    pm.lava_stream(200, 280, -2.5, 1.7)
    for x, s, sd in ((206.5, 0.5, 1), (212.4, 0.55, 2), (219.0, 0.35, 3), (224.0, 0.5, 4), (231.0, 0.45, 5), (240.0, 0.5, 6), (249.0, 0.55, 7), (258.0, 0.5, 8)):
        pm.shards((x, -1.25, 0), 3, s, sd)
    for x, y, s, sd in ((205.0, 4.5, 1.5, 11), (217.5, 5.5, 1.3, 12), (228.0, 6.5, 1.6, 13)):
        pm.shards((x, y, 0), 4, s, sd)
    pm.tortoise((219.5, 0.9, 0), rad(-15), 1.25)
    # the dragon's ground: what it has eaten, pools of lava in the rock, fire crystals, more falls down the ridge
    pm.ribs((211.0, 5.2, 0), 1.1, rad(20))
    pm.ribs((236.5, 8.0, 0), 1.7, rad(-25))
    pm.ribs((224.5, -3.6, 0), 0.7, rad(160))
    for x, y, r, sd in ((208.5, 7.0, 1.6, 1), (221.5, 9.0, 2.3, 2), (233.0, 10.0, 1.9, 3), (247.5, 9.5, 2.6, 4), (259.0, 10.5, 2.0, 5)):
        pm.lava_pool((x, y, 0.03), r, sd)
    for x, y, s_, sd in ((207.5, 2.6, 0.7, 1), (214.5, 3.4, 0.9, 2), (226.5, 4.2, 0.8, 3), (239.0, 5.0, 1.0, 4), (251.5, 5.4, 0.9, 5), (263.5, -3.2, 0.7, 6)):
        pm.crystals((x, y, 0), 4, s_, sd)
    for x, y, w, h in ((226.0, 19.6, 0.35, 2.2), (244.5, 19.7, 0.55, 3.0), (262.0, 19.6, 0.4, 2.6)):
        pm.lavafall((x, y, 0.3), w, h)
    keep.append(_spire())
    pm.nest((268.2, 1.9, LEDGE[2]), 1.1)
    pm.smoke([(264.8, -1.2, 7.5, 0.2), (265.0, -1.3, 8.0, 0.27), (264.8, -1.35, 8.6, 0.36), (265.1, -1.4, 9.3, 0.46)])

    dragon = _dragon()
    flag = props.flag_bahrain((273.3, 0.9, PEAK[2]), 2.6, 1.7, 1.0)
    flag.name = 'SummitFlag'
    lizards = [pm.lizard((x, y, 0.0), rad(a), 1.25) for x, y, a in ((209.5, -0.7, 20), (216.0, 0.6, 200), (222.5, -0.6, -30))]
    live = [dragon, flag] + lizards

    top = _top_profile()
    solids = [dict(x0=X0 - 0.5, x1=262.0, y0=0.0, y1=0.0, kind='ground')]
    solids += [dict(x0=a[0], x1=b[0], y0=a[1], y1=b[1], kind='breath') for a, b in zip(top, top[1:])]
    solids += [dict(x0=LEDGE[0], x1=LEDGE[1], y0=LEDGE[2], y1=LEDGE[2], kind='platform'), dict(x0=PEAK[0], x1=PEAK[1], y0=PEAK[2], y1=PEAK[2], kind='platform')]
    return lk.finish('magma', folder, keep, live, dict(
        x0=X0, x1=X1, solids=solids,
        cam=[[234.0, 0.0], [244.0, 2.0], [256.0, 3.2], [262.0, 5.2], [267.0, 6.1], [272.6, 6.9]],
        zones=[dict(mode='climb', x0=255.5, x1=261.6)],
        anchors=[dict(id='certificates', x=218.6), dict(id='contact', x=266.6)],
        titles=[dict(text="DRAGON'S MOUNTAIN", x=204.8)],
        life=dict(lizards=[209.5, 216.0, 222.5], dragon=dict(x0=226.0, x1=265.2, head=261.0), nest=dict(x=268.2, top=LEDGE[2]),
                  flag=dict(x=273.3), top=PEAK[2], end=273.5),
    ))
