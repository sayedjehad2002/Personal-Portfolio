"""3D Sayed, built from the character sheet (public/art/character-sheet.webp), with a skeleton and animations.

He faces +X and is about 1.63 units tall. One armature drives a few merged, vertex-coloured meshes: Body, Pack and
one mesh per realm outfit, so the game shows an outfit by toggling a mesh. Every part follows exactly one bone
(toy-style rigid skinning), which suits his blocky build.
"""
import bpy
import bmesh
from math import radians as rad, sin, cos, pi
from mathutils import Vector, Euler
from kit import G, link, lin, mat, _obj, _fresh, _MATS

C = dict(
    skin='#F9AD78', nose='#EE9A68', hair='#1B1618', lip='#C9503E', eyeW='#F8F2EA', iris='#2F1C12',
    crown='#2B2F40', cuff='#383D52', cup='#262A37', gear='#5E606D', red='#A8323A',
    jacket='#2A3F63', jacketHi='#38507A', hem='#1E2D48', zip='#7A7C88',
    pants='#22395A', boot='#2A2C38', bootTop='#3F404C', sole='#14171F',
    pack='#2C2D3A', packHi='#3D3E4B', strap='#3A3A44',
)

# name, head, tail, parent
BONES = [
    ('root', (0, 0, 0), (0, 0, 0.2), None),
    ('hips', (0, 0, 0.40), (0, 0, 0.52), 'root'),
    ('torso', (0, 0, 0.40), (0, 0, 0.83), 'hips'),
    ('head', (0, 0, 0.83), (0, 0, 1.35), 'torso'),
    ('arm.R', (0, -0.335, 0.76), (0, -0.335, 0.59), 'torso'),
    ('arm.L', (0, 0.335, 0.76), (0, 0.335, 0.59), 'torso'),
    ('fore.R', (0, -0.335, 0.59), (0, -0.335, 0.36), 'arm.R'),      # elbow
    ('fore.L', (0, 0.335, 0.59), (0, 0.335, 0.36), 'arm.L'),
    ('leg.R', (0, -0.13, 0.40), (0, -0.13, 0.285), 'hips'),
    ('leg.L', (0, 0.13, 0.40), (0, 0.13, 0.285), 'hips'),
    ('shin.R', (0, -0.13, 0.285), (0, -0.13, 0.165), 'leg.R'),      # knee
    ('shin.L', (0, 0.13, 0.285), (0, 0.13, 0.165), 'leg.L'),
    ('foot.R', (0, -0.13, 0.165), (0.25, -0.13, 0.165), 'shin.R'),
    ('foot.L', (0, 0.13, 0.165), (0.25, 0.13, 0.165), 'shin.L'),
    ('pack', (-0.18, 0, 0.82), (-0.18, 0, 0.45), 'torso'),
    ('cape', (-0.12, 0, 0.86), (-0.3, 0, 0.35), 'torso'),
    ('scarf', (-0.2, 0.12, 0.85), (-0.3, 0.12, 0.6), 'torso'),
]
NAMES = [b[0] for b in BONES]

# Layers that are not vertex-coloured get their own material.
LAYER_MATS = {
    'Body_glow': dict(hexc='#FFFFFF', emit=0.6),
    'Aqua_glow': dict(hexc='#9EE6F0', rough=0.1, emit=0.25),
    'Magma_glow': dict(hexc='#FF8A3C', emit=2.5),
    'Skates': dict(hexc='#C9D3E0', rough=0.2, metal=0.6),
}
OUTFIT_LAYERS = dict(
    desert=('Body', 'Body_glow', 'Pack', 'Desert'),
    aqua=('Body', 'Body_glow', 'Aqua', 'Aqua_glow'),
    snow=('Body', 'Body_glow', 'Pack'),
    magma=('Body', 'Body_glow', 'Pack', 'Magma', 'Magma_glow'),
)
ALL_LAYERS = ('Body', 'Body_glow', 'Pack', 'Desert', 'Aqua', 'Aqua_glow', 'Magma', 'Magma_glow', 'Skates')


