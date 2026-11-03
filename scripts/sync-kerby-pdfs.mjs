// Keeps the Quick Start and User Manual on KerBy's Gumroad download page in step with the site's
// /kerby/ pages. The pre-push hook runs it for pushes to master; it also runs by hand:
//
//   node scripts/sync-kerby-pdfs.mjs [--commit <sha>] [--dry-run]
//
// It builds both PDFs (from <sha> when given, otherwise from the working tree) and, for each one
// whose content changed since the last upload, uploads it to Gumroad and swaps it in for the old
// copy inside the "Manual and Quick Start Guide" folder. Content means the PDF minus its timestamps,
// so a rebuild of unchanged pages uploads nothing. What was last uploaded is recorded in
// build/kerby-pdfs/gumroad.json; losing that file costs one re-upload, nothing more.
//
// Needs the `gumroad` CLI, logged in to the Slypork account. Gumroad keeps each replaced PDF
// attached to the product but off the page, as it does old builds; buyers only see the page.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCT = 'cqweak';
const FOLDER = 'Manual and Quick Start Guide';
// Folder order on the page. Names are the PDFs' file names from build-kerby-pdfs.mjs.
const PDFS = ['KerBy Quick Start.pdf', 'KerBy User Manual.pdf'];

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(repo, 'build/kerby-pdfs');
const statePath = path.join(outDir, 'gumroad.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const commitFlag = args.indexOf('--commit');
const commit = commitFlag === -1 ? null : args[commitFlag + 1];

const log = (msg) => console.error(`KerBy PDFs: ${msg}`);

function gumroad(...argv) {
    const out = execFileSync('gumroad', [...argv, '--json', '--no-input'], { encoding: 'utf8', maxBuffer: 64 << 20 });
    return out.trim() ? JSON.parse(out) : null;
}

const productFiles = () => gumroad('products', 'view', PRODUCT).product.files;

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

function folderIn(doc) {
    let folder = doc.content.find((n) => n.type === 'fileEmbedGroup' && n.attrs?.name === FOLDER);
    if (!folder) {
        folder = { type: 'fileEmbedGroup', attrs: { name: FOLDER, uid: randomUUID() }, content: [] };
        const key = doc.content.findIndex((n) => n.type === 'licenseKey');
        doc.content.splice(key === -1 ? doc.content.length : key, 0, folder);
    }
    return folder;
}

// Puts newId where the old copy of this PDF sat, or into the folder in PDFS order if it has none.
function place(doc, pdf, newId, oldIds) {
    for (const e of [...embeds(doc.content)]) {
        if (e.node.attrs.id === newId) e.siblings.splice(e.siblings.indexOf(e.node), 1);
    }
    const old = [...embeds(doc.content)].find((e) => oldIds.has(e.node.attrs.id));
    if (old) {
        old.node.attrs.id = newId;
        return;
    }
    const folder = folderIn(doc);
    const node = { type: 'fileEmbed', attrs: { id: newId, uid: randomUUID(), collapsed: false } };
    const later = new Set(PDFS.slice(PDFS.indexOf(pdf) + 1).map((p) => p.replace(/\.pdf$/, '')));
    const names = new Map(productFiles().map((f) => [f.id, f.name]));
    const at = folder.content.findIndex((n) => later.has(names.get(n.attrs?.id)));
    folder.content.splice(at === -1 ? folder.content.length : at, 0, node);
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
for (const pdf of PDFS) {
    const file = path.join(outDir, pdf);
    const hash = await contentHash(file);
    if (state[pdf]?.hash === hash) { log(`${pdf} unchanged`); continue; }
    if (dryRun) { log(`${pdf} changed; would upload and swap it in (dry run)`); continue; }

    const name = pdf.replace(/\.pdf$/, '');
    const before = productFiles();
    const oldIds = new Set(before.filter((f) => f.name === name).map((f) => f.id));
    if (state[pdf]?.fileId) oldIds.add(state[pdf].fileId);
    log(`uploading ${pdf}`);
    gumroad('products', 'update', PRODUCT, '--file', file, '--file-name', name);
    const added = productFiles().filter((f) => !before.some((b) => b.id === f.id));
    if (added.length !== 1) throw new Error(`expected one new Gumroad file after uploading ${pdf}, found ${added.length}`);
    const newId = added[0].id;

    const pages = gumroad('products', 'content', 'get', PRODUCT);
    if (pages.length !== 1) throw new Error(`expected one rich content page on ${PRODUCT}, found ${pages.length}`);
    place(pages[0].description, pdf, newId, oldIds);
    const input = path.join(outDir, 'content.json');
    await fs.writeFile(input, JSON.stringify(pages, null, 2));
    gumroad('products', 'content', 'set', PRODUCT, input, '--yes');

    const check = JSON.stringify(gumroad('products', 'content', 'get', PRODUCT));
    if (!check.includes(newId)) throw new Error(`${pdf} uploaded as ${newId} but isn't on the page`);
    state[pdf] = { hash, fileId: newId, uploaded: new Date().toISOString() };
    await fs.writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
    log(`${pdf} is live on Gumroad`);
}
