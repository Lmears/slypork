import { initializeMenu, setMenuVisibility, updateMenuValues } from './boid-menu.js';

// Canvas and DOM elements
const canvas = document.getElementById('boidCanvas');
const ctx = canvas.getContext('2d');
const speedSlider = document.getElementById('speedSlider');
const speedControls = document.getElementById('controls');
const speedValue = document.getElementById('speedValue');
const godModeButton = document.getElementById('godModeButton');

// --- Tweakable Simulation Parameters (via experimental menu) ---
let simParams = {
    ALIGNMENT_FORCE: 1.2,
    COHESION_FORCE: 0.7,
    SEPARATION_FORCE: 1.3,
    ALIGNMENT_RADIUS: 50,
    SEPARATION_RADIUS: 50,
    COHESION_RADIUS: 150,
    VELOCITY_INERTIA: 0.45,
    ROTATION_INERTIA: 0.3,
};

const defaultSimParams = { ...simParams }; // Store initial values for reset

const OBSTACLE_PADDING = 0;
const OBSTACLE_VISION_RADIUS = 256;
const OBSTACLE_STEER_FORCE_MULTIPLIER = 0.3;
const OBSTACLE_BOUNCE_FORCE_MULTIPLIER = 3.5;
const OBSTACLE_DEBUG_COLOR = 'rgba(255, 0, 0, 0.7)';
const OBSTACLE_DEBUG_FILL_COLOR = 'rgba(255, 0, 0, 0.1)';

const OBSTACLE_ELEMENT_IDS = [
    // 'aboutLink',
    // 'masteringLink',
    // 'musicLink',
    // 'designLink',
    // 'softwareLink',
    // 'contactLink',
    'navLinks',
    'footer',
    // 'easterEgg',
    'hamburger-menu',
    // 'aboutImage',
    // 'masteringImage',
    // 'pageTitle',
    'homeLink',
    'downloadPdfBtn',
    'keith-logo',
    'dj-pretence-logo',
    'root-basis-logo',
    // 'keith-player',
    // 'dj-pretence-player',
    // 'root-basis-player',
    // 'pageContent'
];

let allObstacles = [];

// --- Other Simulation parameters (mostly non-tweakable via new menu) ---
const FLOCK_SIZE = 150;
const NORMAL_MAX_SPEED = 5;
const SCATTER_MAX_SPEED = 15;
const INITIAL_BOOST = 10;
const BOOST_DECAY = 0.95;

// Mouse interaction
const MOUSE_INFLUENCE_RADIUS = 200;
const CLICK_SCATTER_DURATION = 22;
const HOLD_SCATTER_DURATION = 45;
const COOLDOWN_DURATION = 30;

// Boid behavior forces (related to mouse, not part of tweakable menu)
const MOUSE_FORCE_NORMAL = 3.0;
const MOUSE_FORCE_SCATTER = 2.5;

// Boid behavior radii (DEPTH_INFLUENCE_RADIUS is used for CELL_SIZE but not in tweakable menu)
const DEPTH_INFLUENCE_RADIUS = 50;

// Additional Boid-specific constants
const BOID_MAX_FORCE = 0.175;
const BOID_SIZE_BASE = 20;
const BOID_SIZE_VARIATION = 10;
const BOID_OSCILLATION_SPEED_BASE = 0.002;
const BOID_OSCILLATION_SPEED_VARIATION = 0.002;
const BOID_ROTATION_SPEED = 0.1;

// Easter egg parameters
const EASTER_EGG_WIDTH = 45;
const EASTER_EGG_HEIGHT = 40;
const EASTER_EGG_RIGHT = 25;
const EASTER_EGG_BOTTOM = 21;
const SPREAD_FACTOR = 0.1;

// Animation
const END_ANIMATION_DURATION = 1000;

// Edge buffering for wraparound effect
const EDGE_BUFFER_POSITIONS = [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
];

// --- Spatial Partitioning Settings ---
let CELL_SIZE; // Dynamically calculated based on simParams radii

// Helper function to calculate CELL_SIZE
function calculateCurrentCellSize() {
    return Math.max(simParams.ALIGNMENT_RADIUS, simParams.SEPARATION_RADIUS, simParams.COHESION_RADIUS, DEPTH_INFLUENCE_RADIUS);
}

// Function to update spatial grid parameters if radii change
function updateSpatialGridParameters() {
    const newCellSize = calculateCurrentCellSize();
    CELL_SIZE = newCellSize;

    if (spatialGrid) {
        spatialGrid.cellSize = CELL_SIZE;
        spatialGrid.resize(canvas.width, canvas.height);
    }
}

// Global variables
let speedMultiplier = 1;
let isScattering = false;
let mouseInfluence = false;
let animationFrameId = null;
let isEnding = false;
let endStartTime = 0;
let spatialGrid;
let obstacleGrid;
let godMode = false;
let debugObstaclesMode = false;
let debugGridMode = false;
let debugSelectedBoid = null;
let boidsIgnoreMouse = false;
let boidsIgnoreTouch = false;
let touchEndTimeoutId = null;
let offscreenCanvas;
let offscreenCtx;


const logoImg = new Image();
logoImg.src = '../assets/images/favicon-96x96.png';



// --- Vector Pool (NEW CODE) ---
const VECTOR_POOL_INITIAL_SIZE = FLOCK_SIZE * 20; // Initial pool size, e.g., 150 boids * 20 vectors/boid estimate
const VECTOR_POOL_MAX_SIZE = FLOCK_SIZE * 30;   // Max size to prevent unbounded pool growth if there's a leak

class VectorPool {
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
            // Optional: console.warn("VectorPool had to create a new Vector. Pool empty.");
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

class Vector {
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
        // return new Vector(this.x, this.y); // OLD
        return vectorPool.get(this.x, this.y); // NEW
    }

    set(x, y) { // Helper to set values
        this.x = x;
        this.y = y;
        return this;
    }

    static dist(v1, v2) { return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2); }

    static sub(v1, v2, out_vector) {
        // if (!out_vector) return new Vector(v1.x - v2.x, v1.y - v2.y); // OLD if out_vector was optional
        // NEW: always use out_vector or get from pool
        const target = out_vector || vectorPool.get();
        target.x = v1.x - v2.x;
        target.y = v1.y - v2.y;
        return target;
    }

    static random2D(out_vector) {
        // NEW: always use out_vector or get from pool
        const target = out_vector || vectorPool.get();
        target.x = Math.random() * 2 - 1;
        target.y = Math.random() * 2 - 1;
        // It's common for random2D to return a unit vector or allow chaining setMag
        // For now, just random components. If normalization is implied, add target.normalize();
        return target;
    }
}

