"""World 2 look kit: helpers for building clean, rounded models in Blender from Python.

Run inside Blender:  sys.path.insert(0, <this folder>); import kit
Soft things (sand, snow, animals, Sayed) are smooth; hard things (rock, ice, obsidian) are faceted.
"""
import bpy
import bmesh
import random
from math import radians, sin, cos, pi
from mathutils import Vector, Matrix, Euler

# Side-on game camera: looks along +Y at the walk plane (y = 0).
CAM_Y, CAM_Z, LENS, SHIFT_Y = -20.0, 1.3, 50.0, 0.105

_MATS = {}


# ------------------------------------------------------------------ colour

def _rgb(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]


def lin(h):
    """sRGB hex -> linear RGB."""
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in _rgb(h)]


def mix(a, b, t):
    """Blend two hex colours (used to fade far layers into the haze)."""
    a, b = _rgb(a), _rgb(b)
    return '#%02x%02x%02x' % tuple(round((a[i] + (b[i] - a[i]) * t) * 255) for i in range(3))


# ------------------------------------------------------------------ scene

def scene():
    return bpy.context.scene


def link(o):
    scene().collection.objects.link(o)
    return o


def clear():
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for b in list(coll):
            coll.remove(b)
    _MATS.clear()


def setup(res=(1600, 900), samples=48):
    sc = scene()
    r = sc.render
    r.engine = 'BLENDER_EEVEE'
    r.resolution_x, r.resolution_y = res
    r.resolution_percentage = 100
    r.image_settings.file_format = 'PNG'
    r.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    ee = sc.eevee
    # Soft lighting: screen-space ray tracing plus fast GI gives contact shadows and bounce light.
    for obj, k, v in ((sc.view_settings, 'look', 'None'), (ee, 'taa_render_samples', samples), (ee, 'use_shadows', True),
                      (ee, 'use_raytracing', True), (ee, 'ray_tracing_method', 'SCREEN'), (ee, 'use_fast_gi', True),
                      (ee, 'fast_gi_method', 'GLOBAL_ILLUMINATION'), (ee, 'fast_gi_distance', 3.0),
                      (ee, 'shadow_ray_count', 2), (ee, 'shadow_step_count', 6)):
        try:
            setattr(obj, k, v)
        except Exception:
            pass
    post(0.0)


