// /kerby/'s "hear when it's out" signup.
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
                '<p class="text-base font-light pt-2 opacity-75">If it doesn\'t turn up, have a ' +
                'look in spam.</p>';
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
