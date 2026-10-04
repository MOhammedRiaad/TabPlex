---
name: add-view
description: Add a new top-level page/view (route + nav entry) to the TabPlex UI. Use when asked to add a screen, page, tab or section to the app navigation.
---

# Add a view

Example: view `reminders`, path `/reminders`, component `RemindersView`.

The view list is hard-coded in several places — update **all** of them or navigation will silently fall back to Today.

1. **Component** — `src/features/reminders/RemindersView.tsx` + `RemindersView.css` (co-located), sub-components in `components/`. Read data with `useBoardStore(state => state.x)` selectors.
2. **ViewType** — add `'reminders'` to the union in `src/features/ui/store/uiStore.ts`.
3. **Routes** — `src/routes.tsx`:
    - `ROUTES.REMINDERS: '/reminders'`
    - `ROUTE_METADATA[ROUTES.REMINDERS] = { title, description }`
    - a case in `viewToPath` and in `pathToView`
    - `<Route path={ROUTES.REMINDERS} element={<RemindersView />} />`
4. **Nav** — add `{ view: 'reminders', label: 'Reminders', icon: '…' }` to the items in `src/features/navigation/components/AppNav.tsx`.
5. **Command palette** — add a `nav-reminders` command in `src/features/ui/components/CommandPalette.tsx` (and widen its local view union).
6. **Shortcut (optional)** — `src/hooks/useKeyboardShortcuts.ts`; avoid clashing with `Ctrl+Shift+T` (manifest `_execute_action`) and existing ones listed in README "Keyboard Shortcuts".
7. **Styling** — reuse CSS variables from `src/index.css` so light/dark themes (`useTheme`) work.
8. Update the README feature list/shortcuts if user-facing, then run the `verify` skill.
