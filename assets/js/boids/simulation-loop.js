import { updateBoidRuntimeValues } from './boid.js';
import { updateMenuValues } from './settings.js';
import { applyObstacleAvoidanceForces } from './obstacle.js';
import { TARGET_FPS } from './config.js';

/**
 * Encapsulates the simulation animation loop and frame-by-frame updates.
 * Handles timing, rendering, physics, and exit animations.
 */
export class SimulationLoop {
    constructor(state) {
        this.state = state;
        this.animate = this.animate.bind(this);
    }

    /**
     * Starts the animation loop
     */
    start() {
        this.animate();
    }

    /**
     * Stops the animation loop
     */
    stop() {
        this.state.stopAnimation();
    }

    /**
     * Main animation loop - orchestrates all frame updates
     */
    animate() {
        const currentTime = performance.now();
        const timeScale = this.updateFrameTiming(currentTime);
        this.updateSpeedMultiplier(timeScale);
        this.renderFrame(currentTime);

        if (this.updateExitAnimation(currentTime)) {
            return; // Exit animation complete
        }

        this.updateSimulationState();
        this.updatePhysics(timeScale, currentTime);

        this.state.animationFrameId = requestAnimationFrame(this.animate);
    }

    /**
     * Calculates frame timing and returns timeScale for frame-rate independence
     */
    updateFrameTiming(currentTime) {
        if (!this.state.lastFrameTime) {
            this.state.lastFrameTime = currentTime;
        }
        const deltaTime = currentTime - this.state.lastFrameTime;
        this.state.lastFrameTime = currentTime;

        // timeScale is our adjustment factor. At 60fps, it will be ~2.0. At 120fps, it will be ~1.0.
        return (deltaTime / 1000) * TARGET_FPS;
    }

    /**
     * Updates speed multiplier based on slider and applies to boids
     */
    updateSpeedMultiplier(timeScale) {
        const { speedSlider, inputHandler } = this.state;
        const sliderValue = parseFloat(speedSlider.value) / 100;
        this.state.speedMultiplier = sliderValue * timeScale;

        updateBoidRuntimeValues({
            speedMultiplier: this.state.speedMultiplier,
            mouseInfluence: inputHandler.mouseInfluence,
            boidsIgnoreMouse: inputHandler.boidsIgnoreMouse
        });
    }

    /**
     * Renders the current frame including background, debug visualizations, and cleanup
     */
    renderFrame(currentTime) {
        const { renderer, debugObstaclesMode, allObstacles, debugGridMode, spatialGrid,
            debugSelectedBoid, inputHandler, flock } = this.state;

        renderer.drawBackground();

        if (debugObstaclesMode) {
            renderer.drawObstaclesDebug(allObstacles);
        }
        if (debugGridMode) {
            renderer.drawGridDebug(spatialGrid);
        }
        if (debugSelectedBoid) {
            renderer.drawNeighborhoodDebug(debugSelectedBoid, spatialGrid, this.state.calculateCurrentCellSize());
        }

        if (inputHandler.isScattering) {
            inputHandler.scatter();
        }

        flock.cleanup(currentTime);
    }

    /**
     * Updates simulation state: flock size management and spatial grid population
     */
    updateSimulationState() {
        const { flock, spatialGrid, userHasSetFlockSize, isEnding } = this.state;

        if (!userHasSetFlockSize && !isEnding) {
            flock.updateResponsiveSize(updateMenuValues);
        }

        if (!isEnding) {
            flock.adjustToTargetSize();
        }

        spatialGrid.clear();
        for (let boid of flock) {
            if (!boid.isDying) {
                spatialGrid.addItemAtPoint(boid);
            }
        }
    }

    /**
     * Updates physics: force calculations, obstacle avoidance, movement, and drawing
     */
    updatePhysics(timeScale, currentTime) {
        const { flock, spatialGrid, allObstacles, debugLinesMode, renderer } = this.state;

        for (let boid of flock) {
            if (boid.isDying) continue;
            const localNeighbors = spatialGrid.getItemsInNeighborhood(boid.position);
            boid.calculateBoidAndMouseForces(localNeighbors, timeScale);
        }

        applyObstacleAvoidanceForces(allObstacles, spatialGrid, timeScale);

        if (debugLinesMode) {
            renderer.drawBoidConnections(flock, spatialGrid);
        }

        for (let boid of flock) {
            boid.applyForcesAndMove(timeScale);
            boid.renderSize = boid.calculateRenderSize();
            boid.draw(currentTime);
        }
    }

    /**
     * Handles exit animation rendering and completion detection
     * @returns {boolean} true if exit animation is complete
     */
    updateExitAnimation(currentTime) {
        const { isEnding, flock, endStartTime, renderer } = this.state;

        if (!isEnding) return false;

        const endProgress = renderer.renderExitAnimation(flock, currentTime, endStartTime);
        return endProgress >= 1;
    }
}
