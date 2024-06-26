// Easing function
function easeInOutElastic(x) {
    const c5 = (2 * Math.PI) / 4.5;
    return x === 0 ? 0
        : x === 1 ? 1
            : x < 0.5 ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
                : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
}

// Easter Egg Animation
function setupEasterEgg() {
    const easterEgg = document.getElementById('easterEgg');
    const boidCanvas = document.getElementById('boidCanvas');
    const controls = document.getElementById('controls');
    let tapCount = 0;

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
                        setTimeout(() => animate('up'), 500);
                    }
                }
            }

            requestAnimationFrame(step);
        }

        easterEgg.addEventListener('click', () => {
            animate('down');
            tapCount++;

            if (tapCount === 3) {
                // Reveal boid simulator
                boidCanvas.style.display = 'block';
                controls.style.display = 'flex';
                setTimeout(() => {
                    initBoidSimulator();
                }, 1000);
            }
        });
    }
}

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', setupEasterEgg);