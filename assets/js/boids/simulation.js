import { SimulationState } from './state.js';
import { SimulationLoop } from './simulation-loop.js';
import { initializeSystem, setupAppLifecycleListeners, resetSimulationParameters } from './initialization.js';
import { updateSpatialGridParameters } from './spatial-grid.js';
import { dispatchEvent } from './ui-utils.js';

/**
 * Simulation Orchestrator
 * 
 * This module serves as the main entry point and public API for the boid simulation.
 * It coordinates initialization, lifecycle management, and the animation loop.
 * 
 * Responsibilities:
 * - State management and initialization
 * - Public API for starting/stopping simulation
 * - Coordination between SimulationLoop and lifecycle functions
 */

// Centralized state container
const state = new SimulationState();

// Animation loop controller (created early, but doesn't access DOM)
const loop = new SimulationLoop(state);

/**
 * Starts the boid simulation.
 * Performs lazy initialization on first run, then creates flock and starts animation loop.
 */
async function startSimulation() {
    // Lazy initialization (handles DOM + system setup)
    if (!state.isSystemInitialized) {
        await initializeSystem(state);
    }
    if (!state.isSystemInitialized) {
        console.error("Cannot run simulation; system initialization failed.");
        return;
    }

    // Check if already running
    if (state.isRunning()) {
        console.warn("Simulation is already running. Call stopSimulation() first.");
        return;
    }

    // Prepare systems and create flock
    updateSpatialGridParameters(state.spatialGrid, state.canvas, () => state.calculateCurrentCellSize());
    state.flock.initialize(!state.userHasSetFlockSize);

    // Start animation loop
    state.startRun();
    loop.start();
}

/**
 * Stops the simulation and cleans up all state.
 */
function stopSimulation() {
    loop.stop();
    state.clearSimulation();
    resetSimulationParameters(state);

    // Notify listeners that simulation stopped
    dispatchEvent('simulationStopped');
}

/**
 * Starts the exit animation sequence.
 */
function startExitAnimation() {
    state.beginExitAnimation();

    // Notify listeners that exit animation started
    dispatchEvent('exitAnimationStarted');
}

// Expose public API to global scope
window.startSimulation = startSimulation;
window.stopSimulation = stopSimulation;
window.startExitAnimation = startExitAnimation;

// Setup application lifecycle listeners
setupAppLifecycleListeners(state, startSimulation, stopSimulation);

