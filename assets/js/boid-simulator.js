// Canvas and DOM elements
const canvas = document.getElementById('boidCanvas');
const ctx = canvas.getContext('2d');
const speedSlider = document.getElementById('speedSlider');
const speedControls = document.getElementById('controls');
const speedValue = document.getElementById('speedValue');

// --- Tweakable Simulation Parameters (via experimental menu) ---
let simParams = {
    ALIGNMENT_FORCE: 1.2,
    COHESION_FORCE: 0.7,
    SEPARATION_FORCE: 1.5,
    ALIGNMENT_RADIUS: 50,
    SEPARATION_RADIUS: 50,
    COHESION_RADIUS: 300,
    VELOCITY_INERTIA: 0.45,
    ROTATION_INERTIA: 0.3,
};

const defaultSimParams = { ...simParams }; // Store initial values for reset

// --- Other Simulation parameters (mostly non-tweakable via new menu) ---
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
let mouse = { x: 0, y: 0 };
let mouseInfluence = false;
let animationFrameId = null;
let isEnding = false;
let endStartTime = 0;
let spatialGrid;
let godMode = false;
let debugCellsMode = false;
let debugSelectedBoid = null;
let isMouseOverControls = false;

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
        this.resize(canvasWidth, canvasHeight);
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

                neighborRow = (neighborRow + this.numRows) % this.numRows;
                neighborCol = (neighborCol + this.numCols) % this.numCols;

                if (this.grid[neighborRow] && this.grid[neighborRow][neighborCol]) {
                    for (const otherBoid of this.grid[neighborRow][neighborCol]) {
                        neighbors.push(otherBoid);
                    }
                }
            }
        }
        return neighbors;
    }
}


