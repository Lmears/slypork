// The KerBy demo's audio thread: KerBy's own engine (kerby.wasm, through engine.js), rendering
// 128 frames at a time. The page sends it notes, tempo and control changes; it sends back the
// values the page draws (after a preset or Return Home moves them) and the two voices' scopes.
//
// engine.js and kerby.wasm are built in the slypork-plugins repository (web/kerby-demo, `build.sh
// install`); don't edit them here.
import { KerByEngine } from './engine.js';

// The controls the page shows. Their values come back after anything that can move them.
const SHOWN = ['KICK_RATE', 'BASS_RATE', 'KICK_GLITCH', 'BASS_GLITCH'];
const BLOCK = 128;
const SCOPE_POINTS = 512; // the page's scopes: the engine's 2048-bucket bar, four buckets a point
const SCOPE_EVERY = 8;    // blocks between scope updates: about 40 a second at 44.1 or 48 kHz

class KerByWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.engine = null;
        this.waiting = [];
        this.blocks = 0;
        this.scopeBlocksLeft = 0;
        this.playing = false;
        this.held = new Set();
        this.port.onmessage = event => (this.engine ? this.handle(event.data) : this.waiting.push(event.data));
        KerByEngine.create(options.processorOptions.wasm, sampleRate, BLOCK).then(engine => {
            this.engine = engine;
            this.port.postMessage({ type: 'ready', presets: engine.description.presets, ...this.state() });
            for (const message of this.waiting) this.handle(message);
            this.waiting = [];
        }, error => this.port.postMessage({ type: 'error', message: String(error) }));
    }

    state() {
        const values = {};
        for (const id of SHOWN) values[id] = this.engine.get(id);
        return { values, slots: { kick: this.engine.rateSlots('kick'), bass: this.engine.rateSlots('bass') } };
    }

    settleScopes() {
        if (this.playing || this.held.size) this.scopeBlocksLeft = Infinity;
        else if (this.scopeBlocksLeft === Infinity) this.scopeBlocksLeft = Math.ceil(sampleRate / BLOCK);
    }

    handle(message) {
        const engine = this.engine;
        switch (message.type) {
            // The scopes run while the transport does or a key is held (the keys play with it stopped),
            // and a second after both stop, to let the last bar draw.
            case 'note-on':
                engine.noteOn(message.note, message.velocity ?? 100);
                this.held.add(message.note);
                this.scopeBlocksLeft = Infinity;
                break;
            case 'note-off':
                engine.noteOff(message.note);
                this.held.delete(message.note);
                this.settleScopes();
                break;
            case 'transport':
                engine.setTransport(message.bpm, message.playing);
                this.playing = message.playing;
                this.settleScopes();
                break;
            case 'set': engine.set(message.id, message.value); break;
            case 'preset':
                engine.loadPreset(message.index);
                this.port.postMessage({ type: 'state', preset: true, ...this.state() });
                break;
            case 'home':
                engine.goHome();
                this.port.postMessage({ type: 'state', ...this.state() });
                break;
        }
    }

    process(inputs, outputs) {
        const output = outputs[0];
        if (!this.engine || output[0].length !== BLOCK) return true;
        this.engine.process(output);
        if (this.scopeBlocksLeft > 0 && ++this.blocks % SCOPE_EVERY === 0) {
            this.scopeBlocksLeft -= SCOPE_EVERY;
            const kick = this.points(this.engine.scope('kick'));
            const bass = this.points(this.engine.scope('bass'));
            this.port.postMessage({ type: 'scope', kick, bass }, [kick.buffer, bass.buffer]);
        }
        return true;
    }

    /** The bar at the page's resolution: each point the bucket furthest from zero in its group, so
        a narrow hit isn't averaged away. */
    points(bar) {
        const step = bar.length / SCOPE_POINTS;
        const points = new Float32Array(SCOPE_POINTS);
        for (let i = 0; i < SCOPE_POINTS; i++) {
            let value = 0;
            for (let j = i * step; j < (i + 1) * step; j++) if (Math.abs(bar[j]) > Math.abs(value)) value = bar[j];
            points[i] = value;
        }
        return points;
    }
}

registerProcessor('kerby', KerByWorklet);
