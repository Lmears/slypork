// Canvas and DOM elements
const canvas = document.getElementById('boidCanvas');
const ctx = canvas.getContext('2d');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

// Simulation parameters
const FLOCK_SIZE = 200;
const NORMAL_MAX_SPEED = 5;
const SCATTER_MAX_SPEED = 15;
const INITIAL_BOOST = 10;
const BOOST_DECAY = 0.95;

// Mouse interaction
const MOUSE_INFLUENCE_RADIUS = 200;
const CLICK_SCATTER_DURATION = 22;
const HOLD_SCATTER_DURATION = 45;
const COOLDOWN_DURATION = 30;

// Boid behavior forces
const ALIGNMENT_FORCE = 1.2;
const COHESION_FORCE = 0.7;
const SEPARATION_FORCE = 1.7;
const MOUSE_FORCE_NORMAL = 3.0;
const MOUSE_FORCE_SCATTER = 2.5;

// Boid behavior radii
const ALIGNMENT_RADIUS = 50;
const SEPARATION_RADIUS = 50;
const COHESION_RADIUS = 300;
const DEPTH_INFLUENCE_RADIUS = 50;

// Additional Boid-specific constants
const BOID_MAX_FORCE = 0.175;
const BOID_SIZE_BASE = 20;
const BOID_SIZE_VARIATION = 10;
const BOID_OSCILLATION_SPEED_BASE = 0.002;
const BOID_OSCILLATION_SPEED_VARIATION = 0.002;
const BOID_ROTATION_SPEED = 0.1;

// Inertia values (0 - 1)
const VELOCITY_INERTIA = 0.45;
const ROTATION_INERTIA = 0.3;

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
// CELL_SIZE must be at least the largest interaction radius for the 3x3 neighborhood search to be sufficient.
const CELL_SIZE = Math.max(ALIGNMENT_RADIUS, SEPARATION_RADIUS, COHESION_RADIUS, DEPTH_INFLUENCE_RADIUS);


// Global variables
let speedMultiplier = 1;
let isScattering = false;
let mouse = { x: 0, y: 0 };
let mouseInfluence = false;
let animationFrameId = null;
let isEnding = false;
let endStartTime = 0;
let spatialGrid;
let debugDrawGrid = false;
let debugSelectedBoid = null;

const logoImg = new Image();
logoImg.src = '../assets/images/favicon-96x96.png';

class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(v) { this.x += v.x; this.y += v.y; }
    sub(v) { this.x -= v.x; this.y -= v.y; }
    mult(n) { this.x *= n; this.y *= n; }
    div(n) { this.x /= n; this.y /= n; }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    setMag(n) { this.normalize(); this.mult(n); }
    normalize() { const m = this.mag(); if (m !== 0) this.div(m); }
    limit(max) { if (this.mag() > max) { this.normalize(); this.mult(max); } }
    static dist(v1, v2) { return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2); }
    static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
    static random2D() { return new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1); }
}

class SpatialGrid {
    constructor(canvasWidth, canvasHeight, cellSize) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.cellSize = cellSize;
        this.resize(canvasWidth, canvasHeight); // Call resize to initialize grid
    }

    _initializeGrid() {
        this.grid = [];
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
        // Ensure numCols/numRows are at least 1, even if canvas is smaller than cellSize
        this.numCols = Math.max(1, Math.ceil(newWidth / this.cellSize));
        this.numRows = Math.max(1, Math.ceil(newHeight / this.cellSize));
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

    addBoid(boid) {
        const { col, row } = this._getCellCoords(boid.position);
        if (row >= 0 && row < this.numRows && col >= 0 && col < this.numCols) {
            this.grid[row][col].push(boid);
        }
    }

    getNeighbors(boid) {
        const neighbors = [];
        const { col: boidCol, row: boidRow } = this._getCellCoords(boid.position);

        for (let rOffset = -1; rOffset <= 1; rOffset++) {
            for (let cOffset = -1; cOffset <= 1; cOffset++) {
                let neighborRow = boidRow + rOffset;
                let neighborCol = boidCol + cOffset;

                // Handle grid wraparound for neighbor cells
                neighborRow = (neighborRow + this.numRows) % this.numRows;
                neighborCol = (neighborCol + this.numCols) % this.numCols;

                // Ensure row and col are valid before accessing (should be due to modulo, but defensive)
                if (this.grid[neighborRow] && this.grid[neighborRow][neighborCol]) {
                    for (const otherBoid of this.grid[neighborRow][neighborCol]) {
                        neighbors.push(otherBoid);
                    }
                }
            }
        }
        return neighbors; // Note: This list includes the boid itself.
        // Behavior calculations usually have `other !== this`.
    }
}


