// Offline only: keep the original GLB untouched and preserve authored shading.
import { readFile, writeFile } from 'node:fs/promises';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';

await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready]);
const source = await readFile(new URL('../assets/models/slypork-pig.glb', import.meta.url));
const jsonLength = source.readUInt32LE(12);
const original = JSON.parse(source.subarray(20, 20 + jsonLength));
const binary = source.subarray(28 + jsonLength);
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const types = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

function readAccessor(index) {
    const accessor = original.accessors[index];
    const view = original.bufferViews[accessor.bufferView];
    const Type = types[accessor.componentType];
    if (!Type || accessor.sparse || view.byteStride) throw new Error('Expected dense, packed export');
    const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const bytes = binary.subarray(start, start + accessor.count * components[accessor.type] * Type.BYTES_PER_ELEMENT);
    return new Type(Uint8Array.from(bytes).buffer);
}

for (const [name, ratio, error] of [['medium', 0.3, 0.001], ['low', 0.1, 0.003]]) {
    const document = structuredClone(original);
    document.accessors = [];
    document.bufferViews = [];
    const chunks = [];
    let length = 0;
    let triangles = 0;
    function append(array, template, target) {
        const data = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
        const padding = (4 - length % 4) % 4;
        chunks.push(Buffer.alloc(padding), data);
        length += padding;
        const bufferView = document.bufferViews.length;
        document.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length, target });
        length += data.length;
        const accessor = { ...template, bufferView, byteOffset: 0, count: array.length / components[template.type] };
        if (template.type === 'SCALAR') {
            accessor.componentType = array instanceof Uint16Array ? 5123 : 5125;
            delete accessor.min;
            delete accessor.max;
        }
        document.accessors.push(accessor);
        return document.accessors.length - 1;
    }
    for (const mesh of document.meshes) {
        for (const primitive of mesh.primitives) {
            const positions = readAccessor(primitive.attributes.POSITION);
            const normals = readAccessor(primitive.attributes.NORMAL);
            const colorId = primitive.attributes.COLOR_0;
            const colors = colorId === undefined ? null : readAccessor(colorId);
            const colorSize = colors ? components[original.accessors[colorId].type] : 0;
            const stride = 3 + colorSize;
            const attributes = new Float32Array(positions.length / 3 * stride);
            const colorScale = colors instanceof Uint8Array ? 255 : colors instanceof Uint16Array ? 65535 : 1;
            for (let i = 0; i < positions.length / 3; i++) {
                attributes.set(normals.subarray(i * 3, i * 3 + 3), i * stride);
                for (let c = 0; c < colorSize; c++) attributes[i * stride + 3 + c] = colors[i * colorSize + c] / colorScale;
            }
            const input = Uint32Array.from(readAccessor(primitive.indices));
            // Keep the small studs intact. Preserve seams, normals and baked skin colour.
            const [indices] = input.length < 6000 ? [input] : MeshoptSimplifier.simplifyWithAttributes(
                input, positions, 3, attributes, stride, Array(stride).fill(1), null,
                Math.floor(input.length * ratio / 3) * 3, error, ['LockBorder'],
            );
            const [remap, count] = MeshoptEncoder.reorderMesh(indices, true, false);
            for (const [semantic, id] of Object.entries(primitive.attributes)) {
                const values = readAccessor(id);
                const size = components[original.accessors[id].type];
                const packed = new values.constructor(count * size);
                for (let i = 0; i < remap.length; i++) {
                    if (remap[i] !== 0xffffffff) packed.set(values.subarray(i * size, (i + 1) * size), remap[i] * size);
                }
                // glTF requires tight POSITION bounds after removing vertices.
                const template = { ...original.accessors[id] };
                if (semantic === 'POSITION') {
                    template.min = [Infinity, Infinity, Infinity];
                    template.max = [-Infinity, -Infinity, -Infinity];
                    for (let i = 0; i < packed.length; i++) {
                        template.min[i % 3] = Math.min(template.min[i % 3], packed[i]);
                        template.max[i % 3] = Math.max(template.max[i % 3], packed[i]);
                    }
                }
                primitive.attributes[semantic] = append(packed, template, 34962);
            }
            primitive.indices = append(count <= 65535 ? Uint16Array.from(indices) : indices,
                original.accessors[primitive.indices], 34963);
            triangles += indices.length / 3;
        }
    }
    document.buffers = [{ byteLength: length }];
    const json = Buffer.from(JSON.stringify(document));
    const jsonPadding = (4 - json.length % 4) % 4;
    const binPadding = (4 - length % 4) % 4;
    const header = Buffer.alloc(20);
    header.write('glTF');
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(28 + json.length + jsonPadding + length + binPadding, 8);
    header.writeUInt32LE(json.length + jsonPadding, 12);
    header.write('JSON', 16);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(length + binPadding);
    binHeader.write('BIN\0', 4);
    const output = Buffer.concat([header, json, Buffer.alloc(jsonPadding, 32), binHeader, ...chunks, Buffer.alloc(binPadding)]);
    await writeFile(new URL(`../assets/models/slypork-pig-${name}.glb`, import.meta.url), output);
    console.log(`${name}: ${triangles.toLocaleString()} triangles (excluding mirrored instances), ${output.length.toLocaleString()} bytes`);
}
