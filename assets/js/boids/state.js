import { vectorPool } from './vector.js';
import { DEFAULT_SIM_PARAMS, DEPTH_INFLUENCE_RADIUS } from './config.js';

/**
 * SimulationState
 * 
 * Centralized state container for the boid simulation.
 * Uses public properties for simple state and methods only where
 * validation or side-effects are needed.
 */
export class SimulationState {
    constructor() {
        // Simulation Parameters
        this.simParams = { ...DEFAULT_SIM_PARAMS };
        this.userHasSetFlockSize = false;

        // System Objects
        this.flock = null;
        this.renderer = null;
        this.inputHandler = null;
        this.spatialGrid = null;
        this.allObstacles = [];
        this.boidImageBitmap = null;

        // UI References
        this.canvas = null;
        this.ctx = null;
        this.speedSlider = null;
        this.speedControls = null;
        this.speedValue = null;
        this.godModeButton = null;

        // Animation State
        this.speedMultiplier = 1;
        this.animationFrameId = null;
        this.lastFrameTime = 0;
        this.isEnding = false;
        this.endStartTime = 0;
        this.isSystemInitialized = false;

        // Debug State
        this.godMode = false;
        this.debugObstaclesMode = false;
        this.debugGridMode = false;
        this.debugLinesMode = false;
        this.debugSelectedBoid = null;

        // User Interaction
        this.mouse = vectorPool.get(0, 0);
    }

    // Methods with logic/validation/side-effects only

    setUIReferences({ canvas, ctx, speedSlider, speedControls, speedValue, godModeButton }) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.speedSlider = speedSlider;
        this.speedControls = speedControls;
        this.speedValue = speedValue;
        this.godModeButton = godModeButton;
    }

    updateSimParam(key, value) {
        if (!this.simParams.hasOwnProperty(key)) {
            console.warn(`Attempted to update non-existent param: ${key}`);
            return false;
        }
        this.simParams[key] = value;
        if (key === 'FLOCK_SIZE') this.userHasSetFlockSize = true;
        return true;
    }

    resetSimParams() {
        Object.assign(this.simParams, DEFAULT_SIM_PARAMS);
        this.userHasSetFlockSize = false;
    }

    calculateCurrentCellSize() {
        return Math.max(
            this.simParams.ALIGNMENT_RADIUS,
            this.simParams.SEPARATION_RADIUS,
            this.simParams.COHESION_RADIUS,
            DEPTH_INFLUENCE_RADIUS,
            this.simParams.OBSTACLE_RADIUS
        );
    }

    isRunning() {
        return this.animationFrameId !== null;
    }

    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    updateDebugFlag(flag, enabled) {
        if (flag === 'grid') {
            this.debugGridMode = enabled;
            if (!enabled) this.debugSelectedBoid = null;
        } else if (flag === 'obstacles') {
            this.debugObstaclesMode = enabled;
        } else if (flag === 'lines') {
            this.debugLinesMode = enabled;
        }
    }

    getDebugFlags() {
        return {
            grid: this.debugGridMode,
            obstacles: this.debugObstaclesMode,
            lines: this.debugLinesMode
        };
    }

    resetToDefaults() {
        this.resetSimParams();
        this.godMode = false;
        this.debugObstaclesMode = false;
        this.debugGridMode = false;
        this.debugLinesMode = false;
        this.debugSelectedBoid = null;
        this.isEnding = false;
        this.lastFrameTime = 0;

        if (this.inputHandler) {
            this.inputHandler.isScattering = false;
            this.inputHandler.mouseInfluence = false;
        }
    }
}
