// Keeps the PDFs on KerBy's and DucKy's Gumroad download pages in step with the site's pages:
// KerBy's Quick Start and User Manual (from /kerby/) and DucKy's Quick Start (from
// /ducky/quick-start/). The pre-push hook runs it for pushes to master; it also runs by hand:
//
//   node scripts/sync-kerby-pdfs.mjs [--commit <sha>] [--dry-run]
//
// It builds the PDFs (from <sha> when given, otherwise from the working tree) and, for each one
// whose content changed since the last upload, uploads it to its product and swaps it in for the
// old copy on the download page. A PDF with no old copy goes where PRODUCTS says. Content means
// the PDF minus its timestamps, so a rebuild of unchanged pages uploads nothing. What was last
// uploaded is recorded in build/kerby-pdfs/gumroad.json; losing that file costs one re-upload,
// nothing more. A product that fails doesn't stop the other's.
//
// Needs the `gumroad` CLI, logged in to the Slypork account. Gumroad keeps each replaced PDF
// attached to the product but off the page, as it does old builds; buyers only see the page.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Each product's PDFs, in their order on its page. Names are the PDFs' file names from
// build-kerby-pdfs.mjs. With a folder, a new PDF goes into it (made before the licence key if
// missing); with none, it goes after the page's last file.
const PRODUCTS = [
    { name: 'KerBy', id: 'cqweak', folder: 'Manual and Quick Start Guide',
        pdfs: ['KerBy Quick Start.pdf', 'KerBy User Manual.pdf'] },
    { name: 'DucKy', id: 'zFMAS3ioQziRp3GkRCKBNA==', folder: null, pdfs: ['DucKy Quick Start.pdf'] },
];

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repo, 'build/kerby-pdfs');
const statePath = path.join(outDir, 'gumroad.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const commitFlag = args.indexOf('--commit');
const commit = commitFlag === -1 ? null : args[commitFlag + 1];

const log = (msg) => console.error(`Gumroad PDFs: ${msg}`);

function gumroad(...argv) {
    const out = execFileSync('gumroad', [...argv, '--json', '--no-input'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    return out.trim() ? JSON.parse(out) : null;
}

const productFiles = (id) => gumroad('products', 'view', id).product.files;

// Chrome stamps CreationDate and ModDate into every PDF; everything else is stable between builds.
async function contentHash(file) {
    const bytes = await fs.readFile(file);
    const stripped = bytes.toString('latin1').replace(/\/(CreationDate|ModDate) \([^)]*\)/g, '');
    return createHash('sha256').update(stripped, 'latin1').digest('hex');
}

// Every fileEmbed node in the document, with the array that holds it.
function* embeds(nodes) {
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type === 'fileEmbed') yield { node, siblings: nodes, index: i };
        if (Array.isArray(node.content)) yield* embeds(node.content);
    }
}

function folderIn(doc, name) {
    let folder = doc.content.find((n) => n.type === 'fileEmbedGroup' && n.attrs?.name === name);
    if (!folder) {
        folder = { type: 'fileEmbedGroup', attrs: { name, uid: randomUUID() }, content: [] };
        const key = doc.content.findIndex((n) => n.type === 'licenseKey');
        doc.content.splice(key === -1 ? doc.content.length : key, 0, folder);
    }
    return folder;
}

// Puts newId where the old copy of this PDF sat, or, if it has none, ahead of the product's later
// PDFs: in its folder, or after the page's last file when it has no folder.
function place(doc, product, pdf, newId, oldIds) {
    for (const e of [...embeds(doc.content)]) {
        if (e.node.attrs.id === newId) e.siblings.splice(e.siblings.indexOf(e.node), 1);
    }
    const old = [...embeds(doc.content)].find((e) => oldIds.has(e.node.attrs.id));
    if (old) {
        old.node.attrs.id = newId;
        return;
    }
    const node = { type: 'fileEmbed', attrs: { id: newId, uid: randomUUID(), collapsed: false } };
    const later = new Set(product.pdfs.slice(product.pdfs.indexOf(pdf) + 1).map((p) => p.replace(/\.pdf$/, '')));
    const names = new Map(productFiles(product.id).map((f) => [f.id, f.name]));
    const list = product.folder ? folderIn(doc, product.folder).content : doc.content;
    let at = list.findIndex((n) => n.type === 'fileEmbed' && later.has(names.get(n.attrs?.id)));
    if (at === -1) {
        at = product.folder ? list.length
            : list.findLastIndex((n) => n.type === 'fileEmbed' || n.type === 'fileEmbedGroup') + 1;
    }
    list.splice(at, 0, node);
}

let root = repo;
let tmp = null;
if (commit) {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kerby-pdfs-'));
    execFileSync('sh', ['-c', `git -C "$1" archive "$2" | tar -x -C "$3"`, 'sh', repo, commit, tmp]);
    root = tmp;
}
try {
    execFileSync(process.execPath, [path.join(repo, 'scripts/build-kerby-pdfs.mjs'), '--root', root, outDir], { stdio: ['ignore', 'ignore', 'inherit'] });
} finally {
    if (tmp) await fs.rm(tmp, { recursive: true, force: true });
}

const state = JSON.parse(await fs.readFile(statePath, 'utf8').catch(() => '{}'));

async function sync(product, pdf) {
    const file = path.join(outDir, pdf);
    const hash = await contentHash(file);
    if (state[pdf]?.hash === hash) { log(`${pdf} unchanged`); return; }
    if (dryRun) { log(`${pdf} changed; would upload it to ${product.name} and swap it in (dry run)`); return; }

    const name = pdf.replace(/\.pdf$/, '');
    const before = productFiles(product.id);
    const oldIds = new Set(before.filter((f) => f.name === name).map((f) => f.id));
    if (state[pdf]?.fileId) oldIds.add(state[pdf].fileId);
    log(`uploading ${pdf} to ${product.name}`);
    gumroad('products', 'update', product.id, '--file', file, '--file-name', name);
    const added = productFiles(product.id).filter((f) => !before.some((b) => b.id === f.id));
    if (added.length !== 1) throw new Error(`expected one new Gumroad file after uploading ${pdf}, found ${added.length}`);
    const newId = added[0].id;

    const pages = gumroad('products', 'content', 'get', product.id);
    if (pages.length !== 1) throw new Error(`expected one rich content page on ${product.name}, found ${pages.length}`);
    place(pages[0].description, product, pdf, newId, oldIds);
    const input = path.join(outDir, 'content.json');
    await fs.writeFile(input, JSON.stringify(pages, null, 2));
    gumroad('products', 'content', 'set', product.id, input, '--yes');

    const check = JSON.stringify(gumroad('products', 'content', 'get', product.id));
    if (!check.includes(newId)) throw new Error(`${pdf} uploaded as ${newId} but isn't on ${product.name}'s page`);
    state[pdf] = { hash, fileId: newId, uploaded: new Date().toISOString() };
    await fs.writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
    log(`${pdf} is live on ${product.name}'s Gumroad page`);
}

for (const product of PRODUCTS) {
    try {
        for (const pdf of product.pdfs) await sync(product, pdf);
    } catch (err) {
        log(`${product.name} failed: ${err.message}`);
        process.exitCode = 1;
    }
}