class Boid {
    constructor() {
        const easterEggCenterX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
        const easterEggCenterY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;
        this.position = new Vector(
            easterEggCenterX + (Math.random() - 0.5) * EASTER_EGG_WIDTH * SPREAD_FACTOR,
            easterEggCenterY + (Math.random() - 0.5) * EASTER_EGG_HEIGHT * SPREAD_FACTOR
        );

        this.velocity = Vector.random2D();
        this.velocity.setMag(Math.random() * 2 + 2);
        this.desiredVelocity = new Vector(0, 0);
        this.maxForce = BOID_MAX_FORCE;
        this.maxSpeed = NORMAL_MAX_SPEED;
        this.boost = new Vector(-INITIAL_BOOST, -INITIAL_BOOST);

        this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
        this.rotationSpeed = BOID_ROTATION_SPEED;

        this.depth = Math.random();
        this.size = BOID_SIZE_BASE + this.depth * BOID_SIZE_VARIATION;
        this.renderSize = this.calculateRenderSize();

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

    alignment(localNeighbors) {
        return this.calculateSteering(localNeighbors, simParams.ALIGNMENT_RADIUS, (other, d) => {
            return other.velocity;
        });
    }

    separation(localNeighbors) {
        return this.calculateSteering(localNeighbors, simParams.SEPARATION_RADIUS, (other, d) => {
            const diff = Vector.sub(this.position, other.position);
            diff.div(d * d);
            return diff;
        });
    }

    cohesion(localNeighbors) {
        return this.calculateSteering(localNeighbors, simParams.COHESION_RADIUS, (other, d) => {
            const diff = Vector.sub(other.position, this.position);
            diff.mult(1 - d / simParams.COHESION_RADIUS);
            return diff;
        });
    }

    calculateSteering(boidsToConsider, radius, vectorFunc) {
        let steering = new Vector(0, 0);
        let total = 0;
        for (let other of boidsToConsider) {
            if (other === this) continue;
            let d = Vector.dist(this.position, other.position);
            if (d > 0 && d < radius) {
                let vec = vectorFunc(other, d);
                steering.add(vec);
                total++;
            }
        }
        if (total > 0) {
            steering.div(total);
            steering.setMag(this.maxSpeed);
            steering.sub(this.velocity);
            steering.limit(this.maxForce);
        }
        return steering;
    }

    mouseAttraction() {
        if (!mouseInfluence || isMouseOverControls) return new Vector(0, 0);
        let directionToMouse = Vector.sub(mouse, this.position);
        let distance = directionToMouse.mag();
        if (distance > 0 && distance < MOUSE_INFLUENCE_RADIUS) {
            let steer;
            if (this.scatterState === 1) {
                let desiredRepulsionVelocity = new Vector(directionToMouse.x, directionToMouse.y);
                desiredRepulsionVelocity.setMag(this.maxSpeed);
                desiredRepulsionVelocity.mult(-1);
                steer = Vector.sub(desiredRepulsionVelocity, this.velocity);
                steer.limit(this.maxForce * 3);
            } else {
                let strength = 1.0 - (distance / MOUSE_INFLUENCE_RADIUS);
                let desiredAttractionVelocity = new Vector(directionToMouse.x, directionToMouse.y);
                desiredAttractionVelocity.setMag(this.maxSpeed);
                steer = Vector.sub(desiredAttractionVelocity, this.velocity);
                steer.mult(strength);
                steer.limit(this.maxForce);
            }
            return steer;
        }
        return new Vector(0, 0);
    }

    flock(localNeighbors) {
        const alignment = this.alignment(localNeighbors);
        const cohesion = this.cohesion(localNeighbors);
        const separation = this.separation(localNeighbors);
        const mouseForce = this.mouseAttraction();

        alignment.mult(simParams.ALIGNMENT_FORCE);
        cohesion.mult(simParams.COHESION_FORCE);
        separation.mult(simParams.SEPARATION_FORCE);
        mouseForce.mult(this.scatterState === 1 ? MOUSE_FORCE_SCATTER : MOUSE_FORCE_NORMAL);

        this.desiredVelocity = new Vector(this.velocity.x, this.velocity.y);
        this.desiredVelocity.add(alignment);
        this.desiredVelocity.add(cohesion);
        this.desiredVelocity.add(separation);
        this.desiredVelocity.add(mouseForce);
        this.desiredVelocity.limit(this.maxSpeed);
    }

    update(localNeighbors) {
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
        this.maxSpeed *= (0.5 + this.depth * 0.5);
    }

    updateDepth(localNeighbors) {
        const nearbyBoidsForDepth = [];
        for (const b of localNeighbors) {
            if (b === this) continue;
            if (Vector.dist(this.position, b.position) < DEPTH_INFLUENCE_RADIUS) {
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

    calculateRenderSize() {
        const time = performance.now();
        const oscillation = Math.sin(time * this.oscillationSpeed + this.oscillationOffset);
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

    const localNeighbors = gridInstance.getNeighbors(boid);
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
        ctx.fillStyle = 'rgba(243, 244, 241, 0.1)';
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (debugCellsMode) {
        drawGridVisualization(spatialGrid, ctx);
    }
    if (debugSelectedBoid) {
        drawNeighborhoodVisualization(debugSelectedBoid, spatialGrid, ctx);
    }

    if (isScattering) {
        scatter(HOLD_SCATTER_DURATION);
    }

    spatialGrid.clear();
    for (let boid of flock) {
        spatialGrid.addBoid(boid);
    }

    flock.sort((a, b) => a.depth - b.depth);

    const currentTime = performance.now();
    const endProgress = isEnding ? Math.min(1, (currentTime - endStartTime) / END_ANIMATION_DURATION) : 0;

    for (let boid of flock) {
        if (isEnding) {
            const targetX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
            const targetY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;
            boid.position.x = boid.position.x + (targetX - boid.position.x) * 0.1;
            boid.position.y = boid.position.y + (targetY - boid.position.y) * 0.1;
            // const initialSizeFactor = (BOID_SIZE_BASE + boid.depth * BOID_SIZE_VARIATION) / boid.size;
            boid.size = (BOID_SIZE_BASE + boid.depth * BOID_SIZE_VARIATION) * (1 - endProgress);
            boid.renderSize = boid.calculateRenderSize();
            if (endProgress > 0.95 && Vector.dist(boid.position, new Vector(targetX, targetY)) < 5) {
                boid.position.x = targetX;
                boid.position.y = targetY;
            }
        } else {
            boid.edges();
            const localNeighbors = spatialGrid.getNeighbors(boid);
            boid.flock(localNeighbors);
            boid.update(localNeighbors);
        }
        boid.drawWithEdgeBuffering();
    }

    if (isEnding && endProgress >= 1) {
        console.log("End animation complete.");
        return;
    }

    animationFrameId = requestAnimationFrame(animate);
}

function resetBoidSimulator() {
    stopAnimation();

    CELL_SIZE = calculateCurrentCellSize();

    if (spatialGrid) {
        spatialGrid.cellSize = CELL_SIZE;
        spatialGrid.resize(canvas.width, canvas.height);
    } else {
        spatialGrid = new SpatialGrid(canvas.width, canvas.height, CELL_SIZE);
    }

    flock.length = 0;
    debugSelectedBoid = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Use the global FLOCK_SIZE constant
    for (let i = 0; i < FLOCK_SIZE; i++) {
        flock.push(new Boid());
    }

    isScattering = false;
    mouseInfluence = false;
    speedMultiplier = parseFloat(speedSlider.value) / 100 || 1;
    speedValue.textContent = `${speedSlider.value}%`;
    isEnding = false;
    const experimentalMenu = document.getElementById('experimentalMenu');
    if (experimentalMenu) {
        experimentalMenu.remove();
    }
    isMouseOverControls = false;
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

    CELL_SIZE = calculateCurrentCellSize();
    spatialGrid = new SpatialGrid(canvas.width, canvas.height, CELL_SIZE);

    resetBoidSimulator();
    animate();
    setupEventListeners();
    if (godMode) {
        setupExperimentalMenu();
    }
}

function endSimulation() {
    if (!isEnding) {
        isEnding = true;
        endStartTime = performance.now();
    }
}


function setupEventListeners() {
    document.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = event.clientX - rect.left;
        mouse.y = event.clientY - rect.top;
        mouseInfluence = true;
    });

    document.addEventListener('mouseleave', () => {
        mouseInfluence = false;
        isScattering = false;
    });

    document.addEventListener('mousedown', (event) => {
        if (isMouseOverControls) {
            return;
        }
        if (event.button === 0 && !event.shiftKey) {
            isScattering = true;
            scatter(CLICK_SCATTER_DURATION);
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) {
            isScattering = false;
        }
    });

    // document.addEventListener('touchstart', (event) => {
    //     event.preventDefault();
    //     const rect = canvas.getBoundingClientRect();
    //     mouse.x = event.touches[0].clientX - rect.left;
    //     mouse.y = event.touches[0].clientY - rect.top;
    //     mouseInfluence = true;
    //     isScattering = true;
    //     scatter(CLICK_SCATTER_DURATION);
    // }, { passive: false });

    // document.addEventListener('touchmove', (event) => {
    //     event.preventDefault();
    //     const rect = canvas.getBoundingClientRect();
    //     mouse.x = event.touches[0].clientX - rect.left;
    //     mouse.y = event.touches[0].clientY - rect.top;
    //     mouseInfluence = true;
    // }, { passive: false });

    // document.addEventListener('touchend', () => {
    //     mouseInfluence = false;
    //     isScattering = false;
    // });

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (spatialGrid) {
            spatialGrid.resize(canvas.width, canvas.height);
        }
    });

    speedSlider.addEventListener('input', function () {
        speedMultiplier = (this.value / 100);
        speedValue.textContent = `${this.value}%`;
    });

    speedControls.addEventListener('mouseenter', () => {
        isMouseOverControls = true;
    });

    speedControls.addEventListener('mouseleave', () => {
        isMouseOverControls = false;
    });


    document.addEventListener('click', (event) => {
        if (!event.shiftKey || !debugCellsMode) {
            if (!debugCellsMode) {
                debugSelectedBoid = null;
            }
            return;
        }

        if (isMouseOverControls || (document.getElementById('experimentalMenu') && document.getElementById('experimentalMenu').contains(event.target))) {
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
    });
}

function setupExperimentalMenu() {
    const menuContainer = document.createElement('div');
    menuContainer.id = 'experimentalMenu';
    Object.assign(menuContainer.style, {
        position: 'fixed', bottom: '16px', left: '16px', backgroundColor: 'rgba(0, 0, 0, 0.6)', color: '#FFFFFF',
        padding: '15px', zIndex: '1000', borderRadius: '8px',
        fontFamily: 'Arial, sans-serif', fontSize: '12px', maxHeight: '90vh', overflowY: 'auto', backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)', minWidth: '240px'
    });

    menuContainer.addEventListener('mouseenter', () => {
        isMouseOverControls = true;
    });
    menuContainer.addEventListener('mouseleave', () => {
        isMouseOverControls = false;
    });

    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = `
        #experimentalMenu input[type="number"] {
            background-color: #444; color: white; border: 1px solid #666;
            border-radius: 3px; padding: 2px 4px; text-align: right; width: 50px;
        }
        #experimentalMenu .control-row {
             display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
        }
        #experimentalMenu .control-row label {
            color: #FFFFFF; flex-basis: 60px; flex-shrink: 0;
        }
        #experimentalMenu .control-row input[type="range"] {
             flex-grow: 1; max-width: 100px; /* Adjusted for better spacing */
        }
       #experimentalMenu .value-input {
            width: 32px; text-align: center; color: #FFFFFF;
            background: transparent; border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px; font-size: 11px;
            font-family: Arial, sans-serif;
        }
        #experimentalMenu .value-input:focus {
            outline: none; border-color: #2196F3;
        }
    `;
    document.head.appendChild(styleSheet);

    const title = document.createElement('h2');
    title.textContent = 'God Mode';
    Object.assign(title.style, { marginTop: '0', textAlign: 'center', color: '#FFFFFF', fontSize: '18px' });
    menuContainer.appendChild(title);

    const categorizedParamConfigs = {
        Force: {
            ALIGNMENT_FORCE: { label: 'Alignment', type: 'range', min: 0, max: 5, step: 0.1, precision: 1 },
            COHESION_FORCE: { label: 'Cohesion', type: 'range', min: 0, max: 3, step: 0.1, precision: 1 },
            SEPARATION_FORCE: { label: 'Separation', type: 'range', min: 0, max: 5, step: 0.1, precision: 1 },
        },
        Radius: {
            ALIGNMENT_RADIUS: { label: 'Alignment', type: 'range', min: 10, max: 500, step: 5 },
            COHESION_RADIUS: { label: 'Cohesion', type: 'range', min: 10, max: 750, step: 10 },
            SEPARATION_RADIUS: { label: 'Separation', type: 'range', min: 10, max: 500, step: 5 },
        },
        Inertia: {
            VELOCITY_INERTIA: { label: 'Velocity', type: 'range', min: 0, max: 2, step: 0.01, precision: 2 },
            ROTATION_INERTIA: { label: 'Rotation', type: 'range', min: 0, max: 1.5, step: 0.01, precision: 2 },
        }
    };

    const inputElements = {};

    // Updated function to use CSS custom properties instead of inline background
    const updateSliderFill = (slider) => {
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);
        const val = parseFloat(slider.value);
        const percentage = ((val - min) / (max - min)) * 100;
        slider.style.setProperty('--value', percentage + '%');
    };

