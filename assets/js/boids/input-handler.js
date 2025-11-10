import { Vector } from './vector.js';
import {
    MOUSE_INFLUENCE_RADIUS,
    CLICK_SCATTER_DURATION,
} from './config.js';

export class InputHandler {
    constructor(canvas, dependencies) {
        this.canvas = canvas;
        this.deps = dependencies;

        // Input state
        this.mouseInfluence = false;
        this.isScattering = false;
        this.boidsIgnoreMouse = false;
        this.boidsIgnoreTouch = false;
        this.touchEndTimeoutId = null;

        // Bind handlers to maintain context
        this.mouseMoveHandler = this.mouseMoveHandler.bind(this);
        this.mouseLeaveHandler = this.mouseLeaveHandler.bind(this);
        this.mouseDownHandler = this.mouseDownHandler.bind(this);
        this.mouseUpHandler = this.mouseUpHandler.bind(this);
        this.touchStartHandler = this.touchStartHandler.bind(this);
        this.touchMoveHandler = this.touchMoveHandler.bind(this);
        this.touchEndHandler = this.touchEndHandler.bind(this);
        this.resizeHandler = this.resizeHandler.bind(this);
        this.documentClickHandler = this.documentClickHandler.bind(this);
        this.speedSliderInputHandler = this.speedSliderInputHandler.bind(this);
        this.speedControlsMouseEnterHandler = this.speedControlsMouseEnterHandler.bind(this);
        this.speedControlsMouseLeaveHandler = this.speedControlsMouseLeaveHandler.bind(this);
        this.iframeMouseEnterHandler = this.iframeMouseEnterHandler.bind(this);
        this.iframeMouseLeaveHandler = this.iframeMouseLeaveHandler.bind(this);
        this.godModeButtonClickHandler = this.godModeButtonClickHandler.bind(this);
    }

    // Mouse event handlers
    mouseMoveHandler(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.deps.mouse.set(event.clientX - rect.left, event.clientY - rect.top);
        this.mouseInfluence = true;
    }

    mouseLeaveHandler() {
        this.mouseInfluence = false;
        this.isScattering = false;
    }

    mouseDownHandler(event) {
        if (this.boidsIgnoreMouse) {
            return;
        }
        if (event.button === 0 && !event.shiftKey) {
            this.isScattering = true;
            this.scatter(CLICK_SCATTER_DURATION);
        }
    }

    mouseUpHandler(event) {
        if (event.button === 0) {
            this.isScattering = false;
        }
    }

    // Touch event handlers
    touchStartHandler(event) {
        const experimentalMenu = document.getElementById('experimentalMenu');
        const easterEgg = document.getElementById('easterEgg');
        const navLinks = document.getElementById('navLinks');
        const hamburgerMenu = document.getElementById('hamburger-menu');
        const visualContainer = document.getElementById('visualContainer');
        const playerGrid = document.getElementById('playerGrid');
        const designGrid = document.getElementById('designGrid');
        const songsGrid = document.getElementById('songsGrid');
        const cvContent = document.getElementById('cvContent');
        const softwareContainer = document.getElementById('softwareContainer');
        const homeLink = document.getElementById('homeLink');
        const downloadPdfBtn = document.getElementById('downloadPdfBtn');
        const myModal = document.getElementById('myModal');
        const modalImage = document.getElementById('modalImage');
        const speedControls = this.deps.speedControls;

        const shouldBoidsIgnoreTouch = (easterEgg && easterEgg.contains(event.target)) ||
            (speedControls && speedControls.contains(event.target)) ||
            (experimentalMenu && experimentalMenu.contains(event.target)) ||
            (navLinks && navLinks.contains(event.target)) ||
            (hamburgerMenu && hamburgerMenu.contains(event.target)) ||
            (visualContainer && visualContainer.contains(event.target)) ||
            (playerGrid && playerGrid.contains(event.target)) ||
            (designGrid && designGrid.contains(event.target)) ||
            (songsGrid && songsGrid.contains(event.target)) ||
            (cvContent && cvContent.contains(event.target)) ||
            (softwareContainer && softwareContainer.contains(event.target)) ||
            (homeLink && homeLink.contains(event.target)) ||
            (downloadPdfBtn && downloadPdfBtn.contains(event.target)) ||
            (myModal && myModal.contains(event.target)) ||
            (modalImage && modalImage.contains(event.target));

        this.boidsIgnoreTouch = shouldBoidsIgnoreTouch;

        if (this.deps.isEnding() || this.boidsIgnoreTouch) {
            this.mouseInfluence = false;
            return;
        }
        this.boidsIgnoreMouse = false;
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.deps.mouse.set(event.touches[0].clientX - rect.left, event.touches[0].clientY - rect.top);
        this.mouseInfluence = true;
        this.isScattering = true;
        this.scatter(CLICK_SCATTER_DURATION);

        if (this.touchEndTimeoutId) {
            clearTimeout(this.touchEndTimeoutId);
            this.touchEndTimeoutId = null;
        }
    }

    touchMoveHandler(event) {
        if (this.deps.isEnding() || this.boidsIgnoreTouch) {
            this.mouseInfluence = false;
            return;
        }
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.deps.mouse.set(event.touches[0].clientX - rect.left, event.touches[0].clientY - rect.top);
        this.mouseInfluence = true;

        if (this.touchEndTimeoutId) {
            clearTimeout(this.touchEndTimeoutId);
            this.touchEndTimeoutId = null;
        }
    }

    touchEndHandler() {
        this.isScattering = false;
        this.boidsIgnoreTouch = false;

        if (this.touchEndTimeoutId) {
            clearTimeout(this.touchEndTimeoutId);
        }

        this.touchEndTimeoutId = setTimeout(() => {
            this.mouseInfluence = false;
            this.touchEndTimeoutId = null;
        }, 100);
    }