class Boid {
    constructor() {
        // Position initialization
        const easterEggCenterX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
        const easterEggCenterY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;
        this.position = new Vector(
            easterEggCenterX + (Math.random() - 0.5) * EASTER_EGG_WIDTH * SPREAD_FACTOR,
            easterEggCenterY + (Math.random() - 0.5) * EASTER_EGG_HEIGHT * SPREAD_FACTOR
        );

        // Velocity and movement properties
        this.velocity = Vector.random2D();
        this.velocity.setMag(Math.random() * 2 + 2);
        this.desiredVelocity = new Vector(0, 0);
        this.maxForce = BOID_MAX_FORCE;
        this.maxSpeed = NORMAL_MAX_SPEED;
        this.boost = new Vector(-INITIAL_BOOST, -INITIAL_BOOST);

        // Inertia and rotation properties
        this.velocityInertia = VELOCITY_INERTIA;
        this.rotationInertia = ROTATION_INERTIA;
        this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
        this.rotationSpeed = BOID_ROTATION_SPEED;

        // Visual properties
        this.depth = Math.random();
        this.size = BOID_SIZE_BASE + this.depth * BOID_SIZE_VARIATION;
        this.renderSize = this.calculateRenderSize();

        // Oscillation properties
        this.oscillationOffset = Math.random() * Math.PI * 2;
        this.oscillationSpeed = BOID_OSCILLATION_SPEED_BASE + Math.random() * BOID_OSCILLATION_SPEED_VARIATION;

        // State properties
        this.scatterState = 0;
        this.cooldownTimer = 0;
    }