    for (const categoryName in categorizedParamConfigs) {
        const categoryTitle = document.createElement('h4');
        categoryTitle.textContent = categoryName;
        Object.assign(categoryTitle.style, {
            marginTop: '15px',
            marginBottom: '10px',
            color: '#E0E0E0',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            paddingBottom: '5px'
        });
        menuContainer.appendChild(categoryTitle);

        const paramsInCategory = categorizedParamConfigs[categoryName];

        for (const key in paramsInCategory) {
            const config = paramsInCategory[key];
            const controlDiv = document.createElement('div');
            controlDiv.className = 'control-row';

            const labelEl = document.createElement('label');
            labelEl.htmlFor = `param-${key}-input`;
            labelEl.textContent = `${config.label}: `;

            const inputEl = document.createElement('input');
            inputEl.type = config.type;
            inputEl.id = `param-${key}-input`;
            inputEl.min = config.min;
            inputEl.max = config.max;
            inputEl.step = config.step;
            inputEl.value = simParams[key];

            // Create editable value input instead of span
            const valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.id = `param-${key}-value`;
            valueInput.className = 'value-input';
            valueInput.value = config.precision ? simParams[key].toFixed(config.precision) : simParams[key].toString();

            // Slider input event handler
            inputEl.addEventListener('input', () => {
                let newVal = config.type === 'number' ? parseInt(inputEl.value) : parseFloat(inputEl.value);
                if (config.type === 'number') {
                    if (isNaN(newVal)) newVal = config.min;
                    newVal = Math.max(config.min, Math.min(config.max, newVal));
                    inputEl.value = newVal;
                }
                simParams[key] = newVal;
                valueInput.value = config.precision ? newVal.toFixed(config.precision) : newVal.toString();
                if (config.type === 'range') updateSliderFill(inputEl);
                if (key.includes('RADIUS')) updateSpatialGridParameters();
            });

            // Value input event handlers
            valueInput.addEventListener('input', () => {
                let newVal = parseFloat(valueInput.value);
                if (!isNaN(newVal)) {
                    // Clamp the value to the slider's range
                    newVal = Math.max(config.min, Math.min(config.max, newVal));
                    simParams[key] = newVal;
                    inputEl.value = newVal;
                    if (config.type === 'range') updateSliderFill(inputEl);
                    if (key.includes('RADIUS')) updateSpatialGridParameters();
                }
            });

            valueInput.addEventListener('blur', () => {
                // Ensure the display value is properly formatted on blur
                const currentVal = simParams[key];
                valueInput.value = config.precision ? currentVal.toFixed(config.precision) : currentVal.toString();
            });

            valueInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    valueInput.blur();
                }
            });

            // Initialize slider fill on creation
            if (config.type === 'range') updateSliderFill(inputEl);

            inputElements[key] = { input: inputEl, valueInput: valueInput, config: config };
            controlDiv.appendChild(labelEl);
            controlDiv.appendChild(inputEl);
            controlDiv.appendChild(valueInput);
            menuContainer.appendChild(controlDiv);
        }
    }

    const debugSectionDiv = document.createElement('div');
    Object.assign(debugSectionDiv.style, {
        marginTop: '15px',
        paddingTop: '10px',
        borderTop: '1px solid rgba(255, 255, 255, 0.2)'
    });

    const debugToggleControlRow = document.createElement('div');
    // Mimic .control-row styling for consistency (label left, control right)
    Object.assign(debugToggleControlRow.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px' // Less margin for a single toggle compared to parameter groups
    });

    const debugLabel = document.createElement('label');
    debugLabel.htmlFor = 'debug-cells-toggle';
    debugLabel.textContent = 'Debug Grid Cells';
    Object.assign(debugLabel.style, {
        color: '#FFFFFF' // Ensure text color
        // No fixed flex-basis, let it size naturally
    });

    const debugCheckbox = document.createElement('input');
    debugCheckbox.type = 'checkbox';
    debugCheckbox.id = 'debug-cells-toggle';
    debugCheckbox.checked = debugCellsMode; // Initialize with current state

    debugCheckbox.addEventListener('change', () => {
        debugCellsMode = debugCheckbox.checked;
        if (!debugCellsMode) {
            debugSelectedBoid = null; // Clear selected boid visualization if grid debug is turned off
        }
    });

    debugToggleControlRow.appendChild(debugLabel);
    debugToggleControlRow.appendChild(debugCheckbox);
    debugSectionDiv.appendChild(debugToggleControlRow);
    menuContainer.appendChild(debugSectionDiv);
    // --- End Debug Cells Toggle Section ---


    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    Object.assign(resetButton.style, {
        marginTop: '8px', padding: '8px 12px', width: '100%', background: 'rgb(243, 244, 241)',
        color: '#4A4A4A', borderRadius: '4px', cursor: 'pointer'
    });
    resetButton.addEventListener('mouseover', () => { resetButton.style.background = 'rgb(230, 231, 228)'; });
    resetButton.addEventListener('mouseout', () => { resetButton.style.background = 'rgb(243, 244, 241)'; });

    resetButton.addEventListener('click', () => {
        simParams = { ...defaultSimParams };
        for (const key in inputElements) {
            const elGroup = inputElements[key];
            elGroup.input.value = simParams[key];
            elGroup.valueInput.value = elGroup.config.precision ? simParams[key].toFixed(elGroup.config.precision) : simParams[key].toString();
            if (elGroup.input.type === 'range') updateSliderFill(elGroup.input);
        }
        updateSpatialGridParameters();
    });

    menuContainer.appendChild(resetButton);
    document.body.appendChild(menuContainer);
}


// Expose functions to global scope if they are called from HTML
window.resetBoidSimulator = resetBoidSimulator;
window.stopAnimation = stopAnimation;
window.endSimulation = endSimulation;