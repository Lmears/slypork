import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PigQuality, PIG_QUALITY } from '../assets/js/pig-quality.js';

function simulate(controller, interval, duration, start = 1000) {
    for (let time = start; time < start + duration; time += interval) controller.sample(time);
    return start + duration;
}

test('60/120/144 Hz retain full model and original 2x resolution', () => {
    for (const hz of [60, 120, 144]) {
        const quality = new PigQuality();
        simulate(quality, 1000 / hz, 30000);
        assert.equal(quality.level, 0);
        assert.deepEqual(PIG_QUALITY[quality.level], { pixelRatio: 2, model: 'full' });
    }
});

test('sustained 30 FPS reduces work and sustained recovery restores full quality', () => {
    const quality = new PigQuality();
    const time = simulate(quality, 1000 / 30, 14000);
    assert.equal(quality.level, PIG_QUALITY.length - 1);
    simulate(quality, 1000 / 60, 50000, time);
    assert.equal(quality.level, 0);
});

test('touch devices start with low geometry at 1x and retain the tier across resets', () => {
    const quality = new PigQuality({ coarsePointer: true });
    assert.deepEqual(PIG_QUALITY[quality.level], { pixelRatio: 1, model: 'low' });
    simulate(quality, 1000 / 60, 4000);
    quality.reset();
    assert.equal(quality.level, 3);
});

test('touch devices can reduce work further under pressure and recover to full quality', () => {
    const quality = new PigQuality({ coarsePointer: true });
    const time = simulate(quality, 1000 / 30, 4000);
    assert.equal(quality.level, PIG_QUALITY.length - 1);
    simulate(quality, 1000 / 60, 50000, time);
    assert.equal(quality.level, 0);
});

test('a single hitch, tab suspension and a restart do not reduce quality', () => {
    const quality = new PigQuality();
    let time = simulate(quality, 1000 / 60, 4000);
    quality.sample(time + 150);
    time = simulate(quality, 1000 / 60, 4000, time + 167);
    quality.sample(time + 10000);
    quality.reset();
    simulate(quality, 1000 / 60, 4000, time + 10017);
    assert.equal(quality.level, 0);
});

test('failed recovery probes back off instead of switching every few seconds', () => {
    const quality = new PigQuality();
    let time = simulate(quality, 1000 / 30, 2600);
    assert.equal(quality.level, 1);
    time = simulate(quality, 1000 / 60, 12000, time);
    assert.equal(quality.level, 0);
    simulate(quality, 1000 / 30, 2600, time);
    assert.equal(quality.level, 1);
    assert.equal(quality.recoveryDelay, 16000);
});

async function glb(name) {
    const file = await readFile(new URL(`../assets/models/slypork-pig${name}.glb`, import.meta.url));
    assert.equal(file.readUInt32LE(8), file.length);
    const length = file.readUInt32LE(12);
    return { document: JSON.parse(file.subarray(20, 20 + length)), binary: file.subarray(28 + length) };
}

test('LOD assets preserve materials, instances, vertex shading and valid indexed geometry', async () => {
    const { document: original, binary: source } = await glb('');
    const counts = [];
    for (const name of ['-medium', '-low']) {
        const { document, binary } = await glb(name);
        assert.deepEqual(document.materials, original.materials);
        assert.deepEqual(document.nodes, original.nodes);
        let triangles = 0;
        for (const [m, mesh] of document.meshes.entries()) {
            for (const [p, primitive] of mesh.primitives.entries()) {
                const originalPrimitive = original.meshes[m].primitives[p];
                const records = (doc, bin, prim) => {
                    const views = Object.values(prim.attributes).map(id => {
                        const accessor = doc.accessors[id];
                        const view = doc.bufferViews[accessor.bufferView];
                        return { offset: (view.byteOffset || 0) + (accessor.byteOffset || 0),
                            stride: view.byteLength / accessor.count, count: accessor.count };
                    });
                    return Array.from({ length: views[0].count }, (_, i) => views.map(v =>
                        bin.subarray(v.offset + i * v.stride, v.offset + (i + 1) * v.stride).toString('hex')).join(':'));
                };
                const originals = new Set(records(original, source, originalPrimitive));
                assert.ok(records(document, binary, primitive).every(record => originals.has(record)),
                    'Positions, normals, colour and UV values must come from the original vertices');
                const accessor = document.accessors[primitive.indices];
                const view = document.bufferViews[accessor.bufferView];
                const vertexCount = document.accessors[primitive.attributes.POSITION].count;
                const bytes = accessor.componentType === 5123 ? 2 : 4;
                for (let i = 0; i < accessor.count; i++) {
                    assert.ok(binary.readUIntLE((view.byteOffset || 0) + i * bytes, bytes) < vertexCount);
                }
                triangles += accessor.count / 3;
            }
        }
        counts.push(triangles);
    }
    assert.ok(counts[0] < 80000 && counts[1] < 45000 && counts[1] < counts[0]);
});
