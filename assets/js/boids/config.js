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
    VELOCITY_INERTIA: 0.45,
    ROTATION_INERTIA: 0.3,
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
export const BOID_OSCILLATION_SPEED_BASE = 0.02;
export const BOID_OSCILLATION_SPEED_VARIATION = 0.04;
export const BOID_ROTATION_SPEED = 0.1;
export const BOID_DYING_DURATION = 250; // Time in ms for a boid to fade out

// --- Easter Egg Parameters ---
export const EASTER_EGG_WIDTH = 45;
export const EASTER_EGG_HEIGHT = 40;
export const EASTER_EGG_RIGHT = 25;
export const EASTER_EGG_BOTTOM = 21;
export const SPREAD_FACTOR = 0.1;

// --- Animation ---
export const END_ANIMATION_DURATION = 1000;
export const TARGET_FPS = 120; // The desired FPS for your simulation's look and feel

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
