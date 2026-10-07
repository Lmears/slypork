import { TARGET_FPS, FLOCK_DENSITY, MIN_BOIDS, MAX_BOIDS_PER_1000PX_WIDTH, DEFAULT_SIM_PARAMS } from './config.js';

// Shared screen-space position of the homepage's 3D flock leader. Other pages
// never publish a position and retain the corner egg's original behaviour.
export const heroField = {
    available: false,
    active: false,
    x: 0,
    y: 0,
    radius: 0,
    strength: 0,
    anchor: null,
    travelling: false,
    ringAngle: -0.18,
};

const RING_SQUASH = 0.18;
const breakawayTime = lane => 0.14 + lane * 0.5;
let breakawayCooldown = 0;
const ORBIT_CONTROLS = [
    'ALIGNMENT_FORCE', 'COHESION_FORCE', 'SEPARATION_FORCE', 'OBSTACLE_FORCE',
    'ALIGNMENT_RADIUS', 'COHESION_RADIUS', 'SEPARATION_RADIUS', 'OBSTACLE_RADIUS',
    'VELOCITY_INERTIA',
];

// One tilted plane, like Saturn's rings. Both halves share the same ellipse;
// the pig hides the far half while the near half crosses its face.
export function projectHeroOrbit(phase, lane, point) {
    const outerRadius = heroField.radius * 2.55 + 12;
    const room = Math.min(heroField.x, innerWidth - heroField.x) - 16;
    const fit = Math.min(1, Math.max(heroField.radius * 1.25, Math.min(innerWidth * 0.37, room)) / outerRadius);
    const radius = (heroField.radius * (1.9 + lane * 0.65) + 12) * fit;
    const depth = Math.sin(phase);
    const x = Math.cos(phase) * radius;
    const y = depth * radius * RING_SQUASH;
    const ringCos = Math.cos(heroField.ringAngle);
    const ringSin = Math.sin(heroField.ringAngle);
    point.x = heroField.x + x * ringCos - y * ringSin;
    point.y = heroField.y + x * ringSin + y * ringCos;
    point.depth = depth;
    return point;
}

export function updateHeroOrbits(flock, timeScale, speedMultiplier) {
    const dt = timeScale / TARGET_FPS;
    const active = heroField.available && heroField.active && heroField.strength > 0.08 && !heroField.travelling;
    breakawayCooldown = active ? Math.max(0, breakawayCooldown - dt) : 0;
    // Preserve the original density at the responsive default. The same disk
    // fills more densely when the user increases the population.
    const baseline = Math.max(MIN_BOIDS, Math.min(innerWidth * innerHeight * FLOCK_DENSITY,
        innerWidth / 1000 * MAX_BOIDS_PER_1000PX_WIDTH));
    let living = 0;
    for (const boid of flock) if (!boid.isDying) living++;
    const limit = Math.min(living, Math.max(1, Math.round((innerWidth < 600 ? 22 : 30) * living / baseline)));
    let occupied = 0;

    for (const boid of flock) {
        boid.orbitCooldown = Math.max(0, boid.orbitCooldown - dt);
        if (!boid.orbit) continue;
        if (!active || boid.orbit.anchor !== heroField.anchor || boid.isDying || boid.scatterState === 1
            || boid.orbit.age > boid.orbit.duration || occupied >= limit) {
            boid.orbit = null;
            boid.orbitCooldown = 5;
        } else occupied++;
    }

    if (!active) return;
    const ringCos = Math.cos(heroField.ringAngle);
    const ringSin = Math.sin(heroField.ringAngle);
    for (const boid of flock) {
        if (!boid.orbit && occupied < limit && !boid.isDying && boid.scatterState === 0 && boid.orbitCooldown === 0) {
            const dx = boid.position.x - heroField.x;
            const dy = boid.position.y - heroField.y;
            if (Math.hypot(dx, dy) < heroField.radius + 135) {
                const lane = (boid.id * 0.61803398875) % 1;
                const localX = dx * ringCos + dy * ringSin;
                const localY = -dx * ringSin + dy * ringCos;
                boid.orbit = {
                    anchor: heroField.anchor,
                    phase: Math.atan2(localY / RING_SQUASH, localX),
                    lane, age: 0, duration: 7 + lane * 4, blend: 0,
                    entryDuration: 1.6 + lane * 0.4,
                    entryDelay: lane * 0.18,
                    previousX: boid.position.x,
                    previousY: boid.position.y,
                    originX: boid.position.x, originY: boid.position.y,
                    entryVelocityX: boid.velocity.x / dt,
                    entryVelocityY: boid.velocity.y / dt,
                    offsetX: 0, offsetY: 0, forceX: 0, forceY: 0,
                    flockPull: 0, strain: 0,
                    point: { x: 0, y: 0, depth: 0 },
                    trailPoint: { x: 0, y: 0, depth: 0 },
                };
                occupied++;
            }
        }
        const orbit = boid.orbit;
        if (!orbit) continue;
        orbit.age += dt;
        const entry = Math.max(0, Math.min(1, (orbit.age - orbit.entryDelay) / orbit.entryDuration));
        // Ease elapsed time, rather than repeatedly lerping the previous frame:
        // repeating a small blend at 120 Hz completed the pull almost at once.
        orbit.blend = entry ** 3 * (entry * (entry * 6 - 15) + 10);
        const angularStep = (0.009 + orbit.lane * 0.002) * speedMultiplier;
        orbit.phase = (orbit.phase + angularStep * (0.2 + orbit.blend * 0.8)) % (Math.PI * 2);
        projectHeroOrbit(orbit.phase, orbit.lane, orbit.point);
    }
}

