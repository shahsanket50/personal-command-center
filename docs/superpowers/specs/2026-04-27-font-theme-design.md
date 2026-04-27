# Font Size + Theme System Design

## Overview

Increase Mission Control's default font size from the current 9–11px to a "comfortable" 11–13px scale, and introduce a 5-theme named palette system selectable from Settings. Theme is global, persisted to localStorage, and propagated via React context.

---

## Font Size

**Decision:** B — Comfortable (+2px across the board).

**Mechanism:** A single CSS custom property `--mc-font-base` set to `11px` on `:root`. All hardcoded `font-size` values in MC components are replaced with `calc(var(--mc-font-base) + Npx)` offsets or directly updated values relative to this base. This keeps scaling consistent — one variable to change if the size ever needs revisiting.

**Affected files:** All MC pages, panels, and components that have inline `fontSize` style values. Specifically:
- `client/src/mission-control/panels/Schedule.jsx`
- `client/src/mission-control/panels/TaskList.jsx`
- `client/src/mission-control/panels/Brief.jsx`
- `client/src/mission-control/panels/TriageStream.jsx`
- `client/src/mission-control/panels/PeoplePanel.jsx`
- `client/src/mission-control/components/Panel.jsx`
- `client/src/mission-control/components/CommandPalette.jsx`
- `client/src/mission-control/components/HelpOverlay.jsx`
- `client/src/mission-control/pivots/TodayView.jsx`
- `client/src/mission-control/pivots/TriageView.jsx`
- `client/src/mission-control/pivots/PeopleView.jsx`
- `client/src/mission-control/pages/*.jsx` (all 8 pages)
- `client/src/App.jsx` (top bar, palette trigger)

**Not affected:** `client/src/modules/` (deprecated, Tailwind-based, not touched).

---

## Theme System

### Themes

Five named themes, each covering the full T token set plus an `accent` color:

| Name    | Background | Accent      | Character              |
|---------|------------|-------------|------------------------|
| dark    | #050709    | #86efac     | Current default — deep black, green |
| light   | #f8fafc    | #16a34a     | Bright white, slate text, green accent |
| paper   | #faf7f2    | #c2610a     | Warm cream, brown text, burnt orange |
| ocean   | #020d1a    | #38bdf8     | Deep navy, cyan accent |
| forest  | #080f0a    | #4ade80     | Deep green background, lime accent |

Each theme object contains the same keys as the current `T` export:
```
bg0, bg1, bg2, bg3, bg4
border, borderHi
text, textHi, textDim, textFaint, textGhost
warn, danger, info
accent  ← NEW: previously hardcoded as '#86efac' in App.jsx
```

### Data Shape

`client/src/mission-control/theme.js` gains:

```js
export const THEMES = {
  dark:   { bg0: '#050709', ..., accent: '#86efac' },
  light:  { bg0: '#f8fafc', ..., accent: '#16a34a' },
  paper:  { bg0: '#faf7f2', ..., accent: '#c2610a' },
  ocean:  { bg0: '#020d1a', ..., accent: '#38bdf8' },
  forest: { bg0: '#080f0a', ..., accent: '#4ade80' },
};

export const DEFAULT_THEME = 'dark';
export const THEME_NAMES = Object.keys(THEMES);
```

The existing `export const T = { ... }` is removed. Consumers switch to `useTheme()`.

### React Context

New file: `client/src/mission-control/ThemeContext.jsx`

```jsx
export const ThemeContext = createContext(THEMES[DEFAULT_THEME]);
export function useTheme() { return useContext(ThemeContext); }
```

`App.jsx` reads `localStorage.getItem('mc-theme') ?? DEFAULT_THEME` on mount, holds it in state, wraps the app in `<ThemeContext.Provider value={THEMES[themeName]}>`. Theme changes write to localStorage and update state — context re-renders all consumers.

### Accent prop removal

Currently `ACCENT = '#86efac'` is hardcoded in `App.jsx` and passed as `accent={ACCENT}` to every page and panel. After this change, `accent` comes from `T.accent` via `useTheme()`. The `accent` prop on pages and panels is removed — components read it from context directly.

### Settings page picker

`SettingsPage.jsx` gets a "Appearance" section with:
- A row of 5 circular swatches, one per theme, colored with each theme's `accent` on its `bg0` background
- Active theme has a white ring border
- Clicking a swatch calls `setTheme(name)` which updates localStorage + context state
- Label below swatches shows the active theme name

No server involvement — purely client-side localStorage.

---

## What Changes in Each MC Component

Every MC component that currently does `import { T } from '../theme.js'` switches to:

```js
import { useTheme } from '../ThemeContext.jsx';
// inside component:
const T = useTheme();
```

The `T.` usage throughout stays identical — only the import and declaration change. This is a mechanical find-and-replace across ~20 files.

Components that receive `accent` as a prop stop receiving it and instead read `T.accent` from the hook.

---

## Out of Scope

- `client/src/modules/` — deprecated Tailwind-based modules, not touched
- `client/src/themes/index.js` — used only by modules, not touched
- Server-side — no server changes required
- Font size user control — size is fixed at comfortable; no runtime font size picker

---

## Success Criteria

1. All MC pages render at the comfortable font scale (~11–13px body text)
2. Switching theme in Settings updates the entire app instantly with no reload
3. Selected theme persists across page refreshes (localStorage)
4. Default theme on first load is `dark` (unchanged from current)
5. `accent` prop is fully removed from all MC page/panel call sites
6. No regressions in keyboard navigation, panel layout, or SSE pages
