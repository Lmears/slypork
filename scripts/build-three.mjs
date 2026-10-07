import { build } from 'esbuild';

// Commit this bundle: GitHub Pages serves it directly, with no Node runtime,
// remote CDN or inline import map. Rebuild after changing the Three.js version.
await build({
    stdin: {
        contents: `
            export { Scene, Group, Box3, Vector3, PerspectiveCamera,
                WebGLRenderer, DirectionalLight,
                EquirectangularReflectionMapping, SRGBColorSpace,
                AgXToneMapping } from 'three';
            export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
            export { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
        `,
        resolveDir: process.cwd(),
        sourcefile: 'three-homepage.js',
    },
    outfile: 'assets/js/vendor/three-pig.js',
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    legalComments: 'external',
});
