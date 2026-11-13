// The KerBy demo's audio thread: KerBy's own engine (kerby.wasm, through engine.js), rendering
// 128 frames at a time. The page sends it notes, tempo and control changes; it sends back the
// values the page draws (after a preset or Return Home moves them) and the two voices' scopes.
//
// The engine's clock runs while Play is on or a key is held. A key pressed with nothing else
// sounding starts it from the top of the bar, as pressing a note at bar 1 with Live playing does,
// so a patch whose modulators follow the transport (Dubstep's wobble) plays the same whenever the
// key goes down, instead of carrying on from wherever its free-running LFOs had got to.
// A preset chosen under a key or Play starts from the top too, as if the key went down again
// (fromTheTop()).
//
// engine.js and kerby.wasm are built in the slypork-plugins repository (web/kerby-demo, `build.sh
// install`); don't edit them here.
import { KerByEngine } from './engine.js';

// The controls the page shows. Their values come back after anything that can move them.
const SHOWN = ['KICK_RATE', 'BASS_RATE', 'KICK_GLITCH', 'BASS_GLITCH'];
// The knobs, whose modulation rings (a preset's routes, Acid Glitch's random LFO on Kick Rate) come
// back with every scope update, and once after a preset or Return Home.
const KNOBS = ['KICK_RATE', 'BASS_RATE', 'KICK_GLITCH', 'BASS_GLITCH'];
const BLOCK = 128;
const SCOPE_POINTS = 512; // the page's scopes: the engine's 2048-bucket bar, four buckets a point
const SCOPE_EVERY = 8;    // blocks between scope updates: about 40 a second at 44.1 or 48 kHz
const QUIET_BLOCKS = Math.ceil(sampleRate / 2 / BLOCK); // half a second of silence is quiet
const SILENT = 1e-5;      // -100 dBFS
// What the engine takes to fade the last patch's rhythm out once its note is let go, in blocks: 20 ms,
// KerBy's kPresetFadeSeconds.
const FADE_BLOCKS = Math.ceil(0.02 * sampleRate / BLOCK);

class KerByWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this.engine = null;
        this.waiting = [];
        this.blocks = 0;
        this.scopeBlocksLeft = 0;
        this.ringsDue = false; // the rings to send after the next block: a new patch's routes have run once by then
        this.playing = false; // the page's Play
        this.held = new Set();
        this.velocity = 100;  // the last key's, for the keys fromTheTop() puts down again
        this.bpm = 128;
        this.heard = 0;       // messages from the page, for it to match a quiet against what it's sent
        this.quietBlocks = 0; // silent blocks since the last sound or message
        this.port.onmessage = event => {
            this.heard++;
            this.quietBlocks = 0;
            this.engine ? this.handle(event.data) : this.waiting.push(event.data);
        };
        KerByEngine.create(options.processorOptions.wasm, sampleRate, BLOCK).then(engine => {
            this.engine = engine;
            this.port.postMessage({ type: 'ready', presets: engine.description.presets, ...this.state() });
            this.ringsDue = true;
            for (const message of this.waiting) this.handle(message);
            this.waiting = [];
        }, error => this.port.postMessage({ type: 'error', message: String(error) }));
    }

    state() {
        const values = {};
        for (const id of SHOWN) values[id] = this.engine.get(id);
        return { values, slots: { kick: this.engine.rateSlots('kick'), bass: this.engine.rateSlots('bass') } };
    }

    /** Runs the engine's clock while Play is on or a key is held; starting it goes to the top of the bar. */
    runClock() {
        this.engine.setTransport(this.bpm, this.playing || this.held.size > 0);
    }

    settleScopes() {
        if (this.playing || this.held.size) this.scopeBlocksLeft = Infinity;
        else if (this.scopeBlocksLeft === Infinity) this.scopeBlocksLeft = Math.ceil(sampleRate / BLOCK);
    }

    handle(message) {
        if (this.switching) {
            if (this.switching.startIn) this.whileLetGo(message);
            else if (message.type === 'preset') this.switching.message = message; // the latest one wins
            else this.switching.after.push(message);
            return;
        }
        if (message.type !== 'preset') return this.applyMessage(message);
        // Under sound the engine fades the last patch out first (followSwitch()); in silence it goes straight in.
        if (this.engine.beginPresetChange()) this.switching = { message, after: [] };
        else {
            this.applyMessage(message);
            this.fromTheTop();
        }
    }

    /** A preset that went in under a key or Play starts from the top of its bar, as it does when the key
        goes down. The engine starts the LFOs a patch restarts with the note (Dubstep's wobble) as the
        patch loads, but its clock would carry on from the last patch's bar and tempo, leaving the two out
        of step until the key was let go and pressed again. So that is what's done: every key let go and
        the clock stopped, which also fades out the last patch's rhythm (the engine carries it on only
        while a note is held), and FADE_BLOCKS later the clock started from the top with the keys down
        again. Measured against letting go and pressing again by hand: the same samples, where a patch
        has nothing random. `after` is what the page sent while the last patch faded. */
    fromTheTop(after = []) {
        if (this.playing || this.held.size) {
            for (const note of this.held) this.engine.noteOff(note);
            this.engine.setTransport(this.bpm, false);
            this.switching = { startIn: FADE_BLOCKS };
        }
        for (const waited of after) this.handle(waited);
    }

    /** The page's messages while everything is let go (fromTheTop()): a key or Play only changes what
        goes down when the clock starts, and another preset goes straight in, nothing sounding to fade. */
    whileLetGo(message) {
        switch (message.type) {
            case 'note-on':
                this.held.add(message.note);
                this.velocity = message.velocity ?? 100;
                this.scopeBlocksLeft = Infinity;
                break;
            case 'note-off':
                this.held.delete(message.note);
                this.settleScopes();
                break;
            case 'transport':
                this.bpm = message.bpm;
                this.playing = message.playing;
                this.settleScopes();
                break;
            default: this.applyMessage(message);
        }
    }

    /** A preset's change, a block at a time: the patch goes in once the engine has faded the last one out,
        and what was held starts it from the top FADE_BLOCKS after that (fromTheTop()). */
    followSwitch() {
        const switching = this.switching;
        if (switching.startIn) {
            if (--switching.startIn > 0) return;
            this.switching = null;
            this.runClock();
            for (const note of this.held) this.engine.noteOn(note, this.velocity);
            return;
        }
        if (!this.engine.presetChangeReady()) return;
        this.switching = null;
        this.applyMessage(switching.message);
        this.engine.finishPresetChange();
        this.fromTheTop(switching.after);
    }

    applyMessage(message) {
        const engine = this.engine;
        switch (message.type) {
            // The scopes run while Play is on or a key is held, and a second after both stop, to let
            // the last bar draw.
            case 'note-on':
                this.held.add(message.note);
                this.velocity = message.velocity ?? 100;
                this.runClock();
                engine.noteOn(message.note, this.velocity);
                this.scopeBlocksLeft = Infinity;
                break;
            case 'note-off':
                engine.noteOff(message.note);
                this.held.delete(message.note);
                this.runClock();
                this.settleScopes();
                break;
            case 'transport':
                this.bpm = message.bpm;
                this.playing = message.playing;
                this.runClock();
                this.settleScopes();
                break;
            case 'set': engine.set(message.id, message.value); break;
            case 'preset':
                engine.loadPreset(message.index);
                this.port.postMessage({ type: 'state', preset: true, ...this.state() });
                this.ringsDue = true;
                break;
            case 'home':
                engine.goHome();
                this.port.postMessage({ type: 'state', ...this.state() });
                this.ringsDue = true;
                break;
        }
    }

    process(inputs, outputs) {
        if (this.switching) this.followSwitch();
        const output = outputs[0];
        if (!this.engine || output[0].length !== BLOCK) return true;
        this.engine.process(output);
        if (this.scopeBlocksLeft > 0 && ++this.blocks % SCOPE_EVERY === 0) {
            this.scopeBlocksLeft -= SCOPE_EVERY;
            const kick = this.points(this.engine.scope('kick'));
            const bass = this.points(this.engine.scope('bass'));
            this.port.postMessage({ type: 'scope', kick, bass }, [kick.buffer, bass.buffer]);
            this.ringsDue = true;
        }
        if (this.ringsDue) this.sendRings();
        this.listenForQuiet(output);
        return true;
    }

    /** Each knob's modulation ring, as KerBy draws it round a modulated knob: { low, high, now } as
        0..1 of its travel, or null for a knob no route reaches. */
    sendRings() {
        this.ringsDue = false;
        const rings = {};
        for (const id of KNOBS) rings[id] = this.engine.modulation(id);
        this.port.postMessage({ type: 'modulation', rings });
    }

    /** Says so once the engine has gone quiet: Play off, no key held, the scopes settled and the
        output silent for half a second, so the reverb's tail has died away. The page suspends the
        context then (demo.js sleep()), so the engine isn't run on silence while the tab is open.
        Again after any message, which may have woken it. */
    listenForQuiet(output) {
        if (this.playing || this.held.size || this.scopeBlocksLeft > 0) { this.quietBlocks = 0; return; }
        if (this.quietBlocks > QUIET_BLOCKS) return;
        for (const channel of output) for (let i = 0; i < channel.length; i++) {
            if (Math.abs(channel[i]) > SILENT) { this.quietBlocks = 0; return; }
        }
        if (++this.quietBlocks > QUIET_BLOCKS) this.port.postMessage({ type: 'quiet', heard: this.heard });
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
