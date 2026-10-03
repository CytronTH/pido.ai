import { create } from 'zustand';

/**
 * Theme store — the single source of truth for light/dark mode.
 *
 * - `mode`     : user preference ('light' | 'dark' | 'system'), persisted in localStorage.
 * - `resolved` : the theme actually applied ('light' | 'dark').
 *
 * The `.dark` class on <html> is the only switch the CSS cares about; all colors
 * come from semantic tokens in index.css. An inline script in index.html applies
 * the class before React mounts to avoid a flash of the wrong theme — keep the
 * logic there in sync with `readMode` / `resolveMode` below.
 */

export const THEME_STORAGE_KEY = 'theme';
export const THEME_MODES = ['light', 'dark', 'system'];
const DEFAULT_MODE = 'dark';

const media = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

const readMode = () => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(stored) ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

const resolveMode = (mode) => {
  if (mode === 'system') return media?.matches ? 'dark' : 'light';
  return mode;
};

const applyToDocument = (resolved) => {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
};

const initialMode = readMode();
const initialResolved = resolveMode(initialMode);
applyToDocument(initialResolved);

const useThemeStore = create((set, get) => ({
  mode: initialMode,
  resolved: initialResolved,

  setMode: (mode) => {
    if (!THEME_MODES.includes(mode)) return;
    const resolved = resolveMode(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode / quota) — theme still applies for this session.
    }
    applyToDocument(resolved);
    set({ mode, resolved });
  },

  /** Flip between light and dark (explicit choice, leaves 'system'). */
  toggle: () => get().setMode(get().resolved === 'dark' ? 'light' : 'dark'),

  /** Cycle light -> dark -> system -> light (used by the header button). */
  cycle: () => {
    const order = THEME_MODES;
    get().setMode(order[(order.indexOf(get().mode) + 1) % order.length]);
  },
}));

// Follow OS changes while in 'system' mode.
media?.addEventListener?.('change', () => {
  const { mode } = useThemeStore.getState();
  if (mode !== 'system') return;
  const resolved = resolveMode(mode);
  applyToDocument(resolved);
  useThemeStore.setState({ resolved });
});

// Keep multiple tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) useThemeStore.getState().setMode(readMode());
  });
}

export default useThemeStore;
