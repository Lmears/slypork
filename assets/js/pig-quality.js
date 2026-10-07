// Respond to sustained frame pressure, including work elsewhere on the page.
// Full fidelity is always the starting point; no device/UA guesses or FPS cap.
export const PIG_QUALITY = [
    { pixelRatio: 2, model: 'full' },
    { pixelRatio: 1.5, model: 'full' },
    { pixelRatio: 1.25, model: 'medium' },
    { pixelRatio: 1, model: 'low' },
    { pixelRatio: 0.75, model: 'low' },
];

export class PigQuality {
    level = 0;
    lastTime = 0;
    warmup = 1200;
    duration = 0;
    frames = 0;
    healthy = 0;
    recoveryDelay = 8000;
    probing = false;

    reset() {
        this.lastTime = 0;
        this.warmup = 1200;
        this.duration = this.frames = this.healthy = 0;
    }

    sample(time) {
        if (!this.lastTime) { this.lastTime = time; return false; }
        const delta = time - this.lastTime;
        this.lastTime = time;
        // Loading, tab suspension and debugger pauses aren't sustained pressure.
        if (delta <= 0 || delta > 250) { this.reset(); return false; }
        if (this.warmup > 0) { this.warmup -= delta; return false; }
        this.duration += delta;
        this.frames++;
        if (this.duration < 1200) return false;
        const average = this.duration / this.frames;
        const duration = this.duration;
        this.duration = this.frames = 0;
        if (average > 21 && this.level < PIG_QUALITY.length - 1) {
            this.level++;
            if (this.probing) this.recoveryDelay = Math.min(60000, this.recoveryDelay * 2);
            this.probing = false;
            this.reset();
            return true;
        }
        this.healthy = average < 18 ? this.healthy + duration : 0;
        if (this.level > 0 && this.healthy >= this.recoveryDelay) {
            this.level--;
            this.probing = true;
            this.reset();
            return true;
        }
        return false;
    }
}
