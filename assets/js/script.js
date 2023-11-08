// Home image animation
var homeLink = document.getElementById('homeLink');
var homeLogo = document.querySelector('.home-logo');

var isHovering = false;

function getBaseURL() {
    // Get the current relative path from the root of the domain
    var path = window.location.pathname;
    // Count the number of slashes to determine the depth
    var depth = (path.match(/\//g) || []).length;
    // At root (e.g., /index.html or /<repository>/index.html), depth will be 1 or 2 respectively
    var atRoot = (path.endsWith('/') || path.endsWith('index.html'));
    var atGitHubPagesRoot = path.includes('/slypork-studio/') && atRoot;

    // On GitHub Pages, the root will be /<repository-name>/, so depth will be 2
    var pathPrefix = (depth === 1 || atGitHubPagesRoot) ? './' : '../';
    return pathPrefix + 'assets/images/';
}

function getLogoPath(file) {
    var baseURL = getBaseURL();
    return baseURL + file;
}


homeLink.addEventListener('mouseover', function () {
    homeLogo.src = getLogoPath('home-hover.png');
    isHovering = true;
});

homeLink.addEventListener('mouseout', function () {
    homeLogo.src = getLogoPath('home.png');
    isHovering = false;
});

homeLink.addEventListener('mousedown', function () {
    homeLogo.src = getLogoPath('home.png');
});

homeLink.addEventListener('mouseup', function () {
    if (isHovering) {
        homeLogo.src = getLogoPath('home-hover.png');
    }
});



// Lightbox modal
var modal = document.getElementById("myModal");
var img = document.querySelector('.modal-trigger');
var modalImg = document.getElementById("img01");
img.onclick = function () {
    modal.style.display = "block";
    modalImg.src = this.src;
    captionText.innerHTML = this.alt;
}

var span = document.getElementsByClassName("close")[0];

span.onclick = function () {
    modal.style.display = "none";
}

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

document.onkeydown = function (event) {
    if (event.key === "Escape") {
        if (modal.style.display === "block") {
            modal.style.display = "none";
        }
    }
}
