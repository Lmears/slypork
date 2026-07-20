// Utility functions
function getLogoPath(file) {
    var atRoot = window.location.pathname === '/';
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
    var normalSrc = getLogoPath('slypork_logo.svg');
    var hoverSrc = getLogoPath('slypork_logo_raised.svg');

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

function openModal(event) {
    const triggerElement = event.target.closest('.modal-trigger');

    if (triggerElement && modal && modalImg) {
        const imgSrc = triggerElement.src || triggerElement.querySelector('img')?.src;

        if (imgSrc) {
            modal.style.display = "flex";
            modalImg.src = imgSrc;
        } else {
            console.warn("Modal trigger clicked, but no image source found.", triggerElement);
        }
    }
}

function closeModal() {
    if (modal) {
        modal.style.display = "none";
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
        var hamburger = document.getElementById('hamburger-menu');
        if (hamburger) {
            hamburger.setAttribute('aria-expanded', nav.classList.contains('nav-active') ? 'true' : 'false');
        }
        document.body.dispatchEvent(new CustomEvent('layoutChanged'));
    }
}

function closeNavMenu() {
    var nav = document.querySelector('nav');
    if (nav && nav.classList.contains('nav-active')) {
        nav.classList.remove('nav-active');
        var hamburger = document.getElementById('hamburger-menu');
        if (hamburger) {
            hamburger.setAttribute('aria-expanded', 'false');
        }
        document.body.dispatchEvent(new CustomEvent('layoutChanged'));
    }
}

document.addEventListener('DOMContentLoaded', function () {
    var hamburger = document.getElementById('hamburger-menu');
    var nav = document.querySelector('nav');
    if (hamburger) {
        hamburger.addEventListener('click', toggleNavMenu);
        if (nav) {
            hamburger.setAttribute('aria-expanded', nav.classList.contains('nav-active') ? 'true' : 'false');
        }
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

var darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

function isDarkMode() {
    return darkModeMediaQuery.matches || isDarkReaderActive();
}

window.isDarkReaderActive = isDarkReaderActive;
window.isDarkMode = isDarkMode;
window.getLogoPath = getLogoPath;
window.easeInOutElastic = easeInOutElastic;
window.closeNavMenu = closeNavMenu;

window.addEventListener('load', adjustIframeHeight);
window.addEventListener('resize', adjustIframeHeight);
