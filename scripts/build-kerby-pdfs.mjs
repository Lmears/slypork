// Builds KerBy's Quick Start and User Manual PDFs from this site's /kerby/ pages, and DucKy's Quick
// Start from /ducky/quick-start/, for the files buyers get on Gumroad (sync-kerby-pdfs.mjs uploads
// them). The pages stay the only source: rerun this after editing them and the PDFs follow.
//
//   node scripts/build-kerby-pdfs.mjs [--root <dir>] [outDir]      (default out: build/kerby-pdfs)
//
// --root serves another copy of the site, such as a commit checked out by sync-kerby-pdfs.mjs.
//
// It serves the repo root on a local port, opens the first page of each document in Chrome, pulls
// the other pages' .kerby-doc blocks into it, hides the site chrome and prints. A link to a page
// that's in the same PDF jumps within it; other links to the site open https://slypork.net.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const rootFlag = args.indexOf('--root');
const root = rootFlag === -1 ? repo : path.resolve(args.splice(rootFlag, 2)[1]);
const outDir = path.resolve(args[0] ?? path.join(repo, 'build/kerby-pdfs'));
const chromePath = process.env.CHROME_PATH
    ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// The tutorial order is the order learn/index.html lists them in.
const DOCS = [
    {
        file: 'KerBy Quick Start.pdf',
        title: 'KerBy Quick Start',
        pages: ['/kerby/install/'],
    },
    {
        file: 'DucKy Quick Start.pdf',
        title: 'DucKy Quick Start',
        url: 'slypork.net/ducky',
        pages: ['/ducky/quick-start/'],
    },
    {
        file: 'KerBy User Manual.pdf',
        title: 'KerBy User Manual',
        pages: [
            '/kerby/install/',
            '/kerby/learn/',
            '/kerby/learn/first-pattern/',
            '/kerby/learn/shape-the-duck/',
            '/kerby/learn/layer-a-click/',
            '/kerby/learn/own-sounds/',
            '/kerby/learn/duck-your-mix/',
            '/kerby/reference/',
            '/kerby/reference/signal-flow/',
        ],
    },
];

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff',
    '.ttf': 'font/ttf', '.otf': 'font/otf', '.json': 'application/json', '.ico': 'image/x-icon',
};

