function setupEasterEgg() {
    const easterEgg = document.getElementById('easterEgg');
    const boidCanvas = document.getElementById('boidCanvas');
    const controls = document.getElementById('controls');
    let tapCount = 0;
    let canIncrement = true;

    if (easterEgg) {
        let isAnimating = false;

        function animate(direction) {
            if (isAnimating) return;
            isAnimating = true;

            const startTime = performance.now();
            const duration = 500;
            const startPosition = direction === 'down' ? 0 : 20;
            const endPosition = direction === 'down' ? 20 : 0;

            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = easeInOutElastic(progress);
                const currentPosition = startPosition + (endPosition - startPosition) * easeProgress;

                easterEgg.style.transform = `translateY(${currentPosition}px)`;

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    isAnimating = false;
                    if (direction === 'down') {
                        setTimeout(() => animate('up'), 200);
                    } else if (direction === 'up') {
                        canIncrement = true;
                    }
                }
            }

            requestAnimationFrame(step);
        }

        easterEgg.addEventListener('click', () => {
            if (canIncrement) {
                canIncrement = false;
                animate('down');
                tapCount++;

                if (tapCount === 3) {
                    setTimeout(() => {
                        boidCanvas.style.display = 'block';
                        boidCanvas.style.opacity = '0';
                        boidCanvas.style.transition = 'opacity 0.5s ease-in';

                        setTimeout(() => {
                            boidCanvas.style.opacity = '1';
                            document.body.classList.add('boid-active');

                            setTimeout(() => {
                                controls.style.display = 'flex';
                                controls.style.opacity = '0';
                                controls.style.transition = 'opacity 0.5s ease-in';

                                setTimeout(() => {
                                    controls.style.opacity = '1';
                                    initializeSlider('speedSlider', 'speedValue', '%');
                                    initBoidSimulator();
                                }, 50);
                            }, 500);
                        }, 50);
                    }, 500);
                } else if (tapCount === 4) {
                    if (typeof window.endSimulation === 'function') {
                        window.endSimulation();
                    }

                    setTimeout(() => {
                        boidCanvas.style.opacity = '0';
                        controls.style.opacity = '0';

                        setTimeout(() => {
                            boidCanvas.style.display = 'none';
                            controls.style.display = 'none';
                            document.body.classList.remove('boid-active');

                            if (typeof window.stopAnimation === 'function') {
                                window.stopAnimation();
                            }
                            if (typeof window.resetBoidSimulator === 'function') {
                                window.resetBoidSimulator();
                            }

                            tapCount = 0;
                        }, 1000);
                    }, 50);
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', setupEasterEgg);

/**
 * Initialize a single slider with blue fill effect and scroll wheel control
 * @param {string} sliderId - The ID of the slider element
 * @param {string} [displayId] - Optional ID of element to show the value
 * @param {string} [suffix='%'] - Suffix to add to displayed value
 */
function initializeSlider(sliderId, displayId = null, suffix = '%') {
    const slider = document.getElementById(sliderId);
    const display = displayId ? document.getElementById(displayId) : null;

    if (!slider) {
        console.warn(`Slider with ID '${sliderId}' not found`);
        return;
    }

    function updateSlider() {
        const value = parseFloat(slider.value);

        updateSliderFill(slider);

        // Update the display value if display element exists
        if (display) {
            // For steps like 0.1, ensure fixed decimal places if step is a decimal
            const step = slider.step;
            if (step && step.includes('.')) {
                const precision = step.split('.')[1].length;
                display.textContent = value.toFixed(precision) + suffix;
            } else {
                display.textContent = value + suffix;
            }
        }
    }

    updateSlider();
    slider.addEventListener('input', updateSlider);
    enableSliderWheelControl(slider);
}