// Config
var imagePaths = [
    '../assets/images/posters/experiment.png',
    '../assets/images/posters/psy.png',
    '../assets/images/posters/womp.png',
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
    return img;
}

// Create common elements for the image
function createImageWrapper(src) {
    var wrapperDiv = createElementWithClass('div', 'image-wrapper');

    var imgDiv = createElementWithClass('div');

    var img = createImageElement(src);
    imgDiv.appendChild(img);

    wrapperDiv.appendChild(imgDiv);

    return wrapperDiv;
}

// Add all images to the grid
function populateGrid() {
    var grid = document.getElementById('imageGrid');
    imagePaths.forEach(function (src) {
        grid.appendChild(createImageWrapper(src));
    });
}

// Initialize the grid on window load
window.addEventListener('load', function () {
    populateGrid();
});
