// Builds landing-page/privacy.html from PRIVACY.md, so the published policy is always the one in the repo.
//   node scripts/build-privacy-page.mjs          write the page
//   node scripts/build-privacy-page.mjs --check  fail if the page is out of date (CI)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { marked } from 'marked';

const SOURCE = 'PRIVACY.md';
const TARGET = 'landing-page/privacy.html';

const markdown = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
const body = marked.parse(markdown, { gfm: true });

const html = `<!DOCTYPE html>
<html lang="en">
<!-- Generated from PRIVACY.md by scripts/build-privacy-page.mjs. Edit PRIVACY.md, then run: npm run build:privacy -->

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy · TabPlex Tab Manager</title>
    <meta name="description"
        content="TabPlex privacy policy: the tab manager keeps your tabs, tasks and notes in your browser. No account, no servers, no tracking.">
    <meta name="robots" content="index, follow">
    <meta name="theme-color" content="#161c28">
    <link rel="canonical" href="https://mohammedriaad.github.io/TabPlex/privacy.html">
    <link rel="icon" type="image/png" sizes="32x32" href="images/favicon-32.png">
    <link rel="icon" type="image/png" sizes="128x128" href="images/icon-128.png">

    <meta property="og:type" content="article">
    <meta property="og:site_name" content="TabPlex">
    <meta property="og:title" content="Privacy Policy · TabPlex Tab Manager">
    <meta property="og:description"
        content="TabPlex privacy policy: the tab manager keeps your tabs, tasks and notes in your browser. No account, no servers, no tracking.">
    <meta property="og:url" content="https://mohammedriaad.github.io/TabPlex/privacy.html">
    <meta property="og:image" content="https://mohammedriaad.github.io/TabPlex/images/1-today.png">
    <meta name="twitter:card" content="summary">

    <link rel="preload" href="fonts/bricolage-normal-500-800.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="fonts/atkinson-normal-400.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="style.css">
</head>

<body>
    <a class="skip-link" href="#main">Skip to content</a>

    <header class="site-header">
        <div class="container site-header-inner">
            <a href="index.html" class="wordmark">
                <img src="images/icon-128.png" width="32" height="32" alt="">
                TabPlex
            </a>
            <nav class="site-nav" aria-label="Main">
                <a href="index.html#features">Features</a>
                <a href="index.html#privacy">Privacy</a>
                <a href="index.html#faq">FAQ</a>
            </nav>
        </div>
    </header>

    <main id="main" class="container legal">
${body}
    </main>

    <footer class="site-footer">
        <div class="container site-footer-inner">
            <p>&copy; 2026 TabPlex</p>
            <nav aria-label="Footer">
                <a href="index.html">Home</a>
                <a href="https://github.com/MOhammedRiaad/TabPlex">GitHub</a>
            </nav>
        </div>
    </footer>
</body>

</html>
`;

if (process.argv.includes('--check')) {
    const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== html) {
        console.error(`${TARGET} is out of date with ${SOURCE}. Run: npm run build:privacy`);
        process.exit(1);
    }
    console.log(`${TARGET} is up to date.`);
} else {
    writeFileSync(TARGET, html);
    console.log(`Wrote ${TARGET}`);
}
