# slypork
Portfolio site featuring my audio mastering, music projects, and software development. Connect with my work, listen to my creations, and explore my codebase. 
 
Preview with `python3 -m http.server 8080 --bind 127.0.0.1` (or `npm start`).
This needs only Python 3; no npm install is needed to view or host the site.
The development server serves the repository; do not expose it through a tunnel.

Tailwind generates CSS. The homepage also uses a pinned Three.js release,
bundled locally with esbuild; no CDN or Node server is needed in production.
Dependencies are recorded in `package-lock.json` for reproducible installs.
To edit styles or add utility classes, run `npm ci --ignore-scripts`, then
`npm run build:css`, and commit the generated `assets/css/output.css`.
For live CSS rebuilding, run `npm run watch:css` in a second terminal while the
preview server runs. HTML text and plain JavaScript edits need no npm build.

The homepage renderer is `assets/js/pig.js`; `npm run build:three` regenerates
its committed Three.js bundle after a dependency update. At full quality the pig uses the full
Blender-exported geometry and normals, separate PBR materials, and Blender's
forest HDR environment for reflections, rotated so both lenses catch the canopy
and gaps of sky. Lens materials and normals are used as
exported, with no shader overrides. Blender's world and material-preview
environment do not travel in the GLB; the website loads the same EXR separately.
To preview the same environment in Blender, select the bundled `forest.exr` in
Material Preview or use it in the world's Environment Texture node. See
[the reflection notes](docs/pig-reflections.md) for the source and license.
The skin's procedural colour is transferred
onto the original vertices, including crease shading, without removing faces,
decimating the model or baking normal maps. Blender's subsurface scattering and
procedural pore bump are not reproduced by the standard glTF materials.

To update the model, export `slypork_pig.glb` from Blender, then run:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background /path/to/slypork_pig4.blend \
  --python scripts/build-pig.py -- /path/to/slypork_pig.glb
```

This writes `assets/models/slypork-pig.glb` while preserving the export's geometry.
It also restores the frame stud's Blender Mirror modifier if the export omitted it.
Then run `npm run build:pig-lods` to regenerate the two optional detail levels.
These are generated offline using meshoptimizer, preserving material boundaries,
the original surviving vertices' normals and baked colours, and the small studs.
Commit both generated GLBs alongside the original whenever the model changes.
For an export containing an overlapping reference copy, append
`--exclude-node Mesh_0.002` to omit that copy and its unused textures.
The source Blender project and GLB are never modified. Commit the output along
with renderer changes. The pig fades in after its first rendered frame, with no
loading placeholder. Blue and red rim lights move with the cursor's key light.
The flock easter egg releases boids from the head as it shrinks into a flying
ringleader. Its projected position creates a local circulating current; closing
the egg draws the flock back into the growing logo. Navigation opens while the
flock is out and returns to its previous state afterwards. Hovering or keyboard
focusing a route calls the miniature above it to look down; leaving resumes its
arc. Hovering the corner egg gets a soft glance; the first two accepted taps
deepen it with small nods. The third starts with the same nod and accelerates
straight out of its downward motion into a forward somersault with sideways
turns and rolls around the screen's axes. It carries its momentum into the
flock release before settling into miniature flight. Closing the flock resets
the reaction. Reduced motion keeps the stepped glance without
the tumble. While the flock is active,
hovering the egg leaves the miniature on its flight path. A cropped,
pointer-transparent canvas follows the pig outside its stage without changing the
layout. `hero-field.js` shares
the screen-space position with the simulation; other pages keep the original
corner spawn and exit. Reduced motion uses a stationary miniature, and the 3D
animation pauses for offscreen content and hidden tabs.

`pig-quality.js` starts at the original full geometry and up-to-2x pixel density.
Sustained frame times above 21 ms reduce pixel density and then request lighter
models (about 73k / 40k rendered triangles, versus 229k). Materials, lighting,
antialiasing and HDR reflections remain enabled at every tier. Healthy frame
times below 18 ms trigger gradual recovery after eight seconds; failed recovery
attempts back off to avoid frequent quality changes. Loading and visibility
changes reset the sampling window. No device-name guesses or animation frame
cap are used. On lower tiers the blurred CSS backdrop updates at 15 Hz while
the model and lights continue animating every frame. Canvas bounds follow the
projected model, with allocation slack to avoid constant buffer resizing.
Run `node --test scripts/check-pig-performance.mjs` to check adaptive quality
and verify that the generated models retain the source vertex attributes.

GitHub Pages publishes `master` directly with Jekyll; `_config.yml` excludes
development files and the archived RSVP route. Keep `.nojekyll` absent.
The security workflow validates changes and audits dependencies weekly; it does
not gate the native Pages deployment unless branch protection requires its check.

Run `npm run check:security` and `npm audit` before publishing. See
[the security audit](docs/security-audit.md) for findings and the separate
Cloudflare/Jellyfin follow-up.
