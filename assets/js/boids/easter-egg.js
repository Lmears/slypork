/**
 * Controls the visibility of the main boid controls (speed slider).
 * @param {boolean} isVisible - Whether the controls should be visible.
 * @param {object} [options={}] - An options object.
 * @param {boolean} [options.animated=true] - If false, the change happens instantly.
 */
function setControlsVisibility(isVisible, options = {}) {
    const { animated = true } = options;
    const controls = document.getElementById('controls');
    if (!controls) return;

    // The duration of the fade animation, consistent with your original code.
    const ANIMATION_DURATION = 1000;

    if (isVisible) {
        // --- SHOW LOGIC ---
        controls.style.display = 'flex';

        if (animated) {
            // Use a tiny delay to ensure the 'display' change is rendered
            // before the opacity transition begins.
            setTimeout(() => {
                controls.style.opacity = '1';
            }, 50);
        } else {
            // Instantly set opacity to 1.
            controls.style.opacity = '1';
        }

    } else {
        // --- HIDE LOGIC ---
        if (animated) {
            controls.style.opacity = '0';
            // Wait for the transition to finish before setting display to none.
            setTimeout(() => {
                controls.style.display = 'none';
            }, ANIMATION_DURATION);
        } else {
            // The instant-hide trick:
            // 1. Temporarily disable CSS transitions on the element.
            controls.style.transition = 'none';

            // 2. Apply the final hidden state. It will happen immediately.
            controls.style.opacity = '0';
            controls.style.display = 'none';

            // 3. Re-enable transitions after a tiny delay, so they work next time.
            setTimeout(() => {
                controls.style.transition = ''; // Resets to the CSS-defined value
            }, 20);
        }
    }
}

