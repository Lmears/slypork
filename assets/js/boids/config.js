// --- Flock Management ---
export const FLOCK_DENSITY = 0.0002; // Boids per pixel area for responsive sizing
export const MIN_BOIDS = 30;
export const MAX_BOIDS_PER_1000PX_WIDTH = 750; // Max boids scales with width

// --- Default Simulation Parameters (for reset functionality) ---
// Note: The actual simParams object is kept in simulation.js as it needs to be mutable
export const DEFAULT_SIM_PARAMS = {
    FLOCK_SIZE: 150,
    ALIGNMENT_FORCE: 1.0,
    COHESION_FORCE: 0.7,
    SEPARATION_FORCE: 1.1,
    OBSTACLE_FORCE: 1.2,
    ALIGNMENT_RADIUS: 50,
    COHESION_RADIUS: 120,
    SEPARATION_RADIUS: 45,
    OBSTACLE_RADIUS: 120,
    VELOCITY_INERTIA: 0.30,
    ROTATION_INERTIA: 0.05,
};

// --- Obstacle Parameters ---
export const OBSTACLE_PADDING = 0;
export const OBSTACLE_BOUNCE_FORCE_MULTIPLIER = 3;
export const OBSTACLE_DEBUG_COLOR = 'rgba(255, 0, 0, 0.7)';
export const OBSTACLE_DEBUG_FILL_COLOR = 'rgba(255, 0, 0, 0.1)';
export const OBSTACLE_ELEMENT_IDS = [
    'navLinks',
    'footer',
    'hamburger-menu',
    'simpleHomeLink',
    'downloadPdfBtn',
    'keith-logo',
    'dj-pretence-logo',
    'root-basis-logo',
];

// --- Other Simulation parameters (mostly non-tweakable via new menu) ---
export const MITOSIS_BOOST_STRENGTH = 0.1;
export const NORMAL_MAX_SPEED = 5;
export const SCATTER_MAX_SPEED = 15;
export const INITIAL_BOOST = 10;
export const BOOST_DECAY = 0.95;

// --- Mouse Interaction ---
export const MOUSE_INFLUENCE_RADIUS = 200;
export const CLICK_SCATTER_DURATION = 22;
export const HOLD_SCATTER_DURATION = 45;
export const COOLDOWN_DURATION = 30;
export const MOUSE_FORCE_NORMAL = 3.0;
export const MOUSE_FORCE_SCATTER = 2.5;

// --- Boid Behavior Radii ---
export const DEPTH_INFLUENCE_RADIUS = 50;

// --- Boid-specific Constants ---
export const BOID_MAX_FORCE = 0.175;
export const BOID_SIZE_BASE = 20;
export const BOID_SIZE_VARIATION = 10;
export const BOID_OSCILLATION_SPEED_BASE = 0.01;
export const BOID_OSCILLATION_SPEED_VARIATION = 0.03;
export const BOID_OSCILLATION_SYNC_STRENGTH = 0.02; // How strongly boids sync their oscillation with neighbors
export const BOID_ROTATION_SPEED = 0.1;
export const BOID_DYING_DURATION = 250; // Time in ms for a boid to fade out

// A slow random walk driving a weak sideways steering force (see applyWander).
// Keeps the flock from settling into a mathematically converged glide — birds
// don't hold a perfect line.
//
// The two knobs map onto two different symptoms:
//   STRENGTH — how hard each boid banks. Raise for looser, more restless flocking;
//     too high and it reads as lurching rather than life. This is the amplitude.
//   RATE — how fast the phase drifts, i.e. the *period* of the sway. Low values
//     lean a boid the same way for many seconds, which reads as drunk even at a
//     modest strength. Raise it to shorten the bank without draining liveliness.
export const BOID_WANDER_STRENGTH = 0.075;
export const BOID_WANDER_RATE = 0.30; // Radians of drift per frame at TARGET_FPS

// Neighbours are weighted to zero across the outer band of each radius rather than
// popping in and out at the boundary. Expressed as a fraction of the radius, so the
// inner majority of the neighbourhood keeps full weight and the tuned radii still
// mean what they say.
export const NEIGHBOR_EDGE_FADE = 0.20;

// --- Easter Egg Parameters ---
export const EASTER_EGG_WIDTH = 45;
export const EASTER_EGG_HEIGHT = 40;
export const EASTER_EGG_RIGHT = 25;
export const EASTER_EGG_BOTTOM = 21;
export const SPREAD_FACTOR = 0.1;

// --- Animation ---
// Alpha erased from the canvas each frame to decay boid trails. Deliberately
// the same in light and dark mode: dark mode used to fade at 0.1, which made
// its trails last ~3x longer than light mode's. Lower this for longer trails —
// but on a browser without float16 canvas support (see initializeDOMReferences)
// a lower value also leaves a heavier trail residue, since the erase is
// multiplicative and 8-bit rounding can't take it the last step to zero.
export const TRAIL_FADE_ALPHA = 0.25;
export const END_ANIMATION_DURATION = 1000;
export const TARGET_FPS = 120; // The desired FPS for your simulation's look and feel

// --- Frame Timing ---
// timeScale scales every force and speed limit, so a single stalled frame (tab
// switch, GC pause, layout thrash) would otherwise fling the whole flock. Clamp
// it to a sane band and low-pass it so the motion rides through frame-time noise
// instead of reproducing it. The floor must stay above 0: a timeScale of 0 makes
// maxSpeed 0, and `velocity.limit(0)` zeroes velocity outright.
export const TIME_SCALE_MIN = 0.25;
export const TIME_SCALE_MAX = 3.0;
export const TIME_SCALE_SMOOTHING = 0.1; // EMA weight for each new frame's raw timeScale

// --- Edge Buffering ---
export const EDGE_BUFFER_POSITIONS = [
    { dx: 0, dy: 0 },
    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
    { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
    { dx: -1, dy: 1 }, { dx: 1, dy: 1 }
];

// --- Vector Pool ---
export const MAX_FLOCK_SIZE_HARD_CAP = 1000;
export const PEAK_VECTORS_PER_BOID = 7;
export const VECTOR_POOL_INITIAL_SIZE = MAX_FLOCK_SIZE_HARD_CAP * PEAK_VECTORS_PER_BOID;
export const VECTOR_POOL_MAX_SIZE = MAX_FLOCK_SIZE_HARD_CAP * PEAK_VECTORS_PER_BOID * 2;
