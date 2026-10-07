import { heroField } from './hero-field.js';
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
    TRAIL_FADE_ALPHA,
    TRAIL_CELL_SIZE,
    TRAIL_SPENT_FADE,
} from './config.js';

/**
 * Remembers which parts of the canvas boids have painted into, so the trail fade
 * can be finished off with an outright clear.
 *
 * `destination-out` scales alpha down rather than subtracting from it, and in an
 * 8-bit buffer that scaling has a fixed point above zero: an alpha of 1/255 times
 * 0.75 rounds straight back to 1/255, every frame, forever. So every pixel the
 * flock has ever crossed keeps a last 1/255 of boid colour — which is what stained
 * the page background wherever the boids had been, while the halos around
 * obstacles that boids never enter stayed clean. A float16 buffer has no such
 * fixed point (see initializeDOMReferences), but only Chromium grants one.
 *
 * The fix doesn't depend on the buffer: note how far the fade had progressed when
 * each cell was last painted into, and clear the cell outright once TRAIL_SPENT_FADE
 * more fade has gone by. At that point the trail there is below half a step of
 * 8-bit alpha, so the clear can only take away what is already rounding error —
 * which is exactly the stain.
 */
class TrailRegionTracker {
    constructor(cellSize) {
        this.cellSize = cellSize;
        this.width = 0;
        this.height = 0;
        this.cols = 0;
        this.rows = 0;
        // Total fade applied so far, as a sum of per-frame -ln(1 - fade), against
        // which each cell records the reading at its last painting.
        this.fadeTotal = 0;
        this.paintedAt = new Float64Array(0);
        this.hasInk = new Uint8Array(0);
    }

    /**
     * Rebuilds the grid when the canvas dimensions change. Assigning canvas.width
     * wipes the canvas, so the fresh cells correctly start out with no ink.
     */
    matchCanvas(width, height) {
        if (width === this.width && height === this.height) return;

        this.width = width;
        this.height = height;
        this.cols = Math.max(1, Math.ceil(width / this.cellSize));
        this.rows = Math.max(1, Math.ceil(height / this.cellSize));
        this.paintedAt = new Float64Array(this.cols * this.rows);
        this.hasInk = new Uint8Array(this.cols * this.rows);
    }

    /**
     * Records a frame's worth of fade. Called once the fade has been composited,
     * so a boid painting later in the same frame is correctly unaffected by it.
     */
    advance(fade) {
        this.fadeTotal += -Math.log(1 - fade);
    }

    /**
     * Records that a boid painted a box of `halfExtent` either side of (x, y).
     * Boids near an edge are drawn wrapped to the opposite side, so the marked
     * cell range wraps with them.
     */
    markPainted(x, y, halfExtent) {
        if (!this.cols) return;

        const { cellSize, cols, rows } = this;
        const firstCol = Math.floor((x - halfExtent) / cellSize);
        const firstRow = Math.floor((y - halfExtent) / cellSize);
        const colSpan = Math.min(cols, Math.floor((x + halfExtent) / cellSize) - firstCol + 1);
        const rowSpan = Math.min(rows, Math.floor((y + halfExtent) / cellSize) - firstRow + 1);

        for (let row = 0; row < rowSpan; row++) {
            const wrappedRow = ((firstRow + row) % rows + rows) % rows;
            for (let col = 0; col < colSpan; col++) {
                const wrappedCol = ((firstCol + col) % cols + cols) % cols;
                const index = wrappedRow * cols + wrappedCol;
                this.paintedAt[index] = this.fadeTotal;
                this.hasInk[index] = 1;
            }
        }
    }

