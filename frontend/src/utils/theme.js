import useThemeStore from '../store/useThemeStore';

/**
 * Theme helpers for code that cannot use Tailwind classes directly
 * (Recharts props, SVG attributes, inline styles, third-party widgets).
 *
 * Prefer CSS variables (`var(--fg-muted)`) over JS-resolved hex values: they
 * switch automatically with the theme and need no re-render.
 */

/** @returns {boolean} true when the dark theme is active. */
export const useTheme = () => useThemeStore((s) => s.resolved === 'dark');

/** @returns {'light' | 'dark'} the active theme — e.g. for ReactFlow `colorMode`. */
export const useResolvedTheme = () => useThemeStore((s) => s.resolved);

/** CSS variable reference for a theme token, e.g. themeVar('fg-muted') -> 'var(--fg-muted)'. */
export const themeVar = (token) => `var(--${token})`;

/**
 * Read the computed value of a token (hex/rgb string). Only needed for APIs that
 * cannot take CSS variables, e.g. <canvas> fillStyle. Call it during draw, not at
 * module load, so it reflects the current theme.
 */
export const readThemeColor = (token) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();

/** Shared Recharts styling — spread these into chart components. */
export const chartTheme = {
  grid: themeVar('chart-grid'),
  axis: themeVar('chart-axis'),
  tooltip: {
    contentStyle: {
      backgroundColor: themeVar('surface'),
      borderColor: themeVar('line-strong'),
      borderRadius: '0.5rem',
      color: themeVar('fg'),
    },
    itemStyle: { color: themeVar('fg') },
    labelStyle: { color: themeVar('fg-muted'), marginBottom: '4px' },
    cursor: { fill: themeVar('surface-3'), opacity: 0.4 },
  },
};
