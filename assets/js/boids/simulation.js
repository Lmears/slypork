import { initializeMenu, setMenuVisibility, updateMenuValues, updateDebugCheckboxes } from './settings.js';
import { setControlPanelVisibility } from './ui-utils.js';

// Canvas and DOM elements
const canvas = document.getElementById('boidCanvas');
const ctx = canvas.getContext('2d');
const speedSlider = document.getElementById('speedSlider');
const speedControls = document.getElementById('controls');
const speedValue = document.getElementById('speedValue');
const godModeButton = document.getElementById('godModeButton');

// --- Flock Management ---
const FLOCK_DENSITY = 0.0002; // Boids per pixel area for responsive sizing
const MIN_BOIDS = 30;
const MAX_BOIDS_PER_1000PX_WIDTH = 750; // Max boids scales with width
const DEFAULT_FLOCK_SIZE = 150;
let userHasSetFlockSize = false;

// --- Tweakable Simulation Parameters (via experimental menu) ---
let simParams = {
    FLOCK_SIZE: DEFAULT_FLOCK_SIZE,
    ALIGNMENT_FORCE: 1.0,
    COHESION_FORCE: 0.7,
    SEPARATION_FORCE: 1.1,
    OBSTACLE_FORCE: 1.2,
    ALIGNMENT_RADIUS: 50,
    COHESION_RADIUS: 120,
    SEPARATION_RADIUS: 45,
    OBSTACLE_RADIUS: 120,
    VELOCITY_INERTIA: 0.45,
    ROTATION_INERTIA: 0.3,
};

const defaultSimParams = { ...simParams }; // Store initial values for reset

const OBSTACLE_PADDING = 0;
const OBSTACLE_BOUNCE_FORCE_MULTIPLIER = 3;
const OBSTACLE_DEBUG_COLOR = 'rgba(255, 0, 0, 0.7)';
const OBSTACLE_DEBUG_FILL_COLOR = 'rgba(255, 0, 0, 0.1)';

const OBSTACLE_ELEMENT_IDS = [
    'navLinks',
    'footer',
    'hamburger-menu',
    'simpleHomeLink',
    'downloadPdfBtn',
    'keith-logo',
    'dj-pretence-logo',
    'root-basis-logo',
];
// Initialize obstacles from the DOM elements
let allObstacles = [];

// --- Other Simulation parameters (mostly non-tweakable via new menu) ---
const MITOSIS_BOOST_STRENGTH = 0.1;
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
const BOID_OSCILLATION_SPEED_BASE = 0.02;
const BOID_OSCILLATION_SPEED_VARIATION = 0.04;
const BOID_ROTATION_SPEED = 0.1;
const BOID_DYING_DURATION = 250; // Time in ms for a boid to fade out

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

const TARGET_FPS = 120; // The desired FPS for your simulation's look and feel

