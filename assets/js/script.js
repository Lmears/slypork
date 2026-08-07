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

// Pinned nav
// Drives the two custom properties .pinned-nav reads (see input.css): how far
// the bar is slid out of view, and how far the bottom border has faded in.
// Only the two narrow layouts consume --nav-offset - at md and up the nav is
// the sidebar column, which just stays pinned and never slides away.
(function setupPinnedNav() {
    var header = document.querySelector('.pinned-nav');
    if (!header) return;

    var nav = header.querySelector('#site-nav');
    var hamburger = header.querySelector('#hamburger-menu');

    // Distance scrolled past the pin point over which the border reaches full
    // strength.
    var BORDER_FADE_DISTANCE = 160;

    // How far you have to scroll down with the menu open before it collapses.
    // Comfortably above the ~10px a browser still counts as a tap, so someone
    // who has just opened the menu and is dragging a thumb towards a link does
    // not have it shut under them; still short enough that a deliberate scroll
    // closes it before the second line of content arrives.
    var MENU_CLOSE_DISTANCE = 48;

    var stickTop = 0;      // scroll position at which the header pins
    var navHeight = 0;     // how far it can slide out of view
    var offset = 0;        // current slide, in [-navHeight, 0]
    var lastPinnedScroll = 0;
    var menuOpen = false;
    var downWhileOpen = 0; // downward scroll accumulated since the menu opened

    // html is overflow:hidden and body does the scrolling (see input.css).
    function getScrollTop() {
        return document.body.scrollTop || document.documentElement.scrollTop || 0;
    }

    // The hamburger is display:none in the sm-to-md bar layout and at md and
    // up, where .nav-active is either irrelevant or permanently set.
    function isMenuOpen() {
        return !!(nav && nav.classList.contains('nav-active') &&
            hamburger && window.getComputedStyle(hamburger).display !== 'none');
    }

    // Everything here forces layout, so it's kept out of the scroll handler and
    // only re-run when something can actually have moved.
    function measure() {
        var style = window.getComputedStyle(header);
        // For a sticky box the computed inset is the value we set, not the
        // distance it has currently been shifted by.
        var stickyInset = parseFloat(style.top) || 0;
        var barPadding = parseFloat(style.getPropertyValue('--nav-bar-padding')) || 0;

        // offsetTop on a *stuck* element includes the shift sticky has applied,
        // so measuring mid-scroll would read the header's current on-screen
        // position rather than its resting one and put the pin point below the
        // scroll position - which zeroed the border fade every time the menu
        // was opened or the window resized. Drop out of sticky for the read.
        var restore = header.style.position;
        header.style.position = 'static';
        // <body> is the only positioned ancestor, so this is the header's
        // distance from the top of the document.
        var restingTop = header.offsetTop;
        header.style.position = restore;

        stickTop = Math.max(0, restingTop - stickyInset);
        // The bar overhangs the header by barPadding at each end, so it has
        // that much further to travel before it is fully off screen.
        navHeight = header.offsetHeight + barPadding * 2;
        menuOpen = isMenuOpen();
        downWhileOpen = 0;
        lastPinnedScroll = Math.max(0, getScrollTop() - stickTop);
        offset = Math.max(-navHeight, offset);
        update();
    }

    function update() {
        var pinnedScroll = Math.max(0, getScrollTop() - stickTop);
        var delta = pinnedScroll - lastPinnedScroll;
        lastPinnedScroll = pinnedScroll;

        // An open menu takes a good part of the viewport at hamburger widths,
        // and the hamburger is its only other way out, so scrolling down is the
        // reader saying they are done with it. Collapse it rather than sliding
        // it away: sliding leaves the links hovering half off-screen on the way
        // out, where a collapse keeps the bar pinned with the hamburger in
        // reach. Below the threshold it stays put - an open menu must not creep
        // off the top of its own accord.
        if (menuOpen) {
            downWhileOpen = delta > 0 ? downWhileOpen + delta : 0;
            if (downWhileOpen > MENU_CLOSE_DISTANCE) {
                // The header is in flow (#container is a column at these
                // widths), so collapsing it pulls everything below it up the
                // page. Measured off that next element rather than off the
                // header's own offsetHeight, which would miss margins and any
                // reflow #container does around it.
                var below = header.nextElementSibling;
                var topBefore = below ? below.getBoundingClientRect().top : 0;
                // Dispatches layoutChanged, so measure() re-enters and takes
                // over from here with the collapsed header's dimensions.
                closeNavMenu();
                var shrink = below ? topBefore - below.getBoundingClientRect().top : 0;

                // Where there is room, hand that distance back to the scroll
                // position so the page does not leap forward under a reader who
                // only asked for a few pixels. Only when there is room for the
                // whole of it: a partial correction would clamp at the top of
                // the document and shove the scroll backwards into an
                // in-progress flick, which is worse than the reflow it fixes.
                // Near the top the content just fills in, which is what closing
                // a menu should look like anyway.
                if (shrink > 0 && getScrollTop() >= shrink) {
                    document.body.scrollTop = getScrollTop() - shrink;
                    measure();
                }
                return;
            }
            offset = 0;
        } else {
            offset = Math.min(0, Math.max(-navHeight, offset - delta));
        }

        header.style.setProperty('--nav-offset', offset + 'px');
        header.style.setProperty('--nav-border-opacity',
            Math.min(1, pinnedScroll / BORDER_FADE_DISTANCE));
    }

    // Deliberately unthrottled: update() only reads cached measurements, and
    // rAF-batching it would leave the bar a frame behind the scroll it tracks.
    document.body.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    window.addEventListener('pageshow', measure);
    // Dispatched by toggleNavMenu below, which changes the header's height.
    document.body.addEventListener('layoutChanged', measure);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', measure);
    } else {
        measure();
    }
})();

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
