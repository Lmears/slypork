import { Boid, setBoidDependencies, updateBoidRuntimeValues } from './boid.js';
import { initializeMenu, setMenuVisibility, updateMenuValues, updateDebugCheckboxes } from './settings.js';
import { setControlPanelVisibility } from './ui-utils.js';
import { setObstacleDependencies, initializeObstacles, updateAllObstacles, applyObstacleAvoidanceForces } from './obstacle.js';
import { SpatialGrid } from './spatial-grid.js';
import { Flock } from './flock.js';
import { Renderer } from './renderer.js';
import { InputHandler } from './input-handler.js';
import { SimulationState } from './state.js';
import {
    HOLD_SCATTER_DURATION,
    TARGET_FPS,
} from './config.js';

// Centralized state container
const state = new SimulationState();

// Initialize UI references
state.setUIReferences({
    canvas: document.getElementById('boidCanvas'),
    ctx: document.getElementById('boidCanvas')?.getContext('2d'),
    speedSlider: document.getElementById('speedSlider'),
    speedControls: document.getElementById('controls'),
    speedValue: document.getElementById('speedValue'),
    godModeButton: document.getElementById('godModeButton')
});

// Helper function to update spatial grid parameters when radii change
function updateSpatialGridParameters() {
    const { spatialGrid, canvas } = state;
    const newCellSize = state.calculateCurrentCellSize();

    if (spatialGrid) {
        spatialGrid.cellSize = newCellSize;
        spatialGrid.resize(canvas.width, canvas.height);
    }
}

/**
 * Starts the boid simulation.
 * It will LAZILY INITIALIZE the system on its first run.
 * On subsequent runs, it just creates a new flock and starts the animation.
 */
async function startSimulation() {
    // --- LAZY INITIALIZATION ---
    if (!state.isSystemInitialized) {
        await _prepareEnvironment();
    }
    if (!state.isSystemInitialized) {
        console.error("Cannot run simulation; system initialization failed.");
        return;
    }

    // --- REGULAR RUN LOGIC ---
    const { animationFrameId, spatialGrid, canvas, userHasSetFlockSize, flock, simParams, speedSlider, speedValue } = state;

    if (animationFrameId) {
        console.warn("Simulation is already running. Call stopSimulation() first.");
        return;
    }

    const cellSize = state.calculateCurrentCellSize();
    if (spatialGrid) {
        spatialGrid.cellSize = cellSize;
        spatialGrid.resize(canvas.width, canvas.height);
    }

    // Set initial flock size based on responsive calculation if not manually set
    if (!userHasSetFlockSize) {
        flock.updateResponsiveSize(updateMenuValues);
    }

    // Create the initial flock
    flock.clear();
    for (let i = 0; i < simParams.FLOCK_SIZE; i++) {
        flock.push(new Boid());
    }

    state.speedMultiplier = parseFloat(speedSlider.value) / 100 || 1;
    speedValue.textContent = `${speedSlider.value}%`;
    state.isEnding = false;
    animate();
}

/**
 * Completely stops the simulation, cleans up all boids and state variables.
 */
function stopSimulation() {
    const { flock, renderer } = state;

    // 1. Stop the animation loop immediately.
    state.stopAnimation();

    // 2. Clean up all existing boid objects to prevent memory leaks.
    if (flock) {
        flock.clear();
    }

    // 3. Clear the canvas.
    if (renderer) {
        renderer.clear();
    }

    // 4. Reset all simulation state variables to their defaults.
    state.resetToDefaults();
    setMenuVisibility(false);

    // 5. Reset simulation parameters to their initial values.
    resetSimulationParameters();
}

function startExitAnimation() {
    const { isEnding } = state;
    state.godMode = false;
    setMenuVisibility(false);
    if (!isEnding) {
        state.isEnding = true;
        state.endStartTime = performance.now();
    }
}
//  Core Simulation Loop
function animate() {
    const currentTime = performance.now();
    const timeScale = updateFrameTiming(currentTime);
    updateSpeedMultiplier(timeScale);
    renderFrame(currentTime, timeScale);

    if (updateExitAnimation(currentTime)) {
        return; // Exit animation complete
    }

    updateSimulationState();
    updatePhysics(timeScale, currentTime);

    state.animationFrameId = requestAnimationFrame(animate);
}

function updateFrameTiming(currentTime) {
    if (!state.lastFrameTime) {
        state.lastFrameTime = currentTime;
    }
    const deltaTime = currentTime - state.lastFrameTime;
    state.lastFrameTime = currentTime;

    // timeScale is our adjustment factor. At 60fps, it will be ~2.0. At 120fps, it will be ~1.0.
    return (deltaTime / 1000) * TARGET_FPS;
}

function updateSpeedMultiplier(timeScale) {
    const { speedSlider, inputHandler } = state;
    const sliderValue = parseFloat(speedSlider.value) / 100;
    state.speedMultiplier = sliderValue * timeScale;

    updateBoidRuntimeValues({
        speedMultiplier: state.speedMultiplier,
        mouseInfluence: inputHandler.mouseInfluence,
        boidsIgnoreMouse: inputHandler.boidsIgnoreMouse
    });
}

