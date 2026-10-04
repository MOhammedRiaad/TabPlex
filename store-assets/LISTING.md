# Chrome Web Store listing: TabPlex

Copy these fields into the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Keep them in step with the code: every claim here must be true of the shipped build.

## Store listing tab

| Field        | Value                                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name         | TabPlex (from `manifest.json`)                                                                                                                                                           |
| Summary      | Give every task its own tabs. Park work with a note, resume it in one click, and organize tabs into groups. Private, on-device. (from `manifest.json` `description`, 127/132 characters) |
| Category     | Productivity → Workflow & Planning                                                                                                                                                       |
| Language     | English                                                                                                                                                                                  |
| Homepage URL | https://mohammedriaad.github.io/TabPlex/ (GitHub Pages, published from `landing-page/` by `.github/workflows/pages.yml`)                                                                 |
| Support URL  | https://github.com/MOhammedRiaad/TabPlex/issues                                                                                                                                          |

### Description

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

ALSO INCLUDED
• Boards: save tabs into coloured folders, search them, drag and drop
• Tasks: To Do / Doing / Done with priorities, due dates and checklists
• Markdown notes, a Pomodoro focus timer and a whiteboard canvas
• Bookmarks manager and saved browsing sessions
• Local insights: how often you switched context and how many tabs parking closed
• Command palette (Ctrl+K), keyboard shortcuts, light and dark themes
• Export and import all your data as a file

PRIVATE BY DESIGN
• Everything is stored in your browser on this device. No account, no TabPlex server, no analytics.
• AI features use Chrome's built-in model (Gemini Nano) on your computer. Tab titles and addresses never leave it.
• TabPlex has no access to the content of the websites you visit; it only sees tab titles and addresses.
• Website icons come from Chrome's own local cache, not a third-party service.

On-device AI needs a recent desktop Chrome on a device that meets Chrome's requirements for built-in AI. Every feature works without it.
```

### Graphics

| Asset                                           | Size     | File                                                                             |
| ----------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| Store icon                                      | 128×128  | `assets/icon128.png`                                                             |
| Screenshots (up to 5)                           | 1280×800 | `store-assets/screenshots/1-today.png` … `4-boards.png`, plus `1-today-dark.png` |
| Small promo tile (required)                     | 440×280  | `store-assets/promo/promo-small-440x280.png`                                     |
| Marquee promo tile (optional, used if featured) | 1400×560 | `store-assets/promo/promo-marquee-1400x560.png`                                  |

Regenerate the screenshots and promo tiles (from `store-assets/promo/promo.html`) with `npm run build && npm run screenshots` (demo data, light and dark). The Organize tabs screenshot shows an example AI answer, because automated browsers can't run Chrome's built-in model; the screen itself is the real dialog.

## Privacy practices tab

### Single purpose

```
TabPlex organizes your browser work: tasks that own their tabs (park and resume them), tab groups, boards of saved tabs, notes and a focus timer, in one workspace.
```

### Permission justifications

| Permission      | Justification                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`          | Read the titles and addresses of open tabs so the user can save them to a task or board, and open, close and focus a task's tabs when it starts, parks or resumes.                                                                    |
| `tabGroups`     | Create and name the Chrome tab group for an active task, and the groups the user confirms in "Organize tabs"; notice when the user closes a task's group.                                                                             |
| `history`       | Show recent browser history in the History view and the Boards side panel so the user can add pages to folders, and suggest work sessions from recent history in the Sessions view. Read only by those views; it stays on the device. |
| `sessions`      | List recently closed tabs and windows in the Sessions view so the user can restore them.                                                                                                                                              |
| `storage`       | Save the user's tasks, tabs, notes, boards and settings locally in the browser.                                                                                                                                                       |
| `notifications` | Show task due reminders and focus-timer alerts.                                                                                                                                                                                       |
| `bookmarks`     | Show, search, create, edit and organize the user's bookmarks in the Bookmarks view.                                                                                                                                                   |
| `favicon`       | Show website icons from Chrome's local favicon cache next to saved tabs, bookmarks and links, without contacting a third-party icon service.                                                                                          |

No host permissions. No remote code: all JavaScript is in the package.

### Data usage

TabPlex stores data **only on the user's device** and sends nothing to the developer or third parties, so no data types are "collected" in the Web Store's sense (data handled only locally is not collection). Check none of the data-type boxes, and certify:

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

Privacy policy URL: https://mohammedriaad.github.io/TabPlex/privacy.html

## Open items before submitting

1. **Publish the site.** GitHub Pages is enabled with GitHub Actions as the source. `.github/workflows/pages.yml` deploys `landing-page/` when it or `PRIVACY.md` changes on `main`, so the URLs above go live with the v1.0.0 merge. To publish earlier, run the workflow by hand on `main` (Actions → Landing page → Run workflow).
2. **Developer account**: a Chrome Web Store developer account (one-time registration fee) and a verified contact email.
3. After v1.0.0 is published: replace the three `TODO(v1.0.0)` download links in `landing-page/index.html` with the store URL.

## Microsoft Edge Add-ons

Edge may not offer Chrome's built-in AI, so the Edge listing doesn't promise AI features (TabPlex falls back to grouping by site). Reuse the Chrome text with "Chrome" changed to "the browser", and drop the on-device AI lines.

### Single purpose description

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