    edges() {
        if (this.position.x > canvas.width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = canvas.height;
    }

    // These methods now operate on `localNeighbors` passed from `flock()`
    alignment(localNeighbors) {
        return this.calculateSteering(localNeighbors, ALIGNMENT_RADIUS, (other, d) => {
            return other.velocity;
        });
    }

    separation(localNeighbors) {
        return this.calculateSteering(localNeighbors, SEPARATION_RADIUS, (other, d) => {
            const diff = Vector.sub(this.position, other.position);
            diff.div(d * d); // d*d makes separation stronger for closer boids
            return diff;
        });
    }

    cohesion(localNeighbors) {
        return this.calculateSteering(localNeighbors, COHESION_RADIUS, (other, d) => {
            const diff = Vector.sub(other.position, this.position);
            diff.mult(1 - d / COHESION_RADIUS);
            return diff;
        });
    }

    calculateSteering(boidsToConsider, radius, vectorFunc) {
        let steering = new Vector(0, 0);
        let total = 0;
        for (let other of boidsToConsider) {
            // The boidsToConsider list might contain the boid itself, so filter it out.
            if (other === this) continue;

            let d = Vector.dist(this.position, other.position);
            if (d > 0 && d < radius) { // d > 0 to avoid issues if somehow dist is 0
                let vec = vectorFunc(other, d);
                steering.add(vec);
                total++;
            }
        }
        if (total > 0) {
            steering.div(total);
            steering.setMag(this.maxSpeed); // Desired velocity towards average
            steering.sub(this.velocity);   // Steering force = desired - current
            steering.limit(this.maxForce);
        }
        return steering;
    }

    mouseAttraction() {
        if (!mouseInfluence) return new Vector(0, 0); // No influence, no force

        let directionToMouse = Vector.sub(mouse, this.position); // Vector from boid to mouse
        let distance = directionToMouse.mag(); // Distance to mouse

        // Check if the boid is within the influence radius and not exactly at the mouse position
        if (distance > 0 && distance < MOUSE_INFLUENCE_RADIUS) {
            let steer; // This will be the calculated steering force

            if (this.scatterState === 1) { // Scattering (repulsion) mode
                // For scattering, boids flee directly away from the mouse.
                // The boid's this.maxSpeed is already elevated to SCATTER_MAX_SPEED via updateMaxSpeed().

                // Create a new vector for the desired repulsion velocity, initially pointing towards the mouse.
                let desiredRepulsionVelocity = new Vector(directionToMouse.x, directionToMouse.y);

                // Set its magnitude to the boid's current (scatter) maxSpeed.
                // setMag() normalizes the vector and then scales it.
                desiredRepulsionVelocity.setMag(this.maxSpeed);

                // Reverse the direction to make it point away from the mouse.
                desiredRepulsionVelocity.mult(-1);

                // Standard steering force calculation: desired velocity - current velocity.
                steer = Vector.sub(desiredRepulsionVelocity, this.velocity);

                // Apply a higher force limit for scattering.
                // The MOUSE_FORCE_SCATTER multiplier will be applied later in flock().
                steer.limit(this.maxForce * 3);

            } else { // Normal attraction mode
                // Calculate a strength factor based on proximity.
                let strength = 1.0 - (distance / MOUSE_INFLUENCE_RADIUS);

                // Optional: For an even gentler engagement at the edges, use a squared strength:
                // strength = strength * strength;

                // The desired velocity is to move towards the mouse at the boid's current maxSpeed.
                // Create a new vector for the desired attraction velocity.
                let desiredAttractionVelocity = new Vector(directionToMouse.x, directionToMouse.y);

                // Set its magnitude to the boid's current maxSpeed, pointing towards the mouse.
                // setMag() normalizes the vector and then scales it.
                desiredAttractionVelocity.setMag(this.maxSpeed);

                // Standard steering force calculation: desired velocity - current velocity.
                steer = Vector.sub(desiredAttractionVelocity, this.velocity);

                // Crucially, scale the *entire calculated steering force* by the strength factor.
                steer.mult(strength);

                // Limit the steering force to the boid's general max force capability.
                // The MOUSE_FORCE_NORMAL multiplier will be applied later in flock().
                steer.limit(this.maxForce);
            }
            return steer; // Return the calculated steering force
        }
        return new Vector(0, 0); // Outside influence radius, so no mouse force.
    }

    flock(localNeighbors) { // Receives localNeighbors from the grid
        const alignment = this.alignment(localNeighbors);
        const cohesion = this.cohesion(localNeighbors);
        const separation = this.separation(localNeighbors);
        const mouseForce = this.mouseAttraction();

        alignment.mult(ALIGNMENT_FORCE);
        cohesion.mult(COHESION_FORCE);
        separation.mult(SEPARATION_FORCE);
        mouseForce.mult(this.scatterState === 1 ? MOUSE_FORCE_SCATTER : MOUSE_FORCE_NORMAL);

        this.desiredVelocity = new Vector(this.velocity.x, this.velocity.y); // Start with current velocity
        this.desiredVelocity.add(alignment);
        this.desiredVelocity.add(cohesion);
        this.desiredVelocity.add(separation);
        this.desiredVelocity.add(mouseForce);
        this.desiredVelocity.limit(this.maxSpeed);
    }

    update(localNeighbors) { // Receives localNeighbors for operations like updateDepth
        this.velocity.x = this.velocity.x * this.velocityInertia + this.desiredVelocity.x * (1 - this.velocityInertia);
        this.velocity.y = this.velocity.y * this.velocityInertia + this.desiredVelocity.y * (1 - this.velocityInertia);

        this.velocity.add(this.boost);
        this.boost.mult(BOOST_DECAY);
        this.position.add(this.velocity);

        this.updateScatterState();
        this.updateMaxSpeed();
        this.updateDepth(localNeighbors); // Pass localNeighbors for depth calculation
        this.updateRotation();

        this.velocity.limit(this.maxSpeed);
        this.renderSize = this.calculateRenderSize();
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
        this.maxSpeed *= (0.5 + this.depth * 0.5); // Depth affects max speed
    }

    updateDepth(localNeighbors) { // Uses localNeighbors now
        const nearbyBoidsForDepth = [];
        for (const b of localNeighbors) {
            if (b === this) continue;
            if (Vector.dist(this.position, b.position) < DEPTH_INFLUENCE_RADIUS) {
                nearbyBoidsForDepth.push(b);
            }
        }

        if (nearbyBoidsForDepth.length > 0) {
            const avgDepth = nearbyBoidsForDepth.reduce((sum, b) => sum + b.depth, 0) / nearbyBoidsForDepth.length;
            this.depth = this.depth * 0.99 + avgDepth * 0.01; // Slow interpolation
            this.depth = Math.max(0, Math.min(1, this.depth));
        }
    }

    updateRotation() {
        const targetRotation = Math.atan2(this.velocity.y, this.velocity.x);
        let rotationDiff = targetRotation - this.rotation;
        rotationDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff)); // Normalize angle diff

