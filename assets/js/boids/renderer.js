import { Vector, vectorPool, toroidalDistance } from './vector.js';
import { drawGridVisualization, drawNeighborhoodVisualization } from './spatial-grid.js';
import {
    BOID_SIZE_BASE,
    BOID_SIZE_VARIATION,
    EASTER_EGG_WIDTH,
    EASTER_EGG_HEIGHT,
    EASTER_EGG_RIGHT,
    EASTER_EGG_BOTTOM,
    END_ANIMATION_DURATION,
} from './config.js';

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    /**
     * Clears the canvas and draws the background with fade effect.
     */
    drawBackground() {
        // Check if dark reader extension is active
        if (typeof isDarkReaderActive === 'function' && isDarkReaderActive()) {
            this.ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
        } else {
            this.ctx.fillStyle = 'rgba(243, 244, 241, 0.25)';
        }
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Draws debug visualizations for obstacles.
     */
    drawObstaclesDebug(obstacles) {
        for (const obstacle of obstacles) {
            obstacle.drawDebug(this.ctx);
        }
    }

    /**
     * Draws the spatial grid visualization for debugging.
     */
    drawGridDebug(spatialGrid) {
        drawGridVisualization(spatialGrid, this.ctx, this.canvas);
    }

    /**
     * Draws the neighborhood visualization for a selected boid.
     */
    drawNeighborhoodDebug(selectedBoid, spatialGrid, cellSize) {
        if (selectedBoid) {
            drawNeighborhoodVisualization(selectedBoid, spatialGrid, this.ctx, cellSize);
        }
    }

    /**
     * Draws lines between nearby boids based on their distance.
     * The line opacity fades from full at minDist to zero at maxDist.
     */
    drawBoidConnections(flock, spatialGrid) {
        const minDist = 10;
        const maxDist = 150;
        const range = maxDist - minDist;
        const halfWidth = this.canvas.width / 2;
        const halfHeight = this.canvas.height / 2;

        // Use a Set to ensure each pair is drawn only once per frame.
        const drawnPairs = new Set();

        this.ctx.lineWidth = 0.5;
        this.ctx.strokeStyle = 'rgba(125, 125, 125, 1)';

        for (const boid of flock) {
            if (boid.isDying) continue;

            const localNeighbors = spatialGrid.getItemsInNeighborhood(boid.position);

            for (const other of localNeighbors) {
                if (boid === other || other.isDying) continue;

                const pairKey = boid.id < other.id ? `${boid.id}-${other.id}` : `${other.id}-${boid.id}`;
                if (drawnPairs.has(pairKey)) {
                    continue;
                }

                const { dx, dy, distSq } = toroidalDistance(
                    boid.position.x, boid.position.y,
                    other.position.x, other.position.y,
                    this.canvas.width, this.canvas.height
                );

                const dist = Math.sqrt(distSq);

                if (dist < maxDist) {
                    const opacity = 1 - Math.max(0, Math.min(1, (dist - minDist) / range));
                    if (opacity > 0.001) {
                        const drawX = boid.position.x - dx;
                        const drawY = boid.position.y - dy;

                        this.ctx.globalAlpha = opacity;
                        this.ctx.beginPath();
                        this.ctx.moveTo(boid.position.x, boid.position.y);
                        this.ctx.lineTo(drawX, drawY);
                        this.ctx.stroke();
                    }
                }
                drawnPairs.add(pairKey);
            }
        }
        this.ctx.globalAlpha = 1.0;
    }

    /**
     * Renders the exit animation where all boids converge to a point and shrink.
     */
    renderExitAnimation(flock, currentTime, endStartTime) {
        const endProgress = Math.min(1, (currentTime - endStartTime) / END_ANIMATION_DURATION);
        const targetX = this.canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
        const targetY = this.canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;
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

        return endProgress;
    }

    /**
     * Renders all boids in their normal state (non-exit animation).
     */
    renderBoids(flock, currentTime) {
        for (let boid of flock) {
            boid.applyForcesAndMove();
            boid.renderSize = boid.calculateRenderSize();
            boid.draw(currentTime);
        }
    }

    /**
     * Clears the entire canvas.
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