def post(bloom=0.3, threshold=1.0, size=0.55):
    """Glow around bright things (compositor bloom). bloom=0 switches it off."""
    sc = scene()
    old = bpy.data.node_groups.get('World2Post')
    if old:
        bpy.data.node_groups.remove(old)
    if bloom <= 0:
        sc.render.use_compositing = False
        return
    ng = bpy.data.node_groups.new('World2Post', 'CompositorNodeTree')
    ng.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    rl = ng.nodes.new('CompositorNodeRLayers')
    gl = ng.nodes.new('CompositorNodeGlare')
    out = ng.nodes.new('NodeGroupOutput')
    for v in ('Bloom', 'BLOOM'):
        try:
            gl.inputs['Type'].default_value = v
            break
        except Exception:
            pass
    gl.inputs['Threshold'].default_value = threshold
    gl.inputs['Strength'].default_value = bloom
    gl.inputs['Size'].default_value = size
    ng.links.new(rl.outputs['Image'], gl.inputs['Image'])
    ng.links.new(gl.outputs[0], out.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = True


def render(path):
    scene().render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def camera(x=0.0, y=CAM_Y, z=CAM_Z, lens=LENS, shift_y=SHIFT_Y, look=None):
    c = bpy.data.cameras.new('Cam')
    c.lens, c.shift_y, c.clip_end, c.sensor_width = lens, shift_y, 2000, 36
    o = link(bpy.data.objects.new('Cam', c))
    o.location = (x, y, z)
    if look:
        o.rotation_euler = (Vector(look) - o.location).to_track_quat('-Z', 'Y').to_euler()
    else:
        o.rotation_euler = (radians(90), 0, 0)
    scene().camera = o
    return o


def at(xs, zs, y):
    """World position that lands on screen point (xs, zs) of the walk plane, at depth y."""
    k = (y - CAM_Y) / (0 - CAM_Y)
    return Vector((xs * k, y, CAM_Z + (zs - CAM_Z) * k))


def ambient(hexc, strength=1.0):
    w = scene().world or bpy.data.worlds.new('World')
    scene().world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new('ShaderNodeBackground')
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs[0].default_value = (*lin(hexc), 1)
    bg.inputs[1].default_value = strength


def sun(direction, strength=3.0, hexc='#FFFFFF', angle=8.0):
    L = bpy.data.lights.new('Sun', 'SUN')
    L.energy, L.color, L.angle = strength, lin(hexc), radians(angle)
    o = link(bpy.data.objects.new('Sun', L))
    o.rotation_euler = Vector(direction).normalized().to_track_quat('-Z', 'Y').to_euler()
    return o


def lamp(loc, hexc, energy=100.0, radius=0.5, shadow=False):
    L = bpy.data.lights.new('Lamp', 'POINT')
    L.energy, L.color, L.shadow_soft_size, L.use_shadow = energy, lin(hexc), radius, shadow
    o = link(bpy.data.objects.new('Lamp', L))
    o.location = loc
    return o


# ------------------------------------------------------------------ materials

def _fresh(m):
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    return nt, nt.nodes.new('ShaderNodeOutputMaterial')


def _blend(m):
    try:
        m.surface_render_method = 'BLENDED'
    except Exception:
        pass


def mat(hexc, rough=0.9, emit=0.0, alpha=1.0, metal=0.0):
    key = (hexc, rough, emit, alpha, metal)
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(hexc)
    nt, out = _fresh(m)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    b.inputs['Base Color'].default_value = (*lin(hexc), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if b.inputs.get('Specular IOR Level'):
        b.inputs['Specular IOR Level'].default_value = 0.25
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*lin(hexc), 1)
        b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        _blend(m)
    _MATS[key] = m
    return m


def gradient_mat(stops):
    """Unlit vertical gradient. stops = [(0..1 along UV.y, hex), ...] ascending."""
    m = bpy.data.materials.new('gradient')
    nt, out = _fresh(m)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(tc.outputs['UV'], sep.inputs[0])
    nt.links.new(sep.outputs['Y'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])
    els = ramp.color_ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for e, (p, h) in zip(els, stops):
        e.position = max(0.0, min(1.0, p))
        e.color = (*lin(h), 1)
    return m


def glow_mat(hexc, strength=1.0, power=2.0):
    """Unlit round glow that fades to transparent at the rim (stands in for bloom)."""
    m = bpy.data.materials.new('glow')
    nt, out = _fresh(m)
    N = nt.nodes.new
    tc = N('ShaderNodeTexCoord')
    sub = N('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = (0.5, 0.5, 0)
    ln = N('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    inv = N('ShaderNodeMath'); inv.operation = 'MULTIPLY_ADD'; inv.inputs[1].default_value = -2.0; inv.inputs[2].default_value = 1.0; inv.use_clamp = True
    pw = N('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = power
    tr = N('ShaderNodeBsdfTransparent')
    em = N('ShaderNodeEmission'); em.inputs[0].default_value = (*lin(hexc), 1); em.inputs[1].default_value = strength
    mx = N('ShaderNodeMixShader')
    L = nt.links.new
    L(tc.outputs['UV'], sub.inputs[0]); L(sub.outputs[0], ln.inputs[0]); L(ln.outputs['Value'], inv.inputs[0])
    L(inv.outputs[0], pw.inputs[0]); L(pw.outputs[0], mx.inputs[0]); L(tr.outputs[0], mx.inputs[1])
    L(em.outputs[0], mx.inputs[2]); L(mx.outputs[0], out.inputs[0])
    _blend(m)
    return m


def fade_mat(hexc, strength=1.0, alpha=0.5, mode='both', power=1.5):
    """Unlit sheet whose opacity fades along UV.y: 'both' ends, 'down' (solid at top) or 'up'."""
    m = bpy.data.materials.new('fade')
    nt, out = _fresh(m)
    N = nt.nodes.new
    tc = N('ShaderNodeTexCoord')
    sep = N('ShaderNodeSeparateXYZ')
    a = N('ShaderNodeMath')
    if mode == 'both':
        a.operation = 'MULTIPLY'; a.inputs[1].default_value = pi
        s = N('ShaderNodeMath'); s.operation = 'SINE'
        nt.links.new(a.outputs[0], s.inputs[0])
        last = s
    elif mode == 'up':
        a.operation = 'SUBTRACT'; a.inputs[0].default_value = 1.0
        last = a
    else:
        a.operation = 'MULTIPLY'; a.inputs[1].default_value = 1.0
        last = a
    pw = N('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = power; pw.use_clamp = True
    ml = N('ShaderNodeMath'); ml.operation = 'MULTIPLY'; ml.inputs[1].default_value = alpha
    tr = N('ShaderNodeBsdfTransparent')
    em = N('ShaderNodeEmission'); em.inputs[0].default_value = (*lin(hexc), 1); em.inputs[1].default_value = strength
    mx = N('ShaderNodeMixShader')
    L = nt.links.new
    L(tc.outputs['UV'], sep.inputs[0])
    L(sep.outputs['Y'], a.inputs[1] if mode == 'up' else a.inputs[0])
    L(last.outputs[0], pw.inputs[0]); L(pw.outputs[0], ml.inputs[0]); L(ml.outputs[0], mx.inputs[0])
    L(tr.outputs[0], mx.inputs[1]); L(em.outputs[0], mx.inputs[2]); L(mx.outputs[0], out.inputs[0])
    _blend(m)
    return m


# ------------------------------------------------------------------ flat sheets

def quad(name, p00, p10, p11, p01, material, shadow=False):
    bm = bmesh.new()
    f = bm.faces.new([bm.verts.new(p) for p in (p00, p10, p11, p01)])
    uv = bm.loops.layers.uv.new('UV')
    for l, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uv].uv = c
    return _obj(name, bm, material, smooth=False, shadow=shadow)


def strip(name, bottom, top, material, shadow=False):
    """Ribbon of quads between two polylines, UV.y 0 at the bottom line and 1 at the top."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UV')
    vb = [bm.verts.new(p) for p in bottom]
    vt = [bm.verts.new(p) for p in top]
    n = len(vb) - 1
    for i in range(n):
        f = bm.faces.new((vb[i], vb[i + 1], vt[i + 1], vt[i]))
        for l, c in zip(f.loops, ((i / n, 0), ((i + 1) / n, 0), ((i + 1) / n, 1), (i / n, 1))):
            l[uv].uv = c
    return _obj(name, bm, material, smooth=True, shadow=shadow)


def backdrop(stops, y=120.0, half=130.0, z0=-22.0, z1=48.0, screen=True):
    """Sky gradient wall. With screen=True the stop positions are screen heights on the walk plane."""
    if screen:
        k = (y - CAM_Y) / (0 - CAM_Y)
        stops = [(((CAM_Z + (zs - CAM_Z) * k) - z0) / (z1 - z0), h) for zs, h in stops]
    return quad('Backdrop', (-half, y, z0), (half, y, z0), (half, y, z1), (-half, y, z1), gradient_mat(stops))


def glow(loc, r, hexc, strength=1.0, power=2.0, flat=False):
    x, y, z = loc
    if flat:
        pts = ((x - r, y - r, z), (x + r, y - r, z), (x + r, y + r, z), (x - r, y + r, z))
    else:
        pts = ((x - r, y, z - r), (x + r, y, z - r), (x + r, y, z + r), (x - r, y, z + r))
    return quad('Glow', *pts, glow_mat(hexc, strength, power))


# ------------------------------------------------------------------ meshes

def _obj(name, bm, material, smooth=True, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1),
         sharp=50.0, shadow=True):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
        try:
            me.set_sharp_from_angle(angle=radians(sharp))
        except Exception:
            pass
    me.materials.append(material)
    o = link(bpy.data.objects.new(name, me))
    o.location, o.rotation_euler, o.scale = loc, rot, scale
    o.parent = parent
    if smooth:
        wn = o.modifiers.new('wn', 'WEIGHTED_NORMAL')
        wn.keep_sharp = True
    try:
        o.visible_shadow = shadow
    except Exception:
        pass
    return o


def spline(pts, radii, n):
    """Catmull-Rom resample of a path with a radius at each point."""
    P = [Vector(p) for p in pts]
    m = len(P) - 1
    out, rr = [], []
    for k in range(n + 1):
        t = k / n * m
        i = min(int(t), m - 1)
        u = t - i
        p0, p1, p2, p3 = P[max(i - 1, 0)], P[i], P[i + 1], P[min(i + 2, m)]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3))
        rr.append(radii[i] + (radii[i + 1] - radii[i]) * u)
    return out, rr


class B:
    """Mesh builder: add shapes, then build() one object with one material."""

    def __init__(self):
        self.bm = bmesh.new()

    @staticmethod
    def _m(loc, rot=None, scale=None):
        m = Matrix.Translation(Vector(loc))
        if rot:
            m = m @ Euler(rot).to_matrix().to_4x4()
        if scale is not None:
            if isinstance(scale, (int, float)):
                scale = (scale,) * 3
            m = m @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
        return m

    def ball(self, loc, scale=1.0, rot=None, seg=20, rings=12, keep=None):
        r = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=rings, radius=1.0,
                                      matrix=self._m(loc, rot, scale))
        if keep:
            dead = [v for v in r['verts'] if not keep(v.co)]
            bmesh.ops.delete(self.bm, geom=dead, context='VERTS')
        return self

    def ico(self, loc, scale=1.0, rot=None, sub=1, jitter=0.18, seed=0):
        """Faceted rock: an icosphere with its points nudged."""
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0)
        rnd = random.Random(seed)
        m = self._m(loc, rot, scale)
        for v in r['verts']:
            v.co = m @ (v.co * (1 + rnd.uniform(-jitter, jitter)))
        return self

    def cone(self, p0, p1, r0, r1, seg=14, caps=True):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        if d.length < 1e-6:
            return self
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        m = Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=max(r0, 1e-4),
                              radius2=max(r1, 1e-4), depth=d.length, matrix=m)
        return self

    def limb(self, p0, p1, r0, r1=None, seg=14):
        r1 = r0 if r1 is None else r1
        self.cone(p0, p1, r0, r1, seg, caps=False)
        self.ball(p0, r0, seg=seg, rings=8)
        self.ball(p1, r1, seg=seg, rings=8)
        return self

    def chain(self, pts, radii, seg=14, n=None):
        if n:
            pts, radii = spline(pts, radii, n)
        for i in range(len(pts) - 1):
            self.cone(pts[i], pts[i + 1], radii[i], radii[i + 1], seg, caps=False)
        for p, r in zip(pts, radii):
            self.ball(p, r, seg=seg, rings=8)
        return self

    def rbox(self, loc, size, bevel=0.05, rot=None, seg=3):
        """Rounded box."""
        t = bmesh.new()
        bmesh.ops.create_cube(t, size=1.0)
        for v in t.verts:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        b = min(bevel, min(size) * 0.45)
        if b > 0:
            bmesh.ops.bevel(t, geom=list(t.verts) + list(t.edges), offset=b, offset_type='OFFSET', segments=seg,
                            profile=0.5, affect='EDGES')
        bmesh.ops.transform(t, matrix=self._m(loc, rot), verts=t.verts)
        me = bpy.data.meshes.new('_t')
        t.to_mesh(me)
        t.free()
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        return self

    def poly(self, pts):
        self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        return self

    def build(self, name, material, **kw):
        return _obj(name, self.bm, material, **kw)


class G:
    """Group of builders keyed by colour, so one shape list can use many materials."""

    def __init__(self, name):
        self.name, self.b = name, {}

    def __call__(self, color, **kw):
        key = (color, tuple(sorted(kw.items())))
        if key not in self.b:
            self.b[key] = B()
        return self.b[key]

    def done(self, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True, shadow=True):
        return [b.build('%s.%d' % (self.name, i), mat(color, **dict(kw)), smooth=smooth, parent=parent, loc=loc,
                        rot=rot, shadow=shadow)
                for i, ((color, kw), b) in enumerate(self.b.items())]


def eye(dark, light, x, y, z, r):
    """Dark eye with a small highlight. The sign of y says which side of the head it is on."""
    s = 1 if y >= 0 else -1
    dark.ball((x, y, z), r, seg=12, rings=8)
    light.ball((x + r * 0.35, y + s * r * 0.55, z + r * 0.45), r * 0.38, seg=8, rings=6)


def root(name, loc=(0, 0, 0), rz=0.0, scale=1.0, parent=None, rot=None):
    e = link(bpy.data.objects.new(name, None))
    e.location = loc
    e.rotation_euler = rot if rot else (0, 0, rz)
    e.scale = (scale,) * 3
    e.parent = parent
    return e


def terrain(name, x0, x1, y0, y1, nx, ny, fn, material, smooth=True):
    """Height field z = fn(x, y)."""
    bm = bmesh.new()
    vs = [[bm.verts.new((x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny,
                         fn(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny)))
           for i in range(nx + 1)] for j in range(ny + 1)]
    for j in range(ny):
        for i in range(nx):
            bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    return _obj(name, bm, material, smooth=smooth, sharp=180.0)


def sky_band(zs0, zs1, material, y=96.0, phase=0.0, amp=0.4, xs=9.5):
    """A soft band across the sky between two screen heights (aurora, ash, thin cloud)."""
    bottom = [at(-xs + 2 * xs * i / 40, zs0 + amp * sin(i * 0.33 + phase) + 0.2 * sin(i * 0.9 + phase), y) for i in range(41)]
    top = [at(-xs + 2 * xs * i / 40 + 0.5, zs1 + amp * 0.7 * sin(i * 0.3 + phase + 0.6), y) for i in range(41)]
    return strip('SkyBand', bottom, top, material)


def relief(front=0.14, back=0.06, clear=1.1, seed=0.0):
    """Gentle bumps for a floor that stay flat along the walk line (|y| < clear)."""
    def f(x, y):
        d = abs(y) - clear
        if d <= 0:
            return 0.0
        a = front if y < 0 else back
        return a * smoothstep(d / 2.0) * (sin(x * 0.55 + seed) * cos(y * 0.7 + seed * 1.7) + 0.5 * sin(x * 1.3 + y * 0.9 + seed))
    return f


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def ridge(name, top, y0, depth, material, x0=-60.0, x1=60.0, nx=120, ny=10, base=0.0):
    """A hill or dune line seen from the side: rises from `base` at y0 to top(x) at y0 + depth."""
    return terrain(name, x0, x1, y0, y0 + depth, nx, ny,
                   lambda x, y: base + (top(x) - base) * smoothstep((y - y0) / depth), material)
