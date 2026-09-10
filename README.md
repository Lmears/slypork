# slypork
Portfolio site featuring my audio mastering, music projects, and software development. Connect with my work, listen to my creations, and explore my codebase. 
 
Preview with `python3 -m http.server 8080 --bind 127.0.0.1` (or `npm start`).
This needs only Python 3; no npm install is needed to view or host the site.
The development server serves the repository; do not expose it through a tunnel.

Tailwind is the only direct npm dependency, used to generate CSS, with no npm
packages shipped to the browser. Its transitive dependencies are recorded in
`package-lock.json` for reproducible installs; do not remove individual entries.
To edit styles or add utility classes, run `npm ci --ignore-scripts`, then
`npm run build:css`, and commit the generated `assets/css/output.css`.
For live CSS rebuilding, run `npm run watch:css` in a second terminal while the
preview server runs. HTML text and plain JavaScript edits need no npm build.

GitHub Pages publishes `master` directly with Jekyll; `_config.yml` excludes
development files and the archived RSVP route. Keep `.nojekyll` absent.
The security workflow validates changes and audits dependencies weekly; it does
not gate the native Pages deployment unless branch protection requires its check.

Run `npm run check:security` and `npm audit` before publishing. See
[the security audit](docs/security-audit.md) for findings and the separate
Cloudflare/Jellyfin follow-up.
