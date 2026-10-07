# Changelog

## [1.1.0](https://github.com/MOhammedRiaad/TabPlex/compare/v1.0.1...v1.1.0) (2026-10-05)

### ✨ Features

* **tasks:** add addTaskAndSync and explicit tab attach ([3d3c1f8](https://github.com/MOhammedRiaad/TabPlex/commit/3d3c1f8c6b7a18a4e5177ca0a5f777b00cbf8684))
* **tasks:** add new task from tabs dialog and entry points ([3c8a946](https://github.com/MOhammedRiaad/TabPlex/commit/3c8a946e8ac0ffb0e480d93d1c882f03d7bb2121))
* **tasks:** create & park from the new task from tabs dialog ([356b84b](https://github.com/MOhammedRiaad/TabPlex/commit/356b84b88f951ec5f03950466bd5f5190d0e0d0b)), closes [#13](https://github.com/MOhammedRiaad/TabPlex/issues/13) [#25](https://github.com/MOhammedRiaad/TabPlex/issues/25)
* **tasks:** draft tasks from tabs with on-device AI ([08f0143](https://github.com/MOhammedRiaad/TabPlex/commit/08f01437ebe1a80360111972922ebd6611795d6f))
* **tasks:** one task form for creating and editing ([f63df92](https://github.com/MOhammedRiaad/TabPlex/commit/f63df92003b69be3bb67cda4350daeb54a4cf0b0)), closes [#24](https://github.com/MOhammedRiaad/TabPlex/issues/24)
* **tasks:** pin tasks and notes to the top ([e21999e](https://github.com/MOhammedRiaad/TabPlex/commit/e21999e9ab3c36df585400f247a4a2b82ed7b519)), closes [#14](https://github.com/MOhammedRiaad/TabPlex/issues/14)

### 🐛 Bug Fixes

* **ai:** free the summarizer after parking and drop the name length cap ([b6d82cb](https://github.com/MOhammedRiaad/TabPlex/commit/b6d82cb117fcb8141654f3f48f23823ec758ab5f))
* **tasks:** keep on-device park summaries to two plain sentences ([6ddbc3a](https://github.com/MOhammedRiaad/TabPlex/commit/6ddbc3a5abd56a05faad4a7c6f83909f410aa955))
* **tasks:** show task cards in windows narrower than 1024 px ([733de25](https://github.com/MOhammedRiaad/TabPlex/commit/733de2552c9ead016a01c6db45ee0a010c7ed9e6))

## [1.0.1](https://github.com/MOhammedRiaad/TabPlex/compare/v1.0.0...v1.0.1) (2026-10-04)

### 🐛 Bug Fixes

* **landing:** stop squeezing the screenshots and make them sharp ([7bb137c](https://github.com/MOhammedRiaad/TabPlex/commit/7bb137cbc7af6ea36410fad5ac18050fb22874d4))

## 1.0.0 (2026-10-04)

### ✨ Features

* add `TaskCard` and `TabCard` components with their respective styles. ([4f4c5ab](https://github.com/MOhammedRiaad/TabPlex/commit/4f4c5ab029b1ce18723be4b4dbf86b12a3574e23))
* add board view with task and tab management components and state ([d6ccddf](https://github.com/MOhammedRiaad/TabPlex/commit/d6ccddfe822d9f884d38808113a98b9ddec2a37e))
* add bookmark filtering functionality with UI controls and persistent configuration ([e2414a0](https://github.com/MOhammedRiaad/TabPlex/commit/e2414a00ddd6e9bf7a3c77485489283037dd9b30))
* add bookmarks ([cbbe68f](https://github.com/MOhammedRiaad/TabPlex/commit/cbbe68f251909b532f5c3be9376a83f3419f7d7f))
* Add Command Palette component and types, ([a7ccc75](https://github.com/MOhammedRiaad/TabPlex/commit/a7ccc75d1222657a6322a8c06cfa12a41f8a9c5b))
* Add interactive canvas drawing application with types, components, store, and utilities, update  readme ([d92185c](https://github.com/MOhammedRiaad/TabPlex/commit/d92185cbeb20b210424f37c0b47d17f9eddd7f7d))
* add on-device AI summaries for parked tasks using Chrome's Summarizer API ([49b15d6](https://github.com/MOhammedRiaad/TabPlex/commit/49b15d63670392e43167de9d713890e88e396410))
* add onboarding screen ([cdcca46](https://github.com/MOhammedRiaad/TabPlex/commit/cdcca4614f247cf509bc6456d736b3988b934394))
* add Pomodoro Timer component with styling and functionality ([6028f89](https://github.com/MOhammedRiaad/TabPlex/commit/6028f8916af6e16466a4b0e7b7ff00bcaa73815d))
* add Pomodoro timer, Today and Analytics views, app navigation, search, command palette, and data export/import. ([d0b708b](https://github.com/MOhammedRiaad/TabPlex/commit/d0b708b2a299c20c9fa177f50af179b48c8bfdcf))
* Add Rich Markdown Editor and Pomodoro Timer ([ad584f4](https://github.com/MOhammedRiaad/TabPlex/commit/ad584f43255c06b176da6d3c793c5e830769b47d))
* add semantic release setup with CI/CD workflows ([0370d4b](https://github.com/MOhammedRiaad/TabPlex/commit/0370d4bfaffb2dc56702384e4f128bf3a77b2876))
* add TaskCard component for displaying and managing task details, checklist, and status. ([3d27156](https://github.com/MOhammedRiaad/TabPlex/commit/3d27156f1c8335b101496adcb4d0cbae167f91c7))
* add TaskCard component, types, storage utilities, and AddTaskForm styling. ([3d4e146](https://github.com/MOhammedRiaad/TabPlex/commit/3d4e146926837cd6c9a69c64ca1a2afb3c9184dc))
* add test factories and setup for unit testing ([1f2b4a4](https://github.com/MOhammedRiaad/TabPlex/commit/1f2b4a44ce2471791be513f2134bb5ec8146ef8e))
* add text resize and color , expand project documentation ([7861fe8](https://github.com/MOhammedRiaad/TabPlex/commit/7861fe8ef9d0280d5a98ad371d16f2387e435029))
* **ai:** add Prompt API wrapper with JSON validation and context fitting ([bcac181](https://github.com/MOhammedRiaad/TabPlex/commit/bcac18120b7e9c150575cf914aeba493bc8b88fd))
* **board:** add deletion support for boards, folders, tabs, tasks, notes, and sessions ([2cdce58](https://github.com/MOhammedRiaad/TabPlex/commit/2cdce5887c5ec251987df48519b1e1a11a3ef9d9))
* Enhance board folder UX and Bookmark view parity ([9effdb2](https://github.com/MOhammedRiaad/TabPlex/commit/9effdb28d0a1a297a5fb65393cec02b5149595b4))
* enhance bookmarks UI with modern design, add toast notifications, and improve accessibility ([2da9b1a](https://github.com/MOhammedRiaad/TabPlex/commit/2da9b1a8173747436b4e54111864cb22caef43f0))
* enhance session card ux&ui ([424361a](https://github.com/MOhammedRiaad/TabPlex/commit/424361ae4de251a7505fde6e28835d5133286b4b))
* enhance task data model and store updates ([6657869](https://github.com/MOhammedRiaad/TabPlex/commit/6657869f4924b3f4d375e16b6cd0cdd781d3345a))
* enhance UX with improved shortcuts and toast notifications ([21c6424](https://github.com/MOhammedRiaad/TabPlex/commit/21c6424d036ebc74bee816fc8483e1c9e3923677))
* **export-import:** implement data export and import functionality with keyboard shortcuts ([34f19d7](https://github.com/MOhammedRiaad/TabPlex/commit/34f19d7cb1b3a7edaf4f8bd5b987563e06ec9e3f))
* fix task design ([e9ce921](https://github.com/MOhammedRiaad/TabPlex/commit/e9ce921cb48effb6e527e41c14a9a38c08247cec))
* **folder:** add folder deletion with tab move or delete options ([382d633](https://github.com/MOhammedRiaad/TabPlex/commit/382d63383b859084d203a9aff5ecc624ce44541f))
* implement a comprehensive interactive canvas feature with drawing tools, UI ([5625ced](https://github.com/MOhammedRiaad/TabPlex/commit/5625ceda23c15e3f0e120f1aaba77abc637c594a))
* implement Park & Resume functionality with context management ([464e9b9](https://github.com/MOhammedRiaad/TabPlex/commit/464e9b9ad6943ee844100bcfe0115ac1335a3f58))
* implement sorting functionality for bookmarks with UI controls and persistent configuration ([f3447d8](https://github.com/MOhammedRiaad/TabPlex/commit/f3447d813387ff1b23b53070a1b2e8aa74b4e960))
* integrate react-router for improved navigation and routing ([6befaf2](https://github.com/MOhammedRiaad/TabPlex/commit/6befaf275881e153bb23d447746875ab43ccdf99))
* introduce main application component `App.tsx` with view management,  view preference will now persist across page reloads! ([f5d5f2f](https://github.com/MOhammedRiaad/TabPlex/commit/f5d5f2f209d501a74eadbfdbfb0e989f10745071))
* Introduce Pomodoro timer with UI, settings, and task integration using Zustand. ([b29268e](https://github.com/MOhammedRiaad/TabPlex/commit/b29268e91431d04024e09a2475b05a3fc1e08117))
* merge History and board , add tldrow board ([27b2922](https://github.com/MOhammedRiaad/TabPlex/commit/27b29220a9e8028c357316b2db535b31d2b82bf9))
* **organize:** add site and AI grouping logic ([7f69547](https://github.com/MOhammedRiaad/TabPlex/commit/7f695473668ca3a4808c8c0e70ee3a9a448253e9))
* **organize:** add the organize tabs dialog and entry points ([2124c3c](https://github.com/MOhammedRiaad/TabPlex/commit/2124c3cc4da9e857e3a6900bd7f967de75d61382))
* **organize:** create and undo tab groups in the background ([7b0e63d](https://github.com/MOhammedRiaad/TabPlex/commit/7b0e63dc21e8acf7fdb21c9219bf89db73a97d82))
* Phase 4 comprehensive improvements - Add dark mode with system theme detection - Add global search across tabs, tasks, notes, folders - Add command palette (Ctrl+K) for quick actions - Add analytics dashboard with productivity insights - Convert all CSS to use CSS variables for theming - Add unique ID generation with crypto.randomUUID() - Update types with tags, pinned, analytics interfaces - Add accessibility improvements (ARIA labels) - Improve responsive design and transitions - Update README with comprehensive documentation ([bda1c9e](https://github.com/MOhammedRiaad/TabPlex/commit/bda1c9eaf245d929be4754346d50edf929278082))
* refactor core browser extension architecture with state management, background services, ([900f09f](https://github.com/MOhammedRiaad/TabPlex/commit/900f09f8d51e147e8ac2e83a2e08474d562b2cda))
* repranding and fixing bugs ([d0a9446](https://github.com/MOhammedRiaad/TabPlex/commit/d0a9446df8da0c80006afef25fc45d7752a88a5f))
* revamp bookmarks UI with modern design elements ([283493e](https://github.com/MOhammedRiaad/TabPlex/commit/283493e56a621897f4d066242156025298a960b0))
* **session:** add session and history management with UI navigation ([7c5f40c](https://github.com/MOhammedRiaad/TabPlex/commit/7c5f40ce2e163027b4d2c327f4cccbc43dbc5e3e))
* **sessions:** add session restore functionality with tab management ([a022ac5](https://github.com/MOhammedRiaad/TabPlex/commit/a022ac549da9214e449c4c95d2bcdf939443f609))
* **settings:** add an On-device AI section ([25b0391](https://github.com/MOhammedRiaad/TabPlex/commit/25b0391015a6590e183d872b54afe5e081be446f))
* **settings:** set the greeting name in settings and drop identity permissions ([15711a9](https://github.com/MOhammedRiaad/TabPlex/commit/15711a915da7d09d5eaf0411e93bb7c1389865a3))
* **storage:** add create and storage sync for boards, folders, tabs, tasks, notes, and sessions ([2bd5df1](https://github.com/MOhammedRiaad/TabPlex/commit/2bd5df1e54df244550d03a1d2d57b48117e8af92))
* **today-view:** add toggle to switch between today and all tasks ([4964306](https://github.com/MOhammedRiaad/TabPlex/commit/4964306f7274868793522a7a0ac30ca3a90b00b3))
* **ui:** add 'Today' view tab and note management components ([37c8234](https://github.com/MOhammedRiaad/TabPlex/commit/37c8234c274ebf4326a79233919b71f0bf3cbc07))
* update onboarding screen ([17a73b4](https://github.com/MOhammedRiaad/TabPlex/commit/17a73b46e702a87d2a6ca36eacb672a6480d5634))

### 🐛 Bug Fixes

* **analytics:** strip only a leading www. from domain names ([516398c](https://github.com/MOhammedRiaad/TabPlex/commit/516398ca5756a69ad6a431fcc8faeb750861ccff))
* **background, BoardView:** enhance board management and default board creation logic ([120a459](https://github.com/MOhammedRiaad/TabPlex/commit/120a4595dcd1bcc5a5b1cf4ec03119e5fe29565e))
* **background:** enhance tab movement response handling and improve drag styles ([59c3212](https://github.com/MOhammedRiaad/TabPlex/commit/59c3212152900fe033b03d90882dc52ae8613162))
* **background:** improve message response handling and prevent duplicate item additions ([de9fa31](https://github.com/MOhammedRiaad/TabPlex/commit/de9fa3169a81a11cadcc257b651295d88b6c68ed))
* **background:** suppress errors from missing message listeners ([36cb113](https://github.com/MOhammedRiaad/TabPlex/commit/36cb113b21caafca83ae29153e4b1cb1379dafca))
* **boards:** don't add browsing tabs to Boards on tab updates ([5f16bb7](https://github.com/MOhammedRiaad/TabPlex/commit/5f16bb7ef9bac3021dca2de6c3e2d13dd410f47d)), closes [#21](https://github.com/MOhammedRiaad/TabPlex/issues/21)
* **boards:** sync folder, tab and board edits to the background and other tabs ([b679e17](https://github.com/MOhammedRiaad/TabPlex/commit/b679e17cc48619aa137c397d0b48e4974289d9a9))
* **canvas:** stop hiding the tldraw watermark ([da4e992](https://github.com/MOhammedRiaad/TabPlex/commit/da4e99233b42b76969a7619f0aa5b412e2b36247))
* **data:** restore backups in the background too and keep history in exports ([ff197aa](https://github.com/MOhammedRiaad/TabPlex/commit/ff197aa09d619488beb88413a8283235b7dc60ac))
* **html:** update favicon to use png format ([71a5cfa](https://github.com/MOhammedRiaad/TabPlex/commit/71a5cfa558a0914f3573b9dbbfa9d37a2d634395))
* **notes:** sync note edits and keep the title in step with the content ([6384a24](https://github.com/MOhammedRiaad/TabPlex/commit/6384a244bc658982a36ffb0eecbf3087e9cbf612))
* **notifications:** use window.setInterval for correct type inference ([69f5139](https://github.com/MOhammedRiaad/TabPlex/commit/69f51394003767a6e9830b4b479442a9e315c6ea))
* remove the unused <all_urls> host permission ([23f1829](https://github.com/MOhammedRiaad/TabPlex/commit/23f182995a2f6c5dd9e57d9fef89d218647330fe))
* **search:** open tasks and notes in their own views and match note titles ([27d036f](https://github.com/MOhammedRiaad/TabPlex/commit/27d036f9e15b0a47b00bc00b36f0b88d8b46f669))
* **today:** keep the side column on screen at laptop widths ([4ed1fc5](https://github.com/MOhammedRiaad/TabPlex/commit/4ed1fc5eef2010c062321de3aa16babeee1670fb))

### ⚡ Performance

* lazy-load views to cut the startup bundle by 84% ([0235cc8](https://github.com/MOhammedRiaad/TabPlex/commit/0235cc8f41fa73536a3ed845dfc1ed4af20fbbdb))

### ♻️ Refactoring

* **ai:** share tab description and window helpers with the summarizer ([83f1f53](https://github.com/MOhammedRiaad/TabPlex/commit/83f1f5388e0b97d78172409ed7f85533c07e5ccc))
* **background:** modularize background service and update build entry point ([0b7f152](https://github.com/MOhammedRiaad/TabPlex/commit/0b7f152c3f8b9a045c62ec378ce5f826e162fe59))
* board ui ([ee79b56](https://github.com/MOhammedRiaad/TabPlex/commit/ee79b564eb83432dc4857eaf8f39f6272d03d3b3))
* extract shared utilities, consolidate background types, and fix storage sync gaps ([195c184](https://github.com/MOhammedRiaad/TabPlex/commit/195c184dee460d0ffb82845ff38700beb06ee123))
* split session card to separate component ([984b2be](https://github.com/MOhammedRiaad/TabPlex/commit/984b2be6b684d1e5325d9077a541b9516f94b6eb))
