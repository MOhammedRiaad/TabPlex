# Chrome Web Store Listing — TabPlex

> Last Updated: 2026-10-04

The single source of truth for the store listings (Chrome Web Store and Microsoft Edge Add-ons). It follows the `CHROMEWEBSTORE.md` format of Chrome's `chrome-extensions` agent skill. Copy fields from here into the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) and Partner Center. Every claim must be true of the shipped build.

**Keep it current.** Update this file in the same PR when:

- a user-facing feature changes: the description, Last Updated and Version History
- `manifest.json` permissions change: Permissions Justification, plus `PRIVACY.md` and the README "Permissions Explained"
- data handling changes: Privacy & Data Use and `PRIVACY.md`
- the UI changes: regenerate the screenshots (`npm run build && npm run screenshots`)
- a store rejects a submission: Review Notes

This file isn't shipped: the store zip holds only `dist/`.

## Store Listing

**Extension Name**

TabPlex (from `manifest.json` `name`)

**Short Description**

Give every task its own tabs. Park work with a note, resume it in one click, and organize tabs into groups. Private, on-device.

(`manifest.json` `description`, 127/132 characters)

**Detailed Description**

The store strips Markdown: paste as plain text.

```
Close your tabs without losing your train of thought.

TabPlex gives every task its own tabs. Start a task and its tabs open in a Chrome tab group named after it. When you switch to something else, park it with a one-line note ("where I left off") and the tabs close. Resume later and you're back exactly where you were.

PARK & RESUME
• A task can own a set of tabs; they open in a named, coloured tab group
• New tabs you open join the active task automatically (you can turn this off)
• Park with a note, choose which tabs to keep open, and close the rest
• Parked work waits for you on the Today view; resume in one click
• Closing the group by hand parks the task safely, so no tab is lost
• Optional: start a Pomodoro with the task, and an on-device AI summary of what you were doing

ORGANIZE TABS
• One click suggests tab groups for your loose tabs
• With Chrome's built-in AI, tabs are grouped by what you're working on; without it, by site
• Rename, recolour or drop tabs in a preview before anything changes
• Undo, or save the groups to Boards
• Pinned tabs and existing groups (including your active task) are never touched

NEW TASK FROM TABS
• Turn the tabs you're looking at into a task in one step
• With Chrome's built-in AI, TabPlex drafts the title, priority and next steps; without it, it suggests a title
• Edit the draft, then create the task, or create and start it: its tabs move into the task's group, nothing reopens
• Or create and park it: the tabs are saved to the task and closed, ready to reopen later
• Works from the Tasks view, the command palette, or a group you just organized

ALSO INCLUDED
• Boards: save tabs into coloured folders, search them, drag and drop
• Tasks: To Do / Doing / Done with priorities, due dates and checklists
• Markdown notes, a Pomodoro focus timer and a whiteboard canvas
• Bookmarks manager and saved browsing sessions
• Local insights: how often you switched context and how many tabs parking closed
• Command palette (Ctrl+K), keyboard shortcuts, light and dark themes
• Export and import all your data as a file

HOW TO USE
1. Click the TabPlex icon in the toolbar to open your workspace in a tab.
2. Create a task, add the tabs you need, and press Start: they open in a tab group named after the task.
3. Switching to something else? Press Park, write where you left off, and the tabs close.
4. Press Resume on the Today view to get the tabs and your note back.

PRIVATE BY DESIGN
• Everything is stored in your browser on this device. No account, no TabPlex server, no analytics.
• AI features use Chrome's built-in model on your computer. Tab titles and addresses never leave it.
• TabPlex has no access to the content of the websites you visit; it only sees tab titles and addresses.
• Website icons come from Chrome's own local cache, not a third-party service.

On-device AI needs a recent desktop Chrome on a device that meets Chrome's requirements for built-in AI. Every feature works without it.

SUPPORT
Found a bug or have an idea? Open an issue at https://github.com/MOhammedRiaad/TabPlex/issues
```

**Category**

Productivity → Workflow & Planning

**Single Purpose**

The review team rejects a purpose that lists several features, so this names only the main one. The description covers the rest.

```
Organizes browser tabs by task: each task keeps its own tabs, which the user can close with a short note and reopen later in one click.
```

**Primary Language**

English

## Graphics & Assets

| Asset              | Dimensions | Status   | Filename                                                             |
| ------------------ | ---------- | -------- | -------------------------------------------------------------------- |
| Store Icon         | 128×128    | ✅ Ready | `assets/icon128.png`                                                 |
| Screenshot 1       | 1280×800   | ✅ Ready | `store-assets/screenshots/1-today.png`                               |
| Screenshot 2       | 1280×800   | ✅ Ready | `store-assets/screenshots/2-park-resume.png`                         |
| Screenshot 3       | 1280×800   | ✅ Ready | `store-assets/screenshots/3-organize-tabs.png`                       |
| Screenshot 4       | 1280×800   | ✅ Ready | `store-assets/screenshots/4-boards.png`                              |
| Screenshot 5       | 1280×800   | ✅ Ready | `store-assets/screenshots/1-today-dark.png` (or `5-settings-ai.png`) |
| Small Promo Tile   | 440×280    | ✅ Ready | `store-assets/promo/promo-small-440x280.png`                         |
| Marquee Promo Tile | 1400×560   | ✅ Ready | `store-assets/promo/promo-marquee-1400x560.png`                      |

### Screenshot Notes

Regenerate the screenshots and promo tiles (from `store-assets/promo/promo.html`) with `npm run build && npm run screenshots`. They use demo data, in light and dark. The Organize tabs screenshot shows an example AI answer, because automated browsers can't run Chrome's built-in model; the dialog itself is the real one.

## Permissions Justification

