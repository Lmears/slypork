"""Transfer Blender's procedural skin colour onto the original GLB vertices.

blender --background /path/to/slypork_pig.blend --python scripts/build-pig.py -- \
    /path/to/slypork_pig.glb

Keeps every original mesh, triangle, normal and material boundary. No decimation,
face removal, UV unwrap or normal-map projection. Colour is sampled on the full
mesh, including the original material's crease shading, and stored as COLOR_0.
The .blend and source GLB are only read; output is assets/models/slypork-pig.glb.
"""

import argparse
import json
from pathlib import Path
import struct
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('--exclude-node', action='append', default=[], help='Omit an overlapping reference mesh')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
SOURCE = Path(args.source).expanduser()
OUTPUT = ROOT / 'assets/models/slypork-pig.glb'
skin = bpy.data.materials['Pig Skin'].copy()
# glTF only contains modifiers when Apply Modifiers is enabled on export.
# Preserve the authored stud mirror as a scene transform when the export has
# omitted it; the original mesh buffers still remain untouched.
stud = bpy.data.objects.get('Frame Bolts')
mirror = next((m for m in stud.modifiers if m.type == 'MIRROR' and m.show_render), None) if stud else None
mirror_plane = None
if mirror:
    assert tuple(mirror.use_axis) == (True, False, False), 'Expected the stud mirror on X only'
    basis = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
    plane = (mirror.mirror_object or stud).matrix_world.copy()
    mirror_plane = basis @ plane @ basis.inverted()
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
for name in args.exclude_node:
    reference = bpy.data.objects.get(name)
    assert reference is not None, f'Excluded node not found: {name}'
    bpy.data.objects.remove(reference, do_unlink=True)
pig = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and any(
    m and m.name.startswith('Pig Skin') for m in o.data.materials))

# White on the neighbouring frame keeps shared boundary vertices from baking
# black. Only the skin primitive receives these colours in the output GLB.
for i, material in enumerate(pig.data.materials):
    if material.name.startswith('Pig Skin'):
        pig.data.materials[i] = skin
    else:
        blank = bpy.data.materials.new('Colour bake boundary')
        tree = blank.node_tree
        tree.nodes.clear()
        emission = tree.nodes.new('ShaderNodeEmission')
        output = tree.nodes.new('ShaderNodeOutputMaterial')
        tree.links.new(emission.outputs[0], output.inputs['Surface'])
        pig.data.materials[i] = blank

tree = skin.node_tree
shader = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
output = next(n for n in tree.nodes if n.type == 'OUTPUT_MATERIAL')
emission = tree.nodes.new('ShaderNodeEmission')
tree.links.new(shader.inputs['Base Color'].links[0].from_socket, emission.inputs['Color'])
tree.links.new(emission.outputs[0], output.inputs['Surface'])
colour = pig.data.color_attributes.new(name='Skin colour', type='FLOAT_COLOR', domain='POINT')
pig.data.color_attributes.active_color = colour
bpy.ops.object.select_all(action='DESELECT')
pig.select_set(True)
bpy.context.view_layer.objects.active = pig
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.render.bake.target = 'VERTEX_COLORS'
scene.render.bake.use_selected_to_active = False
bpy.ops.object.bake(type='EMIT')

# Append a standard glTF attribute to the source binary, leaving its existing
# accessors and bytes untouched. KD lookup handles exporter vertex splitting.
data = SOURCE.read_bytes()
assert data[:4] == b'glTF' and struct.unpack_from('<I', data, 4)[0] == 2
json_size = struct.unpack_from('<I', data, 12)[0]
document = json.loads(data[20:20 + json_size])
bin_start = 20 + json_size
bin_size = struct.unpack_from('<I', data, bin_start)[0]
binary = bytearray(data[bin_start + 8:bin_start + 8 + bin_size])
excluded = {i for i, node in enumerate(document['nodes']) if node.get('name') in args.exclude_node}
for scene_info in document['scenes']:
    scene_info['nodes'] = [i for i in scene_info['nodes'] if i not in excluded]
for node in document['nodes']:
    if 'children' in node:
        node['children'] = [i for i in node['children'] if i not in excluded]

