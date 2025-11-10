// This module is responsible for the Experimental Menu UI.
// It receives initial state and dispatches events when the user interacts.
// It does NOT modify the main application state directly.

import { MAX_FLOCK_SIZE_HARD_CAP } from './simulation.js';
import { updateSliderFill, enableSliderWheelControl } from './ui-utils.js';

// --- Private variables ---
let menuContainer; // Keep a reference to the main menu element
const inputElements = {}; // To easily update sliders from text inputs and vice-versa

// --- Private Functions ---

function dispatch(eventName, detail) {
    const event = new CustomEvent(eventName, {
        detail: detail,
        bubbles: true,
        composed: true
    });
    (menuContainer || document.body).dispatchEvent(event);
}

/**
 * Creates a DOM element with specified Tailwind classes and properties.
 * @param {string} tag - The HTML tag for the element.
 * @param {string} classList - A string of Tailwind CSS classes.
 * @param {Object} [properties={}] - Other properties to assign to the element.
 * @returns {HTMLElement} The created element.
 */
function createElement(tag, classList, properties = {}) {
    const element = document.createElement(tag);
    element.className = classList.trim().split(/\s+/).filter(Boolean).join(' ');
    Object.assign(element, properties);
    return element;
}

// --- Public (Exported) Functions ---

/**
 * Sets the visibility of the menu, with an option to skip the animation.
 * @param {boolean} isVisible - Whether the menu should be visible.
 * @param {object} [options={}] - An options object.
 * @param {boolean} [options.animated=true] - If false, the change happens instantly.
 */
export function setMenuVisibility(isVisible, options = {}) {
    const { animated = true } = options; // Default to an animated transition

    if (!menuContainer) return;

    // Centralize all relevant class lists for easy management
    const openClasses = ['opacity-100', 'translate-y-0', 'scale-100', 'pointer-events-auto'];
    const closedClasses = ['opacity-0', 'translate-y-5', 'scale-95', 'pointer-events-none'];
    const transitionClasses = ['transition', 'ease-out', 'duration-300'];

    // --- HIDING LOGIC ---
    if (!isVisible) {
        menuContainer.setAttribute('inert', 'true');
        menuContainer.classList.remove(...openClasses);

        if (animated) {
            // Standard behavior: just add the classes and let the transition run.
            menuContainer.classList.add(...closedClasses);
        } else {
            // INSTANT behavior for page loads/bfcache restores:
            // 1. Temporarily remove transition classes to make the next change instant.
            menuContainer.classList.remove(...transitionClasses);

            // 2. Apply the final 'closed' state classes. This happens immediately.
            menuContainer.classList.add(...closedClasses);

            // 3. IMPORTANT: Use a minimal timeout to re-apply the transition classes
            //    *after* the browser has rendered the instant change. This ensures
            //    that the *next* time the menu is opened, it will animate correctly.
            setTimeout(() => {
                menuContainer.classList.add(...transitionClasses);
            }, 10); // A tiny delay is all that's needed.
        }
        return; // We're done hiding.
    }

    // --- SHOWING LOGIC (can remain the same) ---
    menuContainer.removeAttribute('inert');
    menuContainer.classList.remove(...closedClasses);
    menuContainer.classList.add(...openClasses);
}

/**
 * Fetches an SVG sprite sheet and injects its symbols into the document.
 * This is the most performant method for using multiple icons from a
 * single file, as it requires only ONE HTTP request.
 * It runs only once.
 * @param {string} url - The path to the SVG sprite sheet file.
 */
async function loadSvgIcons(url) {
    const ICON_SPRITE_ID = 'boid-ui-icons';
    if (document.getElementById(ICON_SPRITE_ID)) return;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const svgText = await response.text();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = svgText;
        const svgElement = tempDiv.querySelector('svg');

        if (svgElement) {
            svgElement.setAttribute('id', ICON_SPRITE_ID);
            svgElement.style.display = 'none';
            svgElement.setAttribute('aria-hidden', 'true');
            document.body.prepend(svgElement);
        }
    } catch (error) {
        console.error(`Could not load SVG icons from ${url}:`, error);
    }
}