function setupEasterEgg() {
    const easterEgg = document.getElementById('easterEgg');
    const boidCanvas = document.getElementById('boidCanvas');
    let tapCount = 0;
    let canIncrement = true;
    let currentScale = 1; // Logical current scale
    let isAnimating = false; // Main animation lock

    // Shared state for transform properties
    let activeTransformState = {
        x: 0,
        y: 0,
        scale: currentScale,
        rotate: 0
    };

    function resetEasterEggState() {
        console.log("Resetting Easter Egg state to default.");
        tapCount = 0;
        currentScale = 1;
        canIncrement = true;
        isAnimating = false;

        // Reset the logical state for transformations
        activeTransformState = { x: 0, y: 0, scale: 1, rotate: 0 };

        // Also reset the actual visual style of the element instantly.
        if (easterEgg) {
            // By setting the transform to an empty string, we remove any inline
            // styles and let it revert to its stylesheet definition.
            easterEgg.style.transform = '';
        }
    }

    window.setControlsVisibility = setControlsVisibility;
    window.resetEasterEggState = resetEasterEggState;

    function applyCurrentTransform() {
        easterEgg.style.transform = `translateY(${activeTransformState.y}px) translateX(${activeTransformState.x}px) scale(${activeTransformState.scale}) rotate(${activeTransformState.rotate}deg)`;
    }

    if (easterEgg) {
        function animate(direction) {
            if (isAnimating) return;
            isAnimating = true;
            activeTransformState.x = 0;
            activeTransformState.rotate = 0;

            const startTime = performance.now();
            const duration = 500;
            const baseDistance = 20;

            let scaleForBounceDepthCalculation = currentScale;
            let visualScaleDuringCurrentAnimation = currentScale;

            if (direction === 'down') {
                visualScaleDuringCurrentAnimation = currentScale;
                if (tapCount === 1) scaleForBounceDepthCalculation = 1.3;
                else if (tapCount === 2) scaleForBounceDepthCalculation = 1.5;
                else if (tapCount === 3) scaleForBounceDepthCalculation = 1.8;
            } else {
                scaleForBounceDepthCalculation = currentScale;
                visualScaleDuringCurrentAnimation = currentScale;
            }

            const scaledDistance = baseDistance * scaleForBounceDepthCalculation;
            const startPosition = direction === 'down' ? 0 : scaledDistance;
            const endPosition = direction === 'down' ? scaledDistance : 0;

            activeTransformState.scale = visualScaleDuringCurrentAnimation;
            activeTransformState.y = startPosition;
            applyCurrentTransform();

            function step(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = easeInOutElastic(progress);

                activeTransformState.y = startPosition + (endPosition - startPosition) * easeProgress;
                activeTransformState.scale = visualScaleDuringCurrentAnimation;
                applyCurrentTransform();

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    isAnimating = false;
                    if (direction === 'down') {
                        if (tapCount === 1) currentScale = 1.3;
                        else if (tapCount === 2) currentScale = 1.5;
                        else if (tapCount === 3) currentScale = 1.8;

                        activeTransformState.scale = currentScale;
                        activeTransformState.y = endPosition;
                        applyCurrentTransform();
                        setTimeout(() => animate('up'), 20);
                    } else if (direction === 'up') {
                        if (tapCount === 3) {
                            animateWiggle();
                            animateScaleToNormal(() => {
                                canIncrement = true;
                            });
                        } else {
                            canIncrement = true;
                        }
                        activeTransformState.y = 0;


                        applyCurrentTransform();
                    }
                }
            }
            requestAnimationFrame(step);
        }

        function animateScaleToNormal(onCompleteCallback) {
            isAnimating = true;
            activeTransformState.x = 0;
            activeTransformState.y = 0;
            activeTransformState.rotate = 0;

            const startTime = performance.now();
            const duration = 1000;
            const startScale = currentScale;
            const endScale = 1;

            activeTransformState.scale = startScale;
            applyCurrentTransform();

            function scaleStep(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);

                activeTransformState.scale = startScale + (endScale - startScale) * easeProgress;
                applyCurrentTransform();

                if (progress < 1) {
                    requestAnimationFrame(scaleStep);
                } else {
                    currentScale = 1;
                    activeTransformState.scale = 1;
                    activeTransformState.rotate = 0;
                    applyCurrentTransform();
                    isAnimating = false;
                    if (onCompleteCallback) {
                        onCompleteCallback();
                    }
                }
            }
            requestAnimationFrame(scaleStep);
        }

        function animateWiggle(onCompleteCallback) {
            if (animateWiggle.isRunning) return;
            animateWiggle.isRunning = true;

            const startTime = performance.now();
            const duration = 450;
            const numWiggles = 4;
            const wiggleFrequency = (2 * Math.PI * numWiggles) / duration;
            const amplitude = 1;
            const rotateAmplitude = 3;

            function wiggleStep(currentTime) {
                const elapsed = currentTime - startTime;
                let progress = elapsed / duration;

                if (progress >= 1) {
                    activeTransformState.x = 0;
                    activeTransformState.rotate = 0;
                    applyCurrentTransform();
                    animateWiggle.isRunning = false;
                    if (onCompleteCallback) onCompleteCallback();
                    return;
                }

                const currentXAmplitude = amplitude * (1 - progress); // Dampen X wiggle
                const xOffset = currentXAmplitude * Math.sin(elapsed * wiggleFrequency);

                const currentRotateAmplitude = rotateAmplitude * (1 - progress);
                const rotationOffset = currentRotateAmplitude * Math.sin(elapsed * wiggleFrequency);
                // const rotationOffset = currentRotateAmplitude * Math.cos(elapsed * wiggleFrequency); // Alternative

                activeTransformState.x = xOffset;
                activeTransformState.rotate = rotationOffset;
                applyCurrentTransform();

                requestAnimationFrame(wiggleStep);
            }
            requestAnimationFrame(wiggleStep);
        }
        animateWiggle.isRunning = false;


        function animateGrowAndShrink(onCompleteCallback) {
            if (isAnimating) return;
            isAnimating = true;

            const growDuration = 200;
            const shrinkDuration = 250;
            const targetScaleFactor = 1.8;
            const initialAnimScale = currentScale;
            const peakScale = initialAnimScale * targetScaleFactor;

            activeTransformState.y = 0;
            activeTransformState.scale = initialAnimScale;
            applyCurrentTransform();


            const growStartTime = performance.now();
            function growStep(currentTime) {
                const elapsed = currentTime - growStartTime;
                const progress = Math.min(elapsed / growDuration, 1);
                const easeProgress = 1 - Math.pow(1 - progress, 3);

                activeTransformState.scale = initialAnimScale + (peakScale - initialAnimScale) * easeProgress;
                applyCurrentTransform();

                if (progress < 1) {
                    requestAnimationFrame(growStep);
                } else {
                    const shrinkStartTime = performance.now();
                    function shrinkStep(currentTimeShrink) {
                        const elapsedShrink = currentTimeShrink - shrinkStartTime;
                        const progressShrink = Math.min(elapsedShrink / shrinkDuration, 1);
                        const easeProgressShrink = 1 - Math.pow(1 - progressShrink, 3);

                        activeTransformState.scale = peakScale + (initialAnimScale - peakScale) * easeProgressShrink;
                        applyCurrentTransform();

                        if (progressShrink < 1) {
                            requestAnimationFrame(shrinkStep);
                        } else {
                            currentScale = initialAnimScale;
                            activeTransformState.scale = initialAnimScale;
                            if (!animateWiggle.isRunning) {
                                activeTransformState.x = 0;
                                activeTransformState.rotate = 0;
                            }
                            applyCurrentTransform();

                            isAnimating = false;
                            if (onCompleteCallback) onCompleteCallback();
                        }
                    }
                    requestAnimationFrame(shrinkStep);
                }
            }
            requestAnimationFrame(growStep);
        }


        easterEgg.addEventListener('click', () => {
            // No change needed for this initial section.
            if (!canIncrement) return;
            canIncrement = false;
            tapCount++;
            activeTransformState.scale = currentScale;
            activeTransformState.x = 0;
            activeTransformState.y = 0;
            activeTransformState.rotate = 0;
            applyCurrentTransform();

            // --- HIDING LOGIC (Tap 4) ---
            // Refactored to use the new function and preserve staggered timing.
            if (tapCount === 4) {
                // These animations for the egg itself start immediately.
                activeTransformState.scale = currentScale;
                activeTransformState.y = 0;
                activeTransformState.x = 0;
                activeTransformState.rotate = 0;
                applyCurrentTransform();
                animateWiggle(() => { /* Wiggle finished */ });
                animateGrowAndShrink(() => {
                    tapCount = 0;
                    canIncrement = true;
                });

                // The simulation's own exit animation also starts immediately.
                if (typeof window.startExitAnimation === 'function') {
                    window.startExitAnimation();
                }

                // REFACTOR: Start the fade-out of background elements after a 50ms delay.
                setTimeout(() => {
                    // Call our new, clean function to hide the controls with animation.
                    setControlsVisibility(false);

                    // Start the canvas fade-out at the same time.
                    if (boidCanvas) boidCanvas.style.opacity = '0';
                }, 50);

                // REFACTOR: Schedule the final cleanup to run after the 1000ms animation completes.
                setTimeout(() => {
                    if (boidCanvas) boidCanvas.style.display = 'none';
                    // Note: setControlsVisibility handles its own display change, no need to repeat.
                    document.body.classList.remove('boid-active');
                    if (typeof window.stopSimulation === 'function') {
                        window.stopSimulation();
                    }
                }, 1050); // 50ms delay + 1000ms animation = 1050ms total time.

            }
            // No change needed for this block.
            else if (tapCount === 5) {
                tapCount = 1;
                animate('down');
            }
            // --- BUILD-UP & SHOWING LOGIC (Taps 1-3) ---
            else if (tapCount >= 1 && tapCount <= 3) {
                // This runs on taps 1, 2, and 3.
                animate('down');

                // This nested block ONLY runs on the 3rd tap to reveal the simulation.
                if (tapCount === 3) {
                    // The original timing chain is preserved for the desired visual effect.
                    setTimeout(() => {
                        if (boidCanvas) {
                            boidCanvas.style.display = 'block';
                            boidCanvas.style.opacity = '0';
                        }
                        setTimeout(() => {
                            if (boidCanvas) boidCanvas.style.opacity = '1';
                            document.body.classList.add('boid-active');

                            // REFACTOR: The complex logic for showing the controls is now one function call.
                            // This is scheduled after a 500ms delay to let the canvas appear first.
                            setTimeout(() => {
                                // Show the controls with the default fade-in animation.
                                setControlsVisibility(true);

                                // Initialize the simulation and slider as the controls are fading in.
                                if (typeof initializeSlider === 'function') initializeSlider('speedSlider', 'speedValue', '%');
                                if (typeof startSimulation === 'function') startSimulation();
                            }, 500);
                        }, 50);
                    }, 500);
                }
            }
            // No change needed for this final reset block.
            else {
                resetEasterEggState();
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', setupEasterEgg);

/**
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

    const sliderInputHandlerKey = `_sliderInputHandler_${sliderId}`;

    if (slider[sliderInputHandlerKey]) {
        slider.removeEventListener('input', slider[sliderInputHandlerKey]);
    }

    const updateSliderHandler = function () {
        const value = parseFloat(slider.value);

        updateSliderFill(slider);

        if (display) {
            const step = slider.step;
            if (step && step.includes('.')) {
                const precision = step.split('.')[1].length;
                display.textContent = value.toFixed(precision) + suffix;
            } else {
                display.textContent = value + suffix;
            }
        }
    };

    slider[sliderInputHandlerKey] = updateSliderHandler;
    slider.addEventListener('input', slider[sliderInputHandlerKey]);

    updateSliderHandler();

    if (typeof enableSliderWheelControl === 'function') {
        enableSliderWheelControl(slider);
    }
}

var easterEggElement = document.getElementById('easterEgg');

if (easterEggElement) {
    function preloadImages() {
        const normalImg = new Image();
        const hoverImg = new Image();

        normalImg.src = getLogoPath('home.webp');
        hoverImg.src = getLogoPath('home-hover.webp');
    }
    preloadImages();

    easterEggElement.addEventListener('mousedown', function () {
        easterEggElement.classList.add('easter-egg--clicked');
    });

    easterEggElement.addEventListener('mouseup', function () {
        setTimeout(function () {
            easterEggElement.classList.remove('easter-egg--clicked');
        }, 25);
    });
}