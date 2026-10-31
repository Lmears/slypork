// KerBy, playable on /kerby/: the real instrument's engine (kerby.wasm, run by worklet.js on the
// audio thread) behind a small interface in KerBy's own look - Play, the two voices' Rate and
// Glitch knobs, the house button, a keyboard, presets and tempo.
//
// The keys play as KerBy does with the DAW stopped: hold one and both voices pulse from that
// moment until you let go, so taps play freely. Play starts the transport and holds G for you:
// the latched note keeps both voices pulsing in time, a key switches it, and Stop lets go. That's
// KerBy's Live mode with a held note, which a phone can't otherwise do while a thumb turns Rate.
//
// The engine loads as the demo nears the screen, so its knobs show the preset before anyone
// touches them and Play starts at once. Built in the slypork-plugins repository (web/kerby-demo).

const root = document.querySelector('[data-kerby-demo]');
if (root) initDemo(root);

function initDemo(root) {
    const $ = selector => root.querySelector(selector);
    const status = $('.kd-status');
    const say = text => { status.textContent = text; };

    if (!window.AudioWorkletNode || !window.WebAssembly) {
        root.classList.add('kd-unsupported');
        say('This browser can’t run the demo. Try a recent Chrome, Safari, Firefox or Edge.');
        return;
    }

    // Tempo for each preset (by name), for the genre it was made for; anything else plays at 128.
    const PRESET_BPM = { 'Init': 160, 'Kerb Stomper': 160, 'DnB': 172, 'Dubstep': 140, 'Donk': 160 };
    const DEFAULT_BPM = 128, MIN_BPM = 60, MAX_BPM = 300;
    // The keyboard's octave for each preset, as Live names them (C1 is MIDI 36, where most of the
    // factory presets are voiced); anything else starts at C1. Switching preset moves a held note
    // with it.
    const PRESET_OCTAVE = { 'Kerb Stomper': 0, 'Techno 1': 0, 'DnB': 0, 'Donk': 0 };
    const DEFAULT_OCTAVE = 1;
    const noteName = note => `${NAMES[note % 12]}${Math.floor(note / 12) - 2}`;
    const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    let lowest = (DEFAULT_OCTAVE + 2) * 12;
    const VELOCITY = 100;
    const PLAY_KEY = 7; // the note Play holds: G, above the keyboard's C

    let context = null, node = null, loading = null;
    let presets = [], presetOrder = [], presetAt = 0;
    let playing = false, latched = null, bpm = DEFAULT_BPM;
    const send = message => node?.port.postMessage(message);

    // ---- Colours: KerBy's theme (KerbyLookAndFeel), from the CSS so dark mode follows ----------
    let colours = {};
    const readColours = () => {
        const style = getComputedStyle(root);
        for (const name of ['bg', 'grid', 'midline', 'mid', 'strong', 'text', 'kick', 'bass'])
            colours[name] = style.getPropertyValue(`--kd-${name}`).trim();
    };
    readColours();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        readColours();
        knobs.forEach(k => k.draw());
        scopes.forEach(s => s.draw());
    });

    // ---- Knobs ------------------------------------------------------------------------------------
    // slypork::LookAndFeel::drawRotarySlider: JUCE's default 1.2π..2.8π sweep, measured clockwise
    // from twelve o'clock; a 4px track and value arc 3px inside the dial, their round caps kept
    // within the angles; a 4px pill pointer 0.6 of the radius long; KerBy's home tick across the
    // track. Rate steps through its divisions, skipping any its straight/triplet setting hides.
    const START = Math.PI * 1.2, END = Math.PI * 2.8;
    const RATE_PX_PER_STEP = 14, GLITCH_PX_FULL_RANGE = 200;

    class Knob {
        constructor(element) {
            this.element = element;
            this.id = element.dataset.param;
            this.rate = element.dataset.kind === 'rate';
            this.voice = this.id.startsWith('KICK') ? 'kick' : 'bass';
            this.canvas = element.querySelector('canvas');
            this.valueLabel = element.querySelector('.kd-knob-value');
            this.min = 0;
            this.max = this.rate ? 16 : 100;
            this.value = this.default = Number(element.dataset.default);
            this.home = null;
            this.slots = null;
            this.listen();
        }

        proportion(value) { return (value - this.min) / (this.max - this.min); }

        label() {
            if (this.rate) return this.slots ? this.slots[this.value].label : '';
            return `${Math.round(this.value)} %`;
        }

        /** A value from the engine (a preset, Return Home), not from this knob's own gesture. */
        show(value) {
            this.value = value;
            this.draw();
        }

        set(value) {
            value = Math.min(this.max, Math.max(this.min, value));
            if (this.rate) value = this.legal(Math.round(value), Math.sign(value - this.value) || 1);
            if (value === this.value) return;
            this.value = value;
            send({ type: 'set', id: this.id, value });
            this.draw();
        }

        /** The nearest Rate slot that isn't skipped, looking first in the direction of travel. */
        legal(index, direction) {
            if (!this.slots) return index;
            for (let d = 0; d <= 16; d++)
                for (const i of [index + d * direction, index - d * direction])
                    if (i >= 0 && i <= 16 && !this.slots[i].skipped) return i;
            return index;
        }

        step(direction) {
            if (!this.rate) return this.set(this.value + direction * 5);
            for (let i = this.value + direction; i >= 0 && i <= 16; i += direction)
                if (!this.slots?.[i].skipped) return this.set(i);
        }

        listen() {
            const el = this.element;
            let drag = null, lastTap = 0;
            el.addEventListener('pointerdown', event => {
                if (event.button !== 0) return;
                el.setPointerCapture(event.pointerId);
                const now = performance.now();
                if (now - lastTap < 300) { this.set(this.default); lastTap = 0; drag = null; return; }
                lastTap = now;
                drag = { x: event.clientX, y: event.clientY, value: this.value, moved: false };
                el.classList.add('kd-dragging');
            });
            el.addEventListener('pointermove', event => {
                if (!drag || !el.hasPointerCapture(event.pointerId)) return;
                const travel = (drag.y - event.clientY) + (event.clientX - drag.x);
                if (Math.abs(travel) > 3) { drag.moved = true; lastTap = 0; }
                if (this.rate) this.set(drag.value + Math.round(travel / RATE_PX_PER_STEP));
                else this.set(drag.value + travel * (this.max / GLITCH_PX_FULL_RANGE) * (event.shiftKey ? 0.25 : 1));
            });
            const end = () => { drag = null; el.classList.remove('kd-dragging'); };
            el.addEventListener('pointerup', end);
            el.addEventListener('pointercancel', end);
            let wheel = 0;
            el.addEventListener('wheel', event => {
                event.preventDefault();
                wheel += event.deltaY;
                while (Math.abs(wheel) >= 40) {
                    this.step(wheel < 0 ? 1 : -1);
                    wheel -= Math.sign(wheel) * 40;
                }
            }, { passive: false });
            el.addEventListener('keydown', event => {
                const direction = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[event.key];
                if (direction) { event.preventDefault(); this.step(direction); }
                else if (event.key === 'Home') { event.preventDefault(); this.set(this.min); }
                else if (event.key === 'End') { event.preventDefault(); this.set(this.max); }
            });
        }

        draw() {
            const label = this.label();
            this.valueLabel.textContent = label;
            this.element.setAttribute('aria-valuenow', String(this.value));
            this.element.setAttribute('aria-valuetext', label);

            const { canvas } = this;
            const ratio = window.devicePixelRatio || 1;
            const size = canvas.clientWidth;
            if (!size) return;
            if (canvas.width !== Math.round(size * ratio)) canvas.width = canvas.height = Math.round(size * ratio);
            const g = canvas.getContext('2d');
            g.setTransform(ratio, 0, 0, ratio, 0, 0);
            g.clearRect(0, 0, size, size);

            const centre = size / 2, radius = size / 2 - 4;
            const at = (angle, r) => [centre + r * Math.sin(angle), centre - r * Math.cos(angle)];
            const angleOf = p => START + p * (END - START);
            const arcRadius = radius - 3, stroke = 4, cap = stroke / 2 / arcRadius;
            const arc = (from, to, colour) => {
                const inset = Math.sign(to - from) * Math.min(cap, Math.abs(to - from) / 2);
                g.beginPath();
                g.arc(centre, centre, arcRadius, from + inset - Math.PI / 2, to - inset - Math.PI / 2, to < from);
                g.strokeStyle = colour;
                g.lineWidth = stroke;
                g.lineCap = 'round';
                g.stroke();
            };

            g.fillStyle = colours.bg;
            g.beginPath();
            g.arc(centre, centre, radius, 0, Math.PI * 2);
            g.fill();
            g.globalAlpha = 0.4;
            arc(START, END, colours.mid);
            g.globalAlpha = 1;
            const p = this.proportion(this.value);
            if (p > 0) arc(START, angleOf(p), colours.strong);

            if (this.home !== null) {
                const angle = angleOf(this.proportion(this.home));
                g.beginPath();
                g.moveTo(...at(angle, radius - 6));
                g.lineTo(...at(angle, radius));
                g.strokeStyle = colours.text;
                g.lineWidth = 2;
                g.lineCap = 'butt';
                g.stroke();
            }

            const angle = angleOf(p);
            g.beginPath();
            g.moveTo(...at(angle, 2));
            g.lineTo(...at(angle, radius * 0.6 - 2));
            g.strokeStyle = colours.text;
            g.lineWidth = 4;
            g.lineCap = 'round';
            g.stroke();
        }
    }

    const knobs = [...root.querySelectorAll('.kd-knob')].map(element => new Knob(element));
    const knob = id => knobs.find(k => k.id === id);

    // ---- Scopes: each voice's last bar, as KerBy's row scopes draw it ---------------------------
    class Scope {
        constructor(canvas) {
            this.canvas = canvas;
            this.voice = canvas.dataset.voice;
            this.points = null;
        }

        draw() {
            const { canvas } = this;
            const ratio = window.devicePixelRatio || 1;
            const width = canvas.clientWidth, height = canvas.clientHeight;
            if (!width || !height) return;
            if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
            if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
            const g = canvas.getContext('2d');
            g.setTransform(ratio, 0, 0, ratio, 0, 0);
            g.clearRect(0, 0, width, height);

            g.lineWidth = 1;
            g.strokeStyle = colours.midline;
            g.beginPath();
            for (const beat of [1, 2, 3]) {
                const x = Math.round((width * beat) / 4) + 0.5;
                g.moveTo(x, 0);
                g.lineTo(x, height);
            }
            g.moveTo(0, Math.round(height / 2) + 0.5);
            g.lineTo(width, Math.round(height / 2) + 0.5);
            g.stroke();

            if (!this.points) return;
            const n = this.points.length, half = height / 2 - 2;
            g.beginPath();
            for (let i = 0; i < n; i++) {
                const x = (i / (n - 1)) * width, y = height / 2 - Math.max(-1, Math.min(1, this.points[i])) * half;
                i ? g.lineTo(x, y) : g.moveTo(x, y);
            }
            g.strokeStyle = colours[this.voice];
            g.lineWidth = 1.5;
            g.lineJoin = 'round';
            g.stroke();
        }
    }

    const scopes = [...root.querySelectorAll('.kd-scope')].map(canvas => new Scope(canvas));
    let scopeFrame = 0;
    const redrawScopes = () => {
        if (scopeFrame) return;
        scopeFrame = requestAnimationFrame(() => { scopeFrame = 0; scopes.forEach(s => s.draw()); });
    };
    new ResizeObserver(() => { knobs.forEach(k => k.draw()); scopes.forEach(s => s.draw()); }).observe(root);

    // ---- Keys -------------------------------------------------------------------------------------
    // One octave and a C, from the preset's octave (PRESET_OCTAVE). On a computer keyboard, A to K
    // are the white keys and W E T Y U the black ones, as in Live.
    const keysElement = $('.kd-keys');
    const COMPUTER_KEYS = 'awsedftgyhujk';
    const HOME_KEY = 'i';
    const keyButtons = [];
    for (let i = 0; i <= 12; i++) {
        const black = [1, 3, 6, 8, 10].includes(i % 12);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = black ? 'kd-key kd-key-black' : 'kd-key';
        button.setAttribute('aria-pressed', 'false');
        if (black) button.style.setProperty('--kd-key-at', String([0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][i % 12] + 7 * Math.floor(i / 12)));
        button.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            event.preventDefault();
            button.setPointerCapture(event.pointerId); // its moves and release come here, wherever the finger goes
            fingers.set(`pointer ${event.pointerId}`, lowest + i);
            pressKey(lowest + i, `pointer ${event.pointerId}`);
        });
        // A finger dragged along the keys plays each one it reaches, as KerBy's keyboard does.
        button.addEventListener('pointermove', event => {
            if (!button.hasPointerCapture(event.pointerId)) return;
            const under = document.elementFromPoint(event.clientX, event.clientY)?.closest('.kd-key');
            const j = keyButtons.indexOf(under);
            if (j >= 0) slideKey(`pointer ${event.pointerId}`, lowest + j);
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
            button.addEventListener(type, event => {
                fingers.delete(`pointer ${event.pointerId}`);
                releaseKey(`pointer ${event.pointerId}`);
            });
        // Enter or Space on a focused key holds it like a finger.
        button.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            if (!event.repeat) pressKey(lowest + i, `focus ${i}`);
        });
        button.addEventListener('keyup', event => {
            if (event.key === 'Enter' || event.key === ' ') releaseKey(`focus ${i}`);
        });
        keysElement.append(button);
        keyButtons.push(button);
    }
    const labelKeys = () => {
        keyButtons.forEach((button, i) => button.setAttribute('aria-label', noteName(lowest + i)));
        keysElement.setAttribute('aria-label', `Keys, ${noteName(lowest)} to ${noteName(lowest + 12)}`);
    };
    labelKeys();
    const showLatched = () => {
        const down = new Set(held.values());
        for (const [i, button] of keyButtons.entries()) {
            const on = lowest + i === latched || down.has(lowest + i);
            button.classList.toggle('kd-key-on', on);
            button.setAttribute('aria-pressed', String(on));
        }
    };

    document.addEventListener('keydown', event => {
        if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || !node) return;
        if (event.target.closest('input, textarea, select, [contenteditable]')) return;
        const i = COMPUTER_KEYS.indexOf(event.key.toLowerCase());
        if (i < 0) return;
        const box = root.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight) return; // only while the demo is on screen
        event.preventDefault();
        pressKey(lowest + i, `key ${event.code}`);
    });
    document.addEventListener('keyup', event => releaseKey(`key ${event.code}`));
    window.addEventListener('blur', () => releaseAll()); // a key let go in another window never comes back up here

    // ---- Playing ----------------------------------------------------------------------------------
    const playButton = $('.kd-play');

    function showPlaying() {
        playButton.setAttribute('aria-pressed', String(playing));
        root.classList.toggle('kd-playing', playing);
        showLatched();
    }

    async function start(note = latched ?? lowest + PLAY_KEY) {
        if (!(await audioReady())) return;
        if (!playing) {
            releaseAll(); // Play takes over from any key still held
            playing = true;
            send({ type: 'transport', bpm, playing: true });
        }
        if (note !== null && note !== latched) {
            send({ type: 'note-on', note, velocity: VELOCITY }); // the new note first: a legato change
            if (latched !== null) send({ type: 'note-off', note: latched });
            latched = note;
        }
        showPlaying();
    }

    function stop() {
        if (!playing) return;
        if (latched !== null) send({ type: 'note-off', note: latched });
        latched = null;
        playing = false;
        send({ type: 'transport', bpm, playing: false });
        showPlaying();
    }

    // The keys held while Play is off, by what holds them (a pointer, a computer key or a focused
    // key button), each to its note.
    const held = new Map();

    /** A key going down: while Play is on it switches the held note; otherwise it plays until it's let go. */
    async function pressKey(note, by) {
        unlockAudio();
        if (playing) return start(note);
        if (held.has(by)) return;
        held.set(by, note);
        showLatched();
        if (!(await audioReady()) || held.get(by) !== note) return; // let go while the engine loaded
        send({ type: 'note-on', note, velocity: VELOCITY });
    }

    // The key under each finger on the keyboard, Play on or off, so a drag knows when it reaches
    // another one.
    const fingers = new Map();

    /** A finger dragged onto another key. With Play off, the old note lets go before the new one
        starts, as KerBy's keyboard does: with nothing else held, the new key starts a run of its own
        and plays at once, where a legato change would wait for the next pulse. */
    function slideKey(by, note) {
        if (fingers.get(by) === note) return;
        fingers.set(by, note);
        if (playing) return start(note);
        const old = held.get(by);
        if (old === undefined) return;
        held.set(by, note);
        if (![...held.values()].includes(old)) send({ type: 'note-off', note: old });
        send({ type: 'note-on', note, velocity: VELOCITY });
        showLatched();
    }

    function releaseKey(by) {
        const note = held.get(by);
        if (note === undefined) return;
        held.delete(by);
        if (![...held.values()].includes(note)) send({ type: 'note-off', note });
        showLatched();
    }

    function releaseAll() {
        for (const by of [...held.keys()]) releaseKey(by);
    }

    playButton.addEventListener('click', () => {
        unlockAudio();
        playing ? stop() : start();
    });
    function silence() {
        stop();
        releaseAll();
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) silence();
    });
    document.body.addEventListener('kerbyTourOpened', silence);

    $('.kd-home').addEventListener('click', () => send({ type: 'home' }));
    // KerBy's own Return Home key (KerByAudioProcessorEditor::kReturnHomeKey in the plugin), so the
    // demo teaches the real gesture: one hand on a Rate, the other sending it home. Clear of the
    // note keys and of Live's own; a held key's repeats would only go home again, so they're dropped.
    document.addEventListener('keydown', event => {
        if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || !node) return;
        if (event.key.toLowerCase() !== HOME_KEY) return;
        if (event.target.closest('input, textarea, select, [contenteditable]')) return;
        const box = root.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight) return; // only while the demo is on screen
        event.preventDefault();
        send({ type: 'home' });
    });

    // ---- Presets and tempo ------------------------------------------------------------------------
    const presetName = $('.kd-preset-name');
    const tempoInput = $('.kd-tempo input');
    const nameOf = index => (index < 0 ? 'Init' : presets[index].split('/').pop());
    // What the demo calls a preset where the factory name only makes sense in the plugin: Init is
    // the factory bank's Psy patch, and the bank's Techno 1 is the demo's only techno.
    const DISPLAY_NAME = { 'Init': 'Psy', 'Techno 1': 'Techno' };

    function choosePreset(at) {
        if (!presetOrder.length) return;
        presetAt = (at + presetOrder.length) % presetOrder.length;
        const index = presetOrder[presetAt];
        presetName.textContent = DISPLAY_NAME[nameOf(index)] ?? nameOf(index);
        setTempo(PRESET_BPM[nameOf(index)] ?? DEFAULT_BPM);
        send({ type: 'preset', index });
        const shift = ((PRESET_OCTAVE[nameOf(index)] ?? DEFAULT_OCTAVE) + 2) * 12 - lowest;
        if (shift) {
            lowest += shift;
            labelKeys();
            for (const [by, note] of held) { // a held key moves with the keyboard, like the latched note
                send({ type: 'note-on', note: note + shift, velocity: VELOCITY });
                send({ type: 'note-off', note });
                held.set(by, note + shift);
            }
            if (latched !== null) start(latched + shift);
            else showLatched();
        }
    }
    $('.kd-preset-prev').addEventListener('click', () => choosePreset(presetAt - 1));
    $('.kd-preset-next').addEventListener('click', () => choosePreset(presetAt + 1));

    function setTempo(value) {
        bpm = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(Number(value) || DEFAULT_BPM)));
        tempoInput.value = String(bpm);
        send({ type: 'transport', bpm, playing });
    }
    tempoInput.addEventListener('change', () => setTempo(tempoInput.value));

    // KerBy's value fields (slypork::InlineValueControl): drag the number up or down to change it,
    // measured from where the drag began, or click it to type. Arrows and the wheel step it by one.
    const BPM_PX_PER_STEP = 3;
    let tempoDrag = null;
    tempoInput.addEventListener('pointerdown', event => {
        if (document.activeElement === tempoInput || event.button !== 0) return; // typing: leave it be
        event.preventDefault();
        tempoInput.setPointerCapture(event.pointerId);
        tempoDrag = { y: event.clientY, x: event.clientX, bpm, moved: false };
    });
    tempoInput.addEventListener('pointermove', event => {
        if (!tempoDrag) return;
        const travel = (tempoDrag.y - event.clientY) + (event.clientX - tempoDrag.x);
        if (Math.abs(travel) > 3) tempoDrag.moved = true;
        if (tempoDrag.moved) setTempo(tempoDrag.bpm + Math.round(travel / BPM_PX_PER_STEP));
    });
    tempoInput.addEventListener('pointerup', () => {
        if (tempoDrag && !tempoDrag.moved) {
            tempoInput.focus();
            tempoInput.select();
        }
        tempoDrag = null;
    });
    tempoInput.addEventListener('pointercancel', () => { tempoDrag = null; });
    tempoInput.addEventListener('keydown', event => {
        const direction = { ArrowUp: 1, ArrowDown: -1 }[event.key];
        if (direction) { event.preventDefault(); setTempo(bpm + direction); }
        else if (event.key === 'Enter') tempoInput.blur();
    });
    tempoInput.addEventListener('wheel', event => {
        event.preventDefault();
        setTempo(bpm + (event.deltaY < 0 ? 1 : -1));
    }, { passive: false });

    // ---- Audio ------------------------------------------------------------------------------------
    // iPhones mute web audio with the ring/silent switch unless the page says it's playing music:
    // navigator.audioSession where there is one (iOS 17+), and otherwise a silent looping <audio>
    // started by the same tap, which moves the page onto the media session.
    let unlocked = false;
    function unlockAudio() {
        prepare();
        context.resume(); // inside the tap, every time: a phone call or another tab can suspend it
        if (unlocked) return;
        unlocked = true;
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
        else if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform))) {
            const silence = new Audio(root.dataset.silence);
            silence.loop = true;
            silence.play().catch(() => {});
        }
    }

    /** Creates the context and loads the engine, once. Suspended until a tap resumes it. */
    function prepare() {
        if (loading) return loading;
        context = new AudioContext({ latencyHint: 'interactive' });
        say('Loading KerBy…');
        loading = (async () => {
            const [bytes] = await Promise.all([
                fetch(root.dataset.wasm).then(r => {
                    if (!r.ok) throw new Error(`kerby.wasm: HTTP ${r.status}`);
                    return r.arrayBuffer();
                }),
                context.audioWorklet.addModule(root.dataset.worklet),
            ]);
            node = new AudioWorkletNode(context, 'kerby', {
                numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { wasm: bytes },
            });
            await new Promise((resolve, reject) => {
                node.port.onmessage = ({ data }) => {
                    if (data.type === 'ready') {
                        presets = data.presets;
                        presetOrder = [-1, ...presets.keys()]; // Init first, as KerBy opens
                        applyState(data, true);
                        resolve();
                    } else if (data.type === 'error') reject(new Error(data.message));
                };
            });
            node.port.onmessage = ({ data }) => {
                if (data.type === 'scope') {
                    for (const s of scopes) s.points = data[s.voice];
                    redrawScopes();
                } else if (data.type === 'state') applyState(data, data.preset);
            };
            node.connect(context.destination);
            root.classList.add('kd-ready');
            say('');
            choosePreset(0);
            return true;
        })().catch(error => {
            console.error(error);
            root.classList.add('kd-unsupported');
            say('The demo couldn’t start in this browser. Try a recent Chrome, Safari, Firefox or Edge.');
            return false;
        });
        return loading;
    }

    const audioReady = () => prepare();

    function applyState({ values, slots }, newHomes) {
        for (const k of knobs) {
            if (k.rate) k.slots = slots[k.voice];
            if (newHomes && k.rate) k.home = values[k.id];
            k.show(values[k.id]);
        }
    }

    // Load as the demo nears the screen, so Play starts straight away.
    new IntersectionObserver((entries, observer) => {
        if (entries.some(e => e.isIntersecting)) {
            observer.disconnect();
            prepare();
        }
    }, { rootMargin: '400px' }).observe(root);

    knobs.forEach(k => k.draw());
    scopes.forEach(s => s.draw());
    showPlaying();
}