# ------------------------------------------------------------------ geometry (rest pose, character coordinates)

def _parts():
    L = {}

    def P(layer, bone):
        return L.setdefault(layer, {}).setdefault(bone, G(layer + '.' + bone))

    t = P('Body', 'torso')
    t(C['jacket']).rbox((0, 0, 0.60), (0.36, 0.52, 0.44), 0.09)
    t(C['hem']).rbox((0, 0, 0.405), (0.37, 0.53, 0.05), 0.02)
    t(C['jacketHi']).rbox((-0.02, 0, 0.83), (0.42, 0.50, 0.10), 0.045).ball((-0.18, 0, 0.80), (0.12, 0.2, 0.1))
    t(C['zip']).rbox((0.183, 0, 0.60), (0.012, 0.025, 0.40), 0.004)
    for s in (1, -1):
        t(C['strap']).rbox((0.185, s * 0.15, 0.62), (0.02, 0.06, 0.40), 0.008)
        t(C['strap']).rbox((0, s * 0.15, 0.826), (0.40, 0.06, 0.02), 0.008)
    t(C['red']).rbox((0.197, -0.15, 0.67), (0.02, 0.075, 0.05), 0.008)

    p = P('Pack', 'pack')
    p(C['pack']).rbox((-0.28, 0, 0.61), (0.20, 0.40, 0.42), 0.06)
    p(C['packHi']).rbox((-0.385, 0, 0.53), (0.04, 0.28, 0.18), 0.02).rbox((-0.29, 0, 0.80), (0.21, 0.40, 0.07), 0.03)

    h = P('Body', 'head')
    h(C['skin']).rbox((0, 0, 1.07), (0.62, 0.72, 0.50), 0.13)
    h(C['cuff']).rbox((0, 0, 1.30), (0.69, 0.79, 0.17), 0.06)
    h(C['crown']).rbox((-0.01, 0, 1.47), (0.64, 0.74, 0.26), 0.12).ball((-0.01, 0, 1.56), (0.26, 0.31, 0.08))
    h(C['red']).rbox((0.12, -0.398, 1.30), (0.07, 0.014, 0.055), 0.004)
    h(C['hair']).rbox((-0.285, 0, 1.10), (0.07, 0.66, 0.26), 0.03)
    h(C['hair']).rbox((0.303, 0, 0.855), (0.04, 0.46, 0.07), 0.015).rbox((0.312, 0, 0.895), (0.04, 0.13, 0.085), 0.015)
    h(C['hair']).rbox((0.316, 0, 1.0), (0.03, 0.22, 0.032), 0.01)
    h(C['lip']).rbox((0.314, 0, 0.962), (0.02, 0.09, 0.016), 0.005)
    h(C['nose']).rbox((0.325, 0, 1.048), (0.05, 0.09, 0.07), 0.025)
    hg = P('Body_glow', 'head')
    for s in (1, -1):
        h(C['hair']).rbox((0.06, s * 0.355, 1.14), (0.12, 0.03, 0.14), 0.012)
        h(C['hair']).rbox((0.16, s * 0.352, 0.93), (0.30, 0.035, 0.13), 0.015)
        h(C['hair']).rbox((0.314, s * 0.118, 0.94), (0.03, 0.03, 0.12), 0.01)
        h(C['hair']).rbox((0.318, s * 0.17, 1.2), (0.04, 0.18, 0.045), 0.015, rot=(s * 0.1, 0, 0))
        h(C['eyeW']).rbox((0.305, s * 0.165, 1.10), (0.03, 0.13, 0.125), 0.012)
        h(C['iris']).rbox((0.318, s * 0.152, 1.095), (0.02, 0.085, 0.10), 0.01)
        hg('#FFFFFF').rbox((0.33, s * 0.152 - 0.02, 1.125), (0.006, 0.025, 0.03), 0.002)
        h(C['cup']).rbox((-0.02, s * 0.40, 1.08), (0.24, 0.09, 0.30), 0.04)
        h(C['cup']).rbox((-0.02, s * 0.405, 1.38), (0.13, 0.05, 0.46), 0.02)
        h(C['gear']).rbox((-0.02, s * 0.45, 1.08), (0.13, 0.02, 0.17), 0.008)
    h(C['cup']).rbox((-0.02, 0, 1.6), (0.13, 0.86, 0.06), 0.025)
    h(C['cup']).limb((0.02, -0.45, 0.99), (0.30, -0.34, 0.93), 0.012)
    h('#86403C').ball((0.31, -0.33, 0.93), 0.032)

    for s, side in ((-1, 'R'), (1, 'L')):
        # upper arm and forearm meet at a round elbow, thigh and shin at a round knee, so the joints never gap
        P('Body', 'arm.' + side)(C['jacket']).rbox((0, s * 0.335, 0.68), (0.17, 0.15, 0.2), 0.055).ball((0, s * 0.335, 0.59), (0.082, 0.072, 0.075))
        a = P('Body', 'fore.' + side)
        a(C['jacket']).rbox((0, s * 0.335, 0.525), (0.165, 0.145, 0.16), 0.05)
        a(C['jacketHi']).rbox((0, s * 0.335, 0.46), (0.18, 0.16, 0.05), 0.02)
        a(C['skin']).rbox((0.01, s * 0.335, 0.375), (0.17, 0.15, 0.14), 0.055)
        P('Body', 'leg.' + side)(C['pants']).rbox((0, s * 0.13, 0.345), (0.20, 0.21, 0.13), 0.045).ball((0, s * 0.13, 0.285), (0.095, 0.1, 0.07))
        P('Body', 'shin.' + side)(C['pants']).rbox((0, s * 0.13, 0.225), (0.19, 0.2, 0.13), 0.04)
        f = P('Body', 'foot.' + side)
        f(C['bootTop']).rbox((0, s * 0.13, 0.165), (0.22, 0.225, 0.045), 0.02)
        f(C['boot']).rbox((0.035, s * 0.13, 0.09), (0.31, 0.22, 0.17), 0.06)
        f(C['sole']).rbox((0.035, s * 0.13, 0.015), (0.32, 0.23, 0.035), 0.012)
        P('Aqua', 'foot.' + side)('#E9B44C').rbox((0.36, s * 0.13, 0.035), (0.46, 0.30, 0.05), 0.02)
        P('Skates', 'foot.' + side)('#C9D3E0').rbox((0.04, s * 0.13, -0.02), (0.42, 0.03, 0.05), 0.01)
        # desert: sunglasses pushed up on the beanie, so his eyes stay visible
        P('Desert', 'head')('#15171F').rbox((0.352, s * 0.165, 1.31), (0.02, 0.18, 0.11), 0.03)

    # desert: scarf
    P('Desert', 'head')('#15171F').rbox((0.352, 0, 1.33), (0.02, 0.10, 0.025), 0.008)
    P('Desert', 'torso')('#EFE4CC').rbox((0, 0, 0.85), (0.47, 0.57, 0.12), 0.055)
    P('Desert', 'scarf')('#EFE4CC').rbox((-0.20, 0.12, 0.72), (0.05, 0.15, 0.30), 0.02, rot=(0, 0.45, 0))

    # aqua: air tank, diving mask
    k = P('Aqua', 'pack')
    k('#E9B44C').limb((-0.31, 0, 0.46), (-0.31, 0, 0.78), 0.115)
    k(C['gear']).limb((-0.31, 0, 0.84), (-0.31, 0, 0.90), 0.04)
    P('Aqua', 'head')('#1E2A3A').rbox((0.325, 0, 1.105), (0.06, 0.52, 0.20), 0.045)
    P('Aqua_glow', 'head')('#9EE6F0').rbox((0.357, 0, 1.105), (0.01, 0.43, 0.13), 0.03)

    # magma: short heat cloak that hugs the back, with a glowing hem
    P('Magma', 'cape')('#8C2A2A').ball((-0.12, 0, 0.62), (0.40, 0.42, 0.52), seg=28, rings=18,
                                       keep=lambda v: v.x < -0.10 and 0.30 < v.z < 0.88)
    P('Magma_glow', 'cape')('#FF8A3C').ball((-0.12, 0, 0.62), (0.41, 0.43, 0.53), seg=28, rings=30,
                                           keep=lambda v: v.x < -0.10 and 0.30 < v.z < 0.37)
    P('Magma', 'torso')('#8C2A2A').rbox((-0.02, 0, 0.85), (0.46, 0.56, 0.09), 0.04)
    return L


