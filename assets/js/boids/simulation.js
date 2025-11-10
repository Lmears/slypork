import { Vector, vectorPool } from './vector.js';
import { Boid, setBoidDependencies, updateBoidRuntimeValues } from './boid.js';
import { initializeMenu, setMenuVisibility, updateMenuValues, updateDebugCheckboxes } from './settings.js';
import { setControlPanelVisibility } from './ui-utils.js';
import { setObstacleDependencies, initializeObstacles, updateAllObstacles, applyObstacleAvoidanceForces } from './obstacle.js';
import { SpatialGrid } from './spatial-grid.js';
import { Flock } from './flock.js';
import { Renderer } from './renderer.js';
import {
    DEFAULT_SIM_PARAMS,
    MOUSE_INFLUENCE_RADIUS,
    CLICK_SCATTER_DURATION,
    HOLD_SCATTER_DURATION,
    DEPTH_INFLUENCE_RADIUS,
    TARGET_FPS,
} from './config.js';

// Canvas and DOM elements
const canvas = document.getElementById('boidCanvas');
const ctx = canvas.getContext('2d');
const speedSlider = document.getElementById('speedSlider');
const speedControls = document.getElementById('controls');
const speedValue = document.getElementById('speedValue');
const godModeButton = document.getElementById('godModeButton');

// --- Tweakable Simulation Parameters (via experimental menu) ---
let simParams = { ...DEFAULT_SIM_PARAMS };

// --- Flock Management State ---
let userHasSetFlockSize = false;
let allObstacles = [];
let flock;
let renderer;

// --- Spatial Partitioning Settings ---
let cellSize; // Dynamically calculated based on simParams radii

// Helper function to calculate cellSize
function calculateCurrentCellSize() {
    return Math.max(simParams.ALIGNMENT_RADIUS, simParams.SEPARATION_RADIUS, simParams.COHESION_RADIUS, DEPTH_INFLUENCE_RADIUS, simParams.OBSTACLE_RADIUS);
}

// Function to update spatial grid parameters if radii change
function updateSpatialGridParameters() {
    const newCellSize = calculateCurrentCellSize();
    cellSize = newCellSize;

    if (spatialGrid) {
        spatialGrid.cellSize = cellSize;
        spatialGrid.resize(canvas.width, canvas.height);
    }
}

// Global variables
let speedMultiplier = 1;
let isScattering = false;
let mouseInfluence = false;
let animationFrameId = null;
let isEnding = false;
let endStartTime = 0;
let spatialGrid;
let godMode = false;
let debugObstaclesMode = false;
let debugGridMode = false;
let debugLinesMode = false;
let debugSelectedBoid = null;
let boidsIgnoreMouse = false;
let boidsIgnoreTouch = false;
let touchEndTimeoutId = null;
let boidImageBitmap = null;
let isSystemInitialized = false;

// Vector and VectorPool are now imported from vector.js
let mouse = vectorPool.get(0, 0);

// Public API / Entry Points
/**
 * Starts the boid simulation.
 * It will LAZILY INITIALIZE the system on its first run.
 * On subsequent runs, it just creates a new flock and starts the animation.
 */
async function startSimulation() {
    // --- LAZY INITIALIZATION ---
    if (!isSystemInitialized) {
        await _prepareEnvironment();
    }
    if (!isSystemInitialized) {
        console.error("Cannot run simulation; system initialization failed.");
        return;
    }

    // --- REGULAR RUN LOGIC ---
    if (animationFrameId) {
        console.warn("Simulation is already running. Call stopSimulation() first.");
        return;
    }

    cellSize = calculateCurrentCellSize();
    if (spatialGrid) spatialGrid.resize(canvas.width, canvas.height);
    // Set initial flock size based on responsive calculation if not manually set
    if (!userHasSetFlockSize) {
        flock.updateResponsiveSize(updateMenuValues);
    }
    // Create the initial flock
    flock.clear();
    for (let i = 0; i < simParams.FLOCK_SIZE; i++) {
        flock.push(new Boid());
    }

    speedMultiplier = parseFloat(speedSlider.value) / 100 || 1;
    speedValue.textContent = `${speedSlider.value}%`;
    isEnding = false;
    animate();
}

/**
 * Completely stops the simulation, cleans up all boids and state variables.
 */