// Now define the global vectorPool instance AFTER Vector and VectorPool classes are defined.
const vectorPool = new VectorPool(VECTOR_POOL_INITIAL_SIZE, VECTOR_POOL_MAX_SIZE);

let mouse = vectorPool.get(0, 0);

class Obstacle {
    constructor(elementIdOrElement) {
        this.element = typeof elementIdOrElement === 'string'
            ? document.getElementById(elementIdOrElement)
            : elementIdOrElement;

        this.bounds = null;
        this.paddedBounds = null;
        this.isEnabled = false;
        this.centerX = 0;
        this.centerY = 0;
        this.update(); // Initial update
    }

    update() {
        if (this.element instanceof HTMLElement && typeof this.element.getBoundingClientRect === 'function') {
            const rect = this.element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(this.element);

            if (rect.width > 0 && rect.height > 0 &&
                computedStyle.display !== 'none' &&
                computedStyle.visibility !== 'hidden' &&
                this.element.offsetParent !== null) {

                this.bounds = rect;
                const canvasRect = canvas.getBoundingClientRect();

                this.paddedBounds = {
                    left: rect.left - canvasRect.left - OBSTACLE_PADDING, // Use global
                    top: rect.top - canvasRect.top - OBSTACLE_PADDING,    // Use global
                    right: rect.right - canvasRect.left + OBSTACLE_PADDING, // Use global
                    bottom: rect.bottom - canvasRect.top + OBSTACLE_PADDING, // Use global
                };
                this.paddedBounds.width = this.paddedBounds.right - this.paddedBounds.left;
                this.paddedBounds.height = this.paddedBounds.bottom - this.paddedBounds.top;

                this.centerX = this.paddedBounds.left + this.paddedBounds.width / 2;
                this.centerY = this.paddedBounds.top + this.paddedBounds.height / 2;
                this.isEnabled = true;
            } else {
                this.isEnabled = false;
                this.bounds = null;
                this.paddedBounds = null;
            }
        } else {
            this.isEnabled = false;
            this.bounds = null;
            this.paddedBounds = null;
        }
    }

    drawDebug() {
        if (!this.isEnabled || !this.paddedBounds) return;

        ctx.save();
        ctx.strokeStyle = OBSTACLE_DEBUG_COLOR; // Use global
        ctx.fillStyle = OBSTACLE_DEBUG_FILL_COLOR; // Use global
        ctx.lineWidth = 2;

        const pb = this.paddedBounds;
        ctx.fillRect(pb.left, pb.top, pb.width, pb.height);
        ctx.strokeRect(pb.left, pb.top, pb.width, pb.height);

        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 5, 0, Math.PI * 2);
        // Fill with the same color as the stroke for simplicity, or use a dedicated fill for center point
        ctx.fillStyle = OBSTACLE_DEBUG_COLOR;
        ctx.fill();
        ctx.restore();
    }
}

class SpatialGrid {
    constructor(canvasWidth, canvasHeight, cellSize) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.cellSize = cellSize;
        this.resize(canvasWidth, canvasHeight);
    }

    _initializeGrid() {
        this.grid = [];
        this.numRows = Math.max(1, Math.ceil(this.canvasHeight / this.cellSize));
        this.numCols = Math.max(1, Math.ceil(this.canvasWidth / this.cellSize));
        for (let i = 0; i < this.numRows; i++) {
            this.grid[i] = [];
            for (let j = 0; j < this.numCols; j++) {
                this.grid[i][j] = [];
            }
        }
    }

    resize(newWidth, newHeight) {
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        this._initializeGrid();
    }

    clear() {
        for (let i = 0; i < this.numRows; i++) {
            for (let j = 0; j < this.numCols; j++) {
                this.grid[i][j].length = 0;
            }
        }
    }

    _getCellCoords(position) {
        const col = Math.floor(position.x / this.cellSize);
        const row = Math.floor(position.y / this.cellSize);
        return { col, row };
    }

    // --- GENERIC ADD METHODS ---

    /**
     * Adds an object with a .position property (like a Boid) to a single cell.
     * @param {object} item - The item to add, must have a .position {x, y} property.
     */
    addItemAtPoint(item) {
        const { col, row } = this._getCellCoords(item.position);
        if (row >= 0 && row < this.numRows && col >= 0 && col < this.numCols) {
            this.grid[row][col].push(item);
        }
    }

    /**
     * Adds an object to all grid cells it overlaps.
     * @param {object} item - The item to add.
     * @param {object} bounds - An object with { left, top, right, bottom } properties.
     */
    addItemInArea(item, bounds) {
        const startCol = Math.floor(bounds.left / this.cellSize);
        const endCol = Math.floor(bounds.right / this.cellSize);
        const startRow = Math.floor(bounds.top / this.cellSize);
        const endRow = Math.floor(bounds.bottom / this.cellSize);

        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                if (row >= 0 && row < this.numRows && col >= 0 && col < this.numCols) {
                    this.grid[row][col].push(item);
                }
            }
        }
    }

    // --- GENERIC QUERY METHOD ---

    /**
     * Retrieves all items from the 3x3 neighborhood of cells around a position.
     * Returns an array of items (with duplicates if an item is in multiple cells).
     * @param {object} position - The center point of the query, { x, y }.
     */
    getItemsInNeighborhood(position) {
        const items = [];
        const { col: centerCol, row: centerRow } = this._getCellCoords(position);

        for (let rOffset = -1; rOffset <= 1; rOffset++) {
            for (let cOffset = -1; cOffset <= 1; cOffset++) {
                // Toroidal wrapping for seamless edges
                const neighborRow = (centerRow + rOffset + this.numRows) % this.numRows;
                const neighborCol = (centerCol + cOffset + this.numCols) % this.numCols;

                if (this.grid[neighborRow] && this.grid[neighborRow][neighborCol]) {
                    // This creates a shallow copy, which is fine.
                    // For performance, could also loop and push items one by one.
                    items.push(...this.grid[neighborRow][neighborCol]);
                }
            }
        }
        return items;
    }
}


