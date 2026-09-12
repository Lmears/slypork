// Config
var imagePaths = [
    '../assets/images/posters/experiment.webp',
    '../assets/images/posters/psy.webp',
    '../assets/images/posters/womp.webp',
    '../assets/images/posters/southerly.webp',
];

// Create an element with class name
function createElementWithClass(tag, className) {
    var element = document.createElement(tag);
    element.className = className;
    return element;
}

// Create an image element
function createImageElement(src) {
    var img = document.createElement('img');
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    img.src = src;
    img.alt = "Design Poster";
    img.classList.add('rounded-xl');
    img.loading = 'lazy';
    return img;
}

// Wrap each poster in the shared lightbox trigger, which also makes the grid
// keyboard-navigable and leaves the plain image as the no-JavaScript fallback.
function createImageWrapper(src) {
    var link = createElementWithClass('a', 'image-wrapper modal-trigger');
    link.href = src;
    link.appendChild(createImageElement(src));
    return link;
}

// Add all images to the grid
function populateGrid() {
    var grid = document.getElementById('imageGrid');
    if (!grid) {
        console.error("Element with ID 'imageGrid' not found.");
        return;
    }
    imagePaths.forEach(function (src) {
        grid.appendChild(createImageWrapper(src));
    });
}

window.addEventListener('DOMContentLoaded', function () {
    populateGrid();
});