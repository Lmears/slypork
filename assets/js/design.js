// Config
var imagePaths = [
    '../assets/images/posters/experiment.jpg',
    '../assets/images/posters/psy.jpg',
    '../assets/images/posters/womp.jpg',
    '../assets/images/posters/southerly.jpg',
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
    img.classList.add('modal-trigger', 'cursor-pointer', 'rounded-xl');
    img.loading = 'lazy';
    return img;
}

// Create common elements for the image
function createImageWrapper(src) {
    var wrapperDiv = createElementWithClass('div', 'image-wrapper');
    var img = createImageElement(src);
    wrapperDiv.appendChild(img);
    return wrapperDiv;
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