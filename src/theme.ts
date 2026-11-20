export type Theme = 'light' | 'dark';

const storageKey = 'flowdeck.theme';

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function initializeTheme() {
  try {
    applyTheme(localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light');
  } catch {
    applyTheme('light');
  }
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // The toggle remains usable when browser storage is unavailable.
  }
}
