// /kerby/'s "follow along" signup and product illustrations.
//
// One list, two things arriving on it: a changelog email with each beta build, and
// word when KerBy is released. The page's copy names both - a signup that promised
// only the release would make the build notes read as spam to whoever didn't ask.
//
// The form posts to Buttondown's public embed endpoint, which needs no API key -
// so nothing secret ends up in the page source. Without JS the form still submits
// normally and Buttondown renders its own confirmation page; this file only
// upgrades that to an inline message so the visitor never leaves the page.
//
// Buttondown sends `access-control-allow-origin: *` on that endpoint, so unlike a
// lot of embed forms we can actually read the response and tell success from
// failure rather than optimistically claiming success.

var NOTIFY_ENDPOINT = 'https://buttondown.com/api/emails/embed-subscribe/slypork';

function initNotifyForm() {
    var form = document.getElementById('notifyForm');
    if (!form) return;

    var input = document.getElementById('notifyEmail');
    var button = document.getElementById('notifyButton');
    var status = document.getElementById('notifyStatus');
    var buttonLabel = button.textContent;
    var cta = document.getElementById('kerbyBetaCta');

    // The hero button is an anchor to this form, so the browser does the scrolling;
    // this only puts the cursor in the field once it has arrived, after the jump, so
    // focusing doesn't fight the browser's own scroll.
    if (cta) cta.addEventListener('click', function () {
        setTimeout(function () { input.focus({ preventScroll: true }); }, 0);
    });

    function setStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle('text-kerbyRed', !!isError);
        status.classList.toggle('dark:text-kerbyDarkText', !!isError);
    }

    form.addEventListener('submit', function (event) {
        // Let the browser's own validation bubble handle an empty/malformed address.
        if (!form.checkValidity()) return;

        event.preventDefault();
        button.disabled = true;
        button.textContent = 'Sending…';
        setStatus('', false);

        fetch(NOTIFY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ email: input.value, embed: '1' })
        }).then(function (response) {
            // `response.ok` is NOT a usable success signal here, and this is measured
            // rather than assumed: Buttondown answers a successful signup awaiting
            // double opt-in with **HTTP 400** whose body is its own "Verify Your
            // Subscription" page, and a first-time one with a 302 to
            // ?state=confirmed_subscription. Checking `ok` therefore told people who
            // had just subscribed that it had failed, and invited a second submit.
            // The browser's own `type="email" required` validation has already
            // rejected a malformed address by this point, so the only failure left
            // worth reporting is Buttondown itself being down.
            if (response.status >= 500) throw new Error(response.status);

            // Replace the whole form: leaving a filled-in field beside a success
            // message invites a second submit that would only produce a duplicate.
            form.innerHTML =
                '<p class="text-lg font-light">Almost there — check your inbox and click the ' +
                'confirmation link.</p>' +
                '<p class="text-base font-light pt-2 opacity-75">Then I\'ll be in touch about ' +
                'a build, and you\'ll get the changelog as each new one lands. If it doesn\'t ' +
                'turn up, have a look in spam.</p>';
        }).catch(function () {
            button.disabled = false;
            button.textContent = buttonLabel;
            setStatus('That didn\'t go through. Try again, or email dev@slypork.net.', true);
        });
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

    var screenshot = document.getElementById('kerbyScreenshot');
    if (!screenshot || typeof HTMLDialogElement === 'undefined') return;

    // Keep a regular image link as the no-JavaScript fallback.
    var dialog = document.createElement('dialog');
    dialog.className = 'kerby-lightbox';
    dialog.setAttribute('aria-label', 'KerBy interface, enlarged');
    dialog.innerHTML = '<form method="dialog"><button autofocus>Close <span aria-hidden="true">×</span></button></form><img alt="">';
    document.body.appendChild(dialog);
    screenshot.addEventListener('click', function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        var source = screenshot.querySelector('img');
        var enlarged = dialog.querySelector('img');
        enlarged.src = source.currentSrc || source.src;
        enlarged.alt = source.alt;
        dialog.showModal();
    });
    dialog.addEventListener('click', function (event) {
        if (event.target !== dialog) return;
        var bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKerbyOverview);
    document.addEventListener('DOMContentLoaded', initKerbyReference);
} else {
    initKerbyOverview();
    initKerbyReference();
}
