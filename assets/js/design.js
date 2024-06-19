// Config
var imagePaths = [
    '../assets/images/posters/experiment.jpg',
    '../assets/images/posters/psy.jpg',
    '../assets/images/posters/womp.jpg',
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
    img.classList.add('modal-trigger', 'cursor-pointer');
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

// Lightbox modal
var modal = document.getElementById("myModal");
var modalImg = document.getElementById("img01");

function openModal(event) {
    modal.style.display = "block";
    modalImg.src = event.target.src;
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

window.addEventListener('load', function () {
    populateGrid();

    var images = document.querySelectorAll('.modal-trigger');
    images.forEach(function (image) {
        image.onclick = openModal;
    });

    var closeButton = document.getElementsByClassName("close")[0];
    if (closeButton) {
        closeButton.onclick = closeModal;
    }

    window.onclick = handleOutsideClick;
    document.onkeydown = handleEscapeKey;
});