        const smoothedRotationDiff = rotationDiff * (1 - this.rotationInertia) * this.rotationSpeed * speedMultiplier;
        this.rotation += smoothedRotationDiff;

        this.rotation = (this.rotation + 2 * Math.PI) % (2 * Math.PI); // Keep rotation within [0, 2PI)
    }

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
        ctx.rotate(this.rotation + Math.PI / 2); // Boid image might be pointing up
        ctx.drawImage(logoImg, -this.renderSize / 2, -this.renderSize / 2, this.renderSize, this.renderSize);
        ctx.restore();
    }

    isPositionVisible(pos) {
        return pos.x + this.renderSize / 2 > 0 &&
            pos.x - this.renderSize / 2 < canvas.width &&
            pos.y + this.renderSize / 2 > 0 &&
            pos.y - this.renderSize / 2 < canvas.height;
    }

    calculateRenderSize() {
        const time = performance.now();
        const oscillation = Math.sin(time * this.oscillationSpeed + this.oscillationOffset);
        let size = this.size * (1 + oscillation * 0.1); // Base oscillation

        // Scatter state visual feedback
        if (this.scatterState === 1) {
            size *= 1.5; // Larger when actively scattering
        } else if (this.scatterState === 2) {
            // Transition back to normal size during cooldown
            size *= 1 + 0.5 * (this.cooldownTimer / COOLDOWN_DURATION);
        }
        return size;
    }
}

const flock = [];