# ------------------------------------------------------------------ skeleton and skinning

def _armature(name):
    ad = bpy.data.armatures.new(name)
    ao = link(bpy.data.objects.new(name, ad))
    bpy.context.view_layer.objects.active = ao
    bpy.ops.object.mode_set(mode='EDIT')
    for n, head, tail, parent in BONES:
        b = ad.edit_bones.new(n)
        b.head, b.tail, b.roll = head, tail, 0.0
        if parent:
            b.parent = ad.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in ao.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    return ao


def _vc_mat():
    """One shared material that reads the colour painted on the mesh."""
    if 'vc' not in _MATS:
        m = bpy.data.materials.new('SayedColor')
        nt, out = _fresh(m)
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        va = nt.nodes.new('ShaderNodeVertexColor')
        va.layer_name = 'Color'
        nt.links.new(va.outputs['Color'], b.inputs['Base Color'])
        nt.links.new(b.outputs[0], out.inputs[0])
        b.inputs['Roughness'].default_value = 0.85
        b.inputs['Specular IOR Level'].default_value = 0.25
        _MATS['vc'] = m
    return _MATS['vc']


def _merge(name, bone_groups, ao):
    """One mesh for a layer: every bone's shapes together, weighted to their bone, coloured per face."""
    spec = LAYER_MATS.get(name)
    bm = bmesh.new()
    col = None if spec else bm.loops.layers.float_color.new('Color')
    dl = bm.verts.layers.deform.verify()
    for bone, g in bone_groups.items():
        gi = NAMES.index(bone)
        for (color, _kw), b in g.b.items():
            me = bpy.data.meshes.new('_t')
            b.bm.normal_update()
            b.bm.to_mesh(me)
            b.bm.free()
            nv, nf = len(bm.verts), len(bm.faces)
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
            bm.verts.ensure_lookup_table()
            bm.faces.ensure_lookup_table()
            c = (*lin(color), 1.0)
            for v in bm.verts[nv:]:
                v[dl][gi] = 1.0
            if col is not None:
                for f in bm.faces[nf:]:
                    for l in f.loops:
                        l[col] = c
    o = _obj(name, bm, mat(**spec) if spec else _vc_mat(), smooth=True, sharp=35.0)
    for n in NAMES:
        o.vertex_groups.new(name=n)
    o.parent = ao
    o.modifiers.new('Armature', 'ARMATURE').object = ao
    return o