function stopSimulation() {
    // 1. Stop the animation loop immediately.
    stopAnimation();

    // 2. Clean up all existing boid objects to prevent memory leaks.
    if (flock) {
        flock.clear();
    }
    debugSelectedBoid = null;

    // 3. Clear the canvas.
    if (renderer) {
        renderer.clear();
    }

    // 4. Reset all simulation state variables to their defaults.
    isScattering = false;
    mouseInfluence = false;
    isEnding = false; // Ensure we aren't stuck in the shutdown animation state.
    godMode = false;
    setMenuVisibility(false);
    boidsIgnoreMouse = false;
    boidsIgnoreTouch = false;
    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
        touchEndTimeoutId = null;
    }

    // 5. Reset simulation parameters to their initial values.
    resetSimulationParameters();
}

function startExitAnimation() {
    godMode = false;
    setMenuVisibility(false);
    if (!isEnding) {
        isEnding = true;
        endStartTime = performance.now();
    }
}

let lastFrameTime = 0;
//  Core Simulation Loop
function animate() {
    const currentTime = performance.now();
    if (!lastFrameTime) {
        lastFrameTime = currentTime;
    }
    // deltaTime is the time in milliseconds since the last frame
    let deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // This makes the simulation slow down if FPS drops below ~60 FPS, instead of stuttering wildly.
    // if (deltaTime > 17) {
    //     deltaTime = 17;
    // }

    // timeScale is our adjustment factor. At 60fps, it will be ~2.0. At 120fps, it will be ~1.0.
    const timeScale = (deltaTime / 1000) * TARGET_FPS;

    // THE HACK: The slider's value is now adjusted by the per-frame timeScale.
    const sliderValue = parseFloat(speedSlider.value) / 100;
    speedMultiplier = sliderValue * timeScale;

    // Update boid runtime values each frame
    updateBoidRuntimeValues({
        speedMultiplier,
        mouseInfluence,
        boidsIgnoreMouse
    });

    // Draw background with fade effect
    renderer.drawBackground();

    // Draw debug visualizations
    if (debugObstaclesMode) {
        renderer.drawObstaclesDebug(allObstacles);
    }

    if (debugGridMode) {
        renderer.drawGridDebug(spatialGrid);
    }
    if (debugSelectedBoid) {
        renderer.drawNeighborhoodDebug(debugSelectedBoid, spatialGrid, cellSize);
    }

    if (isScattering) {
        scatter(HOLD_SCATTER_DURATION);
    }

    // --- Cleanup Phase for faded-out boids ---
    flock.cleanup(currentTime);


    // --- Main Simulation Update Order ---

    // 1. Update target flock size if in responsive mode.
    if (!userHasSetFlockSize && !isEnding) {
        flock.updateResponsiveSize(updateMenuValues);
    }

    // 2. Adjust the flock to the target size. This uses the grid populated in step 2.
    if (!isEnding) {
        flock.adjustToTargetSize();
    }


    // 3. Populate the grid with the current state of the flock.
    spatialGrid.clear();
    for (let boid of flock) {
        // Do not include dying boids in the spatial grid for flocking calculations
        if (!boid.isDying) {
            spatialGrid.addItemAtPoint(boid);
        }
    }



    if (isEnding) {
        const endProgress = renderer.renderExitAnimation(flock, currentTime, endStartTime);

        // --- Continue or Stop the Animation Loop ---
        if (endProgress >= 1) {
            return; // Stop the loop
        }
    } else {
        // 4. Main Simulation Loop (if not ending)
        for (let boid of flock) {
            // Dying boids don't need to calculate forces, they just fade out
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

    animationFrameId = requestAnimationFrame(animate);
}

// Simulation Sub-systems & Major Logic
function scatter(duration) {
    flock.forEach(boid => {
        if (Vector.dist(mouse, boid.position) < MOUSE_INFLUENCE_RADIUS) {
            boid.scatterState = 1;
            boid.cooldownTimer = duration;
        }
    });
}

// One-Time Setup & Lifecycle Management
/**
 * Performs the one-time setup for the entire boid system.
 * This should only ever be called once.
 */
async function _prepareEnvironment() {
    // Prevent this from ever running more than once.
    if (isSystemInitialized) return;

    try {
        await loadAndPrepareImage();
    } catch (error) {
        console.error("Could not prepare boid image:", error);
        return; // Stop if the image fails to load
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    spatialGrid = new SpatialGrid(canvas.width, canvas.height, calculateCurrentCellSize());
    allObstacles = initializeObstacles();
    flock = new Flock(simParams, canvas, spatialGrid);
    renderer = new Renderer(canvas, ctx);

    // Initialize Obstacle dependencies
    setObstacleDependencies({
        canvas,
        simParams,
        obstacles: allObstacles
    });

    updateAllObstacles(allObstacles);

    // Initialize Boid dependencies
    setBoidDependencies({
        canvas,
        ctx,
        simParams,
        mouse,
        boidImageBitmap
    });

    const initialDebugFlags = { grid: debugGridMode, obstacles: debugObstaclesMode, lines: debugLinesMode };
    initializeMenu(simParams, initialDebugFlags);
    setupMenuEventListeners();
    setupEventListeners();

    closeNavMenu();

    // Set the flag to true at the very end of a successful setup.
    isSystemInitialized = true;
    console.log("Boid system initialized for the first time.");
}

async function loadAndPrepareImage() {
    // 1. Fetch the image data as a blob
    const response = await fetch('../assets/images/boid-logo.webp');
    if (!response.ok) {
        throw new Error('Failed to fetch boid image');
    }
    const imageBlob = await response.blob();

    // 2. Decode the blob into an ImageBitmap
    boidImageBitmap = await createImageBitmap(imageBlob, {
        resizeWidth: 64,  // Set this to a reasonable max size for your boids
        resizeHeight: 64, // e.g., 64x64
        resizeQuality: 'high'
    });

    // console.log("Boid image is decoded and ready to render.");
}

// Event Handlers
const mouseMoveHandler = (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.set(event.clientX - rect.left, event.clientY - rect.top);
    mouseInfluence = true;
};

const mouseLeaveHandler = () => {
    mouseInfluence = false;
    isScattering = false;
};

const mouseDownHandler = (event) => {
    if (boidsIgnoreMouse) {
        return;
    }
    if (event.button === 0 && !event.shiftKey) {
        isScattering = true;
        scatter(CLICK_SCATTER_DURATION);
    }
};

const mouseUpHandler = (event) => {
    if (event.button === 0) {
        isScattering = false;
    }
};

const touchStartHandler = (event) => {
    const experimentalMenu = document.getElementById('experimentalMenu');
    const easterEgg = document.getElementById('easterEgg');
    const navLinks = document.getElementById('navLinks');
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const visualContainer = document.getElementById('visualContainer');
    const playerGrid = document.getElementById('playerGrid');
    const designGrid = document.getElementById('designGrid');
    const songsGrid = document.getElementById('songsGrid');
    const cvContent = document.getElementById('cvContent');
    const softwareContainer = document.getElementById('softwareContainer');
    const homeLink = document.getElementById('homeLink');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const myModal = document.getElementById('myModal');
    const modalImage = document.getElementById('modalImage');

    const shouldBoidsIgnoreTouch = (easterEgg && easterEgg.contains(event.target)) ||
        (speedControls && speedControls.contains(event.target)) ||
        (experimentalMenu && experimentalMenu.contains(event.target)) ||
        (navLinks && navLinks.contains(event.target)) ||
        (hamburgerMenu && hamburgerMenu.contains(event.target)) ||
        (visualContainer && visualContainer.contains(event.target)) ||
        (playerGrid && playerGrid.contains(event.target)) ||
        (designGrid && designGrid.contains(event.target)) ||
        (songsGrid && songsGrid.contains(event.target)) ||
        (cvContent && cvContent.contains(event.target)) ||
        (softwareContainer && softwareContainer.contains(event.target)) ||
        (homeLink && homeLink.contains(event.target)) ||
        (downloadPdfBtn && downloadPdfBtn.contains(event.target)) ||
        (myModal && myModal.contains(event.target)) ||
        (modalImage && modalImage.contains(event.target));

    boidsIgnoreTouch = shouldBoidsIgnoreTouch;

    if (isEnding || boidsIgnoreTouch) {
        mouseInfluence = false;
        return;
    }
    boidsIgnoreMouse = false;
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouse.set(event.touches[0].clientX - rect.left, event.touches[0].clientY - rect.top);
    mouseInfluence = true;
    isScattering = true;
    scatter(CLICK_SCATTER_DURATION);

    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
        touchEndTimeoutId = null;
    }
};

const touchMoveHandler = (event) => {
    if (isEnding || boidsIgnoreTouch) {
        mouseInfluence = false;
        return;
    }
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    mouse.set(event.touches[0].clientX - rect.left, event.touches[0].clientY - rect.top);
    mouseInfluence = true;

    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
        touchEndTimeoutId = null;
    }
};

const touchEndHandler = () => {
    isScattering = false;
    boidsIgnoreTouch = false;

    if (touchEndTimeoutId) {
        clearTimeout(touchEndTimeoutId);
    }

    touchEndTimeoutId = setTimeout(() => {
        mouseInfluence = false;
        touchEndTimeoutId = null;
    }, 100);
};

const resizeHandler = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (spatialGrid) {
        spatialGrid.resize(canvas.width, canvas.height);
    }
    updateAllObstacles(allObstacles);
    // If simulation is running and in responsive mode, update the target flock size.
    if (animationFrameId && !userHasSetFlockSize) {
        flock.updateResponsiveSize(updateMenuValues);
    }
};



