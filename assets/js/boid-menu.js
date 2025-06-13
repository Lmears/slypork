// boid-menu.js

// This module is responsible for the Experimental Menu UI.
// It receives initial state and dispatches events when the user interacts.
// It does NOT modify the main application state directly.

import { MAX_FLOCK_SIZE_HARD_CAP } from './boid-simulator.js';

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

export function setMenuVisibility(isVisible) {
    if (!menuContainer) return;

    // Define the classes for each state
    const openClasses = ['opacity-100', 'translate-y-0', 'scale-100', 'pointer-events-auto'];
    const closedClasses = ['opacity-0', 'translate-y-5', 'scale-95', 'pointer-events-none'];

    if (isVisible) {
        menuContainer.removeAttribute('inert');
        menuContainer.classList.remove(...closedClasses);
        menuContainer.classList.add(...openClasses);
    } else {
        menuContainer.setAttribute('inert', 'true');
        menuContainer.classList.remove(...openClasses);
        menuContainer.classList.add(...closedClasses);
    }
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

    await loadSvgIcons('assets/images/icons.svg');

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
            obstacles: { label: 'Obstacles', type: 'checkbox', checked: initialDebugFlags.obstacles }
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

    const titleContainer = createElement('div', 'relative w-full pb-1 mb-2.5');
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

    randomizeButton.addEventListener('click', () => {
        const newParams = {};
        for (const categoryName in categorizedParamConfigs) {
            const paramsInCategory = categorizedParamConfigs[categoryName];
            for (const key in paramsInCategory) {
                const config = paramsInCategory[key];
                if (config.type === 'range') {
                    const min = parseFloat(config.min);
                    const max = parseFloat(config.max);
                    const step = parseFloat(config.step) || 1;
                    const precision = config.precision !== undefined ? config.precision : 2;

                    // Calculate the number of possible steps
                    const numSteps = Math.floor((max - min) / step);
                    // Choose a random step index
                    const randomStepIndex = Math.floor(Math.random() * (numSteps + 1));
                    // Calculate the new value
                    let newValue = min + randomStepIndex * step;
                    // Clamp to max in case of floating point inaccuracies
                    newValue = Math.min(max, newValue);
                    // Format to the correct precision
                    const finalValue = parseFloat(newValue.toFixed(precision));

                    // Dispatch event to notify the main application
                    dispatch('paramChanged', { key: key, value: finalValue });
                    // Store for local update
                    newParams[key] = finalValue;
                }
            }
        }
        // Update the menu UI to reflect the new random values
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
    const resetButton = createElement('button', 'px-3 py-2 mt-2 w-full bg-background text-gray-600 rounded-2xl cursor-pointer hover:bg-backgroundHovered', { textContent: 'Reset' });
    resetButton.addEventListener('click', () => {
        dispatch('paramsReset');
        for (const categoryName in categorizedParamConfigs) {
            const controls = categorizedParamConfigs[categoryName];
            for (const key in controls) {
                const config = controls[key];
                if (config.type === 'checkbox') {
                    const checkbox = document.getElementById(`debug-${key}-toggle`);
                    if (checkbox && checkbox.checked) {
                        checkbox.checked = false;
                        dispatch('debugFlagChanged', { flag: key, enabled: false });
                    }
                }
                // Add else-if for other future control types if needed
            }
        }
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