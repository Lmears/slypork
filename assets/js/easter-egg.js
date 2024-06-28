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
                        setTimeout(() => animate('up'), 200);
                    }
                }
            }

            requestAnimationFrame(step);
        }

        easterEgg.addEventListener('click', () => {
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
        });
    }
}

document.addEventListener('DOMContentLoaded', setupEasterEgg);