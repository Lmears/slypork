function isDarkReaderActive() {
    return document.documentElement.getAttribute('data-darkreader-mode') !== null;
}

function updateKeithImage() {
    const keithLogo = document.getElementById('keith-logo');
    if (isDarkReaderActive()) {
        keithLogo.src = "../assets/images/project-logos/keith_white.png";
    } else {
        keithLogo.src = "../assets/images/project-logos/keith.png";
    }
}

// Initial check
updateKeithImage();

const observer = new MutationObserver(updateKeithImage);
observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-darkreader-mode']
});