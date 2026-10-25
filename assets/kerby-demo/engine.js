// The KerBy web engine's JavaScript side: instantiates build/kerby.wasm and wraps its C functions
// (engine/kerby_web.cpp). Written for an AudioWorkletGlobalScope, which has no fetch, DOM or
// (in some browsers) TextDecoder, so it takes the module's bytes and decodes strings itself.
// The page's worklet imports it; so does test-engine.mjs under Node.

const ENOSYS = 52; // WASI's "not implemented": the demo has no files, environment or console

function readUtf8(bytes, start) {
    let end = start;
    while (bytes[end] !== 0) end++;
    let text = '';
    for (let i = start; i < end;) {
        const b = bytes[i++];
        let code;
        if (b < 0x80) code = b;
        else if (b < 0xe0) code = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        else if (b < 0xf0) code = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else code = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        text += String.fromCodePoint(code);
    }
    return text;
}

export class KerByEngine {
    /** Instantiates the engine from the bytes of kerby.wasm, at the AudioContext's sample rate. */
    static async create(wasmBytes, sampleRate, blockSize = 128) {
        const engine = new KerByEngine();
        await engine.#instantiate(wasmBytes);
        engine.#init(sampleRate, blockSize);
        return engine;
    }

    #exports;
    #memory;
    blockSize = 128;
    channels = 2;
    /** { parameters: [{ index, id, name, min, max, steps, default, choices? }], presets: [path] } */
    description;
    #ids = new Map();

    async #instantiate(wasmBytes) {
        const view = () => new DataView(this.#memory.buffer);
        const syscall = () => -ENOSYS;
        const wasi = {
            proc_exit: code => { throw new Error(`KerBy engine exited (${code})`); },
            fd_write: (fd, iovs, count, written) => {
                // Only diagnostics reach here (stdout, stderr): count them as written and drop them.
                let total = 0;
                for (let i = 0; i < count; i++) total += view().getUint32(iovs + i * 8 + 4, true);
                view().setUint32(written, total, true);
                return 0;
            },
            fd_read: () => ENOSYS, fd_close: () => ENOSYS, fd_seek: () => ENOSYS, fd_sync: () => ENOSYS,
            environ_sizes_get: (count, size) => {
                view().setUint32(count, 0, true);
                view().setUint32(size, 0, true);
                return 0;
            },
            environ_get: () => 0,
            clock_time_get: (id, precision, out) => {
                view().setBigUint64(out, BigInt(Math.round(Date.now() * 1e6)), true);
                return 0;
            },
        };
        const env = new Proxy({ emscripten_notify_memory_growth: () => {} }, {
            get: (target, name) => target[name] ?? syscall, // __syscall_*: no file system
        });
        const { instance } = await WebAssembly.instantiate(wasmBytes, { wasi_snapshot_preview1: wasi, env });
        this.#exports = instance.exports;
        this.#memory = instance.exports.memory;
        this.#exports._initialize();
    }

    #init(sampleRate, blockSize) {
        this.blockSize = blockSize;
        this.channels = this.#exports.kerby_create(sampleRate, blockSize);
        this.description = JSON.parse(this.#string(this.#exports.kerby_describe()));
        for (const p of this.description.parameters) this.#ids.set(p.id, p.index);
        this.scopeSize = this.#exports.kerby_scope_size();
    }

    #string(pointer) {
        return readUtf8(new Uint8Array(this.#memory.buffer), pointer);
    }

    #floats(pointer, length) {
        // A fresh view each time: the memory's buffer is replaced whenever the module grows it.
        return new Float32Array(this.#memory.buffer, pointer, length);
    }

    /** Renders one block into `outputs` (an array of Float32Arrays, one per channel). */
    process(outputs) {
        this.#exports.kerby_process();
        for (let c = 0; c < outputs.length; c++)
            outputs[c].set(this.#floats(this.#exports.kerby_output(Math.min(c, this.channels - 1)), this.blockSize));
    }

    noteOn(note, velocity = 100) { this.#exports.kerby_note_on(note, velocity); }
    noteOff(note) { this.#exports.kerby_note_off(note); }

    /** Tempo in BPM, and whether the transport runs; starting it goes back to the top of the bar. */
    setTransport(bpm, playing) { this.#exports.kerby_set_transport(bpm, playing ? 1 : 0); }

    /** A demo preset by its index in description.presets, or -1 for Init. */
    loadPreset(index) { return this.#exports.kerby_load_preset(index) === 1; }

    /** A parameter's plain value (a Rate's division index, a Glitch amount), by ID. */
    get(id) { return this.#exports.kerby_get_parameter(this.#ids.get(id)); }
    set(id, value) { this.#exports.kerby_set_parameter(this.#ids.get(id), value); }
    text(id) { return this.#string(this.#exports.kerby_parameter_text(this.#ids.get(id))); }

    /** A voice's Rate slots ('kick' or 'bass') as the plugin labels them: [{ label, skipped }]. */
    rateSlots(voice) { return JSON.parse(this.#string(this.#exports.kerby_rate_slots(voice === 'kick' ? 0 : 1))); }

    /** A voice's scope: its last bar, scopeSize signed samples (a view: copy it to keep it). */
    scope(voice) { return this.#floats(this.#exports.kerby_scope(voice === 'kick' ? 0 : 1), this.scopeSize); }

    /** The house button: Return Home. */
    goHome() { this.#exports.kerby_go_home(); }
}
