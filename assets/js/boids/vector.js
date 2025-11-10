// vector.js - Vector mathematics and object pooling for boid simulation

import { VECTOR_POOL_INITIAL_SIZE, VECTOR_POOL_MAX_SIZE } from './config.js';

export class VectorPool {
    constructor(initialSize, maxSize) {
        this.pool = [];
        this.maxSize = maxSize;
        // For debugging/tuning:
        this._totalCreated = 0;
        this._totalReleased = 0;
        this._totalRetrieved = 0;
        this._maxInUseSimultaneously = 0;
        this._currentlyInUse = 0;

        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new Vector(0, 0)); // Pre-populate with actual Vector instances
            this._totalCreated++;
        }
    }

    get(x = 0, y = 0) {
        this._totalRetrieved++;
        this._currentlyInUse++;
        if (this._currentlyInUse > this._maxInUseSimultaneously) {
            this._maxInUseSimultaneously = this._currentlyInUse;
        }

        let v;
        if (this.pool.length > 0) {
            v = this.pool.pop();
            v.x = x;
            v.y = y;
        } else {
            v = new Vector(x, y); // Create new if pool is empty
            this._totalCreated++;
            console.warn("VectorPool had to create a new Vector. Pool empty.");
        }
        return v;
    }

    release(v) {
        if (v instanceof Vector) {
            this._totalReleased++;
            this._currentlyInUse--;
            if (this.pool.length < this.maxSize) {
                this.pool.push(v);
            } else {
                // Optional: console.warn("VectorPool is full. Discarding released vector.");
                // Vector is not added back, will be GC'd.
            }
        } else {
            // console.warn("VectorPool: Attempted to release non-Vector object or null/undefined:", v);
        }
    }

    // Utility to get stats (for debugging/tuning)
    getStats() {
        return {
            poolSize: this.pool.length,
            maxSize: this.maxSize,
            totalCreated: this._totalCreated,
            totalRetrieved: this._totalRetrieved,
            totalReleased: this._totalReleased,
            currentlyInUse: this._currentlyInUse,
            maxInUseSimultaneously: this._maxInUseSimultaneously,
        };
    }
}

export class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(n) { this.x *= n; this.y *= n; return this; }
    div(n) { if (n === 0) { this.x = 0; this.y = 0; } else { this.x /= n; this.y /= n; } return this; }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    magSq() { return this.x * this.x + this.y * this.y; }
    setMag(n) { this.normalize(); this.mult(n); return this; }
    normalize() { const m = this.mag(); if (m !== 0) this.div(m); return this; }
    limit(max) { const mSq = this.magSq(); if (mSq > max * max && mSq > 0) { this.div(Math.sqrt(mSq)); this.mult(max); } return this; }

    copy() {
        return vectorPool.get(this.x, this.y);
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    static dist(v1, v2) { return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2); }

    static sub(v1, v2, out_vector) {
        const target = out_vector || vectorPool.get(0, 0);
        target.x = v1.x - v2.x;
        target.y = v1.y - v2.y;
        return target;
    }

    static random2D(out_vector) {
        const target = out_vector || vectorPool.get(0, 0);
        target.x = Math.random() * 2 - 1;
        target.y = Math.random() * 2 - 1;
        return target;
    }
}

// Initialize the global vectorPool instance AFTER Vector and VectorPool classes are defined.
export const vectorPool = new VectorPool(VECTOR_POOL_INITIAL_SIZE, VECTOR_POOL_MAX_SIZE);

// Global helper function for debugging vector pool stats
window.logPoolStats = () => console.table(vectorPool.getStats());
