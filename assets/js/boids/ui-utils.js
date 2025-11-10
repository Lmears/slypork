/**
 * UI control utilities for boid simulation.
 * This module provides reusable functionality for managing the boid control panel,
 * including range sliders, buttons, and visibility control.
 */

/**
 * Updates the fill style of a range slider based on its current value.
 * Sets a CSS custom property '--value' on the slider element for visual feedback.
 * @param {HTMLInputElement} slider - The slider element.
 */
export function updateSliderFill(slider) {
    if (!slider || slider.type !== 'range') {
        console.warn('Invalid element passed to updateSliderFill. Expected a range input.', slider);
        return;
    }
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const val = parseFloat(slider.value);
    const percentage = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--value', percentage + '%');
}

/**
 * Adds mouse wheel control to a slider element, ensuring only one listener is active.
 * Changes the slider's value based on wheel scroll and dispatches an 'input' event.
 * @param {HTMLInputElement} slider - The slider element to add wheel control to.
 */
export function enableSliderWheelControl(slider) {
    if (!slider || slider.type !== 'range') {
        console.warn('Invalid element passed to enableSliderWheelControl. Expected a range input.', slider);
        return;
    }

    const wheelHandlerKey = '_sliderWheelEventHandler';

    // Remove existing handler if present (idempotency)
    if (slider[wheelHandlerKey]) {
        slider.removeEventListener('wheel', slider[wheelHandlerKey]);
    }

    const wheelHandler = (event) => {
        event.preventDefault();

        const step = parseFloat(slider.step) || 1;
        const min = parseFloat(slider.min);
        const max = parseFloat(slider.max);

        let value = parseFloat(slider.value);
        value += event.deltaY < 0 ? step : -step;
        value = Math.min(max, Math.max(min, value));

        if (slider.step.includes('.')) {
            const precision = slider.step.split('.')[1].length;
            value = Number(value.toFixed(precision));
        }

        slider.value = value;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    };

    slider[wheelHandlerKey] = wheelHandler;
    slider.addEventListener('wheel', wheelHandler, { passive: false });
}

/**
 * Adds double-click reset behavior to a slider, returning it to its default value.
 * The default value is stored when this function is first called.
 * @param {HTMLInputElement} slider - The slider element to add double-click reset to.
 * @param {number} [defaultValue] - Optional explicit default value. If not provided, uses slider's current value.
 */
export function enableSliderDoubleClickReset(slider, defaultValue) {
    if (!slider || slider.type !== 'range') {
        console.warn('Invalid element passed to enableSliderDoubleClickReset. Expected a range input.', slider);
        return;
    }

    const resetHandlerKey = '_sliderResetEventHandler';
    const defaultValueKey = '_sliderDefaultValue';

    // Store the default value (either provided or current value)
    if (!slider[defaultValueKey]) {
        slider[defaultValueKey] = defaultValue !== undefined ? defaultValue : parseFloat(slider.value);
    }

    // Remove existing handler if present (idempotency)
    if (slider[resetHandlerKey]) {
        slider.removeEventListener('dblclick', slider[resetHandlerKey]);
    }

    const resetHandler = () => {
        slider.value = slider[defaultValueKey];
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    };

    slider[resetHandlerKey] = resetHandler;
    slider.addEventListener('dblclick', resetHandler);
}

/**
 * Initializes a slider with visual fill updates, optional display value, and wheel control.
 * This is a complete initialization function that sets up all slider functionality.
 * @param {string} sliderId - The ID of the slider element
 * @param {string} [displayId] - Optional ID of element to show the value
 * @param {string} [suffix='%'] - Suffix to add to displayed value
 * @returns {HTMLInputElement|null} - The slider element, or null if not found
 */
export function initializeSlider(sliderId, displayId = null, suffix = '%') {
    const slider = document.getElementById(sliderId);
    const display = displayId ? document.getElementById(displayId) : null;

    if (!slider) {
        console.warn(`Slider with ID '${sliderId}' not found`);
        return null;
    }

    const sliderInputHandlerKey = `_sliderInputHandler_${sliderId}`;

    // Store the initial (default) value from HTML
    const defaultValue = parseFloat(slider.value);

    // Remove existing handler if present (idempotent)
    if (slider[sliderInputHandlerKey]) {
        slider.removeEventListener('input', slider[sliderInputHandlerKey]);
    }

    const updateSliderHandler = () => {
        const value = parseFloat(slider.value);
        updateSliderFill(slider);

        if (display) {
            const step = slider.step;
            const precision = step && step.includes('.') ? step.split('.')[1].length : 0;
            display.textContent = value.toFixed(precision) + suffix;
        }
    };

    slider[sliderInputHandlerKey] = updateSliderHandler;
    slider.addEventListener('input', updateSliderHandler);

    // Add double-click reset behavior
    enableSliderDoubleClickReset(slider, defaultValue);

    // Initial render setup
    updateSliderHandler();

    // Enable mouse wheel adjustment
    enableSliderWheelControl(slider);

    return slider;
}


/**
 * Controls the visibility of the boid control panel (contains speed slider and settings button).
 * @param {boolean} isVisible - Whether the controls should be visible.
 * @param {object} [options={}] - An options object.
 * @param {boolean} [options.animated=true] - If false, the change happens instantly.
 */
export function setControlPanelVisibility(isVisible, options = {}) {
    const { animated = true } = options;
    const controls = document.getElementById('controls');
    if (!controls) return;

    // The duration of the fade animation
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