def _build(name, layers, loc=(0, 0, 0), rz=0.0, scale=1.0):
    ao = _armature(name)
    ao.location, ao.rotation_euler, ao.scale = loc, (0, 0, rz), (scale,) * 3
    parts = _parts()
    for layer in layers:
        _merge(layer, parts[layer], ao)
    return ao


# ------------------------------------------------------------------ posing

def set_pose(ao, P, frame=None, prev=None):
    """Apply a pose dict (degrees; positive arm or leg swings back, negative swings forward)."""
    g = lambda k, d=0.0: rad(P.get(k, d))
    # the foot counter-turns against the thigh and the shin, so the boot stays close to flat
    foot = lambda leg, knee: rad(P['foot']) if 'foot' in P else -(g(leg) + g(knee)) * 0.8
    rots = {
        'root': (0, 0, 0),
        'hips': (g('roll'), g('pitch'), 0),
        'torso': (0, g('lean'), g('twist')),
        'head': (g('headx'), g('head'), g('headz')),
        'arm.R': (-rad(4 + P.get('armRx', 0)), g('armR'), 0),
        'arm.L': (rad(4 + P.get('armLx', 0)), g('armL'), 0),
        # elbows bend the forearm forward (and, for a wave, sideways); knees bend the shin back
        'fore.R': (-g('foreRx'), -g('elbowR', 8), 0),
        'fore.L': (g('foreLx'), -g('elbowL', 8), 0),
        'leg.R': (0, g('legR'), 0),
        'leg.L': (0, g('legL'), 0),
        'shin.R': (0, g('kneeR'), 0),
        'shin.L': (0, g('kneeL'), 0),
        'foot.R': (0, foot('legR', 'kneeR'), 0),
        'foot.L': (0, foot('legL', 'kneeL'), 0),
        'pack': (0, g('pack'), 0),
        'cape': (0, g('cape'), 0),
        'scarf': (0, g('scarf'), 0),
    }
    for name, e in rots.items():
        pb = ao.pose.bones[name]
        B = ao.data.bones[name].matrix_local.to_3x3()
        q = (B.inverted() @ Euler(e).to_matrix() @ B).to_quaternion()
        if prev is not None:
            if name in prev and prev[name].dot(q) < 0:
                q.negate()
            prev[name] = q.copy()
        pb.rotation_quaternion = q
        if name == 'hips':
            pb.location = B.inverted() @ Vector((0, 0, P.get('lift', 0.0)))
        if frame is not None:
            pb.keyframe_insert('rotation_quaternion', frame=frame)
            if name == 'hips':
                pb.keyframe_insert('location', frame=frame)


