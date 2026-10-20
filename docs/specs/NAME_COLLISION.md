# Spec: The "TabPlex" name collision: decide, then rename or coexist

|             |                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **Status**  | Decided 2026-10-08: **C. Coexist**, with a descriptor after the name on the Chrome listing (ROADMAP D16) |
| **Created** | 2026-10-05                                                                                               |
| **Size**    | M (rename: 1–2 days incl. store updates)                                                                 |

## 1. Facts (checked 2026-10-05)

|                              | This project                                                    | The other TabPlex                                                           |
| ---------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| First public use of the name | 2026-01-12 (commit `d0a9446`, public repo since 2025-12-24)     | GitHub org `TabPlex` created 2026-01-18                                     |
| First release                | GitHub v1.0.0 2026-10-04; Edge live 2026-10-05                  | v1.0.0 2026-08-08; Chrome Web Store item `cgenkcelnlbjbnpmembeekfjcldfagbh` |
| Domain                       | `mohammedriaad.github.io/TabPlex`                               | `tabplex.com`                                                               |
| Product                      | tasks with their own tabs (Park & Resume), boards, notes, timer | "workspaces": save/switch a window's tabs                                   |
| Code / assets                | own (proprietary licence since #43)                             | own (AGPL-3.0, different code, logo and text)                               |

Nothing was copied either way: it's an independent name clash, not impersonation. Neither name is (known to be) a
registered trademark.

## 2. Options

| Option                                                                                                        | Effort   | Risk                                                                                                |
| ------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| **A. Rename** before the Chrome submission (recommended)                                                      | M        | Small now (Edge just launched, no Chrome listing); grows with every user                            |
| **B. Contact them** (contact@tabplex.com), show the earlier public use, ask to rename or agree on coexistence | XS       | Likely "no": they hold the domain and the Chrome listing                                            |
| **C. Coexist**                                                                                                | none now | Users confuse the two; our Chrome review may flag the listing as misleading or impersonating theirs |

## 3. Choosing a new name (if A)

For each candidate, record the result of:

1. Chrome Web Store and Edge Add-ons search: no extension with the same or a confusingly similar name.
2. GitHub: no org/repo of that name with a related product.
3. Domain: `.com` (and ideally `.app`) unregistered or affordable.
4. Trademark search: USPTO (TESS), EUIPO (eSearch), WIPO Global Brand Database, in class 9 (software).
5. Says what it does, easy to spell, works as a word mark (e.g. in the store's 75-character name field).

## 4. Rename checklist (if A)

**Change (user-visible):**

- `manifest.json` `name` (and `short_name` if added), `description` if it contains the name.
- `index.html` / `onboarding.html` `<title>` and visible text; UI strings containing "TabPlex" (grep `TabPlex` in
  `src/`, excluding storage keys below).
- `landing-page/` (title, meta description, text, promo tiles in `store-assets/promo/promo.html`, regenerate
  screenshots and tiles with `npm run screenshots`).
- `README.md`, `PRIVACY.md` (+ `npm run build:privacy`), `CHROMEWEBSTORE.md`, `ROADMAP.md`, `CLAUDE.md`, docs.
- Edge listing name and text in Partner Center (same product id; the URL slug may change, update links).
- GitHub repo rename (GitHub redirects old URLs; **GitHub Pages moves** to the new path: update the privacy-policy URL
  in both store listings and the landing links).
- `package.json` `name`, release zip name (`scripts/package-extension.mjs`, `publish-edge.mjs` pattern
  `tabplex-v*.zip`, workflows).
- `LICENSE` first line.

**Keep (internal, renaming would lose user data or break sync):**

- IndexedDB name `TabPlexDB`, `chrome.storage` keys (`tabplex_*`, `tabboard_*`), `localStorage` keys, message types.
- Extension id (same Edge product; Chrome item not created yet).

**Tests:** E2E and unit tests that assert visible "TabPlex" text; the E2E fixture's page title checks; store screenshot
generator.

## 5. Delivery (if A)

1. Owner picks the name (§3), registers the domain if wanted.
2. One PR, `feat: rename TabPlex to {Name}` (a minor release: nothing breaks for users, their data stays), with the
   checklist above.
3. Update Partner Center listing text and assets; submit.
4. Then the Chrome submission (#11) under the new name.
