const downloadBtn = document.getElementById('downloadPdfBtn');
if (downloadBtn) {
    downloadBtn.addEventListener('click', function () {
        window.print();
    });
}
