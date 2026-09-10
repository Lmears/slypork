import { initializeSlider } from './boids/ui-utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const boidCanvas = document.getElementById('boidCanvas');
    const controls = document.getElementById('controls');

    // Instantly show the canvas and controls
    if (boidCanvas) {
        boidCanvas.style.display = 'block';
        boidCanvas.style.opacity = '1';
    }
    if (controls) {
        controls.style.display = 'flex';
        controls.style.opacity = '1';
    }

    // Set the body state
    document.body.classList.add('boid-active');

    // Initialize the slider and start the simulation
    initializeSlider('speedSlider', 'speedValue', '%');

    if (typeof startSimulation === 'function') {
        startSimulation();
    } else {
        console.error('startSimulation function not found. Ensure simulation.js is loaded correctly.');
    }
});
