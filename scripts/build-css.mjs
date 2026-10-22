// Builds assets/css/output.css (or the path after --output) from assets/css/input.css the way
// Tailwind 3's `tailwindcss --minify` did: Tailwind, then autoprefixer, then cssnano's default
// preset without declaration sorting, so the site renders exactly as it did on Tailwind 3.
//
// Tailwind 4 runs as its PostCSS plugin, not its CLI, whose file watcher depends on braces (an
// advisory with no fixed version), and with its own optimiser off: Lightning CSS rewrites the
// hand-written rules too (it dropped #controls' unprefixed backdrop-filter). Two of 3's results
// are kept by hand: autoprefixer keeps the prefixes already there (today's browser data would drop
// some 3 kept), and colours are minified by postcss-colormin 6, the one 3's cssnano 6 used
// (cssnano 7's writes some colours differently; cssnano 6 depends on an unpatched
// postcss-selector-parser).
import { readFile, writeFile } from 'node:fs/promises';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import colormin from 'postcss-colormin';

const input = 'assets/css/input.css';
const flag = process.argv.indexOf('--output');
const output = flag > -1 ? process.argv[flag + 1] : 'assets/css/output.css';

// Tailwind 3 put variant utilities (md:, hover:, dark:, ...) at the very end, after the hand-written
// rules, so at equal specificity they beat them; Tailwind 4 puts them before. Their selectors are the
// only ones with an escaped colon.
const variantsLast = {
    postcssPlugin: 'variants-last',
    OnceExit(root) {
        const isVariant = node => node.type === 'rule' ? node.selector.includes('\\:')
            : node.type === 'atrule' && node.nodes?.length > 0 && node.nodes.every(isVariant);
        const moved = [];
        root.each(node => { if (isVariant(node)) moved.push(node); });
        for (const node of moved) root.append(node.remove());
    },
};

// Tailwind 4 writes breakpoints in range syntax, (width >= 768px), which Safari reads only from 16.4;
// Tailwind 3 wrote (min-width:768px).
const minWidthQueries = {
    postcssPlugin: 'min-width-queries',
    AtRule: {
        media(rule) {
            rule.params = rule.params.replace(/\(width >= ([^)]+)\)/g, '(min-width:$1)').replace(/\(width <= ([^)]+)\)/g, '(max-width:$1)');
            if (/\(\s*width\s*[<>]/.test(rule.params)) throw new Error(`No min-/max-width form for @media ${rule.params}`);
        },
    },
};

const result = await postcss([
    tailwindcss({ base: process.cwd(), optimize: false }),
    variantsLast,
    minWidthQueries,
    autoprefixer({ remove: false }),
    colormin,
    cssnano({ preset: ['default', { cssDeclarationSorter: false, colormin: false }] }),
]).process(await readFile(input, 'utf8'), { from: input, to: output });
await writeFile(output, result.css);