class Boid {
    constructor() {
        const easterEggCenterX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
        const easterEggCenterY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;

        this.position = vectorPool.get(
            easterEggCenterX + (Math.random() - 0.5) * EASTER_EGG_WIDTH * SPREAD_FACTOR,
            easterEggCenterY + (Math.random() - 0.5) * EASTER_EGG_HEIGHT * SPREAD_FACTOR
        );

        this.velocity = Vector.random2D(vectorPool.get());
        this.velocity.setMag(Math.random() * 2 + 2);
        this.desiredVelocity = vectorPool.get(0, 0);
        this.boost = vectorPool.get(-INITIAL_BOOST, -INITIAL_BOOST);
        this.maxForce = BOID_MAX_FORCE;
        this.maxSpeed = NORMAL_MAX_SPEED;

        this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
        this.rotationSpeed = BOID_ROTATION_SPEED;

        this.depth = Math.random();
        this.size = BOID_SIZE_BASE + this.depth * BOID_SIZE_VARIATION;
        this.renderSize = this.calculateRenderSize(performance.now());
        this.oscillationOffset = Math.random() * Math.PI * 2;
        this.oscillationSpeed = BOID_OSCILLATION_SPEED_BASE + Math.random() * BOID_OSCILLATION_SPEED_VARIATION;

        this.scatterState = 0;
        this.cooldownTimer = 0;
    }

