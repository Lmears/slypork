// Respond to sustained frame pressure, including work elsewhere on the page.
// Level 0 is full quality; each level up does less work.
const WARMUP = 1200;
const WINDOW = 1200;

export class FrameQuality {
    lastTime = 0;
    warmup = WARMUP;
    duration = 0;
    frames = 0;
    healthy = 0;
    recoveryDelay = 8000;
    probing = false;
    changedAt = -Infinity;
    // Set by the owner while it is drawing. Only an active controller has load
    // to shed, or a recovery to wait for.
    active = false;
    ahead = null;
    behind = null;

    constructor(levels, level = 0) {
        this.levels = levels;
        this.level = this.start = level;
    }

    // `other` sheds load before this one does, and recovers after it.
    shedsAfter(other) {
        this.ahead = other;
        other.behind = this;
    }

    // Its last change is still being measured.
    isSettling(time) {
        return time - this.changedAt < WARMUP + WINDOW;
    }

    canShed(time) {
        return this.active && (this.level < this.levels - 1 || this.isSettling(time));
    }

    isRecovering(time) {
        return this.active && (this.level > this.start || this.isSettling(time));
    }

    reset() {
        this.lastTime = 0;
        this.warmup = WARMUP;
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
        if (this.duration < WINDOW) return false;
        const average = this.duration / this.frames;
        const duration = this.duration;
        this.duration = this.frames = 0;
        if (average > 21 && this.level < this.levels - 1) {
            if (this.ahead?.canShed(time)) { this.reset(); return false; }
            this.level++;
            if (this.probing) this.recoveryDelay = Math.min(60000, this.recoveryDelay * 2);
            this.probing = false;
            return this.change(time);
        }
        this.healthy = average < 18 ? this.healthy + duration : 0;
        if (this.level > 0 && this.healthy >= this.recoveryDelay && !this.behind?.isRecovering(time)) {
            this.level--;
            this.probing = true;
            return this.change(time);
        }
        return false;
    }

    change(time) {
        this.changedAt = time;
        this.reset();
        return true;
    }
}