function drawGridVisualization(gridInstance, ctx) {
    if (!gridInstance) return;
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)'; // Light gray, semi-transparent
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

    // Highlight the 3x3 neighborhood cells
    ctx.fillStyle = 'rgba(0, 255, 0, 0.05)'; // Light green, very transparent
    for (let rOffset = -1; rOffset <= 1; rOffset++) {
        for (let cOffset = -1; cOffset <= 1; cOffset++) {
            let neighborRow = boidRow + rOffset;
            let neighborCol = boidCol + cOffset;

            // Handle grid wraparound for drawing
            const actualRow = (neighborRow + gridInstance.numRows) % gridInstance.numRows;
            const actualCol = (neighborCol + gridInstance.numCols) % gridInstance.numCols;

            ctx.fillRect(actualCol * gridInstance.cellSize, actualRow * gridInstance.cellSize, gridInstance.cellSize, gridInstance.cellSize);
        }
    }

    // Draw lines to its actual neighbors considered (from spatialGrid.getNeighbors)
    const localNeighbors = gridInstance.getNeighbors(boid);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; // Red lines to neighbors
    ctx.lineWidth = 1;
    let linesDrawn = 0;

    for (const other of localNeighbors) {
        if (other === boid) continue;

        const distanceToOther = Vector.dist(boid.position, other.position);
        // ADD THIS LOG:

        if (distanceToOther <= CELL_SIZE) {
            ctx.beginPath();
            ctx.moveTo(boid.position.x, boid.position.y);
            ctx.lineTo(other.position.x, other.position.y);
            ctx.stroke();
            linesDrawn++; // Increment counter
        }
    }
    // Highlight the selected boid
    ctx.beginPath();
    ctx.arc(boid.position.x, boid.position.y, boid.renderSize / 2 + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)'; // Yellow outline
    ctx.lineWidth = 2;
    ctx.stroke();
}

function scatter(duration) {
    flock.forEach(boid => {
        if (Vector.dist(mouse, boid.position) < MOUSE_INFLUENCE_RADIUS) {
            boid.scatterState = 1; // Active scatter state
            boid.cooldownTimer = duration;
        }
    });
}

function animate() {
    if (typeof isDarkReaderActive === 'function' && isDarkReaderActive()) {
        ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
    } else {
        ctx.fillStyle = 'rgba(243, 244, 241, 0.1)';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (debugDrawGrid) {
        drawGridVisualization(spatialGrid, ctx);
    }
    if (debugSelectedBoid) {
        drawNeighborhoodVisualization(debugSelectedBoid, spatialGrid, ctx);
    }

    if (isScattering) {
        scatter(HOLD_SCATTER_DURATION); // Continuous scatter while mouse is down
    }

    // Populate spatial grid for this frame
    spatialGrid.clear();
    for (let boid of flock) {
        // Boids positions are updated, then they are added to grid.
        // Edges are handled before this in the boid's own update cycle for next frame,
        // but for adding to grid, current position is used.
        spatialGrid.addBoid(boid);
    }

    flock.sort((a, b) => a.depth - b.depth);

    const currentTime = performance.now();
    const endProgress = isEnding ? Math.min(1, (currentTime - endStartTime) / END_ANIMATION_DURATION) : 0;

    for (let boid of flock) {
        if (isEnding) {
            const targetX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
            const targetY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;

            // Interpolate position towards target
            boid.position.x = boid.position.x + (targetX - boid.position.x) * 0.1; // Smooth movement to target
            boid.position.y = boid.position.y + (targetY - boid.position.y) * 0.1;

            // Shrink boid based on endProgress
            // Using original size to scale down correctly
            const initialSizeFactor = (BOID_SIZE_BASE + boid.depth * BOID_SIZE_VARIATION) / boid.size;
            boid.size = (BOID_SIZE_BASE + boid.depth * BOID_SIZE_VARIATION) * (1 - endProgress);
            boid.renderSize = boid.calculateRenderSize(); // Recalculate render size

            // If very close and almost done, snap to avoid infinite interpolation
            if (endProgress > 0.95 && Vector.dist(boid.position, new Vector(targetX, targetY)) < 5) {
                boid.position.x = targetX;
                boid.position.y = targetY;
            }
        } else {
            boid.edges(); // Apply screen wrapping

            // Get local neighbors from the grid
            const localNeighbors = spatialGrid.getNeighbors(boid);

            boid.flock(localNeighbors); // Calculate flocking behaviors with local neighbors
            boid.update(localNeighbors); // Update boid state, using local neighbors for depth
        }
        boid.drawWithEdgeBuffering();
    }

    if (isEnding && endProgress >= 1) {
        // stopAnimation();
        // Potentially clear flock or hide canvas after animation
        console.log("End animation complete.");
        return;
    }

    animationFrameId = requestAnimationFrame(animate);
}

function resetBoidSimulator() {
    stopAnimation(); // This should cancel the loop scheduled by the previous animate() call

    flock.length = 0;
    debugSelectedBoid = null; // Explicitly clear selected boid on reset

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear immediately

    for (let i = 0; i < FLOCK_SIZE; i++) {
        flock.push(new Boid());
    }

    isScattering = false;
    mouseInfluence = false;
    speedMultiplier = parseFloat(speedSlider.value) / 100 || 1;
    speedValue.textContent = `${speedSlider.value}%`;
    isEnding = false;

    if (spatialGrid) {
        spatialGrid.clear();
    } else {
        spatialGrid = new SpatialGrid(canvas.width, canvas.height, CELL_SIZE);
    }
}

function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function initBoidSimulator() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize spatial grid
    spatialGrid = new SpatialGrid(canvas.width, canvas.height, CELL_SIZE);

    resetBoidSimulator();
    animate();
    setupEventListeners();
}