function renderFrame(currentTime, timeScale) {
    const { renderer, debugObstaclesMode, allObstacles, debugGridMode, spatialGrid,
        debugSelectedBoid, inputHandler, flock } = state;

    renderer.drawBackground();

    if (debugObstaclesMode) {
        renderer.drawObstaclesDebug(allObstacles);
    }
    if (debugGridMode) {
        renderer.drawGridDebug(spatialGrid);
    }
    if (debugSelectedBoid) {
        renderer.drawNeighborhoodDebug(debugSelectedBoid, spatialGrid, state.calculateCurrentCellSize());
    }

    if (inputHandler.isScattering) {
        inputHandler.scatter(HOLD_SCATTER_DURATION);
    }

    flock.cleanup(currentTime);
}

function updateSimulationState() {
    const { flock, spatialGrid, userHasSetFlockSize, isEnding } = state;

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

function updatePhysics(timeScale, currentTime) {
    const { flock, spatialGrid, allObstacles, debugLinesMode, renderer } = state;

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

function updateExitAnimation(currentTime) {
    const { isEnding, flock, endStartTime, renderer } = state;

    if (!isEnding) return false;

    const endProgress = renderer.renderExitAnimation(flock, currentTime, endStartTime);
    return endProgress >= 1;
}

// Simulation Sub-systems & Major Logic

// One-Time Setup & Lifecycle Management
/**
 * Performs the one-time setup for the entire boid system.
 * This should only ever be called once.
 */
async function _prepareEnvironment() {
    if (state.isSystemInitialized) return;

    try {
        await loadAndPrepareImage();
        initializeCanvas();
        initializeSimulationSystems();
        initializeDependencyInjection();
        initializeUI();

        state.isSystemInitialized = true;
        console.log("Boid system initialized.");
    } catch (error) {
        console.error("System initialization failed:", error);
    }
}

function initializeCanvas() {
    const { canvas } = state;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function initializeSimulationSystems() {
    const { canvas, ctx, simParams } = state;

    state.spatialGrid = new SpatialGrid(canvas.width, canvas.height, state.calculateCurrentCellSize());
    state.allObstacles = initializeObstacles();
    state.flock = new Flock(simParams, canvas, state.spatialGrid);
    state.renderer = new Renderer(canvas, ctx);
    state.inputHandler = createInputHandler();
}

function createInputHandler() {
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

function initializeDependencyInjection() {
    const { canvas, ctx, mouse, simParams, allObstacles, boidImageBitmap } = state;

    setObstacleDependencies({ canvas, simParams, obstacles: allObstacles });
    setBoidDependencies({ canvas, ctx, simParams, mouse, boidImageBitmap });

    updateAllObstacles(allObstacles);
}

function initializeUI() {
    const { simParams, inputHandler } = state;
    initializeMenu(simParams, state.getDebugFlags());
    setupMenuEventListeners();
    inputHandler.setupEventListeners();
    closeNavMenu();
}

async function loadAndPrepareImage() {
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

// State & Event Management
function setupAppLifecycleListeners() {
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

            const customEvent = new CustomEvent('godModeToggled', {
                detail: { enabled: false },
                bubbles: true,
                composed: true
            });
            document.body.dispatchEvent(customEvent);

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

function setupMenuEventListeners() {
    document.body.addEventListener('godModeToggled', (e) => {
        state.godMode = e.detail.enabled;
        setMenuVisibility(state.godMode);
        console.log("God Mode:", state.godMode);
    });

    document.body.addEventListener('paramChanged', (e) => {
        const { key, value } = e.detail;
        const wasUpdated = state.updateSimParam(key, value);
        if (wasUpdated && key.includes('RADIUS')) {
            updateSpatialGridParameters();
        }
    });

    document.body.addEventListener('debugFlagChanged', (e) => {
        const { flag, enabled } = e.detail;
        state.updateDebugFlag(flag, enabled);
    });

    document.body.addEventListener('paramsReset', resetSimulationParameters);

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

function resetSimulationParameters() {
    state.resetSimParams();
    updateSpatialGridParameters();
    updateMenuValues(state.simParams);
    updateDebugCheckboxes(state.getDebugFlags());
}

// Utility & Helper Functions

function rafThrottle(callback) {
    let requestId = null;
    let lastArgs = []; // To store the latest arguments if needed, though scroll usually doesn't have important args

    const later = (context) => () => {
        requestId = null;
        callback.apply(context, lastArgs);
    };

    const throttled = function (...args) {
        lastArgs = args; // Store the latest arguments
        if (requestId === null) {
            requestId = requestAnimationFrame(later(this));
        }
    };

    throttled.cancel = () => {
        if (requestId !== null) {
            cancelAnimationFrame(requestId);
            requestId = null;
        }
    };
    return throttled;
}

// Expose functions to global scope if they are called from HTML
window.startSimulation = startSimulation;
window.stopSimulation = stopSimulation;
window.startExitAnimation = startExitAnimation;
setupAppLifecycleListeners();