    /**
     * Clears every cell whose trail has decayed to residue. Adjacent stale cells
     * in a row are cleared as a single rect, so a flock leaving a region en masse
     * costs a handful of calls rather than one per cell.
     */
    sweep(ctx) {
        const { cellSize, cols, rows, hasInk, paintedAt } = this;
        const cutoff = this.fadeTotal - TRAIL_SPENT_FADE;

        for (let row = 0; row < rows; row++) {
            const rowOffset = row * cols;
            let runStart = -1;

            // One past the last column, so a run reaching the edge still closes.
            for (let col = 0; col <= cols; col++) {
                const index = rowOffset + col;
                const isStale = col < cols && hasInk[index] === 1 && paintedAt[index] <= cutoff;

                if (isStale) {
                    hasInk[index] = 0;
                    if (runStart === -1) runStart = col;
                } else if (runStart !== -1) {
                    ctx.clearRect(runStart * cellSize, row * cellSize, (col - runStart) * cellSize, cellSize);
                    runStart = -1;
                }
            }
        }
    }

    /**
     * Forgets all ink. For use when the whole canvas has been cleared elsewhere.
     */
    reset() {
        this.hasInk.fill(0);
    }
}

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.trailTracker = new TrailRegionTracker(TRAIL_CELL_SIZE);
        // Whether the float16 buffer was actually granted (see initializeDOMReferences).
        // Anything unreported is treated as the 8-bit fallback, which is the safe
        // assumption for the trail fade below.
        this.hasFloatBuffer = ctx.getContextAttributes?.().colorType === 'float16';
        this.drawOrder = [];
        // The disk gets two crisp surfaces around the pig. Free boids keep
        // using their original canvas and trails behind the page.
        const pigCanvas = document.getElementById('pigCanvas');
        if (pigCanvas) {
            this.frontCanvas = document.createElement('canvas');
            this.frontCanvas.id = 'boidFrontCanvas';
            this.frontCanvas.setAttribute('aria-hidden', 'true');
            this.frontCanvas.style.display = 'none';
            this.frontCtx = this.frontCanvas.getContext('2d', { colorType: 'float16' });
            if (this.frontCtx) {
                this.orbitBackCanvas = document.createElement('canvas');
                this.orbitBackCanvas.id = 'boidOrbitBackCanvas';
                this.orbitBackCanvas.setAttribute('aria-hidden', 'true');
                this.orbitBackCanvas.style.display = 'none';
                this.orbitBackCtx = this.orbitBackCanvas.getContext('2d');
                pigCanvas.before(this.orbitBackCanvas);
                pigCanvas.after(this.frontCanvas);
            }
        }
    }

    /**
     * Fades the previous frame out so trails decay.
     *
     * This only erases alpha (`destination-out`) rather than painting the
     * background colour over the canvas: repeatedly compositing a translucent
     * colour onto itself converges on a slightly darker value than the source,
     * which made the page background visibly shift once the simulation started.
     * Erasing alpha leaves the background to show through the canvas untouched.
     *
     * The fade is the same in both colour schemes — see TRAIL_FADE_ALPHA.
     *
     * TRAIL_FADE_ALPHA is the erase per frame at TARGET_FPS; compounding it over
     * timeScale frames keeps trails the same length in wall-clock time whatever
     * the display refresh rate, instead of running twice as long at 60Hz.
     *
     * Above TARGET_FPS that compounding means erasing *less* per frame (0.134 at
     * 240Hz), and on an 8-bit buffer a smaller per-frame alpha settles on a larger
     * residue — 3/255 rather than 1/255. The sweep takes either away, but only once
     * the trail is spent, so the exponent is floored at 1 without a float16 buffer
     * to keep the residue waiting to be swept as faint as it can be.
     *
     * The sweep runs straight after the fade, before anything is drawn on top.
     */
    drawBackground(timeScale = 1) {
        this.fadeSurface(this.canvas, this.ctx, this.trailTracker, timeScale, this.hasFloatBuffer);
        if (this.frontCtx && this.orbitBackCtx) {
            for (const [canvas, ctx] of [[this.frontCanvas, this.frontCtx], [this.orbitBackCanvas, this.orbitBackCtx]]) {
                if (canvas.width !== this.canvas.width) canvas.width = this.canvas.width;
                if (canvas.height !== this.canvas.height) canvas.height = this.canvas.height;
                canvas.style.display = heroField.available ? 'block' : 'none';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }

    fadeSurface(canvas, ctx, tracker, timeScale, hasFloatBuffer) {
        tracker.matchCanvas(canvas.width, canvas.height);

        const exponent = hasFloatBuffer ? timeScale : Math.max(1, timeScale);
        const fade = 1 - Math.pow(1 - TRAIL_FADE_ALPHA, exponent);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        tracker.advance(fade);
        tracker.sweep(ctx);
    }

    drawFlock(flock, currentTime) {
        if (!heroField.available) {
            for (const boid of flock) boid.draw(currentTime);
            return;
        }
        this.drawOrder.length = 0;
        for (const boid of flock) this.drawOrder.push(boid);
        this.drawOrder.sort((a, b) => (a.orbit?.point.depth ?? 0) - (b.orbit?.point.depth ?? 0));
        for (const boid of this.drawOrder) boid.draw(currentTime);
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
    renderExitAnimation(flock, currentTime, endStartTime, timeScale = 1) {
        const endProgress = Math.min(1, (currentTime - endStartTime) / END_ANIMATION_DURATION);
        // The convergence is a per-frame lerp; compound it so the flock reaches the
        // easter egg at the same moment the time-based progress does, on any display.
        const converge = 1 - Math.pow(0.9, timeScale);
        const targetX = heroField.available ? heroField.x : this.canvas.width - EASTER_EGG_RIGHT - EASTER_EGG_WIDTH / 2;
        const targetY = heroField.available ? heroField.y : this.canvas.height + EASTER_EGG_BOTTOM - EASTER_EGG_HEIGHT / 2 - 10;
        const targetPosForEnding = vectorPool.get(targetX, targetY);

        if (this.homecomingStart !== endStartTime) {
            this.homecomingStart = endStartTime;
            this.homecomingOrigins = new WeakMap();
        }
        const homecoming = heroField.available;
        const gather = endProgress * endProgress * (3 - 2 * endProgress);
        const curl = Math.sin(endProgress * Math.PI) * 0.7;
        const cos = Math.cos(curl);
        const sin = Math.sin(curl);

        for (let boid of flock) {
            if (homecoming) {
                // Use elapsed time rather than exponential pursuit, so the
                // return remains visible for the full second as the head grows.
                let origin = this.homecomingOrigins.get(boid);
                if (!origin) {
                    origin = { x: boid.position.x - targetX, y: boid.position.y - targetY };
                    this.homecomingOrigins.set(boid, origin);
                }
                boid.position.x = targetX + (origin.x * cos - origin.y * sin) * (1 - gather);
                boid.position.y = targetY + (origin.x * sin + origin.y * cos) * (1 - gather);
            } else {
                boid.position.x += (targetPosForEnding.x - boid.position.x) * converge;
                boid.position.y += (targetPosForEnding.y - boid.position.y) * converge;
            }

            // Shrink boids as they approach the end
            boid.size = (BOID_SIZE_BASE + boid.depth * BOID_SIZE_VARIATION) * (1 - endProgress);
            if (endProgress > 0.95 && Vector.dist(boid.position, targetPosForEnding) < 5) {
                boid.position.x = targetPosForEnding.x;
                boid.position.y = targetPosForEnding.y;
            }
            boid.renderSize = boid.calculateRenderSize();
            boid.orbit = null;
        }
        this.drawFlock(flock, currentTime);
        vectorPool.release(targetPosForEnding);

        return endProgress;
    }

    /**
     * Clears the entire canvas.
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.trailTracker.reset();
        this.drawOrder.length = 0;
        if (this.frontCtx) {
            this.frontCtx.clearRect(0, 0, this.frontCanvas.width, this.frontCanvas.height);
            this.frontCanvas.style.display = 'none';
            if (this.orbitBackCtx) {
                this.orbitBackCtx.clearRect(0, 0, this.orbitBackCanvas.width, this.orbitBackCanvas.height);
                this.orbitBackCanvas.style.display = 'none';
            }
        }
    }
}
