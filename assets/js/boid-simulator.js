// Boid Simulator JavaScript
const canvas = document.getElementById('boidCanvas');
const ctx = canvas.getContext('2d');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');

let speedMultiplier = 1;
let isScattering = false;

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
    normalize() { let m = this.mag(); if (m != 0) this.div(m); }
    limit(max) { if (this.mag() > max) { this.normalize(); this.mult(max); } }
    static dist(v1, v2) { return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2); }
    static sub(v1, v2) { return new Vector(v1.x - v2.x, v1.y - v2.y); }
    static random2D() { return new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1); }
}

let mouse = new Vector(0, 0);
let mouseInfluence = false;
const mouseInfluenceRadius = 200;
const clickScatterDuration = 22;
const holdScatterDuration = 45;
const normalMaxSpeed = 5;
const scatterMaxSpeed = 15;
const cooldownDuration = 30;

class Boid {
    constructor() {
        this.position = new Vector(Math.random() * canvas.width, Math.random() * canvas.height);
        this.velocity = Vector.random2D();
        this.velocity.setMag(Math.random() * 2 + 2);
        this.acceleration = new Vector(0, 0);
        this.maxForce = 0.2;
        this.maxSpeed = normalMaxSpeed;
        this.scatterState = 0;
        this.cooldownTimer = 0;
        this.depth = Math.random();
        this.size = 20 + this.depth * 10;
        this.oscillationOffset = Math.random() * Math.PI * 2;
        this.oscillationSpeed = 0.002 + Math.random() * 0.002;
        this.rotation = Math.atan2(this.velocity.y, this.velocity.x);
        this.rotationSpeed = 0.1;
    }

    edges() {
        if (this.position.x > canvas.width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = canvas.height;
    }

    align(boids) {
        let perceptionRadius = 50;
        let steering = new Vector(0, 0);
        let total = 0;
        for (let other of boids) {
            let d = Vector.dist(this.position, other.position);
            if (other != this && d < perceptionRadius) {
                steering.add(other.velocity);
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

    separation(boids) {
        let perceptionRadius = 50;
        let steering = new Vector(0, 0);
        let total = 0;
        for (let other of boids) {
            let d = Vector.dist(this.position, other.position);
            if (other != this && d < perceptionRadius) {
                let diff = Vector.sub(this.position, other.position);
                diff.div(d * d);
                steering.add(diff);
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

    cohesion(boids) {
        let perceptionRadius = 100;
        let steering = new Vector(0, 0);
        let total = 0;
        for (let other of boids) {
            let d = Vector.dist(this.position, other.position);
            if (other != this && d < perceptionRadius) {
                steering.add(other.position);
                total++;
            }
        }
        if (total > 0) {
            steering.div(total);
            steering.sub(this.position);
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
        if (d < mouseInfluenceRadius) {
            let strength = 1 - d / mouseInfluenceRadius;
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
        let alignment = this.align(boids);
        let cohesion = this.cohesion(boids);
        let separation = this.separation(boids);
        let mouseForce = this.mouseAttraction();

        alignment.mult(1.0);
        cohesion.mult(1.0);
        separation.mult(1.5);
        mouseForce.mult(this.scatterState === 1 ? 2.5 : 1.5);

        this.acceleration.add(alignment);
        this.acceleration.add(cohesion);
        this.acceleration.add(separation);
        this.acceleration.add(mouseForce);
    }

    update(boids) {
        this.position.add(this.velocity);
        this.velocity.add(this.acceleration);

        if (this.scatterState === 1) {
            this.cooldownTimer--;
            if (this.cooldownTimer <= 0) {
                this.scatterState = 2;
                this.cooldownTimer = cooldownDuration;
            }
        } else if (this.scatterState === 2) {
            this.cooldownTimer--;
            if (this.cooldownTimer <= 0) {
                this.scatterState = 0;
            }
        }

        if (this.scatterState === 1) {
            this.maxSpeed = scatterMaxSpeed * speedMultiplier;
        } else if (this.scatterState === 2) {
            this.maxSpeed = (normalMaxSpeed + (scatterMaxSpeed - normalMaxSpeed) * (this.cooldownTimer / cooldownDuration)) * speedMultiplier;
        } else {
            this.maxSpeed = normalMaxSpeed * speedMultiplier;
        }

        // Depth-based speed variation
        this.maxSpeed *= (0.5 + this.depth * 0.5);

        this.velocity.limit(this.maxSpeed);
        this.acceleration.mult(0);

        // Update depth based on neighbors
        let nearbyBoids = boids.filter(b => Vector.dist(this.position, b.position) < 50 && b !== this);
        if (nearbyBoids.length > 0) {
            let avgDepth = nearbyBoids.reduce((sum, b) => sum + b.depth, 0) / nearbyBoids.length;
            this.depth = this.depth * 0.99 + avgDepth * 0.01;
            this.depth = Math.max(0, Math.min(1, this.depth));
        }

        let targetRotation = Math.atan2(this.velocity.y, this.velocity.x);
        let rotationDiff = targetRotation - this.rotation;

        // Normalize the rotation difference to be between -PI and PI
        rotationDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));

        // Apply smooth rotation
        this.rotation += rotationDiff * this.rotationSpeed * speedMultiplier;

        // Normalize rotation to be between 0 and 2*PI
        this.rotation = (this.rotation + 2 * Math.PI) % (2 * Math.PI);
    }

    show() {
        let time = performance.now();
        let oscillation = Math.sin(time * this.oscillationSpeed + this.oscillationOffset);
        let size = this.size * (1 + oscillation * 0.1);

        if (this.scatterState === 1) {
            size *= 1.5;
        } else if (this.scatterState === 2) {
            size *= 1 + 0.5 * (this.cooldownTimer / cooldownDuration);
        }

        const lightness = 50 + this.depth * 30; // Lighter as depth increases
        ctx.fillStyle = `hsl(${this.hue}, ${this.saturation}%, ${lightness}%)`;

        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.rotation + Math.PI / 2);
        ctx.drawImage(logoImg, -size / 2, -size / 2, size, size);
        ctx.restore();
    }
}

const flock = [];
const flockSize = 200;

function scatter(duration) {
    flock.forEach(boid => {
        let d = Vector.dist(mouse, boid.position);
        if (d < mouseInfluenceRadius) {
            boid.scatterState = 1;
            boid.cooldownTimer = duration;
        }
    });
}

function animate() {
    ctx.fillStyle = 'rgba(243, 244, 241, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isScattering) {
        scatter(holdScatterDuration);
    }

    flock.sort((a, b) => a.depth - b.depth);

    for (let boid of flock) {
        boid.edges();
        boid.flock(flock);
        boid.update(flock);
        boid.show();
    }

    requestAnimationFrame(animate);
}

function initBoidSimulator() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    for (let i = 0; i < flockSize; i++) {
        flock.push(new Boid());
    }

    animate();

    document.addEventListener('mousemove', (event) => {
        // Get the mouse position relative to the canvas
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
        // Only trigger if the primary mouse button is pressed (usually the left button)
        if (event.button === 0) {
            isScattering = true;
            scatter(clickScatterDuration);
        }
    });

    document.addEventListener('mouseup', (event) => {
        // Only trigger if the primary mouse button is released
        if (event.button === 0) {
            isScattering = false;
        }
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

// Export the initialization function
// window.initBoidSimulator = initBoidSimulator;