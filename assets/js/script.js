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
var img = document.querySelector('.modal-trigger');
var modalImg = document.getElementById("img01");

function openModal() {
    modal.style.display = "block";
    modalImg.src = this.src;
}

function closeModal() {
    modal.style.display = "none";
}

function handleOutsideClick(event) {
    if (event.target === modal) {
        closeModal();
    }
}

function handleEscapeKey(event) {
    if (event.key === "Escape" && modal.style.display === "block") {
        closeModal();
    }
}

if (modal && img && modalImg) {
    img.onclick = openModal;

    var closeButton = document.getElementsByClassName("close")[0];
    if (closeButton) {
        closeButton.onclick = closeModal;
    }

    window.onclick = handleOutsideClick;
    document.onkeydown = handleEscapeKey;
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