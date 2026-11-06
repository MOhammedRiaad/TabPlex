// Park & Resume demo in the hero. Park closes the task's tabs; Resume brings them back. Nothing is sent anywhere.
(function () {
    const demo = document.getElementById('demo');
    if (!demo) return;

    const input = demo.querySelector('#demo-note');
    const noteOut = demo.querySelector('[data-note-out]');
    const status = demo.querySelector('[data-status]');
    const fallbackNote = 'Comparing Stripe vs Paddle fees, stopped at EU VAT';

    function setState(state) {
        demo.dataset.state = state;
        if (state === 'parked') {
            noteOut.textContent = '“' + (input.value.trim() || fallbackNote) + '”';
            status.textContent = 'Parked. 3 tabs closed and your note saved.';
            demo.querySelector('[data-resume]').focus();
        } else {
            status.textContent = 'Resumed. 3 tabs reopened in a tab group.';
            input.focus();
        }
    }

    demo.querySelector('[data-park]').addEventListener('click', () => setState('parked'));
    demo.querySelector('[data-resume]').addEventListener('click', () => setState('working'));
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') setState('parked');
    });
})();