export async function initializeMenu(initialParams, initialDebugFlags) {
    if (document.getElementById('experimentalMenu')) return;

    await loadSvgIcons('/assets/images/icons.svg');

    // --- Refactored configuration to include Debug toggles ---
    const categorizedParamConfigs = {
        General: {
            FLOCK_SIZE: { label: 'Flock Size', type: 'range', min: 1, max: MAX_FLOCK_SIZE_HARD_CAP, step: 1, precision: 0 }
        },
        Force: {
            ALIGNMENT_FORCE: { label: 'Alignment', type: 'range', min: 0, max: 2, step: 0.1, precision: 1 },
            COHESION_FORCE: { label: 'Cohesion', type: 'range', min: 0, max: 3, step: 0.1, precision: 1 },
            SEPARATION_FORCE: { label: 'Separation', type: 'range', min: 0, max: 2, step: 0.1, precision: 1 },
            OBSTACLE_FORCE: { label: 'Obstacle', type: 'range', min: 0, max: 3, step: 0.1, precision: 1 },
        },
        Radius: {
            ALIGNMENT_RADIUS: { label: 'Alignment', type: 'range', min: 10, max: 500, step: 5 },
            COHESION_RADIUS: { label: 'Cohesion', type: 'range', min: 10, max: 750, step: 10 },
            SEPARATION_RADIUS: { label: 'Separation', type: 'range', min: 10, max: 500, step: 5 },
            OBSTACLE_RADIUS: { label: 'Obstacle', type: 'range', min: 10, max: 500, step: 5 },
        },
        Inertia: {
            VELOCITY_INERTIA: { label: 'Velocity', type: 'range', min: 0, max: 2, step: 0.01, precision: 2 },
            ROTATION_INERTIA: { label: 'Rotation', type: 'range', min: 0, max: 1.5, step: 0.01, precision: 2 },
        },
        Debug: {
            grid: { label: 'Grid', type: 'checkbox', checked: initialDebugFlags.grid },
            obstacles: { label: 'Obstacles', type: 'checkbox', checked: initialDebugFlags.obstacles },
            lines: { label: 'Lines', type: 'checkbox', checked: initialDebugFlags.lines }
        }
    };

    // --- Main container setup ---
    menuContainer = createElement('div', `
        fixed bottom-4 left-4 z-[1000] min-w-[276px]
        flex-col bg-black/60 text-white backdrop-blur-sm
        rounded-[32px] font-sans text-xs overflow-hidden
        max-h-[calc(100vh-32px)]
        transition ease-out duration-300
        opacity-0 translate-y-5 scale-95 pointer-events-none
        hidden md:flex
    `, {
        id: 'experimentalMenu',
        inert: 'true',
    });

    const scrollableContent = createElement('div', 'flex-grow overflow-y-auto scrollable-content py-4 px-3 min-h-0', {});
    Object.assign(scrollableContent.style, { scrollbarGutter: 'stable both-edges' });

    const titleContainer = createElement('div', 'relative w-full mb-3');
    const title = createElement('h2', 'm-0 text-center text-white text-lg font-medium', { textContent: 'God Mode' });

    // --- Create and add the dice button for randomization ---
    const randomizeButton = createElement('button', `
        absolute left-[-4px] top-1/2 -translate-y-1/2
        bg-transparent border-none text-white
        cursor-pointer p-2 leading-none
        hover:text-neutral-300 transition-colors
    `, {
        innerHTML: '<svg class="w-5 h-5"><use href="#dice-d20"></use></svg>'
    });

    const icon = randomizeButton.querySelector('svg');

    icon.addEventListener('animationend', () => {
        icon.classList.remove('dice-is-spinning');
    });

    randomizeButton.addEventListener('click', () => {
        // By removing the class and then adding it back within a minimal timeout,
        // we ensure the browser processes the removal before the addition,
        // which reliably restarts the animation from the beginning.
        icon.classList.remove('dice-is-spinning');
        setTimeout(() => {
            icon.classList.add('dice-is-spinning');
        }, 0); // A 0ms timeout is sufficient to queue this for the next paint cycle.

        let newParams;
        let isSizeLarge, isAnyRadiusLarge;

        // Keep generating random parameters until the constraint is met.
        // The constraint: FLOCK_SIZE and any RADIUS cannot both be large (> 400).
        do {
            newParams = {};
            // First, generate a full set of random parameters
            for (const categoryName in categorizedParamConfigs) {
                const paramsInCategory = categorizedParamConfigs[categoryName];
                for (const key in paramsInCategory) {
                    const config = paramsInCategory[key];
                    if (config.type === 'range') {
                        const min = parseFloat(config.min);
                        const max = parseFloat(config.max);
                        const step = parseFloat(config.step) || 1;
                        const precision = config.precision !== undefined ? config.precision : 2;

                        const numSteps = Math.floor((max - min) / step);
                        const randomStepIndex = Math.floor(Math.random() * (numSteps + 1));
                        let newValue = min + randomStepIndex * step;
                        newValue = Math.min(max, newValue); // Clamp to max for safety
                        const finalValue = parseFloat(newValue.toFixed(precision));

                        newParams[key] = finalValue;
                    }
                }
            }

            // Now, check if the generated set violates the constraint
            isSizeLarge = newParams.FLOCK_SIZE > 400;
            isAnyRadiusLarge =
                newParams.ALIGNMENT_RADIUS > 400 ||
                newParams.COHESION_RADIUS > 400 ||
                newParams.SEPARATION_RADIUS > 400 ||
                newParams.OBSTACLE_RADIUS > 400;

        } while (isSizeLarge && isAnyRadiusLarge); // Loop if both conditions are true

        // Once a valid set is found, dispatch all changes and update the UI
        for (const key in newParams) {
            dispatch('paramChanged', { key: key, value: newParams[key] });
        }
        updateMenuValues(newParams);
    });

    const closeButton = createElement('button', `
        absolute right-[-4px] top-1/2 -translate-y-1/2
        bg-transparent border-none text-2xl text-white
        cursor-pointer p-2 leading-none
        hover:text-neutral-300 transition-colors
    `, { innerHTML: '×' });
    titleContainer.append(randomizeButton, title, closeButton);

    // --- Stylesheet for menu controls and collapsible categories ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
            /* Basic Controls */
            #experimentalMenu .control-row {
                padding: 0 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
            }
            #experimentalMenu .control-row label {
                color: #f3f4f1; min-width: 65px; flex-shrink: 0; font-size: 12px;
            }
            #experimentalMenu .control-row input[type="range"] {
                flex-grow: 1; max-width: 100px;
            }
            #experimentalMenu .value-input {
                width: 32px; text-align: center; color: #f3f4f1;
                background: transparent; border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 32px; font-size: 11px;
                font-family: Arial, sans-serif;
            }
            #experimentalMenu .value-input:hover {
                border-color: rgba(255, 255, 255, 0.5);
            }
            #experimentalMenu .value-input:focus {
                outline: none; border-color: #2196F3;
            }

            /* Dice Button Animation */
            @keyframes dice-bounce-and-roll {
                0% {
                    transform: translateY(0) rotate(0deg);
                    animation-timing-function: cubic-bezier(0.25, 0.75, 0.5, 1);
                }
                40% {
                    /* Peak of the throw, reduced height */
                    transform: translateY(-15px) rotate(270deg);
                    animation-timing-function: cubic-bezier(0.5, 0, 0.75, 0.25);
                }
                60% {
                    /* First bounce impact */
                    transform: translateY(0px) rotate(330deg);
                    animation-timing-function: cubic-bezier(0.25, 0.75, 0.5, 1);
                }
                80% {
                    /* Second, smaller bounce, reduced height */
                    transform: translateY(-5px) rotate(350deg);
                    animation-timing-function: cubic-bezier(0.5, 0, 0.75, 0.25);
                }
                100% {
                    /* Settle */
                    transform: translateY(0) rotate(360deg);
                }
            }

            .dice-is-spinning {
                transform-origin: center;
                animation: dice-bounce-and-roll 0.5s ease-out;
            }


            /* Collapsible Category Styles */
            #experimentalMenu .category-header {
                display: flex; justify-content: space-between; align-items: center; cursor: pointer;
                padding: 8px 0; user-select: none; transition: background-color 0.2s; border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }
            #experimentalMenu .category-header:hover { background-color: rgba(255,255,255,0.1); }
            #experimentalMenu .category-header h4 {
                margin-left: 4px; font-size: 14px; color: #f3f4f1;
            }
            #experimentalMenu .category-arrow {
                width: 8px; 
                height: 8px; 
                border-left: 2px solid #f3f4f1; 
                border-bottom: 2px solid #f3f4f1;
                transform: translateY(-2px) rotate(-45deg); 
                transition: transform 0.3s ease-out; 
                margin-right: 6px;
                transform-origin: center;
                position: relative;
            }
            #experimentalMenu .category-header.is-open .category-arrow {
                transform: translateY(2px) rotate(135deg);
            }
            #experimentalMenu .category-content-wrapper {
                display: grid; 
                grid-template-rows: 0fr; /* Collapsed by default */
                padding-top: 0; /* Initial state - no padding */
                transition: grid-template-rows 0.35s ease-in-out, padding-top 0.35s ease-in-out;
            }

            #experimentalMenu .category-content-wrapper.is-open {
                grid-template-rows: 1fr; 
                padding-top: 8px; /* Expanded state */
            }
            #experimentalMenu .category-content {
                overflow: hidden; 
            }
            /* Only remove bottom margin from the last control in the Debug category */
            #experimentalMenu .category-debug .control-row:last-child {
                margin-bottom: 0;
            }

            /* Scrollbar */
            #experimentalMenu .scrollable-content {
                scrollbar-color: #f3f4f1 rgba(255, 255, 255, 0.2);
                scrollbar-width: thin;
            }
    `;

    menuContainer.addEventListener('mouseenter', () => dispatch('menuInteraction', { hovering: true }));
    menuContainer.addEventListener('mouseleave', () => dispatch('menuInteraction', { hovering: false }));
    closeButton.addEventListener('click', () => dispatch('godModeToggled', { enabled: false }));
    scrollableContent.appendChild(titleContainer);

    document.head.appendChild(styleSheet);

    // --- Create and append all parameter controls in collapsible categories ---
    for (const categoryName in categorizedParamConfigs) {
        const isOpen = true;
        const categoryContainer = createElement('div', 'category-container');
        const categoryHeader = createElement('div', `category-header ${isOpen ? 'is-open' : ''}`);
        const categoryTitle = createElement('h4', '', { textContent: categoryName });
        const categoryArrow = createElement('div', 'category-arrow');
        categoryHeader.append(categoryTitle, categoryArrow);

        const contentWrapper = createElement('div', `category-content-wrapper ${isOpen ? 'is-open' : ''}`);
        const contentDiv = createElement('div', 'category-content');

        // Add a specific class to the Debug category's content for styling
        if (categoryName === 'Debug') {
            contentDiv.classList.add('category-debug');
        }

        const paramsInCategory = categorizedParamConfigs[categoryName];
        for (const key in paramsInCategory) {
            const config = paramsInCategory[key];
            const controlRow = createElement('div', 'control-row');

            if (config.type === 'range') {
                const labelEl = createElement('label', '', { htmlFor: `param-${key}-input`, textContent: config.label });
                const inputEl = createElement('input', '', { type: 'range', id: `param-${key}-input`, min: config.min, max: config.max, step: config.step, value: initialParams[key] });
                const valueInput = createElement('input', 'value-input', { type: 'text', id: `param-${key}-value`, value: config.precision ? initialParams[key].toFixed(config.precision) : initialParams[key].toString() });

                inputEl.addEventListener('input', () => {
                    const newVal = parseFloat(inputEl.value);
                    valueInput.value = config.precision ? newVal.toFixed(config.precision) : newVal.toString();
                    if (config.type === 'range') updateSliderFill(inputEl);
                    dispatch('paramChanged', { key: key, value: newVal });
                });
                valueInput.addEventListener('input', () => {
                    let newVal = parseFloat(valueInput.value);
                    if (!isNaN(newVal)) {
                        newVal = Math.max(config.min, Math.min(config.max, newVal));
                        inputEl.value = newVal;
                        if (config.type === 'range') updateSliderFill(inputEl);
                        dispatch('paramChanged', { key: key, value: newVal });
                    }
                });
                const finalizeInputValue = () => {
                    let currentVal = parseFloat(valueInput.value);
                    if (isNaN(currentVal)) {
                        currentVal = parseFloat(inputEl.value);
                    }
                    const min = parseFloat(config.min);
                    const max = parseFloat(config.max);
                    currentVal = Math.max(min, Math.min(max, currentVal));
                    valueInput.value = config.precision ? currentVal.toFixed(config.precision) : currentVal.toString();
                    inputEl.value = currentVal;
                    updateSliderFill(inputEl);
                    dispatch('paramChanged', { key: key, value: currentVal });
                };

                valueInput.addEventListener('blur', finalizeInputValue);
                valueInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        finalizeInputValue();
                        valueInput.blur();
                    }
                });

                updateSliderFill(inputEl);
                enableSliderWheelControl(inputEl);
                inputElements[key] = { input: inputEl, valueInput: valueInput, config: config };
                controlRow.append(labelEl, inputEl, valueInput);

            } else if (config.type === 'checkbox') {
                const label = createElement('label', '', { htmlFor: `debug-${key}-toggle`, textContent: config.label });
                const checkbox = createElement('input', '', { type: 'checkbox', id: `debug-${key}-toggle`, checked: config.checked });
                checkbox.addEventListener('change', () => dispatch('debugFlagChanged', { flag: key, enabled: checkbox.checked }));
                controlRow.append(label, checkbox);
            }
            contentDiv.appendChild(controlRow);
        }

        contentWrapper.appendChild(contentDiv);
        categoryContainer.append(categoryHeader, contentWrapper);
        scrollableContent.appendChild(categoryContainer);

        categoryHeader.addEventListener('click', () => {
            categoryHeader.classList.toggle('is-open');
            contentWrapper.classList.toggle('is-open');
        });
    }


    // --- Create and append Reset button ---
    const resetButton = createElement('button', 'px-3 py-2 mt-4 w-full bg-background text-gray-600 rounded-2xl cursor-pointer hover:bg-backgroundHovered', { textContent: 'Reset' });
    resetButton.addEventListener('click', () => {
        dispatch('paramsReset');
    });
    scrollableContent.appendChild(resetButton);

    // --- Final DOM attachment ---
    menuContainer.appendChild(scrollableContent);
    document.body.appendChild(menuContainer);
}


export function updateMenuValues(newParams) {
    for (const key in newParams) {
        if (inputElements[key]) {
            const { input, valueInput, config } = inputElements[key];
            input.value = newParams[key];
            valueInput.value = config.precision ? newParams[key].toFixed(config.precision) : newParams[key].toString();
            if (input.type === 'range') {
                updateSliderFill(input);
            }
        }
    }
}

/**
 * NEW: Updates the visual state of the debug checkboxes from external state.
 * @param {object} newDebugFlags - An object like { grid: false, obstacles: true }.
 */
export function updateDebugCheckboxes(newDebugFlags) {
    for (const flag in newDebugFlags) {
        const checkbox = document.getElementById(`debug-${flag}-toggle`);
        if (checkbox) {
            checkbox.checked = newDebugFlags[flag];
        }
    }
}