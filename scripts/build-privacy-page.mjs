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
    <title>Privacy policy · TabPlex</title>
    <meta name="description" content="How TabPlex handles your data: everything stays in your browser.">
    <link rel="stylesheet" href="style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet">
</head>

<body>
    <nav class="navbar glass">
        <div class="container nav-container">
            <a href="index.html" class="logo">
                <div class="logo-icon">T</div>
                <span>TabPlex</span>
            </a>
            <div class="nav-links">
                <a href="index.html#features">Features</a>
                <a href="index.html#privacy">Privacy</a>
            </div>
        </div>
    </nav>

    <main class="container legal">
${body}
    </main>

    <footer class="footer">
        <div class="container footer-bottom">
            <p>&copy; 2026 TabPlex</p>
            <div class="socials">
                <a href="index.html">Home</a>
                <a href="https://github.com/MOhammedRiaad/TabPlex">GitHub</a>
            </div>
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