// Keep the original analytic ellipse. Changed controls and departing flocks
// bend it slowly, rather than letting neighbour corrections shake the path.
export function updateHeroOrbitInfluence(boid, timeScale, params) {
    const orbit = boid.orbit;
    if (!orbit) return;
    const dt = timeScale / TARGET_FPS;
    let changed = 0;
    for (const key of ORBIT_CONTROLS) {
        changed += Math.abs(params[key] - DEFAULT_SIM_PARAMS[key]) / Math.max(1, DEFAULT_SIM_PARAMS[key]);
    }
    const influence = Math.min(1, changed) * 0.65 + orbit.flockPull * 0.8;
    let x = (boid.desiredVelocity.x - boid.velocity.x) / timeScale * influence * 60;
    let y = (boid.desiredVelocity.y - boid.velocity.y) / timeScale * influence * 60;
    const limit = heroField.radius * 0.45;
    const fit = Math.min(1, limit / (Math.hypot(x, y) || 1));
    x *= fit;
    y *= fit;
    const response = 1 - Math.exp(-dt / (0.35 + Math.max(0, params.VELOCITY_INERTIA) * 0.4));
    // Two successive easing stages remove abrupt direction changes while
    // preserving a sustained tug. At defaults with no fly-by, both stay zero.
    orbit.forceX += (x - orbit.forceX) * response;
    orbit.forceY += (y - orbit.forceY) * response;
    orbit.offsetX += (orbit.forceX - orbit.offsetX) * response;
    orbit.offsetY += (orbit.forceY - orbit.offsetY) * response;
}

export function finishHeroOrbits(flock, timeScale) {
    const dt = timeScale / TARGET_FPS;
    for (const boid of flock) {
        const orbit = boid.orbit;
        if (!orbit) continue;
        const drift = (1 - Math.exp(-orbit.age * 2.5)) / 2.5;
        const freeX = orbit.originX + orbit.entryVelocityX * drift;
        const freeY = orbit.originY + orbit.entryVelocityY * drift;
        boid.position.x = freeX + (orbit.point.x + orbit.offsetX - freeX) * orbit.blend;
        boid.position.y = freeY + (orbit.point.y + orbit.offsetY - freeY) * orbit.blend;
        boid.velocity.x = boid.position.x - orbit.previousX;
        boid.velocity.y = boid.position.y - orbit.previousY;
        orbit.previousX = boid.position.x;
        orbit.previousY = boid.position.y;
        boid.updateRotation();

        // A sustained departing flock can take a follower, with the current
        // smooth velocity intact. Pace pickups so it peels off individuals.
        const pulled = orbit.blend > 0.9 && orbit.flockPull > 0.25;
        orbit.strain = Math.max(0, orbit.strain + (pulled ? dt : -dt * 2));
        if (orbit.strain > breakawayTime(orbit.lane) && breakawayCooldown === 0) {
            boid.orbit = null;
            boid.orbitCooldown = 5;
            breakawayCooldown = 0.55;
        }
    }
}