    edges() {
        if (this.position.x > canvas.width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = canvas.height;
    }

    // Toroidal based methods
    alignment(localNeighbors) {
        const steeringForce = vectorPool.get(); // Final returned force, released by flock()
        const avgVelocity = vectorPool.get();   // Temporary accumulator
        let total = 0;
        const halfWidth = canvas.width / 2;
        const halfHeight = canvas.height / 2;
        const alignmentRadiusSq = simParams.ALIGNMENT_RADIUS * simParams.ALIGNMENT_RADIUS;

        for (let other of localNeighbors) {
            if (other === this) continue;
            let tdx = this.position.x - other.position.x;
            let tdy = this.position.y - other.position.y;
            if (Math.abs(tdx) > halfWidth) tdx -= Math.sign(tdx) * canvas.width;
            if (Math.abs(tdy) > halfHeight) tdy -= Math.sign(tdy) * canvas.height;
            const dSq = tdx * tdx + tdy * tdy;

            if (dSq > 0 && dSq < alignmentRadiusSq) {
                avgVelocity.add(other.velocity);
                total++;
            }
        }

        if (total > 0) {
            avgVelocity.div(total);
            avgVelocity.setMag(this.maxSpeed); // This is the desired velocity
            Vector.sub(avgVelocity, this.velocity, steeringForce); // steeringForce = desired - current
            steeringForce.limit(this.maxForce);
        } else {
            steeringForce.set(0, 0); // Ensure it's zero if no neighbors
        }
        vectorPool.release(avgVelocity); // Release temporary accumulator
        return steeringForce;
    }

    separation(localNeighbors) {
        const steeringForce = vectorPool.get();
        const desiredSeparation = vectorPool.get();
        let total = 0;
        const halfWidth = canvas.width / 2;
        const halfHeight = canvas.height / 2;
        const separationRadiusSq = simParams.SEPARATION_RADIUS * simParams.SEPARATION_RADIUS;
        const tempDiff = vectorPool.get();

        for (let other of localNeighbors) {
            if (other === this) continue;

            let tdx = this.position.x - other.position.x;
            let tdy = this.position.y - other.position.y;

            // Toroidal wrapping
            if (Math.abs(tdx) > halfWidth) tdx -= Math.sign(tdx) * canvas.width;
            if (Math.abs(tdy) > halfHeight) tdy -= Math.sign(tdy) * canvas.height;

            let dSq = tdx * tdx + tdy * tdy;

            if (dSq === 0) { // If exactly on top, give a slight random push
                Vector.random2D(tempDiff).normalize(); // Get a random direction
                desiredSeparation.add(tempDiff);
                total++;
                // Optionally skip to next neighbor if dSq is 0 to avoid division by zero for 'd'
                // continue; // If you add this, ensure it doesn't break other logic
            } else if (dSq < separationRadiusSq) { // Original condition (dSq > 0 is implicit if dSq !== 0)
                const d = Math.sqrt(dSq);
                tempDiff.set(tdx, tdy);
                tempDiff.setMag(1 / d); // Inverse square like force (1/d is also common)
                desiredSeparation.add(tempDiff);
                total++;
            }
        }
        vectorPool.release(tempDiff);

        if (total > 0) {
            desiredSeparation.div(total);
            if (desiredSeparation.magSq() === 0 && total > 0) {
                // If average is zero (e.g. symmetrical forces canceling out)
                // but there were neighbors, give a tiny random preference if desired.
                // Or just let it be zero. For now, let setMag handle it.
            }
            desiredSeparation.setMag(this.maxSpeed);
            Vector.sub(desiredSeparation, this.velocity, steeringForce);
            steeringForce.limit(this.maxForce);
        } else {
            steeringForce.set(0, 0);
        }
        vectorPool.release(desiredSeparation);
        return steeringForce;
    }

    cohesion(localNeighbors) {
        const steeringForce = vectorPool.get();     // Final, released by flock()
        const averagePosition = vectorPool.get();   // Sum of neighbor positions
        let total = 0;
        const halfWidth = canvas.width / 2;
        const halfHeight = canvas.height / 2;
        const cohesionRadiusSq = simParams.COHESION_RADIUS * simParams.COHESION_RADIUS;

        // Step 1: Calculate average position of neighbors
        for (let other of localNeighbors) {
            if (other === this) continue;
            let tdx = other.position.x - this.position.x;
            let tdy = other.position.y - this.position.y;

            // Handle toroidal wrapping
            if (Math.abs(tdx) > halfWidth) tdx -= Math.sign(tdx) * canvas.width;
            if (Math.abs(tdy) > halfHeight) tdy -= Math.sign(tdy) * canvas.height;
            const dSq = tdx * tdx + tdy * tdy;

            if (dSq > 0 && dSq < cohesionRadiusSq) {
                // Add the neighbor's actual position (accounting for wrapping)
                let neighborX = other.position.x;
                let neighborY = other.position.y;

                // Adjust neighbor position for wrapping to get correct average
                if (Math.abs(other.position.x - this.position.x) > halfWidth) {
                    neighborX = this.position.x + tdx;
                }
                if (Math.abs(other.position.y - this.position.y) > halfHeight) {
                    neighborY = this.position.y + tdy;
                }

                averagePosition.x += neighborX;
                averagePosition.y += neighborY;
                total++;
            }
        }

        if (total > 0) {
            // Step 2: Get the average position
            averagePosition.div(total);

            // Step 3: Calculate desired velocity (towards average position)
            const desiredVelocity = vectorPool.get();
            Vector.sub(averagePosition, this.position, desiredVelocity);
            desiredVelocity.setMag(this.maxSpeed);

            // Step 4: Calculate steering force
            Vector.sub(desiredVelocity, this.velocity, steeringForce);
            steeringForce.limit(this.maxForce);

            vectorPool.release(desiredVelocity);
        } else {
            steeringForce.set(0, 0);
        }

        vectorPool.release(averagePosition);
        return steeringForce;
    }

    mouseAttraction() {
        // if (!mouseInfluence || boidsIgnoreMouse) return new Vector(0, 0); // OLD
        if (!mouseInfluence || boidsIgnoreMouse) return vectorPool.get(0, 0); // NEW - temporary, released by flock()

        // let directionToMouse = Vector.sub(mouse, this.position); // OLD
        const directionToMouse = Vector.sub(mouse, this.position, vectorPool.get()); // NEW - temporary
        let distance = directionToMouse.mag();
        let steer = null; // Will hold the final steering vector for this function

        if (distance > 0 && distance < MOUSE_INFLUENCE_RADIUS) {
            if (this.scatterState === 1) {
                // let desiredRepulsionVelocity = new Vector(directionToMouse.x, directionToMouse.y); // OLD
                const desiredRepulsionVelocity = vectorPool.get(directionToMouse.x, directionToMouse.y); // NEW - temporary
                desiredRepulsionVelocity.setMag(this.maxSpeed).mult(-1);
                // steer = Vector.sub(desiredRepulsionVelocity, this.velocity); // OLD
                steer = Vector.sub(desiredRepulsionVelocity, this.velocity, vectorPool.get()); // NEW - temporary
                steer.limit(this.maxForce * 3);
                vectorPool.release(desiredRepulsionVelocity);
            } else {
                let strength = 1.0 - (distance / MOUSE_INFLUENCE_RADIUS);
                // let desiredAttractionVelocity = new Vector(directionToMouse.x, directionToMouse.y); // OLD
                const desiredAttractionVelocity = vectorPool.get(directionToMouse.x, directionToMouse.y); // NEW - temporary
                desiredAttractionVelocity.setMag(this.maxSpeed);
                // steer = Vector.sub(desiredAttractionVelocity, this.velocity); // OLD
                steer = Vector.sub(desiredAttractionVelocity, this.velocity, vectorPool.get()); // NEW - temporary
                steer.mult(strength).limit(this.maxForce);
                vectorPool.release(desiredAttractionVelocity);
            }
        }
        vectorPool.release(directionToMouse);

        if (steer) {
            return steer; // Return the calculated steer (pooled, to be released by flock)
        } else {
            return vectorPool.get(0, 0); // Return a zero vector if no interaction (pooled, to be released by flock)
        }
    }

    avoidObstacles() {
        const totalAvoidanceForce = vectorPool.get(); // Returned, released by flock()
        const boidRadius = this.renderSize / 2;

        // Temporary vectors reused in the loops
        const effectiveObsCenter = vectorPool.get();
        const currentToroidalForce = vectorPool.get(); // Force from current toroidal image consideration
        const repulsionDirTemp = vectorPool.get();
        const boidToEffectiveCenterTemp = vectorPool.get();
        const closestPointOnEffectiveObstacleTemp = vectorPool.get();
        const boidToClosestPointTemp = vectorPool.get();
        const desiredSteerAwayTemp = vectorPool.get();

        let bestForceForObstacle = null; // To store the selected force for the current obstacle (a copy)
        let bestDistSqForObstacle = Infinity;
        let bestTypeForObstacle = null;

        const nearbyItems = obstacleGrid.getItemsInNeighborhood(this.position);

        const uniqueNearbyObstacles = new Set(nearbyItems);

        for (const obstacle of uniqueNearbyObstacles) {
            if (!obstacle.isEnabled || !obstacle.paddedBounds) continue;

            bestForceForObstacle = null;
            bestDistSqForObstacle = Infinity;
            bestTypeForObstacle = null;

            for (const offset of EDGE_BUFFER_POSITIONS) {
                const offsetX = offset.dx * canvas.width;
                const offsetY = offset.dy * canvas.height;
                const effectiveObsPadded = {
                    left: obstacle.paddedBounds.left + offsetX,
                    top: obstacle.paddedBounds.top + offsetY,
                    right: obstacle.paddedBounds.right + offsetX,
                    bottom: obstacle.paddedBounds.bottom + offsetY,
                    width: obstacle.paddedBounds.width,
                    height: obstacle.paddedBounds.height
                };
                effectiveObsCenter.set(obstacle.centerX + offsetX, obstacle.centerY + offsetY);
                currentToroidalForce.set(0, 0);
                let interactionType = null;
                let currentDistSq = Infinity; // Distance from boid to relevant point on this effective obstacle image

                // --- Bounce Logic (using effective obstacle position) ---
                const isOverlapping =
                    (this.position.x + boidRadius > effectiveObsPadded.left) &&
                    (this.position.x - boidRadius < effectiveObsPadded.right) &&
                    (this.position.y + boidRadius > effectiveObsPadded.top) &&
                    (this.position.y - boidRadius < effectiveObsPadded.bottom);

                if (isOverlapping) {
                    interactionType = 'bounce';
                    Vector.sub(this.position, effectiveObsCenter, repulsionDirTemp);
                    if (repulsionDirTemp.magSq() === 0) Vector.random2D(repulsionDirTemp);
                    repulsionDirTemp.setMag(this.maxSpeed);
                    Vector.sub(repulsionDirTemp, this.velocity, currentToroidalForce);
                    currentToroidalForce.limit(this.maxForce * OBSTACLE_BOUNCE_FORCE_MULTIPLIER);
                    Vector.sub(this.position, effectiveObsCenter, boidToEffectiveCenterTemp);
                    currentDistSq = boidToEffectiveCenterTemp.magSq();
                } else {
                    const closestX = Math.max(effectiveObsPadded.left, Math.min(this.position.x, effectiveObsPadded.right));
                    const closestY = Math.max(effectiveObsPadded.top, Math.min(this.position.y, effectiveObsPadded.bottom));
                    closestPointOnEffectiveObstacleTemp.set(closestX, closestY);
                    Vector.sub(this.position, closestPointOnEffectiveObstacleTemp, boidToClosestPointTemp);
                    currentDistSq = boidToClosestPointTemp.magSq();

                    if (currentDistSq < (OBSTACLE_VISION_RADIUS + boidRadius) ** 2) {
                        Vector.sub(this.position, closestPointOnEffectiveObstacleTemp, desiredSteerAwayTemp);
                        if (desiredSteerAwayTemp.magSq() === 0) {
                            Vector.sub(this.position, effectiveObsCenter, desiredSteerAwayTemp);
                        }
                        if (desiredSteerAwayTemp.magSq() > 0) {
                            interactionType = 'steer';
                            desiredSteerAwayTemp.setMag(this.maxSpeed);
                            Vector.sub(desiredSteerAwayTemp, this.velocity, currentToroidalForce);
                            currentToroidalForce.limit(this.maxForce * OBSTACLE_STEER_FORCE_MULTIPLIER);
                        }
                    }
                }

                // Update closestInteractionData if this interaction is more critical
                if (interactionType) {
                    // Priority: Bounce > Steer. If same type, closer one.
                    let updateBest = false;
                    if (!bestTypeForObstacle) {
                        updateBest = true;
                    } else if (interactionType === 'bounce' && bestTypeForObstacle === 'steer') {
                        updateBest = true;
                    } else if (interactionType === bestTypeForObstacle && currentDistSq < bestDistSqForObstacle) {
                        updateBest = true;
                    }

                    if (updateBest) {
                        if (bestForceForObstacle) vectorPool.release(bestForceForObstacle); // Release previous best copy
                        bestForceForObstacle = currentToroidalForce.copy(); // Copy current toroidal force
                        bestDistSqForObstacle = currentDistSq;
                        bestTypeForObstacle = interactionType;
                    }
                }
            } // End EDGE_BUFFER_POSITIONS loop

            if (bestForceForObstacle) {
                totalAvoidanceForce.add(bestForceForObstacle);
                vectorPool.release(bestForceForObstacle); // Release the copy after adding
            }
        } // End allObstacles loop

        vectorPool.release(effectiveObsCenter);
        vectorPool.release(currentToroidalForce);
        vectorPool.release(repulsionDirTemp);
        vectorPool.release(boidToEffectiveCenterTemp);
        vectorPool.release(closestPointOnEffectiveObstacleTemp);
        vectorPool.release(boidToClosestPointTemp);
        vectorPool.release(desiredSteerAwayTemp);

        return totalAvoidanceForce;
    }

    flock(localNeighbors) {
        const alignment = this.alignment(localNeighbors);
        const cohesion = this.cohesion(localNeighbors);
        const separation = this.separation(localNeighbors);
        const mouseForce = this.mouseAttraction();
        const obstacleAvoidanceForce = this.avoidObstacles();

        alignment.mult(simParams.ALIGNMENT_FORCE);
        cohesion.mult(simParams.COHESION_FORCE);
        separation.mult(simParams.SEPARATION_FORCE);
        mouseForce.mult(this.scatterState === 1 ? MOUSE_FORCE_SCATTER : MOUSE_FORCE_NORMAL);

        this.desiredVelocity.set(this.velocity.x, this.velocity.y);
        this.desiredVelocity.add(alignment);
        this.desiredVelocity.add(cohesion);
        this.desiredVelocity.add(separation);
        this.desiredVelocity.add(mouseForce);
        this.desiredVelocity.add(obstacleAvoidanceForce);
        this.desiredVelocity.limit(this.maxSpeed);

        vectorPool.release(alignment);
        vectorPool.release(cohesion);
        vectorPool.release(separation);
        vectorPool.release(mouseForce);
        vectorPool.release(obstacleAvoidanceForce);
    }

    update(localNeighbors, currentTime) {
        this.velocity.x = this.velocity.x * simParams.VELOCITY_INERTIA + this.desiredVelocity.x * (1 - simParams.VELOCITY_INERTIA);
        this.velocity.y = this.velocity.y * simParams.VELOCITY_INERTIA + this.desiredVelocity.y * (1 - simParams.VELOCITY_INERTIA);

        this.velocity.add(this.boost);
        this.boost.mult(BOOST_DECAY);
        this.position.add(this.velocity);

        this.updateScatterState();
        this.updateMaxSpeed();
        this.updateDepth(localNeighbors);
        this.updateRotation();

        this.velocity.limit(this.maxSpeed);
        this.renderSize = this.calculateRenderSize(currentTime);
    }

    updateScatterState() {
        if (this.scatterState !== 0) {
            this.cooldownTimer--;
            if (this.cooldownTimer <= 0) {
                this.scatterState = this.scatterState === 1 ? 2 : 0;
                this.cooldownTimer = this.scatterState === 2 ? COOLDOWN_DURATION : 0;
            }
        }
    }

    updateMaxSpeed() {
        if (this.scatterState === 1) {
            this.maxSpeed = SCATTER_MAX_SPEED * speedMultiplier;
        } else if (this.scatterState === 2) {
            this.maxSpeed = (NORMAL_MAX_SPEED + (SCATTER_MAX_SPEED - NORMAL_MAX_SPEED) * (this.cooldownTimer / COOLDOWN_DURATION)) * speedMultiplier;
        } else {
            this.maxSpeed = NORMAL_MAX_SPEED * speedMultiplier;
        }
        this.maxSpeed *= (0.5 + this.depth * 0.5);
    }

    updateDepth(localNeighbors) {
        const nearbyBoidsForDepth = [];
        const halfWidth = canvas.width / 2;
        const halfHeight = canvas.height / 2;
        const depthInfluenceRadiusSq = DEPTH_INFLUENCE_RADIUS * DEPTH_INFLUENCE_RADIUS;


        for (const b of localNeighbors) {
            if (b === this) continue;

            let tdx = this.position.x - b.position.x;
            let tdy = this.position.y - b.position.y;

            if (Math.abs(tdx) > halfWidth) {
                tdx = tdx - Math.sign(tdx) * canvas.width;
            }
            if (Math.abs(tdy) > halfHeight) {
                tdy = tdy - Math.sign(tdy) * canvas.height;
            }
            const dSq = tdx * tdx + tdy * tdy;

            if (dSq < depthInfluenceRadiusSq) { // Note: No dSq > 0 check needed if radius > 0
                nearbyBoidsForDepth.push(b);
            }
        }

        if (nearbyBoidsForDepth.length > 0) {
            const avgDepth = nearbyBoidsForDepth.reduce((sum, b) => sum + b.depth, 0) / nearbyBoidsForDepth.length;
            this.depth = this.depth * 0.99 + avgDepth * 0.01;
            this.depth = Math.max(0, Math.min(1, this.depth));
        }
    }

    updateRotation() {
        const targetRotation = Math.atan2(this.velocity.y, this.velocity.x);
        let rotationDiff = targetRotation - this.rotation;
        rotationDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));

