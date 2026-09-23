"""Dependency-free checks for the static site's browser security boundaries."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://slypork.net"


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path
        self.policy = None
        self.referrer = False

    def check(self, condition, message):
        if not condition:
            raise ValueError(f"{self.path.relative_to(ROOT)}:{self.getpos()[0]}: {message}")

    def resource(self, directive, value):
        self.check(self.policy is not None, "CSP must precede resources")
        url = urlsplit(urljoin(ORIGIN + "/" + str(self.path.relative_to(ROOT)), value))
        source = "'self'" if f"{url.scheme}://{url.netloc}" == ORIGIN else f"{url.scheme}://{url.netloc}"
        self.check(source in self.policy.get(directive, []), f"{directive} blocks {value}")
        if source == "'self'":
            self.check((ROOT / url.path.lstrip("/")).is_file(), f"missing resource: {value}")

    def handle_starttag(self, tag, items):
        attrs = dict(items)
        if tag == "meta" and attrs.get("http-equiv", "").lower() == "content-security-policy":
            self.check(self.policy is None, "duplicate CSP")
            self.policy = {}
            for part in attrs["content"].split(";"):
                words = part.split()
                if words:
                    self.policy[words[0]] = words[1:]
            for directive, expected in {
                "default-src": ["'none'"], "script-src": ["'self'"],
                "object-src": ["'none'"], "base-uri": ["'none'"],
                "form-action": ["https://buttondown.com"],
            }.items():
                self.check(self.policy.get(directive) == expected, f"unsafe {directive}")
            self.check("frame-ancestors" not in self.policy, "frame-ancestors needs an HTTP header")
        if tag == "meta" and attrs.get("name") == "referrer":
            self.referrer = attrs.get("content") == "strict-origin-when-cross-origin"
        for name, value in items:
            self.check(not name.startswith("on"), "inline event handler")
            if name in {"src", "href", "action", "formaction"} and value:
                self.check(not value.lower().lstrip().startswith("javascript:"), "javascript URL")
        if tag == "script":
            self.check(bool(attrs.get("src")), "inline script is blocked")
            self.resource("script-src", attrs["src"])
        if tag == "iframe":
            self.resource("frame-src", attrs["src"])
        if tag in {"audio", "video", "source", "track"} and attrs.get("src"):
            self.resource("media-src", attrs["src"])
        if tag == "form" and attrs.get("action"):
            self.resource("form-action", attrs["action"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.resource("style-src", attrs["href"])
            if attrs["href"].startswith("https://"):
                self.check(bool(attrs.get("integrity")) and attrs.get("crossorigin") == "anonymous", "external CSS needs SRI")


pages = sorted(p for p in ROOT.rglob("index.html") if not any(
    part in {"node_modules", ".git", "_site", "vendor"} for part in p.relative_to(ROOT).parts
))
for path in pages:
    parser = Page(path)
    parser.feed(path.read_text())
    parser.check(parser.policy is not None and parser.referrer, "missing security metadata")

if (ROOT / ".nojekyll").exists():
    raise ValueError(".nojekyll bypasses the publication exclusions in _config.yml")
print(f"Security checks passed for {len(pages)} HTML pages.")
