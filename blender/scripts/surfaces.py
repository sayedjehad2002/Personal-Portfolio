"""Procedural surfaces: floors, skins and sky sheets. All patterns use world position, so they need no UV maps.

In the game these become small baked textures or matching shaders.
"""
import bpy
from math import pi
from kit import lin, _fresh, _blend


def _col(h):
    return (*lin(h), 1)


class T:
    """Small helper around one material's node tree."""

    def __init__(self, name):
        self.m = bpy.data.materials.new(name)
        self.nt, self.out = _fresh(self.m)
        self.pos = self.nt.nodes.new('ShaderNodeNewGeometry').outputs['Position']
        self.uv = None

    def node(self, t, **p):
        n = self.nt.nodes.new(t)
        for k, v in p.items():
            setattr(n, k, v)
        return n

    def L(self, a, b):
        self.nt.links.new(a, b)

    def _in(self, sock, v):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, str):
            sock.default_value = _col(v)
        elif v is not None:
            self.L(v, sock)

    def math(self, op, a, b=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        self._in(n.inputs[0], a)
        self._in(n.inputs[1], b)
        return n.outputs[0]

    def ramp(self, v, lo, hi, a=0.0, b=1.0):
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP')
        self.L(v, n.inputs[0])
        for i, x in enumerate((lo, hi, a, b)):
            n.inputs[i + 1].default_value = x
        return n.outputs[0]

    def mixc(self, fac, a, b):
        n = self.node('ShaderNodeMix', data_type='RGBA')
        self._in(n.inputs[0], fac)
        self._in(n.inputs[6], a)
        self._in(n.inputs[7], b)
        return n.outputs[2]

    def xyz(self, v):
        n = self.node('ShaderNodeSeparateXYZ')
        self.L(v, n.inputs[0])
        return n.outputs

    def warped(self, amount, nscale):
        """World position pushed around by noise, so cell patterns look organic."""
        nz = self.node('ShaderNodeTexNoise')
        self.L(self.pos, nz.inputs['Vector'])
        nz.inputs['Scale'].default_value = nscale
        sub = self.node('ShaderNodeVectorMath', operation='SUBTRACT')
        self.L(nz.outputs[1], sub.inputs[0])
        sub.inputs[1].default_value = (0.5, 0.5, 0.5)
        sc = self.node('ShaderNodeVectorMath', operation='SCALE')
        self.L(sub.outputs[0], sc.inputs[0])
        sc.inputs['Scale'].default_value = amount
        add = self.node('ShaderNodeVectorMath', operation='ADD')
        self.L(self.pos, add.inputs[0])
        self.L(sc.outputs[0], add.inputs[1])
        return add.outputs[0]

    def noise(self, scale, detail=2.0, vec=None):
        n = self.node('ShaderNodeTexNoise')
        self.L(vec or self.pos, n.inputs['Vector'])
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        return n.outputs[0]

    def wave(self, scale, distortion, vec=None, direction='Y'):
        n = self.node('ShaderNodeTexWave', wave_type='BANDS', bands_direction=direction)
        self.L(vec or self.pos, n.inputs['Vector'])
        n.inputs['Scale'].default_value = scale
        n.inputs['Distortion'].default_value = distortion
        n.inputs['Detail'].default_value = 2.0
        return n.outputs['Factor']

    def voronoi(self, scale, feature='DISTANCE_TO_EDGE', vec=None):
        n = self.node('ShaderNodeTexVoronoi', feature=feature)
        self.L(vec or self.pos, n.inputs['Vector'])
        n.inputs['Scale'].default_value = scale
        return n

    def bump(self, height, strength=0.3, distance=0.05):
        n = self.node('ShaderNodeBump')
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        self.L(height, n.inputs['Height'])
        return n.outputs[0]

    def surface(self, color, rough=0.9, normal=None, emit_color=None, emit_strength=None):
        b = self.node('ShaderNodeBsdfPrincipled')
        self.L(b.outputs[0], self.out.inputs[0])
        self._in(b.inputs['Base Color'], color)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Specular IOR Level'].default_value = 0.25
        if normal is not None:
            self.L(normal, b.inputs['Normal'])
        if emit_strength is not None:
            self._in(b.inputs['Emission Color'], emit_color)
            self._in(b.inputs['Emission Strength'], emit_strength)
        return self.m

    def sheet(self, color, strength, alpha):
        """Unlit see-through sheet."""
        em = self.node('ShaderNodeEmission')
        self._in(em.inputs[0], color)
        em.inputs[1].default_value = strength
        tr = self.node('ShaderNodeBsdfTransparent')
        mx = self.node('ShaderNodeMixShader')
        self._in(mx.inputs[0], alpha)
        self.L(tr.outputs[0], mx.inputs[1])
        self.L(em.outputs[0], mx.inputs[2])
        self.L(mx.outputs[0], self.out.inputs[0])
        _blend(self.m)
        return self.m

    def uv_xy(self):
        tc = self.node('ShaderNodeTexCoord')
        o = self.xyz(tc.outputs['UV'])
        return o[0], o[1]


# ------------------------------------------------------------------ floors

def sand(base, shade, light, ripple=0.7, strength=0.32, bump=0.22):
    """Wind ripples plus large soft patches of lighter sand."""
    t = T('sand')
    w = t.wave(ripple, 6.0)
    c = t.mixc(t.math('MULTIPLY', w, strength), base, shade)
    c = t.mixc(t.ramp(t.noise(0.22, 2.0), 0.35, 0.75, 0.0, 0.4), c, light)
    return t.surface(c, 0.95, t.bump(w, bump, 0.04))


def seabed(base, shade, light, ripple=0.55, caustic=0.5, cscale=0.5):
    """Sand ripples with the moving net of light the surface throws on the sea bed."""
    t = T('seabed')
    w = t.wave(ripple, 5.0)
    c = t.mixc(t.math('MULTIPLY', w, 0.3), base, shade)
    v = t.voronoi(cscale, vec=t.warped(0.9, 0.7))
    lines = t.math('MULTIPLY', t.ramp(v.outputs['Distance'], 0.0, 0.1, 1.0, 0.0), caustic)
    c = t.mixc(lines, c, light)
    return t.surface(c, 0.9, t.bump(w, 0.18, 0.04), light, t.math('MULTIPLY', lines, 0.35))


def snow(base, shade, sparkle=1.3):
    """Soft drifts with a little sparkle."""
    t = T('snow')
    c = t.mixc(t.ramp(t.noise(0.3, 2.0), 0.3, 0.7, 0.0, 0.65), base, shade)
    sp = t.ramp(t.noise(60.0, 0.0), 0.73, 0.77, 0.0, sparkle)
    return t.surface(c, 0.85, t.bump(t.noise(2.5, 3.0), 0.12, 0.03), '#FFFFFF', sp)


def ice(base, crack, deep):
    """Glossy ice with fine cracks and darker patches of deep water."""
    t = T('ice')
    v = t.voronoi(0.35, vec=t.warped(0.5, 0.6))
    v2 = t.voronoi(1.3, vec=t.warped(0.3, 1.5))
    lines = t.math('MAXIMUM', t.ramp(v.outputs['Distance'], 0.0, 0.014, 1.0, 0.0),
                   t.ramp(v2.outputs['Distance'], 0.0, 0.012, 0.45, 0.0))
    c = t.mixc(t.ramp(t.noise(0.2, 2.0), 0.3, 0.7), base, deep)
    return t.surface(t.mixc(lines, c, crack), 0.12)


def obsidian(base, plate, glow, amount=1.0, vscale=0.55):
    """Cracked black rock. Lava glows in the cracks, strongest near the lava river (low y)."""
    t = T('obsidian')
    vec = t.warped(0.35, 0.9)
    d = t.voronoi(vscale, vec=vec).outputs['Distance']
    tone = t.xyz(t.voronoi(vscale, 'F1', vec).outputs['Color'])[0]
    c = t.mixc(t.math('MULTIPLY', tone, 0.7), base, plate)
    veins = t.ramp(d, 0.0, 0.04, 1.0, 0.0)
    patches = t.ramp(t.noise(0.2, 2.0), 0.42, 0.6)
    near = t.ramp(t.xyz(t.pos)[1], -3.0, 7.0, 1.0, 0.2)
    e = t.math('MULTIPLY', t.math('MULTIPLY', veins, patches), t.math('MULTIPLY', near, 4.0 * amount))
    return t.surface(c, 0.42, t.bump(t.ramp(d, 0.0, 0.12), 0.45, 0.06), glow, e)


# ------------------------------------------------------------------ skins

def scales(base, dark, light, scale=2.3):
    """Dragon hide: one scale per cell, darker in the gaps, lighter in the middle."""
    t = T('scales')
    d = t.voronoi(scale).outputs['Distance']
    tone = t.xyz(t.voronoi(scale, 'F1').outputs['Color'])[0]
    c = t.mixc(t.math('MULTIPLY', tone, 0.45), base, dark)
    c = t.mixc(t.ramp(d, 0.0, 0.07, 0.6, 0.0), c, dark)
    c = t.mixc(t.ramp(d, 0.2, 0.45, 0.0, 0.25), c, light)
    return t.surface(c, 0.6, t.bump(t.ramp(d, 0.0, 0.2), 0.55, 0.09))


# ------------------------------------------------------------------ sky sheets

def water_surface(col='#EAFFF8', cscale=0.3, alpha=0.5, fade_from=2.0, fade_to=60.0):
    """The sea surface seen from below: a bright net that fades with distance."""
    t = T('watersurface')
    v = t.voronoi(cscale, vec=t.warped(0.8, 0.5))
    lines = t.ramp(v.outputs['Distance'], 0.0, 0.1, 1.0, 0.0)
    depth = t.ramp(t.xyz(t.pos)[1], fade_from, fade_to, alpha, 0.0)
    return t.sheet(col, 1.0, t.math('MULTIPLY', lines, depth))


def curtain(col, top, alpha=0.5, streaks=26.0):
    """Aurora curtain: soft at both edges, with vertical rays, shifting colour towards the top (uses UVs)."""
    t = T('curtain')
    x, y = t.uv_xy()
    vert = t.math('POWER', t.math('SINE', t.math('MULTIPLY', y, pi)), 1.3, clamp=True)
    cv = t.node('ShaderNodeCombineXYZ')
    t.L(t.math('MULTIPLY', x, streaks), cv.inputs[0])
    t.L(t.math('MULTIPLY', y, 0.7), cv.inputs[1])
    rays = t.ramp(t.noise(1.0, 2.0, cv.outputs[0]), 0.3, 0.72, 0.18, 1.0)
    a = t.math('MULTIPLY', t.math('MULTIPLY', vert, rays), alpha)
    return t.sheet(t.mixc(t.ramp(y, 0.4, 1.0), col, top), 1.0, a)


def band(col, alpha=0.6, sx=3.0, sy=1.5):
    """Soft cloud band: ash, haze or thin cloud (uses UVs)."""
    t = T('band')
    x, y = t.uv_xy()
    vert = t.math('POWER', t.math('SINE', t.math('MULTIPLY', y, pi)), 1.0, clamp=True)
    cv = t.node('ShaderNodeCombineXYZ')
    t.L(t.math('MULTIPLY', x, sx), cv.inputs[0])
    t.L(t.math('MULTIPLY', y, sy), cv.inputs[1])
    puff = t.ramp(t.noise(1.0, 3.0, cv.outputs[0]), 0.38, 0.7)
    return t.sheet(col, 1.0, t.math('MULTIPLY', t.math('MULTIPLY', vert, puff), alpha))
