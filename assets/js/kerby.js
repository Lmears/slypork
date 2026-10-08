// /kerby/'s "follow along" signup and product illustrations.
//
// One list, two things arriving on it: word when KerBy is released, and a changelog
// email with each new version. The page's copy names both - a signup that promised
// only the release would make the build notes read as spam to whoever didn't ask.
//
// The form posts to Buttondown's public embed endpoint, which needs no API key -
// so nothing secret ends up in the page source. Without JS the form still submits
// normally and Buttondown renders its own confirmation, validation or CAPTCHA page.
// Keep that navigation even with JS: fetching the embed endpoint hides challenges
// visitors may need to complete. A response below HTTP 500 does not mean success.
// https://docs.buttondown.com/building-your-subscriber-base

function initNotifyForm() {
    var form = document.getElementById('notifyForm');
    if (!form) return;

    var input = document.getElementById('notifyEmail');
    var cta = document.getElementById('kerbyNotifyCta');

    // The hero button is an anchor to this form, so without JS it still jumps there.
    // With JS it also puts the cursor in the field, so a visitor can tap the button and
    // start typing. The focus has to happen synchronously inside the click: iOS (and
    // Instagram's in-app browser, where most of these visits come from) only raises
    // the keyboard for a focus() made during the user's own tap, and silently ignored
    // the old setTimeout one. So the scroll is done here too rather than left to the
    // browser, and preventScroll keeps focus() from making a jump of its own.
    // The URL is left as it was: nothing reads the hash, and the bare /kerby/ is tidier.
    if (cta) cta.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        form.scrollIntoView({ block: 'start' });
        input.focus({ preventScroll: true });
    });

}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotifyForm);
} else {
    initNotifyForm();
}

function initKerbyOverview() {
    var recovery = document.getElementById('kerbyRecovery');
    if (recovery) {
        var curve = document.getElementById('kerbyBassCurve');
        var fill = document.getElementById('kerbyBassFill');
        function drawDuck() {
            var length = 248 * Number(recovery.value) / 100;
            var path = [104, 352].map(function (start, index) {
                return (index ? ' L' : 'M') + start + ' 176 C' +
                    (start + length * 0.2) + ' 176 ' + (start + length * 0.23) +
                    ' 102 ' + (start + length) + ' 102 L' + (start + 248) + ' 102';
            }).join('');
            curve.setAttribute('d', path);
            fill.setAttribute('d', path + ' L600 176Z');
            recovery.setAttribute('aria-valuetext', recovery.value < 45 ? 'Quick return' :
                recovery.value > 75 ? 'Slow return' : 'Gradual return');
        }
        recovery.closest('.kerby-duck-control').hidden = false;
        recovery.addEventListener('input', drawDuck);
        drawDuck();
    }
}

function initKerbyReference() {
    var input = document.getElementById('kerbyReferenceSearch');
    if (!input) return;
    var sections = Array.from(document.querySelectorAll('[data-reference]'));
    var indexLinks = Array.from(document.querySelectorAll('.kerby-topic-index a'));
    var searchable = sections.map(function (section) {
        return section.textContent.toLocaleLowerCase();
    });
    var status = document.getElementById('kerbySearchStatus');

    function filter() {
        var terms = input.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
        var count = 0;
        sections.forEach(function (section, index) {
            var matches = terms.every(function (term) { return searchable[index].includes(term); });
            section.hidden = !matches;
            indexLinks[index].hidden = !matches;
            if (matches) count++;
        });
        status.textContent = terms.length === 0 ? 'Browse all ' + count + ' topics below.' :
            count === 0 ? 'No matching topics. Try another word, or clear the search.' :
            count + (count === 1 ? ' matching topic.' : ' matching topics.');
        document.body.dispatchEvent(new CustomEvent('layoutChanged'));
    }

    function showLinkedTopic() {
        var target = document.getElementById(location.hash.slice(1));
        if (target && target.matches('[data-reference]') && target.hidden) {
            input.value = '';
            filter();
            target.scrollIntoView();
        }
    }

    input.closest('.kerby-search').hidden = false;
    input.addEventListener('input', filter);
    document.getElementById('kerbySearchClear').addEventListener('click', function () {
        input.value = '';
        filter();
        input.focus();
    });
    window.addEventListener('hashchange', showLinkedTopic);
    window.addEventListener('pageshow', function () { filter(); showLinkedTopic(); });
    filter();
    showLinkedTopic();
}

// /kerby/whats-new/ fetches its notes from changelog.html, which the plugin repo's release
// script generates from CHANGELOG.md - kept out of the page so it isn't carrying a
// generated history that grows every release. Same-origin, so the CSP's
// connect-src 'self' already allows it. no-cache revalidates rather than refetching,
// so a visitor right after a release sees the new notes, not a cached copy.
function initKerbyChangelog() {
    var container = document.getElementById('kerbyChangelog');
    if (!container) return;

    fetch('/kerby/changelog.html', { cache: 'no-cache' }).then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.text();
    }).then(function (html) {
        container.innerHTML = html;
        // The fragment folds older versions away, which suited the Overview it was made
        // for. On a page that is only the history, show all of it.
        container.querySelectorAll('details').forEach(function (details) {
            details.open = true;
        });
    }).catch(function () {
        // A link rather than an error message: the notes still exist, the fetch just failed.
        container.innerHTML = '<p class="text-lg font-light pt-4"><a href="/kerby/changelog.html" ' +
            'class="link-underline">Read the changelog</a></p>';
    }).then(function () {
        document.body.dispatchEvent(new CustomEvent('layoutChanged'));
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKerbyOverview);
    document.addEventListener('DOMContentLoaded', initKerbyReference);
    document.addEventListener('DOMContentLoaded', initKerbyChangelog);
} else {
    initKerbyOverview();
    initKerbyReference();
    initKerbyChangelog();
}