        const smoothedRotationDiff = rotationDiff * (1 - simParams.ROTATION_INERTIA) * this.rotationSpeed * speedMultiplier;
        this.rotation += smoothedRotationDiff;

        this.rotation = (this.rotation + 2 * Math.PI) % (2 * Math.PI);
    }

    // draw(targetCtx) {
    //     targetCtx.save();
    //     targetCtx.translate(this.position.x, this.position.y);
    //     targetCtx.rotate(this.rotation + Math.PI / 2);
    //     targetCtx.drawImage(logoImg, -this.renderSize / 2, -this.renderSize / 2, this.renderSize, this.renderSize);
    //     targetCtx.restore();
    // }

    drawWithEdgeBuffering() {
        EDGE_BUFFER_POSITIONS.forEach(offset => {
            const position = this.calculateBufferPosition(offset);
            if (this.isPositionVisible(position)) {
                this.drawAt(position);
            }
        });
    }

    calculateBufferPosition(offset) {
        return {
            x: this.position.x + offset.dx * canvas.width,
            y: this.position.y + offset.dy * canvas.height
        };
    }

    drawAt(position) {
        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(this.rotation + Math.PI / 2);
        ctx.drawImage(logoImg, -this.renderSize / 2, -this.renderSize / 2, this.renderSize, this.renderSize);
        ctx.restore();
    }

    isPositionVisible(pos) {
        return pos.x + this.renderSize / 2 > 0 &&
            pos.x - this.renderSize / 2 < canvas.width &&
            pos.y + this.renderSize / 2 > 0 &&
            pos.y - this.renderSize / 2 < canvas.height;
    }

    calculateRenderSize(currentTime) {
        const oscillation = Math.sin(currentTime * this.oscillationSpeed + this.oscillationOffset);
        let size = this.size * (1 + oscillation * 0.1);

        if (this.scatterState === 1) {
            size *= 1.5;
        } else if (this.scatterState === 2) {
            size *= 1 + 0.5 * (this.cooldownTimer / COOLDOWN_DURATION);
        }
        return size;
    }
}