const throttledScrollUpdater = rafThrottle(performScrollUpdates);

const speedSliderInputHandler = function () {
    speedMultiplier = (this.value / 100);
    speedValue.textContent = `${this.value}%`;
};

const speedControlsMouseEnterHandler = () => {
    boidsIgnoreMouse = true;
};

const speedControlsMouseLeaveHandler = () => {
    boidsIgnoreMouse = false;
};

const iframeMouseEnterHandler = () => {
    boidsIgnoreMouse = true;
};

const iframeMouseLeaveHandler = () => {
    boidsIgnoreMouse = false;
};

const documentClickHandler = (event) => {
    if (!event.shiftKey || !debugGridMode) {
        if (!debugGridMode) {
            debugSelectedBoid = null;
        }
        return;
    }

    const experimentalMenu = document.getElementById('experimentalMenu');
    if (boidsIgnoreMouse || (experimentalMenu && experimentalMenu.contains(event.target) && godMode)) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let closestBoid = null;
    let minDistSq = Infinity;

    for (const boid of flock) {
        const distSq = (boid.position.x - clickX) ** 2 + (boid.position.y - clickY) ** 2;
        if (distSq < minDistSq && distSq < (boid.renderSize * 2) ** 2) {
            minDistSq = distSq;
            closestBoid = boid;
        }
    }
    debugSelectedBoid = closestBoid;
};

