import { FrameQuality } from '../frame-quality.js';
import { FLOCK_DENSITY, MIN_BOIDS, MAX_BOIDS_PER_1000PX_WIDTH } from './config.js';

// Under sustained frame pressure the flock thins out and its canvases drop
// towards 1x, before the homepage pig gives up any of its own quality. Every
// step removes boids, so none is a no-op on a 1x screen.
export const FLOCK_QUALITY = [
    { pixelRatio: 2, population: 1 },
    { pixelRatio: 1.5, population: 0.8 },
    { pixelRatio: 1.5, population: 0.6 },
    { pixelRatio: 1, population: 0.45 },
    { pixelRatio: 1, population: 0.3 },
];

export const flockQuality = new FrameQuality(FLOCK_QUALITY.length);

export function flockPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, FLOCK_QUALITY[flockQuality.level].pixelRatio);
}

// The responsive flock size for a viewport, thinned to the current quality level.
export function responsiveFlockSize(width, height) {
    const size = Math.min(width * height * FLOCK_DENSITY, width / 1000 * MAX_BOIDS_PER_1000PX_WIDTH);
    return Math.floor(Math.max(MIN_BOIDS, size * FLOCK_QUALITY[flockQuality.level].population));
}