const flock = [];

function drawGridVisualization(gridInstance, ctx) {
    if (!gridInstance) return;
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 0.5;

    for (let i = 0; i <= gridInstance.numCols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridInstance.cellSize, 0);
        ctx.lineTo(i * gridInstance.cellSize, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= gridInstance.numRows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridInstance.cellSize);
        ctx.lineTo(canvas.width, i * gridInstance.cellSize);
        ctx.stroke();
    }
}

function drawNeighborhoodVisualization(boid, gridInstance, ctx) {
    if (!boid || !gridInstance) return;

    const { col: boidCol, row: boidRow } = gridInstance._getCellCoords(boid.position);

    ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
    for (let rOffset = -1; rOffset <= 1; rOffset++) {
        for (let cOffset = -1; cOffset <= 1; cOffset++) {
            let neighborRow = boidRow + rOffset;
            let neighborCol = boidCol + cOffset;
            const actualRow = (neighborRow + gridInstance.numRows) % gridInstance.numRows;
            const actualCol = (neighborCol + gridInstance.numCols) % gridInstance.numCols;
            ctx.fillRect(actualCol * gridInstance.cellSize, actualRow * gridInstance.cellSize, gridInstance.cellSize, gridInstance.cellSize);
        }
    }

    const localNeighbors = gridInstance.getItemsInNeighborhood(boid.position);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    for (const other of localNeighbors) {
        if (other === boid) continue;
        const distanceToOther = Vector.dist(boid.position, other.position);
        if (distanceToOther <= CELL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(boid.position.x, boid.position.y);
            ctx.lineTo(other.position.x, other.position.y);
            ctx.stroke();
        }
    }
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, boid.renderSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

function initializeObstacles() {
    allObstacles = OBSTACLE_ELEMENT_IDS.map(id => new Obstacle(id));
}

function updateAllObstacles() {
    if (!obstacleGrid) return;
    obstacleGrid.clear();

    for (const obstacle of allObstacles) {
        obstacle.update();
        if (obstacle.isEnabled) {
            obstacleGrid.addItemInArea(obstacle, obstacle.paddedBounds);
        }
    }
}

function rafThrottle(callback) {
    let requestId = null;
    let lastArgs = []; // To store the latest arguments if needed, though scroll usually doesn't have important args

    const later = (context) => () => {
        requestId = null;
        callback.apply(context, lastArgs);
    };

    const throttled = function (...args) {
        lastArgs = args; // Store the latest arguments
        if (requestId === null) {
            requestId = requestAnimationFrame(later(this));
        }
    };

    throttled.cancel = () => {
        if (requestId !== null) {
            cancelAnimationFrame(requestId);
            requestId = null;
        }
    };
    return throttled;
}

function scatter(duration) {
    flock.forEach(boid => {
        if (Vector.dist(mouse, boid.position) < MOUSE_INFLUENCE_RADIUS) {
            boid.scatterState = 1;
            boid.cooldownTimer = duration;
        }
    });
}

function animate() {
    if (typeof isDarkReaderActive === 'function' && isDarkReaderActive()) {
        ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
    } else {
        ctx.fillStyle = 'rgba(243, 244, 241, 0.25)';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (debugObstaclesMode) {
        for (const obstacle of allObstacles) {
            obstacle.drawDebug();
        }
    }

    if (debugGridMode) {
        drawGridVisualization(spatialGrid, ctx);
    }
    if (debugSelectedBoid) {
        drawNeighborhoodVisualization(debugSelectedBoid, spatialGrid, ctx);
    }

    if (isScattering) {
        scatter(HOLD_SCATTER_DURATION);
    }

    if (spatialGrid) {
        spatialGrid.clear();
        for (let boid of flock) {
            spatialGrid.addItemAtPoint(boid);
        }
    }

    // offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);


    // flock.sort((a, b) => a.depth - b.depth);

    const currentTime = performance.now();
    const endProgress = isEnding ? Math.min(1, (currentTime - endStartTime) / END_ANIMATION_DURATION) : 0;

    let targetPosForEnding = null;
    if (isEnding) {
        const targetX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
        const targetY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;
        targetPosForEnding = vectorPool.get(targetX, targetY);
    }

    for (let boid of flock) {
        if (isEnding && targetPosForEnding) {
            boid.position.x = boid.position.x + (targetPosForEnding.x - boid.position.x) * 0.1;
            boid.position.y = boid.position.y + (targetPosForEnding.y - boid.position.y) * 0.1;
            boid.size = (BOID_SIZE_BASE + boid.depth * BOID_SIZE_VARIATION) * (1 - endProgress);
            boid.renderSize = boid.calculateRenderSize(currentTime);
            if (endProgress > 0.95 && Vector.dist(boid.position, targetPosForEnding) < 5) {
                boid.position.x = targetPosForEnding.x;
                boid.position.y = targetPosForEnding.y;
            }
        } else if (!isEnding) {
            boid.edges();
            const localNeighbors = spatialGrid.getItemsInNeighborhood(boid.position);
            boid.flock(localNeighbors);
            boid.update(localNeighbors, currentTime);
        }
        boid.drawWithEdgeBuffering();
    }

    if (targetPosForEnding) {
        vectorPool.release(targetPosForEnding);
    }

    // for (const offset of EDGE_BUFFER_POSITIONS) {
    //     const x = offset.dx * canvas.width;
    //     const y = offset.dy * canvas.height;
    //     ctx.drawImage(offscreenCanvas, x, y);
    // }


    if (isEnding && endProgress >= 1) {
        console.log("End animation complete.");
        // console.log("Final VectorPool Stats:", vectorPool.getStats());
        return;
    }

    animationFrameId = requestAnimationFrame(animate);
}

function resetBoidSimulator() {

    stopAnimation();

    CELL_SIZE = calculateCurrentCellSize();

    // --- No if/else needed. We assume grids exist. Just update them. ---
    spatialGrid.cellSize = CELL_SIZE;
    spatialGrid.resize(canvas.width, canvas.height);

    // Also update the obstacle grid
    obstacleGrid.cellSize = CELL_SIZE;
    obstacleGrid.resize(canvas.width, canvas.height);
    updateAllObstacles(); // IMPORTANT: Repopulate obstacle grid after resize

    flock.length = 0;
    debugSelectedBoid = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < FLOCK_SIZE; i++) {
        flock.push(new Boid());
    }

    isScattering = false;
    mouseInfluence = false;
    speedMultiplier = parseFloat(speedSlider.value) / 100 || 1;
    speedValue.textContent = `${speedSlider.value}%`;

    boidsIgnoreMouse = false;
    boidsIgnoreTouch = false;
}

function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

// Function to be called from another file
function initBoidSimulator() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // offscreenCanvas = document.createElement('canvas');
    // offscreenCanvas.width = canvas.width;
    // offscreenCanvas.height = canvas.height;
    // offscreenCtx = offscreenCanvas.getContext('2d');

    CELL_SIZE = calculateCurrentCellSize();
    spatialGrid = new SpatialGrid(canvas.width, canvas.height, CELL_SIZE);
    obstacleGrid = new SpatialGrid(canvas.width, canvas.height, CELL_SIZE);

    initializeObstacles();
    updateAllObstacles();
    isEnding = false;

    const initialDebugFlags = { grid: debugGridMode, obstacles: debugObstaclesMode };
    initializeMenu(simParams, initialDebugFlags);
    setupMenuEventListeners();
    resetBoidSimulator();
    animate();
    closeNavMenu();
    setupEventListeners();
}

