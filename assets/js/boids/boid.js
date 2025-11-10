// boid.js - Individual boid behavior and rendering

import { Vector, vectorPool } from './vector.js';
import {
    BOID_MAX_FORCE,
    BOID_SIZE_BASE,
    BOID_SIZE_VARIATION,
    BOID_OSCILLATION_SPEED_BASE,
    BOID_OSCILLATION_SPEED_VARIATION,
    BOID_ROTATION_SPEED,
    BOID_DYING_DURATION,
    NORMAL_MAX_SPEED,
    SCATTER_MAX_SPEED,
    INITIAL_BOOST,
    BOOST_DECAY,
    COOLDOWN_DURATION,
    MOUSE_INFLUENCE_RADIUS,
    MOUSE_FORCE_NORMAL,
    MOUSE_FORCE_SCATTER,
    DEPTH_INFLUENCE_RADIUS,
    EASTER_EGG_WIDTH,
    EASTER_EGG_HEIGHT,
    EASTER_EGG_RIGHT,
    EASTER_EGG_BOTTOM,
    SPREAD_FACTOR,
    EDGE_BUFFER_POSITIONS
} from './config.js';

// Module-level variables that the Boid class needs access to
// These will be injected via setBoidDependencies()
let canvas = null;
let ctx = null;
let simParams = null;
let speedMultiplier = 1;
let mouseInfluence = false;
let boidsIgnoreMouse = false;
let mouse = null;
let boidImageBitmap = null;

/**
 * Injects external dependencies that boids need to function.
 * Must be called before creating any boids.
 */
export function setBoidDependencies(dependencies) {
    canvas = dependencies.canvas;
    ctx = dependencies.ctx;
    simParams = dependencies.simParams;
    mouse = dependencies.mouse;
    boidImageBitmap = dependencies.boidImageBitmap;
}

/**
 * Updates runtime values that change during simulation.
 * Call this each frame or when these values change.
 */
export function updateBoidRuntimeValues(values) {
    speedMultiplier = values.speedMultiplier;
    mouseInfluence = values.mouseInfluence;
    boidsIgnoreMouse = values.boidsIgnoreMouse;
}

let nextBoidId = 0;

export class Boid {
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