    // Window event handlers
    resizeHandler() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        if (this.deps.spatialGrid) {
            this.deps.spatialGrid.resize(this.canvas.width, this.canvas.height);
        }
        this.deps.updateAllObstacles();

        // If simulation is running and in responsive mode, update the target flock size.
        if (this.deps.isRunning() && !this.deps.userHasSetFlockSize()) {
            this.deps.flock.updateResponsiveSize(this.deps.updateMenuValues);
        }
    }

    // UI control handlers
    speedSliderInputHandler(event) {
        this.deps.setSpeedMultiplier(event.target.value / 100);
        this.deps.speedValue.textContent = `${event.target.value}%`;
    }

    speedControlsMouseEnterHandler() {
        this.boidsIgnoreMouse = true;
    }

    speedControlsMouseLeaveHandler() {
        this.boidsIgnoreMouse = false;
    }

    iframeMouseEnterHandler() {
        this.boidsIgnoreMouse = true;
    }

    iframeMouseLeaveHandler() {
        this.boidsIgnoreMouse = false;
    }

    // Debug click handler
    documentClickHandler(event) {
        if (!event.shiftKey || !this.deps.debugGridMode()) {
            if (!this.deps.debugGridMode()) {
                this.deps.setDebugSelectedBoid(null);
            }
            return;
        }

        const experimentalMenu = document.getElementById('experimentalMenu');
        if (this.boidsIgnoreMouse || (experimentalMenu && experimentalMenu.contains(event.target) && this.deps.godMode())) {
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        let closestBoid = null;
        let minDistSq = Infinity;

        for (const boid of this.deps.flock) {
            const distSq = (boid.position.x - clickX) ** 2 + (boid.position.y - clickY) ** 2;
            if (distSq < minDistSq && distSq < (boid.renderSize * 2) ** 2) {
                minDistSq = distSq;
                closestBoid = boid;
            }
        }
        this.deps.setDebugSelectedBoid(closestBoid);
    }

    godModeButtonClickHandler() {
        const newGodModeState = !this.deps.godMode();
        const event = new CustomEvent('godModeToggled', {
            detail: { enabled: newGodModeState },
            bubbles: true,
            composed: true
        });
        document.body.dispatchEvent(event);
    }

    // Scatter behavior
    scatter(duration) {
        this.deps.flock.forEach(boid => {
            if (Vector.dist(this.deps.mouse, boid.position) < MOUSE_INFLUENCE_RADIUS) {
                boid.scatterState = 1;
                boid.cooldownTimer = duration;
            }
        });
    }

    // Setup and teardown
    setupEventListeners() {
        this.removeEventListeners(); // Remove any existing listeners first

        document.addEventListener('mousemove', this.mouseMoveHandler);
        document.addEventListener('mouseleave', this.mouseLeaveHandler);
        document.addEventListener('mousedown', this.mouseDownHandler);
        document.addEventListener('mouseup', this.mouseUpHandler);
        document.addEventListener('touchstart', this.touchStartHandler, { passive: false });
        document.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
        document.addEventListener('touchend', this.touchEndHandler);
        window.addEventListener('resize', this.resizeHandler);
        document.addEventListener('click', this.documentClickHandler);

        if (this.deps.scrollUpdater) {
            document.body.addEventListener('scroll', this.deps.scrollUpdater, { passive: true });
        }

        if (this.deps.speedSlider) {
            this.deps.speedSlider.addEventListener('input', this.speedSliderInputHandler);
        }
        if (this.deps.speedControls) {
            this.deps.speedControls.addEventListener('mouseenter', this.speedControlsMouseEnterHandler);
            this.deps.speedControls.addEventListener('mouseleave', this.speedControlsMouseLeaveHandler);
        }
        if (this.deps.godModeButton) {
            this.deps.godModeButton.addEventListener('click', this.godModeButtonClickHandler);
        }

        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            iframe.addEventListener('mouseenter', this.iframeMouseEnterHandler);
            iframe.addEventListener('mouseleave', this.iframeMouseLeaveHandler);
        });
    }

    removeEventListeners() {
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        document.removeEventListener('mouseleave', this.mouseLeaveHandler);
        document.removeEventListener('mousedown', this.mouseDownHandler);
        document.removeEventListener('mouseup', this.mouseUpHandler);
        document.removeEventListener('touchstart', this.touchStartHandler);
        document.removeEventListener('touchmove', this.touchMoveHandler);
        document.removeEventListener('touchend', this.touchEndHandler);
        window.removeEventListener('resize', this.resizeHandler);
        document.removeEventListener('click', this.documentClickHandler);

        if (this.deps.scrollUpdater) {
            document.body.removeEventListener('scroll', this.deps.scrollUpdater);
        }

        if (this.deps.speedSlider) {
            this.deps.speedSlider.removeEventListener('input', this.speedSliderInputHandler);
        }
        if (this.deps.speedControls) {
            this.deps.speedControls.removeEventListener('mouseenter', this.speedControlsMouseEnterHandler);
            this.deps.speedControls.removeEventListener('mouseleave', this.speedControlsMouseLeaveHandler);
        }
        if (this.deps.godModeButton) {
            this.deps.godModeButton.removeEventListener('click', this.godModeButtonClickHandler);
        }

        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            iframe.removeEventListener('mouseenter', this.iframeMouseEnterHandler);
            iframe.removeEventListener('mouseleave', this.iframeMouseLeaveHandler);
        });
    }

    cleanup() {
        this.removeEventListeners();
        if (this.touchEndTimeoutId) {
            clearTimeout(this.touchEndTimeoutId);
            this.touchEndTimeoutId = null;
        }
    }
}