// Helper function to calculate CELL_SIZE
function calculateCurrentCellSize() {
    return Math.max(simParams.ALIGNMENT_RADIUS, simParams.SEPARATION_RADIUS, simParams.COHESION_RADIUS, DEPTH_INFLUENCE_RADIUS, simParams.OBSTACLE_RADIUS);
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
let godMode = false;
let debugObstaclesMode = false;
let debugGridMode = false;
let debugLinesMode = false;
let debugSelectedBoid = null;
let boidsIgnoreMouse = false;
let boidsIgnoreTouch = false;
let touchEndTimeoutId = null;
let boidImageBitmap = null;
let isSystemInitialized = false;


// --- Vector Pool ---
// Since FLOCK_SIZE is dynamic, the pool size must be based on a hard-coded maximum capacity.
export const MAX_FLOCK_SIZE_HARD_CAP = 1000;
const PEAK_VECTORS_PER_BOID = 7;
const VECTOR_POOL_INITIAL_SIZE = MAX_FLOCK_SIZE_HARD_CAP * PEAK_VECTORS_PER_BOID;
const VECTOR_POOL_MAX_SIZE = MAX_FLOCK_SIZE_HARD_CAP * PEAK_VECTORS_PER_BOID * 2;

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

window.logPoolStats = () => console.table(vectorPool.getStats());

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

let nextBoidId = 0;
class Boid {
    constructor(parentBoid = null) {
        this.id = nextBoidId++;
        if (parentBoid) {
            // "Mitosis" logic: spawn from a parent
            this.position = parentBoid.position.copy();
            this.position.x += (Math.random() - 0.5) * 5; // Jitter position
            this.position.y += (Math.random() - 0.5) * 5;

            this.velocity = parentBoid.velocity.copy();
            // Apply a small perpendicular force to "split off"
            this.boost = vectorPool.get(0, 0);
            this.depth = parentBoid.depth;

        } else {
            // Initial spawn logic (at the easter egg location)
            const easterEggCenterX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
            const easterEggCenterY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;

            this.position = vectorPool.get(
                easterEggCenterX + (Math.random() - 0.5) * EASTER_EGG_WIDTH * SPREAD_FACTOR,
                easterEggCenterY + (Math.random() - 0.5) * EASTER_EGG_HEIGHT * SPREAD_FACTOR
            );

            this.velocity = Vector.random2D(vectorPool.get(0, 0));
            this.velocity.setMag(Math.random() * 2 + 2);
            this.boost = vectorPool.get(-INITIAL_BOOST, -INITIAL_BOOST);
            this.depth = Math.random();
        }

        // --- Common initialization for all boids ---
        this.desiredVelocity = vectorPool.get(0, 0);
        this.maxForce = BOID_MAX_FORCE;
        this.maxSpeed = NORMAL_MAX_SPEED;

        this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
        this.rotationSpeed = BOID_ROTATION_SPEED;

        this.size = BOID_SIZE_BASE + this.depth * BOID_SIZE_VARIATION;
        this.renderSize = this.calculateRenderSize();
        this.oscillationPhase = Math.random() * Math.PI * 2;
        this.oscillationSpeed = BOID_OSCILLATION_SPEED_BASE + Math.random() * BOID_OSCILLATION_SPEED_VARIATION;

        this.scatterState = 0;
        this.cooldownTimer = 0;

        // --- Properties for fading out ---
        this.isDying = false;
        this.dyingStartTime = 0;
    }

    destroy() {
        vectorPool.release(this.position);
        vectorPool.release(this.velocity);
        vectorPool.release(this.desiredVelocity);
        vectorPool.release(this.boost);
        // Set them to null to prevent accidental use after destruction
        this.position = null;
        this.velocity = null;
        this.desiredVelocity = null;
        this.boost = null;
    }

    startDying() {
        if (!this.isDying) {
            this.isDying = true;
            this.dyingStartTime = performance.now();
        }
    }

    edges() {
        if (this.position.x > canvas.width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = canvas.height;
    }

    calculateFlockingForces(localNeighbors, timeScale) {
        const dynamicMaxForce = this.maxForce * timeScale;

        // --- Accumulators for all behaviors ---
        const alignmentForce = vectorPool.get(0, 0);
        const cohesionForce = vectorPool.get(0, 0);
        const separationForce = vectorPool.get(0, 0);

        const avgVelocity = vectorPool.get(0, 0);
        const avgPosition = vectorPool.get(0, 0);
        const avgRepulsion = vectorPool.get(0, 0);
        let avgDepth = 0;

        let avgPhaseX = 0;
        let avgPhaseY = 0;
        let syncTotal = 0;

        let alignmentTotal = 0;
        let cohesionTotal = 0;
        let separationTotal = 0;
        let depthTotal = 0;

        // --- Pre-calculate constants for this boid ---
        const halfWidth = canvas.width / 2;
        const halfHeight = canvas.height / 2;
        const alignRadiusSq = simParams.ALIGNMENT_RADIUS * simParams.ALIGNMENT_RADIUS;
        const cohRadiusSq = simParams.COHESION_RADIUS * simParams.COHESION_RADIUS;
        const sepRadiusSq = simParams.SEPARATION_RADIUS * simParams.SEPARATION_RADIUS;
        const depthRadiusSq = DEPTH_INFLUENCE_RADIUS * DEPTH_INFLUENCE_RADIUS;
        const syncRadiusSq = 50 * 50;

        const tempDiff = vectorPool.get(0, 0); // Reusable vector for calculations

        // --- SINGLE LOOP ---
        for (const other of localNeighbors) {
            if (other === this || other.isDying) continue; // Ignore self and dying boids in flocking

            // --- 1. Calculate Toroidal Distance (ONCE!) ---
            let tdx = this.position.x - other.position.x;
            let tdy = this.position.y - other.position.y;
            if (Math.abs(tdx) > halfWidth) tdx -= Math.sign(tdx) * canvas.width;
            if (Math.abs(tdy) > halfHeight) tdy -= Math.sign(tdy) * canvas.height;
            const dSq = tdx * tdx + tdy * tdy;

            // --- 2. Apply Behaviors based on distance ---
            // Alignment
            if (dSq < alignRadiusSq) {
                avgVelocity.add(other.velocity);
                alignmentTotal++;
            }
            // Cohesion
            if (dSq < cohRadiusSq) {
                // Adjust neighbor position for wrapping to get correct average
                const neighborX = this.position.x - tdx;
                const neighborY = this.position.y - tdy;
                avgPosition.x += neighborX;
                avgPosition.y += neighborY;
                cohesionTotal++;
            }
            // Separation
            if (dSq < sepRadiusSq && dSq > 0) {
                const distance = Math.sqrt(dSq);
                const strength = 1.0 - (distance / simParams.SEPARATION_RADIUS);
                tempDiff.set(tdx, tdy); // Vector pointing away from neighbor
                tempDiff.normalize().mult(strength);
                avgRepulsion.add(tempDiff);
                separationTotal++;
            }
            // Depth
            if (dSq < depthRadiusSq) {
                avgDepth += other.depth;
                depthTotal++;
            }

            // Oscillation Sync
            if (dSq < syncRadiusSq) {
                avgPhaseX += Math.cos(other.oscillationPhase);
                avgPhaseY += Math.sin(other.oscillationPhase);
                syncTotal++;
            }
        }

        vectorPool.release(tempDiff); // Done with this temporary vector

        // --- Finalize ALIGNMENT force ---
        if (alignmentTotal > 0) {
            avgVelocity.div(alignmentTotal);
            avgVelocity.setMag(this.maxSpeed);
            Vector.sub(avgVelocity, this.velocity, alignmentForce);
            alignmentForce.limit(dynamicMaxForce);
        }
        vectorPool.release(avgVelocity);

        // --- Finalize COHESION force ---
        if (cohesionTotal > 0) {
            avgPosition.div(cohesionTotal);
            Vector.sub(avgPosition, this.position, cohesionForce);
            cohesionForce.setMag(this.maxSpeed);
            cohesionForce.sub(this.velocity);
            cohesionForce.limit(dynamicMaxForce);
        }
        vectorPool.release(avgPosition);

        // --- Finalize SEPARATION force ---
        if (separationTotal > 0) {
            avgRepulsion.div(separationTotal);
            if (avgRepulsion.magSq() > 0) {
                avgRepulsion.setMag(this.maxSpeed);
                Vector.sub(avgRepulsion, this.velocity, separationForce);
                separationForce.limit(dynamicMaxForce);
            }
        }
        vectorPool.release(avgRepulsion);

        // --- Finalize and apply DEPTH update ---
        if (depthTotal > 0) {
            const targetDepth = avgDepth / depthTotal;
            this.depth = this.depth * 0.99 + targetDepth * 0.01;
            this.depth = Math.max(0, Math.min(1, this.depth));
        }

        // --- Finalize OSCILLATION SYNC update ---
        if (syncTotal > 0) {
            const avgTargetPhase = Math.atan2(avgPhaseY / syncTotal, avgPhaseX / syncTotal);
            let phaseDifference = avgTargetPhase - this.oscillationPhase;
            phaseDifference = Math.atan2(Math.sin(phaseDifference), Math.cos(phaseDifference));
            this.oscillationPhase += phaseDifference * 0.02 * timeScale;
        }

        // --- Return the combined forces ---
        return { alignmentForce, cohesionForce, separationForce };
    }

    mouseAttraction(timeScale) {
        if (!mouseInfluence || boidsIgnoreMouse) return vectorPool.get(0, 0);

        const directionToMouse = Vector.sub(mouse, this.position, vectorPool.get(0, 0));
        let distance = directionToMouse.mag();
        let steer = null; // Will hold the final steering vector for this function

        const dynamicMaxForce = this.maxForce * timeScale;

        if (distance > 0 && distance < MOUSE_INFLUENCE_RADIUS) {
            if (this.scatterState === 1) {
                const desiredRepulsionVelocity = vectorPool.get(directionToMouse.x, directionToMouse.y);
                desiredRepulsionVelocity.setMag(this.maxSpeed).mult(-1);
                steer = Vector.sub(desiredRepulsionVelocity, this.velocity, vectorPool.get(0, 0));
                steer.limit(dynamicMaxForce * 3);
                vectorPool.release(desiredRepulsionVelocity);
            } else {
                let strength = 1.0 - (distance / MOUSE_INFLUENCE_RADIUS);
                const desiredAttractionVelocity = vectorPool.get(directionToMouse.x, directionToMouse.y);
                desiredAttractionVelocity.setMag(this.maxSpeed);
                steer = Vector.sub(desiredAttractionVelocity, this.velocity, vectorPool.get(0, 0));
                steer.mult(strength).limit(dynamicMaxForce);
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

    /**
    * Calculates flocking and mouse forces and accumulates them in desiredVelocity.
    * Obstacle forces will be added externally after this step.
    */
    calculateBoidAndMouseForces(localNeighbors, timeScale) {
        // --- 1. Calculate flocking and mouse forces ---
        const { alignmentForce, cohesionForce, separationForce } = this.calculateFlockingForces(localNeighbors, timeScale);
        const mouseForce = this.mouseAttraction(timeScale);

        // --- 2. Apply weights ---
        alignmentForce.mult(simParams.ALIGNMENT_FORCE);
        cohesionForce.mult(simParams.COHESION_FORCE);
        separationForce.mult(simParams.SEPARATION_FORCE);
        mouseForce.mult(this.scatterState === 1 ? MOUSE_FORCE_SCATTER : MOUSE_FORCE_NORMAL);

        // --- 3. Accumulate forces into desiredVelocity ---
        // Start with current velocity for steering behavior
        this.desiredVelocity.set(this.velocity.x, this.velocity.y);
        this.desiredVelocity.add(alignmentForce);
        this.desiredVelocity.add(cohesionForce);
        this.desiredVelocity.add(separationForce);
        this.desiredVelocity.add(mouseForce);
        // Note: obstacleAvoidanceForce is now added externally between this method and the next.

        // --- 4. Release temporary force vectors ---
        vectorPool.release(alignmentForce);
        vectorPool.release(cohesionForce);
        vectorPool.release(separationForce);
        vectorPool.release(mouseForce);
    }

    /**
     * Applies the final accumulated forces (including obstacle forces) to update
     * the boid's physics, position, and visual properties.
     */
    applyForcesAndMove(timeScale) {
        // For living boids, update velocity based on all calculated forces.
        // Dying boids skip this block and just continue with their last velocity.
        if (!this.isDying) {
            // --- 1. Update velocity from desiredVelocity based on inertia ---
            this.velocity.x = this.velocity.x * simParams.VELOCITY_INERTIA + this.desiredVelocity.x * (1 - simParams.VELOCITY_INERTIA);
            this.velocity.y = this.velocity.y * simParams.VELOCITY_INERTIA + this.desiredVelocity.y * (1 - simParams.VELOCITY_INERTIA);

            // --- 2. Update state, determine max speed, and limit the base velocity ---
            this.updateScatterState();
            this.updateMaxSpeed();
            this.velocity.limit(this.maxSpeed); // Limit the boid's normal, sustainable speed

            // --- 3. Apply the decaying boost AFTER limiting ---
            // This allows the boost to temporarily exceed the max speed.
            this.velocity.add(this.boost);
            this.boost.mult(BOOST_DECAY);
        }


        // --- 4. Update position and visuals (for ALL boids, living or dying) ---
        this.position.add(this.velocity);
        this.updateRotation();
        this.oscillationPhase = (this.oscillationPhase + this.oscillationSpeed * timeScale) % (Math.PI * 2);
        this.edges(); // Wrap around canvas
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



    updateRotation() {
        const targetRotation = Math.atan2(this.velocity.y, this.velocity.x);
        let rotationDiff = targetRotation - this.rotation;
        rotationDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));

        const smoothedRotationDiff = rotationDiff * (1 - simParams.ROTATION_INERTIA) * this.rotationSpeed * speedMultiplier;
        this.rotation += smoothedRotationDiff;

        this.rotation = (this.rotation + 2 * Math.PI) % (2 * Math.PI);
    }

    draw(currentTime) {
        const margin = this.renderSize; // A slightly larger margin for safety

        // If the boid is safely away from all edges, draw it just once.
        if (this.position.x > margin && this.position.x < canvas.width - margin &&
            this.position.y > margin && this.position.y < canvas.height - margin) {

            this.drawAt(this.position, currentTime);

        } else {
            // Only for boids near an edge, perform the expensive buffered drawing.
            EDGE_BUFFER_POSITIONS.forEach(offset => {
                const position = this.calculateBufferPosition(offset);
                if (this.isPositionVisible(position)) {
                    this.drawAt(position, currentTime);
                }
            });
        }
    }

    calculateBufferPosition(offset) {
        return {
            x: this.position.x + offset.dx * canvas.width,
            y: this.position.y + offset.dy * canvas.height
        };
    }

    drawAt(position, currentTime) {
        if (!boidImageBitmap) return;
        ctx.save();

        let opacity = 1.0;
        let scale = 1.0;

        if (this.isDying) {
            const progress = Math.min(1, (currentTime - this.dyingStartTime) / BOID_DYING_DURATION);
            opacity = 1 - progress;
            scale = 1 - progress;
        }

        const finalRenderSize = this.renderSize * scale;
        if (finalRenderSize <= 0) {
            ctx.restore();
            return;
        }

        ctx.globalAlpha = opacity;
        ctx.translate(position.x, position.y);
        ctx.rotate(this.rotation + Math.PI / 2);
        ctx.drawImage(boidImageBitmap, -finalRenderSize / 2, -finalRenderSize / 2, finalRenderSize, finalRenderSize);
        ctx.restore();
    }

    isPositionVisible(pos) {
        return pos.x + this.renderSize / 2 > 0 &&
            pos.x - this.renderSize / 2 < canvas.width &&
            pos.y + this.renderSize / 2 > 0 &&
            pos.y - this.renderSize / 2 < canvas.height;
    }

    calculateRenderSize() {
        const oscillation = Math.sin(this.oscillationPhase);
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

/**
 * Draws lines between nearby boids based on their distance.
 * The line opacity fades from full at 20px to zero at 200px.
 */
function drawBoidConnections() {
    const minDist = 10;
    const maxDist = 150;
    const range = maxDist - minDist;
    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;

    // Use a Set to ensure each pair is drawn only once per frame.
    const drawnPairs = new Set();

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = 'rgba(125, 125, 125, 1)';

    for (const boid of flock) {
        if (boid.isDying) continue;

        const localNeighbors = spatialGrid.getItemsInNeighborhood(boid.position);

        for (const other of localNeighbors) {
            if (boid === other || other.isDying) continue;

            const pairKey = boid.id < other.id ? `${boid.id}-${other.id}` : `${other.id}-${boid.id}`;
            if (drawnPairs.has(pairKey)) {
                continue;
            }

            let dx = boid.position.x - other.position.x;
            let dy = boid.position.y - other.position.y;

            if (Math.abs(dx) > halfWidth) dx -= Math.sign(dx) * canvas.width;
            if (Math.abs(dy) > halfHeight) dy -= Math.sign(dy) * canvas.height;

            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < maxDist) {
                const opacity = 1 - Math.max(0, Math.min(1, (dist - minDist) / range));
                if (opacity > 0.001) {
                    const drawX = boid.position.x - dx;
                    const drawY = boid.position.y - dy;

                    ctx.globalAlpha = opacity;
                    ctx.beginPath();
                    ctx.moveTo(boid.position.x, boid.position.y);
                    ctx.lineTo(drawX, drawY);
                    ctx.stroke();
                }
            }
            drawnPairs.add(pairKey);
        }
    }
    ctx.globalAlpha = 1.0;
}

// --- NEW FLOCK MANAGEMENT FUNCTIONS ---

/**
 * Finds a boid within a "clump" by sampling the flock and checking neighbor density.
 * Used for both adding (as a parent) and removing boids.
 * @returns {Boid | null} The chosen boid, or null if the flock is empty.
 */
function findBoidInClump() {
    if (flock.length === 0) return null;

    let bestBoid = null;
    let maxNeighbors = -1;
    // Sample a small number of boids to find a suitable candidate efficiently.
    const sampleSize = Math.min(flock.length, 15);
    const radius = simParams.COHESION_RADIUS;
    const radiusSq = radius * radius;

    // For correct toroidal distance calculation
    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;

    for (let i = 0; i < sampleSize; i++) {
        const candidate = flock[Math.floor(Math.random() * flock.length)];
        // Get neighbors from the pre-populated spatial grid for this frame.
        const potentialNeighbors = spatialGrid.getItemsInNeighborhood(candidate.position);
        let neighborCount = 0;
        for (const other of potentialNeighbors) {
            if (other === candidate) {
                continue;
            }

            // Perform correct, optimized toroidal distance check
            let dx = candidate.position.x - other.position.x;
            let dy = candidate.position.y - other.position.y;

            if (Math.abs(dx) > halfWidth) {
                dx = canvas.width - Math.abs(dx);
            }
            if (Math.abs(dy) > halfHeight) {
                dy = canvas.height - Math.abs(dy);
            }

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

    // Fallback to a purely random boid if no suitable one is found.
    return bestBoid || flock[Math.floor(Math.random() * flock.length)];
}


/** Adds one new boid to the flock using "mitosis" from a clumped parent. */
function addBoid() {
    const parentBoid = findBoidInClump();
    const newBoid = new Boid(parentBoid);

    // If a parent exists, apply the splitting force.
    if (parentBoid) {
        // Create temporary vectors for the calculation
        const splitForce = vectorPool.get(parentBoid.velocity.y, -parentBoid.velocity.x);
        const randomJitter = Vector.random2D(vectorPool.get(0, 0)).mult(0.25);

        splitForce.normalize().mult(MITOSIS_BOOST_STRENGTH);
        splitForce.add(randomJitter); // Add jitter for less uniform splits

        // Apply opposing boosts
        newBoid.boost.add(splitForce);
        parentBoid.boost.sub(splitForce); // Parent gets an equal and opposite recoil

        // Release the temporary vectors now that they've been used
        vectorPool.release(splitForce);
        vectorPool.release(randomJitter);
    }

    flock.push(newBoid);
}

/** Marks a boid for removal, starting a fade-out animation. */
function removeBoid() {
    if (flock.length === 0) return;

    // Try a few times to find a boid that isn't already dying. This is to avoid
    // always picking the same one if `findBoidInClump` is not perfectly random.
    for (let i = 0; i < 10; i++) {
        const candidate = findBoidInClump();
        if (candidate && !candidate.isDying) {
            candidate.startDying();
            return;
        }
    }

    // If the loop fails (e.g., many boids are already dying),
    // find the first available boid to ensure one is always marked.
    const fallbackBoid = flock.find(b => !b.isDying);
    if (fallbackBoid) {
        fallbackBoid.startDying();
    }
}


/**
 * Compares current flock size to the target in simParams and adds/removes boids.
 */
function adjustFlockToTargetSize() {
    const targetSize = Math.floor(simParams.FLOCK_SIZE);

    // Count only boids that are not in the process of fading out.
    let livingBoidsCount = 0;
    for (const boid of flock) {
        if (!boid.isDying) {
            livingBoidsCount++;
        }
    }

    const difference = targetSize - livingBoidsCount;

    if (difference > 0) {
        // Add boids if below target, respecting the hard cap on total boids (living + dying).
        const boidsToAdd = Math.min(difference, MAX_FLOCK_SIZE_HARD_CAP - flock.length);
        for (let i = 0; i < boidsToAdd; i++) {
            addBoid();
        }
    } else if (difference < 0) {
        // Mark boids for removal if above target.
        for (let i = 0; i < Math.abs(difference); i++) {
            removeBoid();
        }
    }
}


/**
 * Calculates the desired flock size based on canvas area and density settings.
 * This is called when `userHasSetFlockSize` is false.
 */
function updateResponsiveFlockSize() {
    const maxBoids = (canvas.width / 1000) * MAX_BOIDS_PER_1000PX_WIDTH;
    let targetSize = canvas.width * canvas.height * FLOCK_DENSITY;
    targetSize = Math.max(MIN_BOIDS, targetSize);
    targetSize = Math.min(maxBoids, targetSize);
    simParams.FLOCK_SIZE = Math.floor(targetSize);
    updateMenuValues(simParams);
}


// Public API / Entry Points
/**
 * Starts the boid simulation.
 * It will LAZILY INITIALIZE the system on its first run.
 * On subsequent runs, it just creates a new flock and starts the animation.
 */
async function startSimulation() {
    // --- LAZY INITIALIZATION ---
    if (!isSystemInitialized) {
        await _prepareEnvironment();
    }
    if (!isSystemInitialized) {
        console.error("Cannot run simulation; system initialization failed.");
        return;
    }

    // --- REGULAR RUN LOGIC ---
    if (animationFrameId) {
        console.warn("Simulation is already running. Call stopSimulation() first.");
        return;
    }

    CELL_SIZE = calculateCurrentCellSize();
    if (spatialGrid) spatialGrid.resize(canvas.width, canvas.height);
    // Set initial flock size based on responsive calculation if not manually set
    if (!userHasSetFlockSize) {
        updateResponsiveFlockSize();
    }
    // Create the initial flock
    flock.length = 0; // Clear previous flock if any
    for (let i = 0; i < simParams.FLOCK_SIZE; i++) {
        flock.push(new Boid());
    }

    speedMultiplier = parseFloat(speedSlider.value) / 100 || 1;
    speedValue.textContent = `${speedSlider.value}%`;
    isEnding = false;
    animate();
}

/**
 * Completely stops the simulation, cleans up all boids and state variables.
 */
function stopSimulation() {
    // 1. Stop the animation loop immediately.
    stopAnimation();

    // 2. Clean up all existing boid objects to prevent memory leaks.
    for (const boid of flock) {
        boid.destroy();
    }
    flock.length = 0;
    debugSelectedBoid = null;

    // 3. Clear the canvas.
    if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // 4. Reset all simulation state variables to their defaults.
    isScattering = false;
    mouseInfluence = false;
    isEnding = false; // Ensure we aren't stuck in the shutdown animation state.
    godMode = false;
    setMenuVisibility(false);
    boidsIgnoreMouse = false;
    boidsIgnoreTouch = false;
    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
        touchEndTimeoutId = null;
    }

    // 5. Reset simulation parameters to their initial values.
    resetSimulationParameters();
}

function startExitAnimation() {
    godMode = false;
    setMenuVisibility(false);
    if (!isEnding) {
        isEnding = true;
        endStartTime = performance.now();
    }
}

let lastFrameTime = 0;
//  Core Simulation Loop
function animate() {
    const currentTime = performance.now();
    if (!lastFrameTime) {
        lastFrameTime = currentTime;
    }
    // deltaTime is the time in milliseconds since the last frame
    let deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // This makes the simulation slow down if FPS drops below ~60 FPS, instead of stuttering wildly.
    // if (deltaTime > 17) {
    //     deltaTime = 17;
    // }

    // timeScale is our adjustment factor. At 60fps, it will be ~2.0. At 120fps, it will be ~1.0.
    const timeScale = (deltaTime / 1000) * TARGET_FPS;

    // THE HACK: The slider's value is now adjusted by the per-frame timeScale.
    const sliderValue = parseFloat(speedSlider.value) / 100;
    speedMultiplier = sliderValue * timeScale;

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

    // --- Cleanup Phase for faded-out boids ---
    for (let i = flock.length - 1; i >= 0; i--) {
        const boid = flock[i];
        if (boid.isDying && (currentTime - boid.dyingStartTime > BOID_DYING_DURATION)) {
            boid.destroy();
            flock[i] = flock[flock.length - 1];
            flock.pop();
        }
    }


    // --- Main Simulation Update Order ---

    // 1. Update target flock size if in responsive mode.
    if (!userHasSetFlockSize && !isEnding) {
        updateResponsiveFlockSize();
    }

    // 2. Adjust the flock to the target size. This uses the grid populated in step 2.
    if (!isEnding) {
        adjustFlockToTargetSize();
    }


    // 3. Populate the grid with the current state of the flock.
    spatialGrid.clear();
    for (let boid of flock) {
        // Do not include dying boids in the spatial grid for flocking calculations
        if (!boid.isDying) {
            spatialGrid.addItemAtPoint(boid);
        }
    }



    const endProgress = isEnding ? Math.min(1, (currentTime - endStartTime) / END_ANIMATION_DURATION) : 0;
    if (isEnding) {
        const targetX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
        const targetY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;
        const targetPosForEnding = vectorPool.get(targetX, targetY);

        for (let boid of flock) {
            // Lerp position towards the target
            boid.position.x += (targetPosForEnding.x - boid.position.x) * 0.1;
            boid.position.y += (targetPosForEnding.y - boid.position.y) * 0.1;

            // Shrink boids as they approach the end
            boid.size = (BOID_SIZE_BASE + boid.depth * BOID_SIZE_VARIATION) * (1 - endProgress);
            if (endProgress > 0.95 && Vector.dist(boid.position, targetPosForEnding) < 5) {
                boid.position.x = targetPosForEnding.x;
                boid.position.y = targetPosForEnding.y;
            }
            boid.renderSize = boid.calculateRenderSize();
            boid.draw(currentTime);
        }
        vectorPool.release(targetPosForEnding);
    } else {
        // 4. Main Simulation Loop (if not ending)
        for (let boid of flock) {
            // Dying boids don't need to calculate forces, they just fade out
            if (boid.isDying) continue;
            const localNeighbors = spatialGrid.getItemsInNeighborhood(boid.position);
            boid.calculateBoidAndMouseForces(localNeighbors, timeScale);
        }

        applyObstacleAvoidanceForces(timeScale);

        if (debugLinesMode) {
            drawBoidConnections();
        }

        for (let boid of flock) {
            boid.applyForcesAndMove(timeScale);
            boid.renderSize = boid.calculateRenderSize();
            boid.draw(currentTime);
        }
    }

    // --- Continue or Stop the Animation Loop ---
    if (isEnding && endProgress >= 1) {
        return; // Stop the loop
    }
    animationFrameId = requestAnimationFrame(animate);
}

// Simulation Sub-systems & Major Logic
/**
 * Applies obstacle avoidance forces using an obstacle-centric approach.
 * For each obstacle, it finds all boids within its influence radius and calculates
 * the necessary avoidance force, applying it directly to the boid's desiredVelocity.
 */
function applyObstacleAvoidanceForces(timeScale) {
    // --- Reusable temporary vectors for all calculations in this function ---
    const effectiveObsCenter = vectorPool.get(0, 0);
    const repulsionDirTemp = vectorPool.get(0, 0);
    const boidToEffectiveCenterTemp = vectorPool.get(0, 0);
    const closestPointOnEffectiveObstacleTemp = vectorPool.get(0, 0);
    const boidToClosestPointTemp = vectorPool.get(0, 0);
    const desiredSteerAwayTemp = vectorPool.get(0, 0);
    const currentToroidalForce = vectorPool.get(0, 0); // Holds the force for one toroidal image

    // --- 1. For each Obstacle -> ... ---
    for (const obstacle of allObstacles) {
        if (!obstacle.isEnabled || !obstacle.paddedBounds) continue;

        // --- 2. Find all nearby Boids -> ... ---
        // Define the search area around the obstacle, including its vision radius.
        const influenceRadius = simParams.OBSTACLE_RADIUS;
        const searchBounds = {
            left: obstacle.paddedBounds.left - influenceRadius,
            top: obstacle.paddedBounds.top - influenceRadius,
            right: obstacle.paddedBounds.right + influenceRadius,
            bottom: obstacle.paddedBounds.bottom + influenceRadius,
        };

        // Get the grid cells that this search area overlaps.
        const startCol = Math.max(0, Math.floor(searchBounds.left / spatialGrid.cellSize));
        const endCol = Math.min(spatialGrid.numCols - 1, Math.floor(searchBounds.right / spatialGrid.cellSize));
        const startRow = Math.max(0, Math.floor(searchBounds.top / spatialGrid.cellSize));
        const endRow = Math.min(spatialGrid.numRows - 1, Math.floor(searchBounds.bottom / spatialGrid.cellSize));

        // Collect a unique set of boids from those cells.
        const uniqueBoidsInArea = new Set();
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const cell = spatialGrid.grid[row][col];
                for (const boid of cell) {
                    uniqueBoidsInArea.add(boid);
                }
            }
        }

        // --- 3. For each nearby Boid, Calculate and apply force -> ... ---
        for (const boid of uniqueBoidsInArea) {
            if (boid.isDying) continue; // Dying boids don't avoid obstacles
            const dynamicMaxForce = boid.maxForce * timeScale;
            let bestForceForBoid = null; // Stores the single most critical force vector for this boid/obstacle pair
            let bestDistSqForBoid = Infinity;
            let bestTypeForBoid = null; // 'steer' or 'bounce'

            const boidRadius = boid.renderSize / 2;

            const margin = simParams.OBSTACLE_RADIUS + boidRadius;

            const boidIsFarFromEdges =
                boid.position.x > margin && boid.position.x < canvas.width - margin &&
                boid.position.y > margin && boid.position.y < canvas.height - margin;

            // If the boid is far from the edges, we only need to check the primary position (offset 0,0).
            // Otherwise, we check all 9 positions for a seamless wrap.
            const offsetsToCheck = boidIsFarFromEdges ? [EDGE_BUFFER_POSITIONS[0]] : EDGE_BUFFER_POSITIONS;

            // Check against all 9 toroidal images of the obstacle to find the most critical interaction.
            for (const offset of offsetsToCheck) {
                const offsetX = offset.dx * canvas.width;
                const offsetY = offset.dy * canvas.height;
                const effectiveObsPadded = {
                    left: obstacle.paddedBounds.left + offsetX,
                    top: obstacle.paddedBounds.top + offsetY,
                    right: obstacle.paddedBounds.right + offsetX,
                    bottom: obstacle.paddedBounds.bottom + offsetY,
                };
                effectiveObsCenter.set(obstacle.centerX + offsetX, obstacle.centerY + offsetY);
                currentToroidalForce.set(0, 0);
                let interactionType = null;
                let currentDistSq = Infinity;

                // --- This is the exact same calculation logic from your old `avoidObstacles` method ---
                const isOverlapping =
                    (boid.position.x + boidRadius > effectiveObsPadded.left) &&
                    (boid.position.x - boidRadius < effectiveObsPadded.right) &&
                    (boid.position.y + boidRadius > effectiveObsPadded.top) &&
                    (boid.position.y - boidRadius < effectiveObsPadded.bottom);

                if (isOverlapping) {
                    interactionType = 'bounce';
                    Vector.sub(boid.position, effectiveObsCenter, repulsionDirTemp);
                    if (repulsionDirTemp.magSq() === 0) Vector.random2D(repulsionDirTemp);

                    repulsionDirTemp.setMag(NORMAL_MAX_SPEED);

                    Vector.sub(repulsionDirTemp, boid.velocity, currentToroidalForce);
                    const bounceMultiplier = simParams.OBSTACLE_FORCE * OBSTACLE_BOUNCE_FORCE_MULTIPLIER;
                    currentToroidalForce.limit(dynamicMaxForce * bounceMultiplier);
                    Vector.sub(boid.position, effectiveObsCenter, boidToEffectiveCenterTemp);
                    currentDistSq = boidToEffectiveCenterTemp.magSq();
                } else {
                    const closestX = Math.max(effectiveObsPadded.left, Math.min(boid.position.x, effectiveObsPadded.right));
                    const closestY = Math.max(effectiveObsPadded.top, Math.min(boid.position.y, effectiveObsPadded.bottom));
                    closestPointOnEffectiveObstacleTemp.set(closestX, closestY);
                    Vector.sub(boid.position, closestPointOnEffectiveObstacleTemp, boidToClosestPointTemp);
                    currentDistSq = boidToClosestPointTemp.magSq();
                    const visionRadius = simParams.OBSTACLE_RADIUS + boidRadius;

                    if (currentDistSq < visionRadius ** 2) {
                        Vector.sub(boid.position, closestPointOnEffectiveObstacleTemp, desiredSteerAwayTemp);
                        if (desiredSteerAwayTemp.magSq() === 0) Vector.sub(boid.position, effectiveObsCenter, desiredSteerAwayTemp);
                        if (desiredSteerAwayTemp.magSq() > 0) {
                            interactionType = 'steer';
                            desiredSteerAwayTemp.setMag(boid.maxSpeed);
                            Vector.sub(desiredSteerAwayTemp, boid.velocity, currentToroidalForce);
                            const distance = Math.sqrt(currentDistSq);
                            const strength = 1 - (distance / visionRadius);
                            currentToroidalForce.mult(strength);
                            currentToroidalForce.limit(dynamicMaxForce * simParams.OBSTACLE_FORCE);
                        }
                    }
                }
                // --- End of ported logic ---

                // Determine if this interaction is more critical than any other found so far for this boid.
                if (interactionType) {
                    let updateBest = !bestTypeForBoid ||
                        (interactionType === 'bounce' && bestTypeForBoid === 'steer') ||
                        (interactionType === bestTypeForBoid && currentDistSq < bestDistSqForBoid);

                    if (updateBest) {
                        if (bestForceForBoid) vectorPool.release(bestForceForBoid);
                        bestForceForBoid = currentToroidalForce.copy();
                        bestDistSqForBoid = currentDistSq;
                        bestTypeForBoid = interactionType;
                    }
                }
            } // End of toroidal images loop

            // After checking all 9 images, if a best force was found, apply it to the boid.
            if (bestForceForBoid) {
                boid.desiredVelocity.add(bestForceForBoid);
                vectorPool.release(bestForceForBoid);
            }
        } // End of nearby boids loop
    } // End of obstacles loop

    // --- Release all temporary vectors at the end ---
    vectorPool.release(effectiveObsCenter);
    vectorPool.release(repulsionDirTemp);
    vectorPool.release(boidToEffectiveCenterTemp);
    vectorPool.release(closestPointOnEffectiveObstacleTemp);
    vectorPool.release(boidToClosestPointTemp);
    vectorPool.release(desiredSteerAwayTemp);
    vectorPool.release(currentToroidalForce);
}

function scatter(duration) {
    flock.forEach(boid => {
        if (Vector.dist(mouse, boid.position) < MOUSE_INFLUENCE_RADIUS) {
            boid.scatterState = 1;
            boid.cooldownTimer = duration;
        }
    });
}

// One-Time Setup & Lifecycle Management
/**
 * Performs the one-time setup for the entire boid system.
 * This should only ever be called once.
 */
async function _prepareEnvironment() {
    // Prevent this from ever running more than once.
    if (isSystemInitialized) return;

    try {
        await loadAndPrepareImage();
    } catch (error) {
        console.error("Could not prepare boid image:", error);
        return; // Stop if the image fails to load
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    spatialGrid = new SpatialGrid(canvas.width, canvas.height, calculateCurrentCellSize());
    initializeObstacles();
    updateAllObstacles();

    const initialDebugFlags = { grid: debugGridMode, obstacles: debugObstaclesMode, lines: debugLinesMode };
    initializeMenu(simParams, initialDebugFlags);
    setupMenuEventListeners();
    setupEventListeners();

    closeNavMenu();

    // Set the flag to true at the very end of a successful setup.
    isSystemInitialized = true;
    console.log("Boid system initialized for the first time.");
}

async function loadAndPrepareImage() {
    // 1. Fetch the image data as a blob
    const response = await fetch('../assets/images/boid-logo.webp');
    if (!response.ok) {
        throw new Error('Failed to fetch boid image');
    }
    const imageBlob = await response.blob();

    // 2. Decode the blob into an ImageBitmap
    boidImageBitmap = await createImageBitmap(imageBlob, {
        resizeWidth: 64,  // Set this to a reasonable max size for your boids
        resizeHeight: 64, // e.g., 64x64
        resizeQuality: 'high'
    });

    // console.log("Boid image is decoded and ready to render.");
}

function initializeObstacles() {
    allObstacles = OBSTACLE_ELEMENT_IDS.map(id => new Obstacle(id));
}

// Event Handlers
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
    if (spatialGrid) {
        spatialGrid.resize(canvas.width, canvas.height);
    }
    updateAllObstacles();
    // If simulation is running and in responsive mode, update the target flock size.
    if (animationFrameId && !userHasSetFlockSize) {
        updateResponsiveFlockSize();
    }
};



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

const iframeMouseEnterHandler = () => {
    boidsIgnoreMouse = true;
};

const iframeMouseLeaveHandler = () => {
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

// State & Event Management
function setupAppLifecycleListeners() {
    window.addEventListener('pageshow', (event) => {
        // This event fires on every page load, including back-button navigation.
        if (event.persisted) {
            mouseInfluence = false;
            // console.log("Page restored from back-forward cache. Resetting UI state.");
            godMode = false;

            setMenuVisibility(false, { animated: false });

            if (typeof window.resetEasterEggState === 'function') {
                window.resetEasterEggState();
            }

            // Dispatch event to sync the God Mode button's state (good practice)
            const customEvent = new CustomEvent('godModeToggled', {
                detail: { enabled: false },
                bubbles: true,
                composed: true
            });
            document.body.dispatchEvent(customEvent);


            const pageMode = document.body.dataset.pageMode;

            // Only tear down the main simulation UI if we are NOT on the permanent page.
            if (pageMode !== 'permanent-sim') {
                stopSimulation();
                // console.log("Standard page detected. Hiding main simulation UI.");

                setControlPanelVisibility(false, { animated: false });

                // Instantly hide the canvas
                const boidCanvas = document.getElementById('boidCanvas');
                if (boidCanvas) {
                    boidCanvas.style.transition = 'none';
                    boidCanvas.style.opacity = '0';
                    boidCanvas.style.display = 'none';
                    setTimeout(() => boidCanvas.style.transition = '', 20);
                }
            } else {
                // console.log("Permanent simulation page detected. Controls and canvas will remain visible.");
            }
        }
    });
}

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

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        iframe.removeEventListener('mouseenter', iframeMouseEnterHandler);
        iframe.removeEventListener('mouseleave', iframeMouseLeaveHandler);
    });

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

    iframes.forEach(iframe => {
        iframe.addEventListener('mouseenter', iframeMouseEnterHandler);
        iframe.addEventListener('mouseleave', iframeMouseLeaveHandler);
    });
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
            // If the user manually changes flock size via the menu, set the flag.
            if (key === 'FLOCK_SIZE') {
                userHasSetFlockSize = true;
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
        } else if (flag === 'lines') {
            debugLinesMode = enabled;
        }
    });

    document.body.addEventListener('paramsReset', resetSimulationParameters);


    // Handles mouse entering/leaving the menu itself
    document.body.addEventListener('menuInteraction', (e) => {
        boidsIgnoreMouse = e.detail.hovering;
        // console.log("Boids ignore mouse:", boidsIgnoreMouse);
    });

    document.body.addEventListener('layoutChanged', throttledScrollUpdater);
}

function updateAllObstacles() {
    for (const obstacle of allObstacles) {
        obstacle.update();
    }
}

function performScrollUpdates() {
    updateAllObstacles();
}

function resetSimulationParameters() {
    simParams = { ...defaultSimParams }; // Reset to defaults
    userHasSetFlockSize = false;         // Allow responsive flock size again.
    updateSpatialGridParameters();      // Update dependent systems (grid)
    updateMenuValues(simParams);        // Update UI to reflect the reset
    debugGridMode = false;
    debugObstaclesMode = false;
    debugLinesMode = false;
    updateDebugCheckboxes({
        grid: debugGridMode,
        obstacles: debugObstaclesMode,
        lines: debugLinesMode
    });
}

// Utility & Helper Functions
function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
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

// Debugging Functions
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



// Expose functions to global scope if they are called from HTML
window.startSimulation = startSimulation;
window.stopSimulation = stopSimulation;
window.startExitAnimation = startExitAnimation;
setupAppLifecycleListeners();
