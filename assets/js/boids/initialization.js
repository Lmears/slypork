import { setBoidDependencies } from './boid.js';
import { initializeMenu, setMenuVisibility, updateMenuValues, updateDebugCheckboxes } from './settings.js';
import { setControlPanelVisibility, rafThrottle, dispatchEvent } from './ui-utils.js';
import { setObstacleDependencies, initializeObstacles, updateAllObstacles } from './obstacle.js';
import { SpatialGrid, updateSpatialGridParameters } from './spatial-grid.js';
import { Flock } from './flock.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input-handler.js';

/**
 * Initializes DOM references. Must be called after DOM is ready.
 * @param {SimulationState} state - The state object to populate
 * @returns {boolean} true if all required elements were found, false otherwise
 */
function initializeDOMReferences(state) {
    const canvas = document.getElementById('boidCanvas');
    if (!canvas) {
        console.error("Failed to initialize: Canvas element #boidCanvas not found.");
        return false;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Failed to initialize: Could not get 2D context from canvas.");
        return false;
    }

    const speedSlider = document.getElementById('speedSlider');
    const speedControls = document.getElementById('controls');
    const speedValue = document.getElementById('speedValue');
    const godModeButton = document.getElementById('godModeButton');

    if (!speedSlider || !speedControls || !speedValue || !godModeButton) {
        console.error("Failed to initialize: Missing required UI elements.");
        return false;
    }

    state.setUIReferences({
        canvas,
        ctx,
        speedSlider,
        speedControls,
        speedValue,
        godModeButton
    });

    return true;
}

/**
 * Performs one-time setup for the entire boid system
 */
export async function initializeSystem(state) {
    if (state.isSystemInitialized) return;

    // Ensure DOM references are initialized first
    if (!state.canvas && !initializeDOMReferences(state)) {
        console.error("System initialization failed: Could not initialize DOM references.");
        return;
    }

    try {
        await loadAndPrepareImage(state);
        initializeCanvas(state);
        initializeSimulationSystems(state);
        initializeDependencyInjection(state);
        initializeUI(state);

        state.isSystemInitialized = true;
        console.log("Boid system initialized.");
    } catch (error) {
        console.error("System initialization failed:", error);
    }
}

/**
 * Initializes canvas dimensions
 */