# Static poses for the look stills.
POSES = dict(
    idle=dict(),
    walk=dict(lean=6, armR=36, armL=-36, elbowR=26, elbowL=36, legR=-34, legL=30, kneeL=30),
    run=dict(lean=12, armR=55, armL=-55, legR=-46, legL=40, lift=0.05),
    skate=dict(lean=22, armR=-50, armL=58, elbowR=34, elbowL=34, legR=46, legL=-24, kneeR=10, kneeL=40, head=-16),
    swim=dict(pitch=74, armR=-168, armL=24, legR=20, legL=-16, head=-52, foot=78),
    climb=dict(lean=-4, armR=-150, armL=-110, elbowR=20, elbowL=60, legR=-80, legL=-30, kneeR=95, kneeL=50, head=-18),
    wave=dict(armRx=92, foreRx=80, head=-4),
)


def sayed(pose='idle', outfit='snow', loc=(0, 0, 0), rz=0.0, scale=1.0):
    """A posed Sayed for a still picture."""
    layers = OUTFIT_LAYERS[outfit] + (('Skates',) if pose == 'skate' else ())
    ao = _build('Sayed', layers, loc, rz, scale)
    set_pose(ao, POSES[pose])
    return ao


# ------------------------------------------------------------------ animation

def _blend(t, keys):
    """Smoothly interpolate pose dicts placed at times 0..1."""
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            u = u * u * (3 - 2 * u)
            return {k: a.get(k, 0.0) + (b.get(k, 0.0) - a.get(k, 0.0)) * u for k in set(a) | set(b)}
    return dict(keys[-1][1])


def _idle(t):
    s = sin(2 * pi * t)
    return dict(lean=1.2 * s, head=-1.5 * s, armR=3 * s, armL=3 * s, elbowR=10 + 2 * s, elbowL=10 + 2 * s, kneeR=3, kneeL=3,
                lift=0.006 * s, pack=1.5 * s, cape=2 * s, scarf=3 * s)


