"""Game export helpers: pack many small objects into a few draw calls, then write a GLB and report what is in it."""
import bpy
import bmesh
import json
import os
import struct
from kit import _MATS, _fresh, lin, link
from sayed import _vc_mat


def _key(material):
    """The (hex, rough, emit, alpha, metal) a kit material was made from, or None."""
    for k, m in _MATS.items():
        if m == material and k != 'vc':
            return k
    return None


def _matte(key):
    return key is not None and key[2] == 0 and key[3] == 1 and key[4] == 0


def _mesh_object(name, bm, material, parent=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    o = link(bpy.data.objects.new(name, me))
    o.parent = parent
    o.modifiers.new('wn', 'WEIGHTED_NORMAL').keep_sharp = True
    return o


def _pack(name, objs, parent=None):
    """Replace mesh objects by one vertex-coloured mesh (matte colours) plus one mesh per special material."""
    dg = bpy.context.evaluated_depsgraph_get()
    inv = parent.matrix_world.inverted() if parent else None
    main = bmesh.new()
    col = main.loops.layers.float_color.new('Color')
    special = {}
    for o in objs:
        m = o.data.materials[0]
        key = _key(m)
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(inv @ o.matrix_world if inv else o.matrix_world)
        if _matte(key):
            nf = len(main.faces)
            main.from_mesh(me)
            main.faces.ensure_lookup_table()
            c = (*lin(key[0]), 1.0)
            for f in main.faces[nf:]:
                for l in f.loops:
                    l[col] = c
        else:
            special.setdefault(m, bmesh.new()).from_mesh(me)
        bpy.data.meshes.remove(me)
    out = []
    if len(main.faces):
        out.append(_mesh_object(name, main, _vc_mat(), parent))
    else:
        main.free()
    for i, (m, bm) in enumerate(special.items()):
        out.append(_mesh_object('%s.fx%d' % (name, i), bm, m, parent))
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    return out


def pack_live(root):
    """A living thing keeps its empties (the game moves them); the meshes under each empty become one mesh."""
    bpy.context.view_layer.update()
    groups = {}

    def walk(e):
        for c in e.children:
            if c.type == 'MESH':
                groups.setdefault(e, []).append(c)
            else:
                walk(c)

    walk(root)
    for e, objs in groups.items():
        _pack(e.name + '.mesh', objs, e)
    return root


def pack_static(name, keep=()):
    """Everything that never moves becomes one vertex-coloured mesh. `keep` lists roots and objects to leave alone."""
    bpy.context.view_layer.update()
    skip = set()
    for k in keep:
        skip.add(k)
        skip.update(k.children_recursive)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in skip]
    out = _pack(name, objs)
    for e in [o for o in bpy.context.scene.objects if o.type == 'EMPTY' and o not in skip and not o.children]:
        bpy.data.objects.remove(e, do_unlink=True)
    return out


def named_material(obj, name, hexc, rough=0.95):
    """Give an object a plain material the game can find by name (to add its own shader)."""
    m = bpy.data.materials.new(name)
    nt, out = _fresh(m)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    b.inputs['Base Color'].default_value = (*lin(hexc), 1)
    b.inputs['Roughness'].default_value = rough
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return m


def export_glb(path, draco=False):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_yup=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=draco)
    return inspect(path)


def inspect(path):
    with open(path, 'rb') as f:
        f.read(12)
        n, _kind = struct.unpack('<I4s', f.read(8))
        doc = json.loads(f.read(n))
    acc = doc.get('accessors', [])
    tris = sum(acc[p['indices']]['count'] // 3 for m in doc.get('meshes', []) for p in m['primitives'] if 'indices' in p)
    return dict(kb=round(os.path.getsize(path) / 1024, 1), triangles=tris,
                draw_calls=sum(len(m['primitives']) for m in doc.get('meshes', [])),
                nodes=[n.get('name') for n in doc.get('nodes', []) if 'mesh' not in n],
                materials=[m['name'] for m in doc.get('materials', [])])
