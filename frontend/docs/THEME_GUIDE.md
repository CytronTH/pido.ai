# Theme Guide (Light / Dark)

All UI colors come from **semantic tokens** defined once in
[`src/index.css`](../src/index.css). Components never decide "what color is this in dark
mode?" — they say *what the thing is* (a surface, a border, muted text) and the token
resolves to the right color for the active theme.

## How it works

```
index.html inline script ──► sets .dark on <html> before first paint
useThemeStore (Zustand)   ──► mode: light | dark | system, persists to localStorage('theme')
index.css  :root / .dark  ──► raw values  (--surface: #fff / #0f172a ...)
           @theme inline  ──► Tailwind utilities (bg-surface, text-fg-muted, border-line ...)
```

- `dark:` variant is bound to the `.dark` class (`@custom-variant dark`), **not** the OS setting.
- `system` mode follows `prefers-color-scheme` live; tabs stay in sync via the `storage` event.

## Token cheat-sheet

| Purpose | Utility | Light | Dark |
|---|---|---|---|
| App background | `bg-canvas` | `#f1f5f9` | `#020617` |
| Card / panel / sidebar / modal | `bg-surface` | `#ffffff` | `#0f172a` |
| Input, nested card, hover row | `bg-surface-2` | `#f1f5f9` | `#1e293b` |
| Hover on surface-2, chips, active | `bg-surface-3` | `#e2e8f0` | `#334155` |
| Toggle track, strong fill | `bg-surface-4` | `#cbd5e1` | `#475569` |
| Default border / divider | `border-line` | `#e2e8f0` | `#1e293b` |
| Emphasised border (inputs, buttons) | `border-line-strong` | `#cbd5e1` | `#334155` |
| Heading / primary text | `text-fg` | `#0f172a` | `#f8fafc` |
| Body text | `text-fg-secondary` | `#334155` | `#cbd5e1` |
| Labels, secondary info | `text-fg-muted` | `#475569` | `#94a3b8` |
| Hints, captions | `text-fg-subtle` | `#64748b` | `#64748b` |
| Disabled, placeholders | `text-fg-faint` | `#94a3b8` | `#475569` |
| Text on an inverted (`bg-fg`) surface | `text-fg-inverse` | `#f8fafc` | `#0f172a` |
| Brand button | `bg-primary hover:bg-primary-hover text-on-primary` | blue-600 | blue-500 |
| Status | `text-success` `text-warning` `text-danger` `text-info` | | |
| Inset widget well | `shadow-well`, `shadow-well-deep` | soft | deep |

All tokens accept opacity modifiers: `bg-surface-2/50`, `border-line/60`, `hover:bg-fg/5`.

## Rules

1. **Neutrals = tokens only.** Don't use `gray-*`, `slate-*`, `zinc-*`, `white`, `black` for UI chrome.
2. **No `dark:` pairs for neutrals.** `bg-white dark:bg-gray-900` → `bg-surface`.
3. **Accent colors** (`blue`, `emerald`, `purple`, ...) are not tokenised. Conventions:
   - Solid accent fill: `bg-blue-600 text-white` — same in both themes.
   - Accent text on a surface: `text-blue-600 dark:text-blue-400` (light shades like
     -300/-400 are unreadable on white; use -600, or -700 for yellow/amber/lime/orange).
   - Accent tint / badge: `bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300`,
     or the opacity form `bg-blue-500/10` which works in both themes without `dark:`.
4. **Literal white/black only when the color is physical**, not themed: video letterbox
   (`bg-black`), overlays drawn on top of camera frames, switch knobs (`bg-white`),
   the traffic-light housing.
5. **Non-Tailwind contexts** (Recharts, SVG attributes, inline styles, ReactFlow):
   use CSS variables — `stroke="var(--chart-grid)"`, `style={{ color: 'var(--fg-muted)' }}`.
   Recharts: spread `chartTheme` from `src/utils/theme.js`.
   SVG elements can also take classes: `className="stroke-surface-3 fill-fg-muted"`.
6. **`<canvas>`** can't read CSS vars directly — call `readThemeColor('fg')` at draw time.
7. **Reading the theme in JS** (rarely needed): `useTheme()` → `isDark`,
   `useResolvedTheme()` → `'light' | 'dark'` (e.g. ReactFlow `colorMode`).
   Never read `localStorage` or `document.documentElement.classList` directly.

## Adding a new token

1. Add the raw value to **both** `:root` and `.dark` in `index.css`.
2. Expose it in `@theme inline` as `--color-<name>: var(--<name>);`.
3. Add a row to the table above.

## Common conversions

| Old | New |
|---|---|
| `bg-gray-50 dark:bg-gray-950` | `bg-canvas` |
| `bg-white dark:bg-gray-900` | `bg-surface` |
| `bg-gray-100 dark:bg-gray-800` | `bg-surface-2` |
| `hover:bg-gray-200 dark:hover:bg-gray-700` | `hover:bg-surface-3` |
| `border-gray-200 dark:border-gray-800` | `border-line` |
| `border-gray-300 dark:border-gray-700` | `border-line-strong` |
| `text-gray-900 dark:text-white` | `text-fg` |
| `text-gray-700 dark:text-gray-300` | `text-fg-secondary` |
| `text-gray-600 dark:text-gray-400` | `text-fg-muted` |
| `text-gray-500` | `text-fg-subtle` |