const godModeButtonClickHandler = () => {
    const newGodModeState = !godMode;
    const event = new CustomEvent('godModeToggled', {
        detail: { enabled: newGodModeState },
        bubbles: true,
        composed: true
    });
    document.body.dispatchEvent(event);
};

// State & Event Management
function setupAppLifecycleListeners() {
    window.addEventListener('pageshow', (event) => {
        // This event fires on every page load, including back-button navigation.
        if (event.persisted) {
            mouseInfluence = false;
            // console.log("Page restored from back-forward cache. Resetting UI state.");
            godMode = false;

            setMenuVisibility(false, { animated: false });

            if (typeof window.resetEasterEggState === 'function') {
                window.resetEasterEggState();
            }

            // Dispatch event to sync the God Mode button's state (good practice)
            const customEvent = new CustomEvent('godModeToggled', {
                detail: { enabled: false },
                bubbles: true,
                composed: true
            });
            document.body.dispatchEvent(customEvent);


            const pageMode = document.body.dataset.pageMode;

            // Only tear down the main simulation UI if we are NOT on the permanent page.
            if (pageMode !== 'permanent-sim') {
                stopSimulation();
                // console.log("Standard page detected. Hiding main simulation UI.");

                setControlPanelVisibility(false, { animated: false });

                // Instantly hide the canvas
                const boidCanvas = document.getElementById('boidCanvas');
                if (boidCanvas) {
                    boidCanvas.style.transition = 'none';
                    boidCanvas.style.opacity = '0';
                    boidCanvas.style.display = 'none';
                    setTimeout(() => boidCanvas.style.transition = '', 20);
                }
            } else {
                // console.log("Permanent simulation page detected. Controls and canvas will remain visible.");
            }
        }
    });
}