function serve() {
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        let file = path.join(root, decodeURIComponent(url.pathname));
        if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
        try {
            if ((await fs.stat(file)).isDirectory()) file = path.join(file, 'index.html');
            const body = await fs.readFile(file);
            res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
            res.end(body);
        } catch {
            res.writeHead(404).end();
        }
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// Print rules layered over the site's own CSS: drop everything that isn't the document, give the
// text the full page width, and start each source page on a new sheet.
const PRINT_CSS = `
    #boidCanvas, #controls, #container > header, .kerby-header, .kerby-back, .kerby-end-link,
    .kerby-search, footer { display: none !important; }
    html, body { background: #fff !important; height: auto !important; overflow: visible !important; display: block !important; }
    #container { display: block !important; padding: 0 !important; max-width: none !important; }
    #content, .kerby-frame { padding: 0 !important; margin: 0 !important; max-width: none !important; }
    .pdf-part + .pdf-part { break-before: page; }
    .kerby-frame { border: 0 !important; }
    figure, img, svg, dl, pre, aside, .kerby-next a, .kerby-reference-map { break-inside: avoid; }
    /* A signal chain split across sheets misdraws its joins, and each one fits on a page. */
    .kerby-prose > section:has(.kerby-flow-path) { break-inside: avoid; }
    h2, h3 { break-after: avoid; }
    dl + p { break-before: avoid; }
    .pdf-cover { margin: 0 0 2.5rem; }
    .pdf-cover h1 { font-size: 2rem; margin: 0 0 .25rem; }
    .pdf-cover p { margin: 0; opacity: .7; }
`;

async function build(browser, base, doc) {
    const page = await browser.newPage();
    // The printable width of A4 less the margins, at the 0.8 print scale, so measurements below
    // match the printed layout.
    await page.setViewport({ width: 841, height: 1200 });
    await page.emulateMediaType('screen');
    // The page light whatever this machine's appearance is set to (its screenshots are made dark
    // below), and each animation's still: a page prints an animated image's first frame. Every
    // <picture> holding an animation has a reduced-motion source for this (docs/kerby-content.md).
    await page.emulateMediaFeatures([
        { name: 'prefers-color-scheme', value: 'light' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
    ]);
    await page.goto(base + doc.pages[0], { waitUntil: 'networkidle0' });

    await page.evaluate(async ({ pages, title, url }) => {
        const frame = document.querySelector('.kerby-frame');
        const parts = [];
        for (const href of pages) {
            const html = await (await fetch(href)).text();
            const src = new DOMParser().parseFromString(html, 'text/html').querySelector('.kerby-doc');
            if (!src) throw new Error(`no .kerby-doc on ${href}`);
            const part = document.importNode(src, true);
            part.classList.add('pdf-part');
            part.dataset.source = href;
            // Ids repeat across pages (#help, #macos...); prefix them so in-PDF anchors stay unique.
            const slug = href.replace(/\W+/g, '-');
            part.querySelectorAll('[id]').forEach((el) => { el.id = slug + el.id; });
            part.querySelectorAll('a[href^="#"]').forEach((a) => { a.setAttribute('href', '#' + slug + a.getAttribute('href').slice(1)); });
            // Dark screenshots on the light page, as the PDF has always had: each dark source always
            // matches (it comes before its light one).
            part.querySelectorAll('source[media*="prefers-color-scheme: dark"]').forEach((s) => {
                s.media = s.media.replace('(prefers-color-scheme: dark)', '(min-width: 0)');
            });
            parts.push(part);
        }
        frame.replaceChildren(...parts);

        const cover = document.createElement('div');
        cover.className = 'pdf-cover';
        cover.innerHTML = '<h1></h1><p></p>';
        cover.querySelector('h1').textContent = title;
        cover.querySelector('p').textContent = url;
        parts[0].prepend(cover);

        // script.js fills in data-email links on load; these arrived after it ran.
        frame.querySelectorAll('a[data-email]').forEach((a) => {
            const address = a.dataset.email + '@' + (a.dataset.emailDomain || 'slypork.net');
            a.href = 'mailto:' + address;
            a.textContent = address;
        });
        // A link to a page that's in this PDF jumps within it; anything else opens the site.
        const slugOf = (href) => href.replace(/\W+/g, '-');
        parts.forEach((part) => { part.id = slugOf(part.dataset.source) + 'top'; });
        frame.querySelectorAll('a[href^="/"]').forEach((a) => {
            const url = new URL(a.getAttribute('href'), location.origin);
            if (pages.includes(url.pathname)) {
                a.setAttribute('href', '#' + slugOf(url.pathname) + (url.hash ? url.hash.slice(1) : 'top'));
            } else {
                a.href = 'https://slypork.net' + a.getAttribute('href');
            }
        });
        frame.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; });
        await Promise.all([...frame.querySelectorAll('img')].map((img) => img.decode().catch(() => {})));
    }, { pages: doc.pages, title: doc.title, url: doc.url ?? 'slypork.net/kerby' });

    await page.addStyleTag({ content: PRINT_CSS });
    // Floating extras (the easter egg and the like) would print on every sheet.
    await page.evaluate(() => {
        for (const el of document.body.querySelectorAll('*')) {
            if (!el.closest('.kerby-frame') && getComputedStyle(el).position === 'fixed') el.style.display = 'none';
        }
        // Keep short sections whole so a heading or a last line doesn't strand on its own sheet.
        // Long ones (the illustrated tour) would leave half-empty pages, so they flow.
        document.querySelectorAll('.kerby-prose > section').forEach((s) => {
            if (s.getBoundingClientRect().height < 600) s.style.breakInside = 'avoid';
        });
        return document.fonts.ready;
    });
    const broken = await page.$$eval('.kerby-frame img', (imgs) => imgs.filter((i) => !i.naturalWidth).map((i) => i.src));
    if (broken.length) throw new Error(`${doc.file}: images failed to load:\n  ${broken.join('\n  ')}`);
    const shown = await page.$$eval('.kerby-frame img', (imgs) => imgs.map((i) => new URL(i.currentSrc).pathname));
    const moving = [];
    for (const src of new Set(shown)) {
        const head = (await fs.readFile(path.join(root, decodeURIComponent(src)))).subarray(0, 64).toString('latin1');
        if (head.startsWith('RIFF') && head.includes('ANIM')) moving.push(src);
    }
    if (moving.length) throw new Error(`${doc.file}: animations with no reduced-motion still, which would print their first frame:\n  ${moving.join('\n  ')}`);
    const deadJumps = await page.$$eval('.kerby-frame a[href^="#"]', (links) => links
        .filter((a) => !document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))))
        .map((a) => `${a.textContent.trim()} -> ${a.getAttribute('href')}`));
    if (deadJumps.length) throw new Error(`${doc.file}: links to nowhere in the PDF:\n  ${deadJumps.join('\n  ')}`);

    const out = path.join(outDir, doc.file);
    await page.pdf({
        path: out,
        format: 'A4',
        printBackground: true,
        // The site's 17px body text prints at about 10pt this way, a manual's usual size.
        scale: 0.8,
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#888">${doc.title} · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });
    await page.close();
    return out;
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: chromePath, headless: true });
try {
    await fs.mkdir(outDir, { recursive: true });
    for (const doc of DOCS) console.log(await build(browser, base, doc));
} finally {
    await browser.close();
    server.close();
}