def _stride(t, leg, knee, arm, elbow):
    """Legs and arms of a walk or run: the leg that swings forward folds at the knee as it passes under him."""
    s, c = sin(2 * pi * t), cos(2 * pi * t)
    return dict(legR=-leg * s, legL=leg * s, kneeR=knee * max(0.0, c), kneeL=knee * max(0.0, -c),
                armR=arm * s, armL=-arm * s, elbowR=elbow + 14 * max(0.0, -s), elbowL=elbow + 14 * max(0.0, s))


def _walk(t):
    s, c2 = sin(2 * pi * t), cos(4 * pi * t)
    return dict(lean=6, twist=5 * s, lift=0.02 * c2 - 0.01, head=2 * c2, pack=4 * cos(4 * pi * t + 0.6),
                cape=-6 + 5 * cos(4 * pi * t + 0.8), scarf=-10 + 8 * cos(4 * pi * t + 1.0), **_stride(t, 34, 42, 36, 26))


def _run(t):
    s, c2 = sin(2 * pi * t), cos(4 * pi * t)
    return dict(lean=14, twist=9 * s, lift=0.045 * c2 + 0.02, head=3 * c2 - 4, pack=7 * cos(4 * pi * t + 0.6),
                cape=-18 + 8 * cos(4 * pi * t + 0.8), scarf=-28 + 10 * cos(4 * pi * t + 1.0), **_stride(t, 48, 78, 56, 82))


def _skate(t):
    s, c2 = sin(2 * pi * t), cos(4 * pi * t)
    # crouched: thighs forward, knees bent; the pushing leg straightens out behind him
    return dict(lean=20 + 3 * c2, twist=10 * s, roll=-6 * s, legR=-22 + 66 * max(0.0, s), legL=-22 + 66 * max(0.0, -s),
                kneeR=40 - 32 * max(0.0, s), kneeL=40 - 32 * max(0.0, -s), armR=-46 * s, armL=46 * s, elbowR=34, elbowL=34,
                lift=-0.035 - 0.012 * c2, head=-16, pack=3 * c2, cape=-14 + 4 * c2, scarf=-24 + 6 * c2)


def _swim(t):
    s = sin(2 * pi * t)
    k = sin(8 * pi * t)
    return dict(pitch=74 + 3 * sin(4 * pi * t), roll=8 * s, head=-52, armR=-360 * t, armL=-360 * t - 180, elbowR=14, elbowL=14,
                legR=16 * k, legL=-16 * k, kneeR=14 + 12 * k, kneeL=14 - 12 * k, foot=78, lift=0.03 * sin(4 * pi * t))


def _climb(t):
    s, c2 = sin(2 * pi * t), cos(4 * pi * t)
    # hand over hand, knees coming up high
    return dict(lean=-2, twist=6 * s, head=-16, armR=-128 + 30 * s, armL=-128 - 30 * s, elbowR=46 - 30 * s, elbowL=46 + 30 * s,
                legR=-58 - 26 * s, legL=-58 + 26 * s, kneeR=74 + 26 * s, kneeL=74 - 26 * s, foot=10, lift=0.03 * c2, pack=3 * c2, cape=4 * c2)


def _jump(t):
    squat = dict(legR=-38, legL=-38, kneeR=76, kneeL=76)
    return _blend(t, [
        (0.0, dict(elbowR=10, elbowL=10)),
        (0.15, dict(lean=16, armR=42, armL=42, elbowR=30, elbowL=30, lift=-0.1, **squat)),
        (0.35, dict(lean=-4, armR=-150, armL=-150, elbowR=14, elbowL=14, lift=0.05, legR=10, legL=10, foot=30, cape=-20, scarf=-25)),
        (0.6, dict(lean=4, armR=-120, armL=-135, elbowR=30, elbowL=30, legR=-44, legL=-8, kneeR=70, kneeL=48, lift=0.06, cape=10, pack=-6)),
        (0.85, dict(lean=14, armR=20, armL=20, elbowR=34, elbowL=34, lift=-0.09, pack=8, **squat)),
        (1.0, dict(elbowR=10, elbowL=10)),
    ])


