# Security audit — 10 September 2026 (NZ)

Scope: tracked source, 651 locally available Git commits (1,094 unique text
blobs), npm dependency graph, GitHub Pages configuration, and a small number of
unauthenticated HTTP requests to the two public hostnames. No exploitation,
password attempts, real newsletter submissions, or media requests were made.
Changes are local until committed and pushed to `master`.

## Findings and changes

| Finding | Assessment | Change |
| --- | --- | --- |
| Nine npm audit findings (two critical, six high, one low) | Development-tool exposure; these packages do not execute on the public site | Updated compatible locked dependencies; final audit reports zero known vulnerabilities |
| Obsolete deployment action with implicit token permissions | Unnecessary supply-chain risk: Pages already builds `master` directly, while this action published a different branch | Removed the unused deployment workflow; replacement checks use a pinned checkout, read-only token, and no persisted credentials |
| Whole repository published as website content | `package.json` and the archived RSVP form both returned HTTP 200; the manifest is not a secret, but the publication boundary was too broad | Jekyll exclusions remove development files, docs, source CSS and `rsvp-disabled` from the website |
| No Content Security Policy | Missing browser protection, rather than a demonstrated XSS exploit | Added early CSP metadata to all 18 HTML pages; extracted two inline scripts so only same-origin external scripts can run |
| Unnecessary local process runner | `concurrently` existed only to launch the CSS watcher and preview server together | Removed it and 25 locked packages; watcher and server now use separate commands |
| No ongoing dependency checks or credential ignore patterns | Future maintenance risk | Added weekly npm audit, Dependabot, static security checks and common credential-file ignores |

CSP explicitly permits the existing embedded services, the Buttondown form,
and integrity-checked Font Awesome CSS. It blocks unapproved scripts, frames,
connections, forms, base URL changes, and objects. Inline styles remain allowed
because existing layout code and SVG illustrations use them. This policy is
specific to the portfolio and must not be copied onto Jellyfin.

The DOM review found no demonstrated user-input-to-HTML execution path. Existing
`innerHTML` uses insert fixed markup or the repository's own SVG sprite. The
Buttondown embed endpoint is intentionally public and contains no API secret.
The history scan found no matches for the tested private-key, GitHub/AWS token,
Cloudflare credential, or quoted credential-assignment patterns. This is a
limited pattern scan, not proof that no secret has ever been exposed. It excludes
binary assets and cannot inspect unreachable or unfetched history.

## Is npm necessary?

The deployed site is plain HTML, JavaScript, fonts, images and committed CSS.
It needs no Node server, npm install, or production npm dependencies.

Tailwind is actively used throughout the HTML and in `assets/css/input.css`.
Keeping the current styling workflow requires its compiler when adding utility
classes or changing styles. There is now one direct development dependency:
`tailwindcss`. The lockfile shrank from 136 to 111 package entries; the remainder
are Tailwind's transitive dependencies, including CSS parsing, file watching,
glob matching and config loading. They are not unused application libraries.
Deleting their lock entries would make installations less reproducible.

A standalone Tailwind executable could replace npm, but would still bundle a
compiler and its dependencies and require separate binary pinning and updates.
That migration was not needed for this cleanup. Tailwind 3's transitive `glob`
package still emits an upstream deprecation warning; npm audit reports no known
vulnerabilities in the selected version. No forced major-version overrides were
added to suppress the warning.

Use Python's localhost server directly to preview without npm. For CSS changes,
use the commands in README.md. The server intentionally does not apply Jekyll
exclusions; it must not be exposed through a public tunnel.

## Hosting observations and boundaries

- GitHub's Pages API reported `master:/`, legacy Jekyll builds, and HTTPS
  enforcement enabled. Both public hostnames redirected HTTP to HTTPS.
- `slypork.net` responded directly through GitHub Pages; `watch.slypork.net`
  responded through Cloudflare. Repository edits cannot configure the PC,
  Jellyfin, or the tunnel. A shared parent domain does not give the static site
  direct access to Jellyfin's origin-scoped browser storage.
- Jellyfin's web client and public server-info route were reachable without a
  Cloudflare Access challenge. The protected `/Users` route returned 401 and the
  setup wizard was reported complete. These checks are not a complete
  authentication audit or evidence that every API route is protected.
- The server reported 10.11.8. The owner is handling an upgrade to 12.0 separately;
  no server upgrade or configuration changes are part of this repository patch.

For the gaming PC, the settings not verified here are the firewall and router
port forwards, tunnel ingress rules, service account privileges, proxy trust,
user permissions and access policies. In particular:

1. Keep public ingress limited to the intended Jellyfin service. When cloudflared
   runs on the same PC, its origin can use loopback; avoid opening router ports
   for Jellyfin or routing wildcard hostnames to other PC services. For locally
   managed tunnel rules, use an unmatched-request `http_status:404` final rule.
2. Review Jellyfin's known proxies and local-network definitions so remote
   clients are not treated as trusted local users. Run it without administrator
   privileges and with only the filesystem access it needs. Use separate
   non-admin viewing accounts and strong passwords.
3. Decide whether public Jellyfin login is intended. Cloudflare Tunnel carries
   traffic; access restriction is a separate policy. An Access login can suit
   browser users, but native/TV clients need compatibility testing. Private
   network access is another option. No policy was enabled during this audit.
4. Keep tunnel tokens and account certificates outside this public repository.
   Ignore rules are only accident prevention; rotate any credential if it is
   ever committed, even after removing the file.

The sampled HTML responses lacked CSP, HSTS and clickjacking headers. The new
meta CSP works on GitHub Pages, but `frame-ancestors`, `X-Content-Type-Options`
and HSTS require real HTTP response headers. If adding these at a proxy, scope
portfolio rules to the portfolio hostname and test Jellyfin separately. No
ineffective `_headers` file or `frame-ancestors` meta tag was added. GitHub Pages
exclusions also do not erase public Git history or make archived form URLs private.

## Validation

- Clean `npm ci --ignore-scripts`, npm audit (zero findings), and no production
  npm dependencies.
- CSS compilation with the updated dependency tree, without rewriting the
  currently committed stylesheet as an unrelated visual change.
- Static checks on all 18 pages: policy placement, local script availability,
  existing frame/style/form destinations, stylesheet integrity, and no inline
  scripts or event handlers.
- Chromium checks across all 18 pages: no unexpected CSP violations or JavaScript
  exceptions; injected inline scripts and unapproved frames blocked. Flock
  initialization, CV print, KerBy lightbox and mocked newsletter submission pass.
  External services were stubbed: real playback, booking and subscription
  delivery were not tested.
- A local Jekyll 3.10 safe-mode build confirmed development paths and the archived
  RSVP route are absent, while every required tracked page and asset is present.
  This is not a live GitHub Pages deployment test.

The security workflow reports checks but does not block native Pages publishing
unless repository branch protection requires them. Do not add `.nojekyll`, which
would bypass `_config.yml`. New repository files are public unless excluded.
After publishing, verify `/package.json` and `/rsvp-disabled/` return 404 and that
pages contain the CSP meta tag; these URLs still serve the old deployment now.

## References

- [GitHub Pages and Jekyll](https://docs.github.com/en/pages/setting-up-a-github-pages-site-with-jekyll/about-github-pages-and-jekyll)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Cloudflare Access applications](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/)
- [Jellyfin networking](https://jellyfin.org/docs/general/post-install/networking/)
- [Jellyfin reverse proxy configuration](https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/)
