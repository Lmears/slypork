// Utility functions
function getLogoPath(file) {
    var atRoot = window.location.pathname === '/' || window.location.pathname === '/slypork-studio/';
    var baseURL = atRoot ? 'assets/images/' : '../assets/images/';
    return baseURL + file;
}

// Easing function
function easeInOutElastic(x) {
    const c5 = (2 * Math.PI) / 4.5;
    return x === 0 ? 0
        : x === 1 ? 1
            : x < 0.5 ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
                : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1;
}

// Home image animation
var homeLink = document.getElementById('homeLink');
var homeLogo = document.querySelector('.home-logo');
if (homeLink && homeLogo) {
    var isHovering = false;
    var normalSrc = getLogoPath('home.webp');
    var hoverSrc = getLogoPath('home-hover.webp');

    function handleHomeLinkMouseEnter() {
        if (homeLogo.src !== hoverSrc) { // Only change if different
            homeLogo.src = hoverSrc;
        }
        isHovering = true;
    }

    function handleHomeLinkMouseLeave() {
        if (homeLogo.src !== normalSrc) { // Only change if different
            homeLogo.src = normalSrc;
        }
        isHovering = false;
    }

    function handleHomeLinkMouseDown() {
        homeLogo.src = normalSrc;
    }

    function handleHomeLinkMouseUp() {
        if (isHovering && homeLogo.src !== hoverSrc) {
            homeLogo.src = hoverSrc;
        }
    }

    homeLink.addEventListener('mouseenter', handleHomeLinkMouseEnter);
    homeLink.addEventListener('mouseleave', handleHomeLinkMouseLeave);
    homeLink.addEventListener('mousedown', handleHomeLinkMouseDown);
    homeLink.addEventListener('mouseup', handleHomeLinkMouseUp);
}

// Lightbox modal
var modal = document.getElementById("myModal");
var modalImg = document.getElementById("modalImage");
// var closeButton = document.querySelector("#myModal .close");

function openModal(event) {
    const triggerElement = event.target.closest('.modal-trigger');

    if (triggerElement && modal && modalImg) {
        const imgSrc = triggerElement.src || triggerElement.querySelector('img')?.src;

        if (imgSrc) {
            modal.style.display = "flex";
            modalImg.src = imgSrc;
            // lockHTMLScroll();
        } else {
            console.warn("Modal trigger clicked, but no image source found.", triggerElement);
        }
    }
}

function closeModal() {
    if (modal) {
        modal.style.display = "none";
        // unlockHTMLScroll();
        if (modalImg) {
            modalImg.src = "";
        }
    }
}

function handleOutsideClick(event) {
    if (event.target === modal) {
        closeModal();
    }
}

function handleEscapeKey(event) {
    if (event.key === "Escape" && modal && modal.style.display === "flex") {
        closeModal();
    }
}

document.body.addEventListener('click', openModal);

if (modal) {
    // if (closeButton) {
    //     closeButton.onclick = closeModal;
    // } else {
    //     console.warn("Modal close button (.close) not found within #myModal.");
    // }

    window.addEventListener('click', handleOutsideClick);

    document.addEventListener('keydown', handleEscapeKey);
}

if (modal && !modalImg) {
    console.warn("Modal image element (#modalImage) not found. Modal cannot display images.");
}

// Hamburger menu
function toggleNavMenu() {
    var nav = document.querySelector('nav');
    if (nav) {
        nav.classList.toggle('nav-active');
        document.body.dispatchEvent(new CustomEvent('layoutChanged'));
    }
}

function closeNavMenu() {
    var nav = document.querySelector('nav');
    if (nav && nav.classList.contains('nav-active')) {
        nav.classList.remove('nav-active');
        document.body.dispatchEvent(new CustomEvent('layoutChanged'));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var hamburger = document.getElementById('hamburger-menu');
    if (hamburger) {
        hamburger.addEventListener('click', toggleNavMenu);
    }
});

// Software iframes
function adjustIframeHeight() {
    const iframes = document.querySelectorAll('.software-iframe');
    if (iframes.length > 0) {
        const viewportHeight = window.innerHeight;
        const maxHeight = Math.min(800, viewportHeight * 0.8);

        iframes.forEach(iframe => {
            iframe.style.height = `${maxHeight}px`;
        });
    }
}

// Check for dark mode
function isDarkReaderActive() {
    return document.documentElement.getAttribute('data-darkreader-mode') !== null;
}

window.addEventListener('load', adjustIframeHeight);
window.addEventListener('resize', adjustIframeHeight);

/**
 * Updates the fill style of a range slider based on its current value.
 * It sets a CSS custom property '--value' on the slider element.
 * @param {HTMLInputElement} slider - The slider element.
 */
function updateSliderFill(slider) {
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
function enableSliderWheelControl(slider) {
    if (!slider || slider.type !== 'range') {
        console.warn('Invalid element passed to enableSliderWheelControl. Expected a range input.', slider);
        return;
    }

    const wheelHandlerKey = '_sliderWheelEventHandler';

    // Remove existing handler if present (idempotency)
    if (slider[wheelHandlerKey]) {
        slider.removeEventListener('wheel', slider[wheelHandlerKey]);
    }

    const wheelHandler = function (event) {
        event.preventDefault();

        const step = parseFloat(this.step) || 1;
        let currentValue = parseFloat(this.value);
        const min = parseFloat(this.min);
        const max = parseFloat(this.max);

        // Update value based on scroll direction
        currentValue += event.deltaY < 0 ? step : -step;

        // Apply constraints
        currentValue = Math.max(min, Math.min(max, currentValue));

        // Handle decimal precision
        if (this.step && this.step.includes('.')) {
            const precision = this.step.split('.')[1].length;
            currentValue = parseFloat(currentValue.toFixed(precision));
        }

        this.value = currentValue;
        this.dispatchEvent(new Event('input', { bubbles: true }));
    };

    slider[wheelHandlerKey] = wheelHandler;
    slider.addEventListener('wheel', wheelHandler, { passive: false });
}