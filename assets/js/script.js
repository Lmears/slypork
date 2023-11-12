console.log('Script is running');

// Home image animation
var homeLink = document.getElementById('homeLink');
var homeLogo = document.querySelector('.home-logo');

var isHovering = false;

function getLogoPath(file) {
    // This variable will check if the pathname is exactly '/' 
    // or '/<repository-name>/' for GitHub Pages
    var atRoot = window.location.pathname === '/' || window.location.pathname === '/slypork-studio/';

    // If we're at the root, we use 'assets/images/', else '../assets/images/'
    var baseURL = atRoot ? 'assets/images/' : '../assets/images/';
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

// Only set up the modal if the elements exist
if (modal && img && modalImg) {
    img.onclick = function () {
        modal.style.display = "block";
        modalImg.src = this.src;
    }

    var span = document.getElementsByClassName("close")[0];

    if (span) {
        span.onclick = function () {
            modal.style.display = "none";
        }
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    document.onkeydown = function (event) {
        if (event.key === "Escape") {
            if (modal && modal.style.display === "block") {
                modal.style.display = "none";
            }
        }
    }
}



// Hamburger menu
document.addEventListener('DOMContentLoaded', function () {
    var hamburger = document.getElementById('hamburger-menu');
    var nav = document.querySelector('nav');

    hamburger.addEventListener('click', function () {
        nav.classList.toggle('nav-active');
    });
});