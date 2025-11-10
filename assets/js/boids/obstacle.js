import { Vector, vectorPool } from './vector.js';
import {
    OBSTACLE_PADDING,
    OBSTACLE_BOUNCE_FORCE_MULTIPLIER,
    OBSTACLE_DEBUG_COLOR,
    OBSTACLE_DEBUG_FILL_COLOR,
    OBSTACLE_ELEMENT_IDS,
    NORMAL_MAX_SPEED,
    EDGE_BUFFER_POSITIONS,
} from './config.js';

/**
 * Obstacle class - represents a DOM element that boids should avoid
 */
export class Obstacle {
    constructor(elementIdOrElement) {
        this.element = typeof elementIdOrElement === 'string'
            ? document.getElementById(elementIdOrElement)
            : elementIdOrElement;

        this.bounds = null;
        this.paddedBounds = null;
        this.isEnabled = false;
        this.centerX = 0;
        this.centerY = 0;
        this.canvas = null; // Will be set by setObstacleDependencies
        // Don't call update() here - it needs canvas to be set first
    }

    update() {
        if (!this.canvas) return; // Early return if canvas not set yet
        
        if (this.element instanceof HTMLElement && typeof this.element.getBoundingClientRect === 'function') {
            const rect = this.element.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(this.element);

            if (rect.width > 0 && rect.height > 0 &&
                computedStyle.display !== 'none' &&
                computedStyle.visibility !== 'hidden' &&
                this.element.offsetParent !== null) {

                this.bounds = rect;
                const canvasRect = this.canvas.getBoundingClientRect();

                this.paddedBounds = {
                    left: rect.left - canvasRect.left - OBSTACLE_PADDING,
                    top: rect.top - canvasRect.top - OBSTACLE_PADDING,
                    right: rect.right - canvasRect.left + OBSTACLE_PADDING,
                    bottom: rect.bottom - canvasRect.top + OBSTACLE_PADDING,
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

    drawDebug(ctx) {
        if (!this.isEnabled || !this.paddedBounds) return;

        ctx.save();
        ctx.strokeStyle = OBSTACLE_DEBUG_COLOR;
        ctx.fillStyle = OBSTACLE_DEBUG_FILL_COLOR;
        ctx.lineWidth = 2;

        const pb = this.paddedBounds;
        ctx.fillRect(pb.left, pb.top, pb.width, pb.height);
        ctx.strokeRect(pb.left, pb.top, pb.width, pb.height);

        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = OBSTACLE_DEBUG_COLOR;
        ctx.fill();
        ctx.restore();
    }
}

// Module-level dependencies
let canvas = null;
let simParams = null;

/**
 * Sets the dependencies needed by the obstacle system
 */
export function setObstacleDependencies(deps) {
    canvas = deps.canvas;
    simParams = deps.simParams;
    
    // Set canvas reference for all existing obstacles
    if (deps.obstacles) {
        for (const obstacle of deps.obstacles) {
            obstacle.canvas = canvas;
        }
    }
}

/**
 * Initializes obstacles from the configured element IDs
 */
export function initializeObstacles() {
    const obstacles = OBSTACLE_ELEMENT_IDS.map(id => new Obstacle(id));
    return obstacles;
}

/**
 * Updates all obstacles' bounds and positions
 */
export function updateAllObstacles(obstacles) {
    for (const obstacle of obstacles) {
        obstacle.update();
    }
}

/**
 * Applies obstacle avoidance forces using an obstacle-centric approach.
 * For each obstacle, it finds all boids within its influence radius and calculates
 * the necessary avoidance force, applying it directly to the boid's desiredVelocity.
 */
export function applyObstacleAvoidanceForces(obstacles, spatialGrid, timeScale) {
    if (!canvas || !simParams) {
        console.error('Obstacle dependencies not set. Call setObstacleDependencies first.');
        return;
    }

    // --- Reusable temporary vectors for all calculations in this function ---
    const effectiveObsCenter = vectorPool.get(0, 0);
    const repulsionDirTemp = vectorPool.get(0, 0);
    const boidToEffectiveCenterTemp = vectorPool.get(0, 0);
    const closestPointOnEffectiveObstacleTemp = vectorPool.get(0, 0);
    const boidToClosestPointTemp = vectorPool.get(0, 0);
    const desiredSteerAwayTemp = vectorPool.get(0, 0);
    const currentToroidalForce = vectorPool.get(0, 0); // Holds the force for one toroidal image

    // --- 1. For each Obstacle -> ... ---
    for (const obstacle of obstacles) {
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