def _wave(t):
    # upper arm out to the side, forearm up, the hand waving from the elbow
    return dict(armRx=92, foreRx=74 + 22 * sin(4 * pi * t), elbowR=6, armL=3, elbowL=10, headx=4 * sin(2 * pi * t), head=-4,
                lift=0.006 * sin(2 * pi * t))


def _lift(t):
    # dumbbell curls: upper arms still, forearms curling one after the other
    a = 0.5 - 0.5 * cos(2 * pi * t)
    b = 0.5 - 0.5 * cos(2 * pi * t + pi)
    return dict(lean=-3, armR=-12, armL=-12, elbowR=18 + 108 * a, elbowL=18 + 108 * b, kneeR=6, kneeL=6, lift=-0.008 * (a + b), head=-3)


def _point(t):
    s = sin(2 * pi * t)
    return dict(lean=3, armR=-80 + 2 * s, elbowR=10, armL=6, elbowL=16, head=-4 + s, lift=0.004 * s)


def _flag(t):
    return _blend(t, [
        (0.0, dict(lean=-6, armR=-165, armL=-150, elbowR=12, elbowL=20, head=-14)),
        (0.3, dict(lean=14, armR=-66, armL=-56, elbowR=38, elbowL=44, lift=-0.05, kneeR=30, kneeL=30, legR=-15, legL=-15, head=6)),
        (0.5, dict(lean=12, armR=-66, armL=-56, elbowR=38, elbowL=44, lift=-0.05, kneeR=30, kneeL=30, legR=-15, legL=-15, head=6)),
        (1.0, dict(lean=2, armR=-74, armL=10, elbowR=24, elbowL=12, head=-6)),
    ])


def _cheer(t):
    s2 = sin(4 * pi * t)
    hop = abs(sin(2 * pi * t))
    return dict(lean=-4, head=-12, armR=-158 + 10 * s2, armL=-158 - 10 * s2, armRx=20, armLx=20, elbowR=14 + 10 * hop, elbowL=14 + 10 * hop,
                lift=0.05 * hop, legR=-10 * (1 - hop), legL=-10 * (1 - hop), kneeR=24 * (1 - hop), kneeL=24 * (1 - hop), pack=5 * s2,
                cape=-8 + 8 * s2)


# name: (frames at 30 fps, pose function of t in 0..1)
ANIMS = dict(idle=(60, _idle), walk=(24, _walk), run=(16, _run), skate=(40, _skate), jump=(26, _jump), wave=(40, _wave),
             lift=(48, _lift), point=(40, _point), flag=(40, _flag), cheer=(24, _cheer), swim=(36, _swim), climb=(28, _climb))


def animate(ao):
    """One action per animation, each pushed to its own NLA track so the exporter writes them all."""
    ad = ao.animation_data_create()
    acts = []
    for name, (frames, fn) in ANIMS.items():
        act = bpy.data.actions.new(name)
        ad.action = act
        prev = {}
        for f in range(0, frames + 1, 2):
            set_pose(ao, fn(f / frames), frame=f, prev=prev)
        acts.append((name, act, frames))
    ad.action = None
    for name, act, frames in acts:
        tr = ad.nla_tracks.new()
        tr.name = name
        st = tr.strips.new(name, 0, act)
        try:
            if st.action_slot is None and len(act.slots):
                st.action_slot = act.slots[0]
        except Exception:
            pass
    set_pose(ao, {})
    return [a[0] for a in acts]


def rig():
    """The full character for the game: every outfit layer on one skeleton, with all animations."""
    ao = _build('Sayed', ALL_LAYERS)
    return ao, animate(ao)
