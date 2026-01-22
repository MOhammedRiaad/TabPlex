/* global document, window, chrome, setTimeout, console */
// Onboarding page script
document.addEventListener('DOMContentLoaded', () => {
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