function setupMenuEventListeners() {
    document.body.addEventListener('godModeToggled', (e) => {
        godMode = e.detail.enabled;
        setMenuVisibility(godMode);
        console.log("God Mode:", godMode);
    });

    document.body.addEventListener('paramChanged', (e) => {
        const { key, value } = e.detail;
        if (simParams.hasOwnProperty(key)) {
            simParams[key] = value;
            if (key.includes('RADIUS')) {
                updateSpatialGridParameters();
            }
        }
    });

    document.body.addEventListener('debugFlagChanged', (e) => {
        const { flag, enabled } = e.detail;
        if (flag === 'grid') {
            debugGridMode = enabled;
            if (!enabled) debugSelectedBoid = null;
        } else if (flag === 'obstacles') {
            debugObstaclesMode = enabled;
        }
    });

    document.body.addEventListener('paramsReset', () => {
        simParams = { ...defaultSimParams };
        updateSpatialGridParameters();
        updateMenuValues(simParams); // Tell the menu to update its display
        console.log('Simulation parameters reset to default.');
    });

    // Handles mouse entering/leaving the menu itself
    document.body.addEventListener('menuInteraction', (e) => {
        boidsIgnoreMouse = e.detail.hovering;
        console.log("Boids ignore mouse:", boidsIgnoreMouse);
    });

    document.body.addEventListener('layoutChanged', throttledScrollUpdater);
}

function endSimulation() {
    godMode = false;
    setMenuVisibility(false);
    if (!isEnding) {
        isEnding = true;
        endStartTime = performance.now();
    }
}

const mouseMoveHandler = (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.set(event.clientX - rect.left, event.clientY - rect.top);
    mouseInfluence = true;
};

const mouseLeaveHandler = () => {
    mouseInfluence = false;
    isScattering = false;
};

const mouseDownHandler = (event) => {
    if (boidsIgnoreMouse) {
        return;
    }
    if (event.button === 0 && !event.shiftKey) {
        isScattering = true;
        scatter(CLICK_SCATTER_DURATION);
    }
};

const mouseUpHandler = (event) => {
    if (event.button === 0) {
        isScattering = false;
    }
};

