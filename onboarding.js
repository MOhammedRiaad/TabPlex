/* global document, window, chrome, setTimeout, console */
// Onboarding page script
// Same key and ids as src/features/boards/switcher/boardStyle.ts (a unit test keeps the lists in step)
const BOARD_STYLE_KEY = 'tabplex_board_style';

/** Board view picker: shows the saved choice and saves a new one. Skipping it keeps the default (Board tabs). */
function setUpBoardStylePicker() {
    const options = Array.from(document.querySelectorAll('input[name="boardStyle"]'));
    const saved = document.getElementById('boardStyleSaved');
    if (!options.length || typeof chrome === 'undefined' || !chrome.storage) return;

    chrome.storage.local
        .get([BOARD_STYLE_KEY])
        .then(result => {
            const match = options.find(option => option.value === result[BOARD_STYLE_KEY]);
            if (match) match.checked = true;
        })
        .catch(console.error);

    options.forEach(option => {
        option.addEventListener('change', () => {
            if (!option.checked) return;
            chrome.storage.local
                .set({ [BOARD_STYLE_KEY]: option.value })
                .then(() => {
                    const name = option.parentElement.querySelector('.board-style-name');
                    if (saved && name) saved.textContent = `Saved: ${name.firstChild.textContent.trim()}`;
                })
                .catch(console.error);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setUpBoardStylePicker();
    const getStartedBtn = document.getElementById('getStartedBtn');

    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            // Open TabBoard extension
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({ type: 'OPEN_TABBOARD' }, () => {
                    // Handle response or errors
                    if (chrome.runtime.lastError) {
                        console.error('Error opening TabBoard:', chrome.runtime.lastError);
                        // Fallback: try to open the extension URL directly
                        const extensionUrl = chrome.runtime.getURL('index.html');
                        window.location.href = extensionUrl;
                    } else {
                        // Close the onboarding tab after opening TabBoard
                        setTimeout(() => {
                            window.close();
                        }, 500);
                    }
                });
            } else {
                // Fallback: try to open the extension URL
                const extensionUrl = chrome.runtime.getURL('index.html');
                window.location.href = extensionUrl;
            }
        });
    }

    // Add smooth scroll behavior
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        });
    });
});