if mirror_plane is not None:
    node_index = next(i for i, n in enumerate(document['nodes']) if n.get('name') == 'Frame Bolts')
    node = document['nodes'][node_index]
    assert node_index in document['scenes'][document.get('scene', 0)]['nodes'], 'Expected a root stud node'
    translation = Matrix.Translation(Vector(node.get('translation', (0, 0, 0))))
    x, y, z, w = node.get('rotation', (0, 0, 0, 1))
    rotation = Quaternion((w, x, y, z)).to_matrix().to_4x4()
    scale = Matrix.Diagonal((*node.get('scale', (1, 1, 1)), 1))
    transform = translation @ rotation @ scale
    if 'matrix' in node:
        transform = Matrix([node['matrix'][i::4] for i in range(4)])
    plane_local = mirror_plane.inverted() @ transform
    side = []
    for primitive in document['meshes'][node['mesh']]['primitives']:
        accessor = document['accessors'][primitive['attributes']['POSITION']]
        view = document['bufferViews'][accessor['bufferView']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        for i in range(accessor['count']):
            p = Vector(struct.unpack_from('<3f', binary, offset + i * view.get('byteStride', 12)))
            side.append((plane_local @ p).x)
    if not (min(side) < -1e-5 and max(side) > 1e-5):
        reflection = mirror_plane @ Matrix.Diagonal((-1, 1, 1, 1)) @ mirror_plane.inverted()
        mirrored_stud = dict(node, name='Frame Bolts mirrored')
        copy_index = len(document['nodes'])
        document['nodes'].append(mirrored_stud)
        parent_index = len(document['nodes'])
        document['nodes'].append({'name': 'Frame Bolts Mirror modifier', 'children': [copy_index],
                                 'matrix': [reflection[row][col] for col in range(4) for row in range(4)]})
        document['scenes'][document.get('scene', 0)]['nodes'].append(parent_index)
        print('Restored the Blender Mirror modifier for the second frame stud.', flush=True)

points = KDTree(len(pig.data.vertices))
for vertex in pig.data.vertices:
    p = vertex.co
    points.insert(Vector((p.x, p.z, -p.y)), vertex.index)
points.balance()

for mesh in document['meshes']:
    for primitive in mesh['primitives']:
        material = document['materials'][primitive['material']]
        if material['name'] != 'Pig Skin':
            continue
        accessor = document['accessors'][primitive['attributes']['POSITION']]
        view = document['bufferViews'][accessor['bufferView']]
        offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', 12)
        colours = bytearray()
        for i in range(accessor['count']):
            position = struct.unpack_from('<3f', binary, offset + i * stride)
            _, index, distance = points.find(Vector(position))
            assert distance < 1e-5, f'Unmatched skin vertex: {position}'
            rgb = colour.data[index].color[:3]
            # RGBA occupies 8 bytes, preserving glTF's 4-byte vertex alignment.
            colours.extend(struct.pack('<4H', *(round(max(0, min(1, c)) * 65535) for c in rgb), 65535))
        binary.extend(b'\0' * (-len(binary) % 4))
        document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary),
                                      'byteLength': len(colours), 'target': 34962})
        document['accessors'].append({'bufferView': len(document['bufferViews']) - 1,
                                     'componentType': 5123, 'normalized': True,
                                     'count': accessor['count'], 'type': 'VEC4'})
        primitive['attributes']['COLOR_0'] = len(document['accessors']) - 1
        binary.extend(colours)
        # glTF has no Blender subsurface-scattering equivalent. Preserve the
        # actual sheen weight instead of the exporter's full-white sheen.
        material['extensions']['KHR_materials_sheen']['sheenColorFactor'] = [
            float(shader.inputs['Sheen Weight'].default_value)] * 3

if excluded:
    # This export's unused textured reference is most of its download size.
    # Remove only unreachable data; copy every retained buffer view verbatim.
    assert not document.get('skins') and not document.get('animations'), 'Reference pruning expects a static model'
    reachable = set()
    def visit(index):
        if index in reachable:
            return
        reachable.add(index)
        for child in document['nodes'][index].get('children', []):
            visit(child)
    for scene_info in document['scenes']:
        for index in scene_info['nodes']:
            visit(index)
    def compact(key, used):
        indices = sorted(used)
        mapping = {old: new for new, old in enumerate(indices)}
        document[key] = [document[key][i] for i in indices]
        return mapping
    node_map = compact('nodes', reachable)
    for scene_info in document['scenes']:
        scene_info['nodes'] = [node_map[i] for i in scene_info['nodes']]
    for node in document['nodes']:
        if 'children' in node:
            node['children'] = [node_map[i] for i in node['children']]
    mesh_map = compact('meshes', {node['mesh'] for node in document['nodes'] if 'mesh' in node})
    for node in document['nodes']:
        if 'mesh' in node:
            node['mesh'] = mesh_map[node['mesh']]
    primitives = [p for mesh in document['meshes'] for p in mesh['primitives']]
    material_map = compact('materials', {p['material'] for p in primitives})
    for primitive in primitives:
        primitive['material'] = material_map[primitive['material']]
    # The finished pig uses untextured PBR materials plus vertex colour; all
    # image textures in this export belong to the omitted reference copy.
    def has_texture(value):
        if isinstance(value, dict):
            return any((k.endswith('Texture') and isinstance(v, dict) and 'index' in v)
                       or has_texture(v) for k, v in value.items())
        if isinstance(value, list):
            return any(has_texture(v) for v in value)
        return False
    assert not has_texture(document['materials']), 'Cannot prune textures used by the finished model'
    for key in ('textures', 'images', 'samplers'):
        document.pop(key, None)
    used_accessors = set()
    for primitive in primitives:
        assert not primitive.get('targets'), 'Reference pruning expects no morph targets'
        used_accessors.update(primitive['attributes'].values())
        used_accessors.add(primitive['indices'])
    accessor_map = compact('accessors', used_accessors)
    for primitive in primitives:
        primitive['attributes'] = {name: accessor_map[i] for name, i in primitive['attributes'].items()}
        primitive['indices'] = accessor_map[primitive['indices']]
    assert all('sparse' not in a for a in document['accessors']), 'Reference pruning expects dense accessors'
    view_map = compact('bufferViews', {a['bufferView'] for a in document['accessors']})
    for accessor in document['accessors']:
        accessor['bufferView'] = view_map[accessor['bufferView']]
    packed = bytearray()
    for view in document['bufferViews']:
        offset = view.get('byteOffset', 0)
        payload = binary[offset:offset + view['byteLength']]
        packed.extend(b'\0' * (-len(packed) % 4))
        view['byteOffset'] = len(packed)
        packed.extend(payload)
    binary = packed
    print(f'Omitted reference meshes: {", ".join(args.exclude_node)}; retained geometry bytes unchanged.', flush=True)

document['buffers'][0]['byteLength'] = len(binary)
binary.extend(b'\0' * (-len(binary) % 4))
encoded = json.dumps(document, separators=(',', ':')).encode()
encoded += b' ' * (-len(encoded) % 4)
result = (struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(binary))
          + struct.pack('<I4s', len(encoded), b'JSON') + encoded
          + struct.pack('<I4s', len(binary), b'BIN\0') + binary)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_bytes(result)
print(f'Wrote {OUTPUT}: {len(result):,} bytes; original geometry preserved.', flush=True)