function endSimulation() {
    if (!isEnding) {
        isEnding = true;
        endStartTime = performance.now();
    }
}


function setupEventListeners() {
    // To prevent adding multiple listeners if setupEventListeners is called more than once
    // It's better to make this idempotent or ensure it's called only once.
    // For this refactor, assuming it's called once during init.

    document.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
        mouseInfluence = true;
    });

    document.addEventListener('mouseleave', () => {
        mouseInfluence = false;
        isScattering = false; // Stop continuous scatter if mouse leaves
    });

    document.addEventListener('mousedown', (event) => {
        if (event.button === 0 && !event.shiftKey) { // Left mouse button
            isScattering = true;
            scatter(CLICK_SCATTER_DURATION); // Initial scatter on click
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) { // Left mouse button
            isScattering = false;
        }
    });

    document.addEventListener('touchstart', (event) => {
        event.preventDefault(); // Prevent scrolling/default touch actions
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.touches[0].clientX - rect.left;
        mouse.y = event.touches[0].clientY - rect.top;
        mouseInfluence = true;
        isScattering = true;
        scatter(CLICK_SCATTER_DURATION);
    }, { passive: false });

    document.addEventListener('touchmove', (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.touches[0].clientX - rect.left;
        mouse.y = event.touches[0].clientY - rect.top;
        mouseInfluence = true;
    }, { passive: false });

    document.addEventListener('touchend', () => {
        mouseInfluence = false;
        isScattering = false;
    });

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (spatialGrid) {
            spatialGrid.resize(canvas.width, canvas.height);
        }
        // Optional: redraw or re-initialize elements based on new size
        // The animate loop will handle repainting.
    });

    speedSlider.addEventListener('input', function () {
        speedMultiplier = (this.value / 100);
        speedValue.textContent = `${this.value}%`;
    });

    document.addEventListener('click', (event) => {
        if (!event.shiftKey || !debugDrawGrid) { // MODIFIED: Require Shift key
            if (!debugDrawGrid) {
                debugSelectedBoid = null;
            }
            return;
        }
        console.log("Shift click detected, entering debug mode.");
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        let closestBoid = null;
        let minDistSq = Infinity;

        for (const boid of flock) {
            const distSq = (boid.position.x - clickX) ** 2 + (boid.position.y - clickY) ** 2;
            if (distSq < minDistSq && distSq < (boid.renderSize * 2) ** 2) { // Click within ~2x boid size
                minDistSq = distSq;
                closestBoid = boid;
            }
        }
        debugSelectedBoid = closestBoid;
    });
}

// Expose functions to global scope if they are called from HTML (e.g., buttons)
window.resetBoidSimulator = resetBoidSimulator;
window.stopAnimation = stopAnimation;
window.endSimulation = endSimulation;