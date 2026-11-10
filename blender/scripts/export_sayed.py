"""Phase 1: export the rigged, animated Sayed to public/world/sayed.glb (and keep a .blend to open by hand)."""
import bpy
import json
import os
import struct
from kit import clear, setup
from sayed import rig


def inspect(path):
    """Read the GLB's JSON chunk and report what the game will actually receive."""
    with open(path, 'rb') as f:
        f.read(12)
        n, _kind = struct.unpack('<I4s', f.read(8))
        doc = json.loads(f.read(n))
    acc = doc.get('accessors', [])
    tris = 0
    for m in doc.get('meshes', []):
        for p in m['primitives']:
            tris += acc[p['indices']]['count'] // 3 if 'indices' in p else 0
    return dict(
        kb=round(os.path.getsize(path) / 1024, 1),
        meshes=[(m['name'], len(m['primitives']), sorted(m['primitives'][0]['attributes'])) for m in doc.get('meshes', [])],
        triangles=tris,
        joints=len(doc['skins'][0]['joints']) if doc.get('skins') else 0,
        materials=[m['name'] for m in doc.get('materials', [])],
        animations=[(a['name'], round(acc[a['samplers'][0]['input']]['max'][0], 2), len(a['channels'])) for a in doc.get('animations', [])],
    )


def export(glb, blend=None):
    clear()
    setup()
    bpy.context.scene.render.fps = 30
    bpy.context.scene.frame_start = 0
    ao, names = rig()
    os.makedirs(os.path.dirname(glb), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', export_apply=True, export_yup=True, export_animations=True,
        export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_skins=True, export_cameras=False,
        export_lights=False,
    )
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=blend, check_existing=False)
    return dict(authored=names, **inspect(glb))