function setupEventListeners() {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseleave', mouseLeaveHandler);
    document.removeEventListener('mousedown', mouseDownHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    document.removeEventListener('touchstart', touchStartHandler);
    document.removeEventListener('touchmove', touchMoveHandler);
    document.removeEventListener('touchend', touchEndHandler);
    window.removeEventListener('resize', resizeHandler);
    document.removeEventListener('click', documentClickHandler);
    document.body.removeEventListener('scroll', throttledScrollUpdater);

    if (speedSlider) {
        speedSlider.removeEventListener('input', speedSliderInputHandler);
    }
    if (speedControls) {
        speedControls.removeEventListener('mouseenter', speedControlsMouseEnterHandler);
        speedControls.removeEventListener('mouseleave', speedControlsMouseLeaveHandler);
    }
    if (godModeButton) {
        godModeButton.removeEventListener('click', godModeButtonClickHandler);
    }

    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        iframe.removeEventListener('mouseenter', iframeMouseEnterHandler);
        iframe.removeEventListener('mouseleave', iframeMouseLeaveHandler);
    });

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseleave', mouseLeaveHandler);
    document.addEventListener('mousedown', mouseDownHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    document.addEventListener('touchstart', touchStartHandler, { passive: false });
    document.addEventListener('touchmove', touchMoveHandler, { passive: false });
    document.addEventListener('touchend', touchEndHandler);
    window.addEventListener('resize', resizeHandler);
    document.addEventListener('click', documentClickHandler);
    document.body.addEventListener('scroll', throttledScrollUpdater, { passive: true });

    if (speedSlider) {
        speedSlider.addEventListener('input', speedSliderInputHandler);
    }
    if (speedControls) {
        speedControls.addEventListener('mouseenter', speedControlsMouseEnterHandler);
        speedControls.addEventListener('mouseleave', speedControlsMouseLeaveHandler);
    }
    if (godModeButton) {
        godModeButton.addEventListener('click', godModeButtonClickHandler);
    }

    iframes.forEach(iframe => {
        iframe.addEventListener('mouseenter', iframeMouseEnterHandler);
        iframe.addEventListener('mouseleave', iframeMouseLeaveHandler);
    });
}

function setupMenuEventListeners() {
    document.body.addEventListener('godModeToggled', (e) => {
        godMode = e.detail.enabled;
        setMenuVisibility(godMode);
        console.log("God Mode:", godMode);
    });

    document.body.addEventListener('paramChanged', (e) => {
        const { key, value } = e.detail;
        if (simParams.hasOwnProperty(key)) {
            simParams[key] = value;
            if (key.includes('RADIUS')) {
                updateSpatialGridParameters();
            }
            // If the user manually changes flock size via the menu, set the flag.
            if (key === 'FLOCK_SIZE') {
                userHasSetFlockSize = true;
            }
        }
    });

    document.body.addEventListener('debugFlagChanged', (e) => {
        const { flag, enabled } = e.detail;
        if (flag === 'grid') {
            debugGridMode = enabled;
            if (!enabled) debugSelectedBoid = null;
        } else if (flag === 'obstacles') {
            debugObstaclesMode = enabled;
        } else if (flag === 'lines') {
            debugLinesMode = enabled;
        }
    });

    document.body.addEventListener('paramsReset', resetSimulationParameters);


    // Handles mouse entering/leaving the menu itself
    document.body.addEventListener('menuInteraction', (e) => {
        boidsIgnoreMouse = e.detail.hovering;
        // console.log("Boids ignore mouse:", boidsIgnoreMouse);
    });

    document.body.addEventListener('layoutChanged', throttledScrollUpdater);
}

function performScrollUpdates() {
    updateAllObstacles(allObstacles);
}

function resetSimulationParameters() {
    // Mutate the existing simParams object instead of creating a new one
    // This ensures boid.js and obstacle.js see the changes immediately
    Object.assign(simParams, DEFAULT_SIM_PARAMS);

    userHasSetFlockSize = false;         // Allow responsive flock size again.
    updateSpatialGridParameters();      // Update dependent systems (grid)
    updateMenuValues(simParams);        // Update UI to reflect the reset
    debugGridMode = false;
    debugObstaclesMode = false;
    debugLinesMode = false;
    updateDebugCheckboxes({
        grid: debugGridMode,
        obstacles: debugObstaclesMode,
        lines: debugLinesMode
    });
}

// Utility & Helper Functions
function stopAnimation() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

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
