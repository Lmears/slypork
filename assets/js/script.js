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
var homeLogo = document.querySelector('.home-logo') || document.querySelector('.rsvp-logo');
if (homeLink && homeLogo) {
    var isHovering = false;

    function handleHomeLinkMouseOver() {
        homeLogo.src = getLogoPath('home-hover.png');
        isHovering = true;
    }

    function handleHomeLinkMouseOut() {
        homeLogo.src = getLogoPath('home.png');
        isHovering = false;
    }

    function handleHomeLinkMouseDown() {
        homeLogo.src = getLogoPath('home.png');
    }

    function handleHomeLinkMouseUp() {
        if (isHovering) {
            homeLogo.src = getLogoPath('home-hover.png');
        }
    }

    homeLink.addEventListener('mouseover', handleHomeLinkMouseOver);
    homeLink.addEventListener('mouseout', handleHomeLinkMouseOut);
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
 * Adds mouse wheel control to a slider element.
 * Changes the slider's value based on wheel scroll and dispatches an 'input' event.
 * @param {HTMLInputElement} slider - The slider element to add wheel control to.
 */
function enableSliderWheelControl(slider) {
    if (!slider || slider.type !== 'range') {
        console.warn('Invalid element passed to enableSliderWheelControl. Expected a range input.', slider);
        return;
    }

    slider.addEventListener('wheel', function (event) {
        // Prevent the page from scrolling
        event.preventDefault();

        // Determine the step amount
        const step = parseFloat(this.step) || 1; // Default to 1 if step is not defined or 0
        let currentValue = parseFloat(this.value);
        const min = parseFloat(this.min);
        const max = parseFloat(this.max);

        // deltaY is positive for scrolling down/forward, negative for up/backward
        if (event.deltaY < 0) { // Scrolling up (increase value) - original logic was decreasing, assuming wheel up = increase value
            currentValue += step; // Corrected: wheel up usually increases
        } else if (event.deltaY > 0) { // Scrolling down (decrease value)
            currentValue -= step; // Corrected: wheel down usually decreases
        }

        // Clamp the value to min/max
        currentValue = Math.max(min, Math.min(max, currentValue));

        // Round to the same precision as the step to avoid floating point issues
        if (this.step && this.step.includes('.')) {
            const precision = this.step.split('.')[1].length;
            currentValue = parseFloat(currentValue.toFixed(precision));
        } else {
            // For integer steps, no specific rounding needed beyond clamp if currentValue is already number
            // If step is 1, currentValue could be e.g. 50.1 after adding 0.1 from a previous non-integer step.
            // However, typical range sliders with integer steps won't have this issue if step is enforced.
            // Let's ensure it aligns with step:
            currentValue = Math.round(currentValue / step) * step;
            currentValue = parseFloat(currentValue.toFixed(10)); // Avoid long floating points from division
            currentValue = Math.max(min, Math.min(max, currentValue)); // Re-clamp after rounding
        }


        this.value = currentValue;

        // Manually trigger an 'input' event so updateSlider (and other listeners)
        // react to the change.
        this.dispatchEvent(new Event('input', { bubbles: true }));

    }, { passive: false }); // passive: false is important for preventDefault()
}