| Permission      | Type        | Justification                                                                                                                                                                                                                         |
| --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`          | permissions | Read the titles and addresses of open tabs so the user can save them to a task or board, and open, close and focus a task's tabs when it starts, parks or resumes.                                                                    |
| `tabGroups`     | permissions | Create and name the Chrome tab group for an active task, and the groups the user confirms in "Organize tabs"; notice when the user closes a task's group.                                                                             |
| `history`       | permissions | Show recent browser history in the History view and the Boards side panel so the user can add pages to folders, and suggest work sessions from recent history in the Sessions view. Read only by those views; it stays on the device. |
| `sessions`      | permissions | List recently closed tabs and windows in the Sessions view so the user can restore them.                                                                                                                                              |
| `storage`       | permissions | Save the user's tasks, tabs, notes, boards and settings locally in the browser.                                                                                                                                                       |
| `notifications` | permissions | Show task due reminders and focus-timer alerts.                                                                                                                                                                                       |
| `bookmarks`     | permissions | Show, search, create, edit and organize the user's bookmarks in the Bookmarks view.                                                                                                                                                   |
| `favicon`       | permissions | Show website icons from Chrome's local favicon cache next to saved tabs, bookmarks and links, without contacting a third-party icon service.                                                                                          |

No host permissions. No remote code: all JavaScript is in the package.

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No.

TabPlex stores data **only on the user's device** and sends nothing to the developer or third parties. Data handled only on the device is not "collection" in the Web Store's sense, so check none of the data-type boxes. It reads web history and tab titles/addresses for its own features, and that data never leaves the device. It doesn't use `chrome.storage.sync`.

### Data Use Certification

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

## Privacy Policy

**Privacy Policy URL**: https://mohammedriaad.github.io/TabPlex/privacy.html (generated from `PRIVACY.md` by `npm run build:privacy`, published by `.github/workflows/pages.yml`)

## Distribution

**Visibility**: Public
**Regions**: All regions

## Developer Info

**Publisher Name**: set in the developer dashboard
**Contact Email**: set and verified in the developer dashboard (it is shown publicly; Google sends policy notices there)
**Support URL**: https://github.com/MOhammedRiaad/TabPlex/issues
**Homepage URL**: https://mohammedriaad.github.io/TabPlex/

## Microsoft Edge Add-ons

The Release workflow publishes updates after the first version (`npm run publish:edge`; see `docs/MAINTENANCE_GUIDE.md` → Release Process). The first version was submitted by hand in Partner Center. The workflow needs the `EDGE_CLIENT_ID`, `EDGE_API_KEY` and `EDGE_PRODUCT_ID` repository secrets.

Edge may not offer Chrome's built-in AI, so the Edge listing doesn't promise AI features (TabPlex falls back to grouping by site). Reuse the Chrome text with "Chrome" changed to "the browser", and drop the on-device AI lines.

### Single purpose description (as submitted)

```
TabPlex organizes your browser work around tasks. Each task can own a set of tabs: start it to open them in a named tab group, park it with a short "where I left off" note to close them, and resume it later in one click. Everything else in TabPlex supports that purpose: organizing open tabs into groups, boards of saved tabs, task lists, notes and a focus timer, all in one workspace. All data stays on the user's device.
```

### Graphics

| Asset                  | Size     | File                                                                |
| ---------------------- | -------- | ------------------------------------------------------------------- |
| Small promotional tile | 440×280  | `store-assets/promo/promo-small-440x280.png`                        |
| Large promotional tile | 1400×560 | `store-assets/promo/promo-marquee-1400x560.png`                     |
| Screenshot 1           | 1280×800 | `store-assets/screenshots/edge/1-today.png` (no AI summary)         |
| Screenshot 2           | 1280×800 | `store-assets/screenshots/2-park-resume.png`                        |
| Screenshot 3           | 1280×800 | `store-assets/screenshots/edge/3-organize-tabs-by-site.png` (no AI) |
| Screenshot 4           | 1280×800 | `store-assets/screenshots/4-boards.png`                             |
| Screenshot 5           | 1280×800 | `store-assets/screenshots/edge/1-today-dark.png`                    |
| Screenshot 6           | 1280×800 | `store-assets/screenshots/2-park-resume-dark.png`                   |

## Version History

Most recent first. Versions come from semantic-release (`CHANGELOG.md`); a store row changes when the version is uploaded or reviewed.

| Version | Date       | Changes                                                                                                        | Status                                                    |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| next    | —          | New task from tabs (draft a task from open tabs, create & start or park it); one task form for create and edit | Not released yet (on `develop`)                           |
| 1.0.1   | 2026-10-04 | Landing page fix only; no change to the extension                                                              | Edge: submitted by hand, in review. Chrome: not submitted |
| 1.0.0   | 2026-10-04 | First public release: Park & Resume, Organize tabs, boards, tasks, notes, timer                                | GitHub release only                                       |

## Review Notes

### Known Issues / Limitations

- On-device AI (Organize tabs by topic, task drafts, park summaries) needs desktop Chrome with built-in AI on capable hardware. Without it, Organize tabs groups by site, New task from tabs suggests only a title, and summaries are off.
- Edge: the AI features are hidden or fall back, because Edge may not offer the same built-in model.

### Rejection History

None yet.

## Before submitting to the Chrome Web Store

1. **Developer account**: a Chrome Web Store developer account (one-time registration fee) and a verified contact email.
2. Run the release-candidate pass (`ROADMAP.md` v1.0 queue #10) and the [pre-publish review checklist](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/chrome-extensions/references/webstore/review-checklist.md).
3. Upload `tabplex-vX.Y.Z.zip` from the GitHub release, fill in the fields above, and submit.
4. Once published: replace the three `TODO(v1.0.0)` download links in `landing-page/index.html` with the store URL, and add a Version History row.
