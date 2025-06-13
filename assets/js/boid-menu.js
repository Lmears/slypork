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

export function initializeMenu(initialParams, initialDebugFlags) {
    if (document.getElementById('experimentalMenu')) return;

    const categorizedParamConfigs = {
        General: { // New category
            FLOCK_SIZE: {
                label: 'Flock Size',
                type: 'range',
                min: 1,
                max: MAX_FLOCK_SIZE_HARD_CAP,
                step: 1,
                precision: 0
            }
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

    const scrollableContent = document.createElement('div');
    scrollableContent.classList.add(
        'flex-grow', 'overflow-y-auto', 'scrollable-content', 'py-4', 'px-3', 'min-h-0'
    );
    Object.assign(scrollableContent.style, { scrollbarGutter: 'stable both-edges' });

    const titleContainer = createElement('div', 'relative w-full pb-1 mb-2.5');
    const title = createElement('h2', 'm-0 text-center text-white text-lg font-medium', { textContent: 'God Mode' });
    const closeButton = createElement('button', `
        absolute right-[-8px] top-1/2 -translate-y-1/2
        bg-transparent border-none text-2xl text-white
        cursor-pointer p-2 leading-none
        hover:text-neutral-300 transition-colors
    `, { innerHTML: '×' });
    titleContainer.append(title, closeButton);

    // --- Stylesheet for menu controls ---
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
            #experimentalMenu .control-row {
                display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;
            }
            #experimentalMenu .control-row label {
                color: #f3f4f1; min-width: 65px; flex-shrink: 0;
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
            #experimentalMenu .value-input:focus {
                outline: none; border-color: #2196F3;
            }

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

    // --- Create and append all parameter controls ---
    for (const categoryName in categorizedParamConfigs) {
        const categoryTitle = document.createElement('h4');
        categoryTitle.textContent = categoryName;
        Object.assign(categoryTitle.style, { marginTop: '15px', marginBottom: '10px', color: '#f3f4f1', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', paddingBottom: '5px' });
        scrollableContent.appendChild(categoryTitle);

        const paramsInCategory = categorizedParamConfigs[categoryName];
        for (const key in paramsInCategory) {
            // This is the full loop you provided, now placed correctly inside the function.
            const config = paramsInCategory[key];
            const controlDiv = document.createElement('div');
            controlDiv.className = 'control-row';
            const labelEl = document.createElement('label');
            labelEl.htmlFor = `param-${key}-input`;
            labelEl.textContent = `${config.label} `;
            const inputEl = document.createElement('input');
            inputEl.type = config.type;
            inputEl.id = `param-${key}-input`;
            inputEl.min = config.min;
            inputEl.max = config.max;
            inputEl.step = config.step;
            inputEl.value = initialParams[key];
            const valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.id = `param-${key}-value`;
            valueInput.className = 'value-input';
            valueInput.value = config.precision ? initialParams[key].toFixed(config.precision) : initialParams[key].toString();

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
            })

            if (config.type === 'range') { updateSliderFill(inputEl); enableSliderWheelControl(inputEl); }
            inputElements[key] = { input: inputEl, valueInput: valueInput, config: config };
            controlDiv.appendChild(labelEl);
            controlDiv.appendChild(inputEl);
            controlDiv.appendChild(valueInput);
            scrollableContent.appendChild(controlDiv);
        }
    }

    // --- Create and append Debug Section ---
    const debugTitle = document.createElement('h4');
    debugTitle.textContent = 'Debug';
    Object.assign(debugTitle.style, { marginTop: '15px', marginBottom: '10px', color: '#f3f4f1', borderBottom: '1px solid rgba(255, 255, 255, 0.2)', paddingBottom: '5px' });
    scrollableContent.appendChild(debugTitle);
    const debugSectionDiv = document.createElement('div');
    const debugGridToggleControlRow = document.createElement('div');
    debugGridToggleControlRow.className = 'control-row';
    const debugGridLabel = document.createElement('label');
    debugGridLabel.htmlFor = 'debug-grid-toggle';
    debugGridLabel.textContent = 'Grid';
    debugGridLabel.style.color = '#f3f4f1';
    const debugGridCheckbox = document.createElement('input');
    debugGridCheckbox.type = 'checkbox';
    debugGridCheckbox.id = 'debug-grid-toggle';
    debugGridCheckbox.checked = initialDebugFlags.grid;
    debugGridCheckbox.addEventListener('change', () => dispatch('debugFlagChanged', { flag: 'grid', enabled: debugGridCheckbox.checked }));
    debugGridToggleControlRow.appendChild(debugGridLabel);
    debugGridToggleControlRow.appendChild(debugGridCheckbox);
    debugSectionDiv.appendChild(debugGridToggleControlRow);

    const debugObstaclesToggleControlRow = document.createElement('div');
    debugObstaclesToggleControlRow.className = 'control-row';
    const debugObstaclesLabel = document.createElement('label');
    debugObstaclesLabel.htmlFor = 'debug-obstacles-toggle';
    debugObstaclesLabel.textContent = 'Obstacles';
    debugObstaclesLabel.style.color = '#f3f4f1';
    const debugObstaclesCheckbox = document.createElement('input');
    debugObstaclesCheckbox.type = 'checkbox';
    debugObstaclesCheckbox.id = 'debug-obstacles-toggle';
    debugObstaclesCheckbox.checked = initialDebugFlags.obstacles;
    debugObstaclesCheckbox.addEventListener('change', () => dispatch('debugFlagChanged', { flag: 'obstacles', enabled: debugObstaclesCheckbox.checked }));
    debugObstaclesToggleControlRow.appendChild(debugObstaclesLabel);
    debugObstaclesToggleControlRow.appendChild(debugObstaclesCheckbox);
    debugSectionDiv.appendChild(debugObstaclesToggleControlRow);
    scrollableContent.appendChild(debugSectionDiv);

    // --- Create and append Reset button ---
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset';
    resetButton.className = 'px-3 py-2 mt-2 w-full bg-background text-gray-600 rounded-2xl cursor-pointer hover:bg-backgroundHovered';
    // Replace the existing reset button event listener with this updated version:

    resetButton.addEventListener('click', () => {
        // Reset parameters
        dispatch('paramsReset');

        // Reset debug checkboxes to unchecked
        const debugGridCheckbox = document.getElementById('debug-grid-toggle');
        const debugObstaclesCheckbox = document.getElementById('debug-obstacles-toggle');

        if (debugGridCheckbox && debugGridCheckbox.checked) {
            debugGridCheckbox.checked = false;
            dispatch('debugFlagChanged', { flag: 'grid', enabled: false });
        }

        if (debugObstaclesCheckbox && debugObstaclesCheckbox.checked) {
            debugObstaclesCheckbox.checked = false;
            dispatch('debugFlagChanged', { flag: 'obstacles', enabled: false });
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