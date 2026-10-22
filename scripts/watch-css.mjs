import { spawn } from 'node:child_process';
import { watch } from 'node:fs';

// Tailwind's own --watch only ever adds classes: one that appears in a page and is then
// removed stays in output.css until the watcher restarts, leaving a diff no commit wants.
// Running the full build on every change keeps output.css exactly what build:css produces.
const isSource = (file) =>
    !file.startsWith('node_modules/') && !file.startsWith('.git/') &&
    (file.endsWith('.html') || (file.startsWith('assets/js/') && file.endsWith('.js')) ||
        ['assets/css/input.css', 'assets/css/tailwind3-base.css', 'assets/css/tailwind3-utilities.css',
            'tailwind.config.mjs'].includes(file));

let timer;
let running = false;
let pending = false;

function build() {
    if (running) { pending = true; return; }
    running = true;
    const tailwind = spawn(process.execPath, ['scripts/build-css.mjs'],
        { stdio: 'inherit', env: { ...process.env, BROWSERSLIST_IGNORE_OLD_DATA: '1' } });
    tailwind.on('exit', () => {
        running = false;
        if (pending) { pending = false; build(); }
    });
}

build();
watch('.', { recursive: true }, (_event, file) => {
    if (!file || !isSource(file.split('\\').join('/'))) return;
    clearTimeout(timer);
    timer = setTimeout(build, 150);
});