const touchStartHandler = (event) => {
    const experimentalMenu = document.getElementById('experimentalMenu');
    const easterEgg = document.getElementById('easterEgg');
    // const aboutLink = document.getElementById('aboutLink');
    // const masteringLink = document.getElementById('masteringLink');
    // const musicLink = document.getElementById('musicLink');
    // const designLink = document.getElementById('designLink');
    // const softwareLink = document.getElementById('softwareLink');
    // const contactLink = document.getElementById('contactLink');
    const navLinks = document.getElementById('navLinks');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const visualContainer = document.getElementById('visualContainer');
    const playerGrid = document.getElementById('playerGrid');
    const designGrid = document.getElementById('designGrid');
    const songsGrid = document.getElementById('songsGrid');
    const cvContent = document.getElementById('cvContent');
    const softwareContainer = document.getElementById('softwareContainer');
    const homeLink = document.getElementById('homeLink');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const myModal = document.getElementById('myModal');
    const modalImage = document.getElementById('modalImage');

    const shouldBoidsIgnoreTouch = (easterEgg && easterEgg.contains(event.target)) ||
        (speedControls && speedControls.contains(event.target)) ||
        (experimentalMenu && experimentalMenu.contains(event.target)) ||
        // (aboutLink && aboutLink.contains(event.target)) ||
        // (masteringLink && masteringLink.contains(event.target)) ||
        // (musicLink && musicLink.contains(event.target)) ||
        // (designLink && designLink.contains(event.target)) ||
        // (softwareLink && softwareLink.contains(event.target)) ||
        // (contactLink && contactLink.contains(event.target)) ||
        (navLinks && navLinks.contains(event.target)) ||
        (hamburgerMenu && hamburgerMenu.contains(event.target)) ||
        (visualContainer && visualContainer.contains(event.target)) ||
        (playerGrid && playerGrid.contains(event.target)) ||
        (designGrid && designGrid.contains(event.target)) ||
        (songsGrid && songsGrid.contains(event.target)) ||
        (cvContent && cvContent.contains(event.target)) ||
        (softwareContainer && softwareContainer.contains(event.target)) ||
        (homeLink && homeLink.contains(event.target)) ||
        (downloadPdfBtn && downloadPdfBtn.contains(event.target)) ||
        (myModal && myModal.contains(event.target)) ||
        (modalImage && modalImage.contains(event.target));

    boidsIgnoreTouch = shouldBoidsIgnoreTouch;

    if (isEnding || boidsIgnoreTouch) {
        mouseInfluence = false;
        return;
    }
    boidsIgnoreMouse = false;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouse.set(event.touches[0].clientX - rect.left, event.touches[0].clientY - rect.top);
    mouseInfluence = true;
    isScattering = true;
    scatter(CLICK_SCATTER_DURATION);

    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
        touchEndTimeoutId = null;
    }
};

const touchMoveHandler = (event) => {
    if (isEnding || boidsIgnoreTouch) {
        mouseInfluence = false;
        return;
    }
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouse.set(event.touches[0].clientX - rect.left, event.touches[0].clientY - rect.top);
    mouseInfluence = true;

    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
        touchEndTimeoutId = null;
    }
};

const touchEndHandler = () => {
    isScattering = false;
    boidsIgnoreTouch = false;

    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
    }

    touchEndTimeoutId = setTimeout(() => {
        mouseInfluence = false;
        touchEndTimeoutId = null;
    }, 100);
};

const resizeHandler = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // if (offscreenCanvas) {
    //     offscreenCanvas.width = canvas.width;
    //     offscreenCanvas.height = canvas.height;
    // }
    if (spatialGrid) {
        spatialGrid.resize(canvas.width, canvas.height);
    }
    if (obstacleGrid) {
        obstacleGrid.resize(canvas.width, canvas.height);
    }
    updateAllObstacles();
};

function performScrollUpdates() {
    updateAllObstacles();
}

const throttledScrollUpdater = rafThrottle(performScrollUpdates);

const speedSliderInputHandler = function () {
    speedMultiplier = (this.value / 100);
    speedValue.textContent = `${this.value}%`;
};

const speedControlsMouseEnterHandler = () => {
    boidsIgnoreMouse = true;
};

const speedControlsMouseLeaveHandler = () => {
    boidsIgnoreMouse = false;
};

const documentClickHandler = (event) => {
    if (!event.shiftKey || !debugGridMode) {
        if (!debugGridMode) {
            debugSelectedBoid = null;
        }
        return;
    }

    const experimentalMenu = document.getElementById('experimentalMenu');
    if (boidsIgnoreMouse || (experimentalMenu && experimentalMenu.contains(event.target) && godMode)) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let closestBoid = null;
    let minDistSq = Infinity;

    for (const boid of flock) {
        const distSq = (boid.position.x - clickX) ** 2 + (boid.position.y - clickY) ** 2;
        if (distSq < minDistSq && distSq < (boid.renderSize * 2) ** 2) {
            minDistSq = distSq;
            closestBoid = boid;
        }
    }
    debugSelectedBoid = closestBoid;
};

const godModeButtonClickHandler = () => {
    const newGodModeState = !godMode;
    const event = new CustomEvent('godModeToggled', {
        detail: { enabled: newGodModeState },
        bubbles: true,
        composed: true
    });
    document.body.dispatchEvent(event);
    console.log("God Mode:", godMode);
};

function setupEventListeners() {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseleave', mouseLeaveHandler);
    document.removeEventListener('mousedown', mouseDownHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    document.removeEventListener('touchstart', touchStartHandler);
    document.removeEventListener('touchmove', touchMoveHandler);
    document.removeEventListener('touchend', touchEndHandler);
    window.removeEventListener('resize', resizeHandler);
    document.removeEventListener('click', documentClickHandler);
    document.body.removeEventListener('scroll', throttledScrollUpdater);

    if (speedSlider) {
        speedSlider.removeEventListener('input', speedSliderInputHandler);
    }
    if (speedControls) {
        speedControls.removeEventListener('mouseenter', speedControlsMouseEnterHandler);
        speedControls.removeEventListener('mouseleave', speedControlsMouseLeaveHandler);
    }
    if (godModeButton) {
        godModeButton.removeEventListener('click', godModeButtonClickHandler);
    }

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseleave', mouseLeaveHandler);
    document.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    document.addEventListener('touchstart', touchStartHandler, { passive: false });
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler);
    window.addEventListener('resize', resizeHandler);
    document.addEventListener('click', documentClickHandler);
    document.body.addEventListener('scroll', throttledScrollUpdater, { passive: true });

    if (speedSlider) {
        speedSlider.addEventListener('input', speedSliderInputHandler);
    }
    if (speedControls) {
        speedControls.addEventListener('mouseenter', speedControlsMouseEnterHandler);
        speedControls.addEventListener('mouseleave', speedControlsMouseLeaveHandler);
    }
    if (godModeButton) {
        godModeButton.addEventListener('click', godModeButtonClickHandler);
    }
}

// Expose functions to global scope if they are called from HTML
window.initBoidSimulator = initBoidSimulator;
window.resetBoidSimulator = resetBoidSimulator;
window.stopAnimation = stopAnimation;
window.endSimulation = endSimulation;