function initializeCanvas(state) {
    const { canvas } = state;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

/**
 * Creates and initializes all simulation systems
 */
function initializeSimulationSystems(state) {
    const { canvas, ctx, simParams } = state;

    state.spatialGrid = new SpatialGrid(canvas.width, canvas.height, state.calculateCurrentCellSize());
    state.allObstacles = initializeObstacles();
    state.flock = new Flock(simParams, canvas, state.spatialGrid);
    state.renderer = new Renderer(canvas, ctx);
    state.inputHandler = createInputHandler(state);
}

/**
 * Creates InputHandler with all dependencies
 */
function createInputHandler(state) {
    const { canvas, mouse, flock, spatialGrid, speedSlider, speedControls, speedValue,
        godModeButton, allObstacles } = state;
    const throttledScrollUpdater = rafThrottle(() => updateAllObstacles(allObstacles));

    return new InputHandler(canvas, {
        mouse,
        flock,
        spatialGrid,
        speedSlider,
        speedControls,
        speedValue,
        godModeButton,
        scrollUpdater: throttledScrollUpdater,
        isEnding: () => state.isEnding,
        isRunning: () => state.isRunning(),
        userHasSetFlockSize: () => state.userHasSetFlockSize,
        godMode: () => state.godMode,
        debugGridMode: () => state.debugGridMode,
        updateAllObstacles: () => updateAllObstacles(allObstacles),
        updateMenuValues,
        setSpeedMultiplier: (value) => { state.speedMultiplier = value; },
        setDebugSelectedBoid: (boid) => { state.debugSelectedBoid = boid; }
    });
}

/**
 * Initializes dependency injection for boids and obstacles
 */
function initializeDependencyInjection(state) {
    const { canvas, ctx, mouse, simParams, allObstacles, boidImageBitmap } = state;

    setObstacleDependencies({ canvas, simParams, obstacles: allObstacles });
    setBoidDependencies({ canvas, ctx, simParams, mouse, boidImageBitmap });

    updateAllObstacles(allObstacles);
}

/**
 * Initializes UI components and event listeners
 */
function initializeUI(state) {
    const { simParams, inputHandler } = state;
    initializeMenu(simParams, state.getDebugFlags());
    setupMenuEventListeners(state);
    inputHandler.setupEventListeners();
    closeNavMenu();
}

/**
 * Loads and prepares the boid image as ImageBitmap
 */
async function loadAndPrepareImage(state) {
    const response = await fetch('../assets/images/boid-logo.webp');
    if (!response.ok) {
        throw new Error('Failed to fetch boid image');
    }
    const imageBlob = await response.blob();

    state.boidImageBitmap = await createImageBitmap(imageBlob, {
        resizeWidth: 64,
        resizeHeight: 64,
        resizeQuality: 'high'
    });
}

/**
 * Sets up application lifecycle listeners for page navigation
 */
export function setupAppLifecycleListeners(state, startSimulation, stopSimulation) {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            const { inputHandler } = state;

            if (inputHandler) {
                inputHandler.mouseInfluence = false;
            }

            state.godMode = false;
            setMenuVisibility(false, { animated: false });

            if (typeof window.resetEasterEggState === 'function') {
                window.resetEasterEggState();
            }

            dispatchEvent('godModeToggled', { enabled: false });

            const pageMode = document.body.dataset.pageMode;

            if (pageMode !== 'permanent-sim') {
                stopSimulation();
                setControlPanelVisibility(false, { animated: false });

                const boidCanvas = document.getElementById('boidCanvas');
                if (boidCanvas) {
                    boidCanvas.style.transition = 'none';
                    boidCanvas.style.opacity = '0';
                    boidCanvas.style.display = 'none';
                    setTimeout(() => boidCanvas.style.transition = '', 20);
                }
            } else {
                if (!state.isRunning()) {
                    startSimulation();
                }
            }
        }
    });
}

/**
 * Sets up menu-related event listeners (god mode, param changes, etc.)
 */
function setupMenuEventListeners(state) {
    document.body.addEventListener('godModeToggled', (e) => {
        state.godMode = e.detail.enabled;
        setMenuVisibility(state.godMode);
        console.log("God Mode:", state.godMode);
    });

    document.body.addEventListener('paramChanged', (e) => {
        const { key, value } = e.detail;
        const wasUpdated = state.updateSimParam(key, value);
        if (wasUpdated && key.includes('RADIUS')) {
            updateSpatialGridParameters(state.spatialGrid, state.canvas, () => state.calculateCurrentCellSize());
        }
    });

    document.body.addEventListener('debugFlagChanged', (e) => {
        const { flag, enabled } = e.detail;
        state.updateDebugFlag(flag, enabled);
    });

    document.body.addEventListener('paramsReset', () => resetSimulationParameters(state));

    document.body.addEventListener('simulationStopped', () => {
        setMenuVisibility(false);
    });

    document.body.addEventListener('exitAnimationStarted', () => {
        setMenuVisibility(false);
    });

    document.body.addEventListener('menuInteraction', (e) => {
        const { inputHandler } = state;
        if (inputHandler) {
            inputHandler.boidsIgnoreMouse = e.detail.hovering;
        }
    });

    const { allObstacles } = state;
    const throttledScrollUpdater = rafThrottle(() => updateAllObstacles(allObstacles));
    document.body.addEventListener('layoutChanged', throttledScrollUpdater);
}

/**
 * Resets simulation parameters and updates UI to reflect changes.
 * Handles both state reset and UI synchronization.
 * @param {SimulationState} state - The simulation state
 */
export function resetSimulationParameters(state) {
    state.resetSimParams();
    updateSpatialGridParameters(state.spatialGrid, state.canvas, () => state.calculateCurrentCellSize());

    // Sync UI with reset values
    updateMenuValues(state.simParams);
    updateDebugCheckboxes(state.getDebugFlags());
}

/**
 * Closes the navigation menu (defined elsewhere in codebase)
 */
function closeNavMenu() {
    if (typeof window.closeNavMenu === 'function') {
        window.closeNavMenu();
    }
}

