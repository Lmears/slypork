// Canvas and DOM elements
const canvas = document.getElementById('boidCanvas');
const ctx = canvas.getContext('2d');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

// Simulation parameters
const FLOCK_SIZE = 100;
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
const ALIGNMENT_FORCE = 1.1;
const COHESION_FORCE = 0.7;
const SEPARATION_FORCE = 1.7;
const MOUSE_FORCE_NORMAL = 2.5;
const MOUSE_FORCE_SCATTER = 2.5;

// Boid behavior radii
const ALIGNMENT_RADIUS = 50;
const SEPARATION_RADIUS = 50;
const COHESION_RADIUS = 400;

// Additional Boid-specific constants
const BOID_MAX_FORCE = 0.2;
const BOID_SIZE_BASE = 20;
const BOID_SIZE_VARIATION = 10;
const BOID_OSCILLATION_SPEED_BASE = 0.002;
const BOID_OSCILLATION_SPEED_VARIATION = 0.002;
const BOID_ROTATION_SPEED = 0.1;

// Inertia values (0 - 1)
const VELOCITY_INERTIA = 0.4;
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

// Global variables
let speedMultiplier = 1;
let isScattering = false;
let mouse = { x: 0, y: 0 };
let mouseInfluence = false;
let animationFrameId = null;

// Assets
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

    alignment(boids) {
        return this.calculateSteering(boids, ALIGNMENT_RADIUS, (other, d) => {
            return other.velocity;
        });
    }

    separation(boids) {
        return this.calculateSteering(boids, SEPARATION_RADIUS, (other, d) => {
            const diff = Vector.sub(this.position, other.position);
            diff.div(d * d);
            return diff;
        });
    }

    cohesion(boids) {
        return this.calculateSteering(boids, COHESION_RADIUS, (other, d) => {
            const diff = Vector.sub(other.position, this.position);
            diff.mult(1 - d / COHESION_RADIUS);
            return diff;
        });
    }

    calculateSteering(boids, radius, vectorFunc) {
        let steering = new Vector(0, 0);
        let total = 0;
        for (let other of boids) {
            let d = Vector.dist(this.position, other.position);
            if (other !== this && d < radius) {
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
        if (!mouseInfluence) return new Vector(0, 0);
        let steering = Vector.sub(mouse, this.position);
        let d = steering.mag();
        if (d < MOUSE_INFLUENCE_RADIUS) {
            let strength = 1 - d / MOUSE_INFLUENCE_RADIUS;
            if (this.scatterState === 1) {
                steering.mult(-1);
                strength = 1;
            }
            steering.setMag(this.maxSpeed * strength * 2);
            steering.sub(this.velocity);
            steering.limit(this.maxForce * (this.scatterState === 1 ? 3 : 1));
            return steering;
        }
        return new Vector(0, 0);
    }

    flock(boids) {
        const alignment = this.alignment(boids);
        const cohesion = this.cohesion(boids);
        const separation = this.separation(boids);
        const mouseForce = this.mouseAttraction();

        alignment.mult(ALIGNMENT_FORCE);
        cohesion.mult(COHESION_FORCE);
        separation.mult(SEPARATION_FORCE);
        mouseForce.mult(this.scatterState === 1 ? MOUSE_FORCE_SCATTER : MOUSE_FORCE_NORMAL);

        this.desiredVelocity = new Vector(this.velocity.x, this.velocity.y);
        this.desiredVelocity.add(alignment);
        this.desiredVelocity.add(cohesion);
        this.desiredVelocity.add(separation);
        this.desiredVelocity.add(mouseForce);
        this.desiredVelocity.limit(this.maxSpeed);
    }

    update(boids) {
        this.velocity.x = this.velocity.x * this.velocityInertia + this.desiredVelocity.x * (1 - this.velocityInertia);
        this.velocity.y = this.velocity.y * this.velocityInertia + this.desiredVelocity.y * (1 - this.velocityInertia);

        this.velocity.add(this.boost);

        this.boost.mult(BOOST_DECAY);

        this.position.add(this.velocity);

        this.updateScatterState();
        this.updateMaxSpeed();
        this.updateDepth(boids);
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

    updateDepth(boids) {
        const nearbyBoids = boids.filter(b => Vector.dist(this.position, b.position) < 50 && b !== this);
        if (nearbyBoids.length > 0) {
            const avgDepth = nearbyBoids.reduce((sum, b) => sum + b.depth, 0) / nearbyBoids.length;
            this.depth = this.depth * 0.99 + avgDepth * 0.01;
            this.depth = Math.max(0, Math.min(1, this.depth));
        }
    }

    updateRotation() {
        const targetRotation = Math.atan2(this.velocity.y, this.velocity.x);
        let rotationDiff = targetRotation - this.rotation;
        rotationDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));

        const smoothedRotationDiff = rotationDiff * (1 - this.rotationInertia) * this.rotationSpeed * speedMultiplier;
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
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isScattering) {
        scatter(HOLD_SCATTER_DURATION);
    }

    flock.sort((a, b) => a.depth - b.depth);

    const currentTime = performance.now();
    const endProgress = isEnding ? (currentTime - endStartTime) / END_ANIMATION_DURATION : 0;

    for (let boid of flock) {
        if (isEnding) {
            const targetX = canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
            const targetY = canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;

            boid.position.x = boid.position.x + (targetX - boid.position.x) * endProgress;
            boid.position.y = boid.position.y + (targetY - boid.position.y) * endProgress;

            boid.size = boid.size * (1 - endProgress);
        } else {
            boid.edges();
            boid.flock(flock);
            boid.update(flock);
        }
        boid.drawWithEdgeBuffering();
    }

    if (isEnding && endProgress >= 1) {
        stopAnimation();
        return;
    }

    animationFrameId = requestAnimationFrame(animate);
}

function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}


function resetBoidSimulator() {
    stopAnimation();

    flock.length = 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < FLOCK_SIZE; i++) {
        flock.push(new Boid());
    }

    isScattering = false;
    mouseInfluence = false;
    speedMultiplier = 1;
    speedSlider.value = "100";
    speedValue.textContent = "100%";
    isEnding = false;
}

function initBoidSimulator() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    resetBoidSimulator();
    animate();
    setupEventListeners();
}

function endSimulation() {
    isEnding = true;
    endStartTime = performance.now();
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
        if (event.button === 0) {
            isScattering = true;
            scatter(CLICK_SCATTER_DURATION);
        }
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button === 0) {
            isScattering = false;
        }
    });

    document.addEventListener('touchend', () => {
        mouseInfluence = false;
    });

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    speedSlider.addEventListener('input', function () {
        speedMultiplier = (this.value / 100);
        speedValue.textContent = `${this.value}%`;
    });
}

window.resetBoidSimulator = resetBoidSimulator;
window.stopAnimation = stopAnimation;
window.endSimulation = endSimulation;

