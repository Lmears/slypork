import { Boid } from './boid.js';
import { Vector, vectorPool } from './vector.js';
import {
    FLOCK_DENSITY,
    MIN_BOIDS,
    MAX_BOIDS_PER_1000PX_WIDTH,
    MITOSIS_BOOST_STRENGTH,
    MAX_FLOCK_SIZE_HARD_CAP,
    BOID_DYING_DURATION,
} from './config.js';

export class Flock {
    constructor(simParams, canvas, spatialGrid) {
        this.boids = [];
        this.simParams = simParams;
        this.canvas = canvas;
        this.spatialGrid = spatialGrid;
    }

    // Provide iterable access to the boids array
    [Symbol.iterator]() {
        return this.boids[Symbol.iterator]();
    }

    get length() {
        return this.boids.length;
    }

    push(boid) {
        this.boids.push(boid);
    }

    pop() {
        return this.boids.pop();
    }

    find(predicate) {
        return this.boids.find(predicate);
    }

    forEach(callback) {
        this.boids.forEach(callback);
    }

    /**
     * Finds a boid within a "clump" by sampling the flock and checking neighbor density.
     * Used for both adding (as a parent) and removing boids.
     * @private
     * @returns {Boid | null} The chosen boid, or null if the flock is empty.
     */
    _findBoidInClump() {
        if (this.boids.length === 0) return null;

        let bestBoid = null;
        let maxNeighbors = -1;
        const sampleSize = Math.min(this.boids.length, 15);
        const radius = this.simParams.COHESION_RADIUS;
        const radiusSq = radius * radius;

        const halfWidth = this.canvas.width / 2;
        const halfHeight = this.canvas.height / 2;

        for (let i = 0; i < sampleSize; i++) {
            const candidate = this.boids[Math.floor(Math.random() * this.boids.length)];
            const potentialNeighbors = this.spatialGrid.getItemsInNeighborhood(candidate.position);
            let neighborCount = 0;
            for (const other of potentialNeighbors) {
                if (other === candidate) continue;

                let dx = candidate.position.x - other.position.x;
                let dy = candidate.position.y - other.position.y;

                if (Math.abs(dx) > halfWidth) dx = this.canvas.width - Math.abs(dx);
                if (Math.abs(dy) > halfHeight) dy = this.canvas.height - Math.abs(dy);

                const distSq = dx * dx + dy * dy;

                if (distSq < radiusSq) {
                    neighborCount++;
                }
            }
            if (neighborCount > maxNeighbors) {
                maxNeighbors = neighborCount;
                bestBoid = candidate;
            }
        }

        return bestBoid || this.boids[Math.floor(Math.random() * this.boids.length)];
    }

    /**
     * Adds one new boid to the flock using "mitosis" from a clumped parent.
     * @private
     */
    _addBoid() {
        const parentBoid = this._findBoidInClump();
        const newBoid = new Boid(parentBoid);

        if (parentBoid) {
            const splitForce = vectorPool.get(parentBoid.velocity.y, -parentBoid.velocity.x);
            const randomJitter = Vector.random2D(vectorPool.get(0, 0)).mult(0.25);

            splitForce.normalize().mult(MITOSIS_BOOST_STRENGTH);
            splitForce.add(randomJitter);

            newBoid.boost.add(splitForce);
            parentBoid.boost.sub(splitForce);

            vectorPool.release(splitForce);
            vectorPool.release(randomJitter);
        }

        this.boids.push(newBoid);
    }

    /**
     * Marks a boid for removal, starting a fade-out animation.
     * @private
     */
    _removeBoid() {
        if (this.boids.length === 0) return;

        for (let i = 0; i < 10; i++) {
            const candidate = this._findBoidInClump();
            if (candidate && !candidate.isDying) {
                candidate.startDying();
                return;
            }
        }

        const fallbackBoid = this.boids.find(b => !b.isDying);
        if (fallbackBoid) {
            fallbackBoid.startDying();
        }
    }

    /**
     * Compares current flock size to the target and adds/removes boids.
     */
    adjustToTargetSize() {
        const targetSize = Math.floor(this.simParams.FLOCK_SIZE);
        const MAX_CHANGES_PER_FRAME = 50;

        let livingBoidsCount = 0;
        for (const boid of this.boids) {
            if (!boid.isDying) {
                livingBoidsCount++;
            }
        }

        const difference = targetSize - livingBoidsCount;

        if (difference > 0) {
            const boidsToAdd = Math.min(difference, MAX_FLOCK_SIZE_HARD_CAP - this.boids.length, MAX_CHANGES_PER_FRAME);
            for (let i = 0; i < boidsToAdd; i++) {
                this._addBoid();
            }
        } else if (difference < 0) {
            const boidsToRemove = Math.min(Math.abs(difference), MAX_CHANGES_PER_FRAME);
            for (let i = 0; i < boidsToRemove; i++) {
                this._removeBoid();
            }
        }
    }

    /**
     * Calculates the desired flock size based on canvas area and density settings.
     * @param {function} updateMenuValues - Function to update the UI menu.
     */
    updateResponsiveSize(updateMenuValues) {
        const maxBoids = (this.canvas.width / 1000) * MAX_BOIDS_PER_1000PX_WIDTH;
        let targetSize = this.canvas.width * this.canvas.height * FLOCK_DENSITY;
        targetSize = Math.max(MIN_BOIDS, targetSize);
        targetSize = Math.min(maxBoids, targetSize);
        this.simParams.FLOCK_SIZE = Math.floor(targetSize);
        updateMenuValues(this.simParams);
    }

    cleanup(currentTime) {
        for (let i = this.boids.length - 1; i >= 0; i--) {
            const boid = this.boids[i];
            if (boid.isDying && (currentTime - boid.dyingStartTime > BOID_DYING_DURATION)) {
                boid.destroy();
                this.boids[i] = this.boids[this.boids.length - 1];
                this.boids.pop();
            }
        }
    }

    clear() {
        for (const boid of this.boids) {
            boid.destroy();
        }
        this.boids.length = 0;
    }

    /**
     * Initializes the flock by clearing existing boids and creating new ones.
     * If responsive sizing is enabled, calculates size based on canvas dimensions first.
     * @param {boolean} useResponsiveSize - Whether to calculate size based on canvas dimensions
     */
    initialize(useResponsiveSize = false) {
        this.clear();

        if (useResponsiveSize) {
            const maxBoids = (this.canvas.width / 1000) * MAX_BOIDS_PER_1000PX_WIDTH;
            let targetSize = this.canvas.width * this.canvas.height * FLOCK_DENSITY;
            targetSize = Math.max(MIN_BOIDS, targetSize);
            targetSize = Math.min(maxBoids, targetSize);
            this.simParams.FLOCK_SIZE = Math.floor(targetSize);
        }

        for (let i = 0; i < this.simParams.FLOCK_SIZE; i++) {
            this.push(new Boid());
        }
    }
}
