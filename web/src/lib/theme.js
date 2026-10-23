const KEY = 'vibe:theme';

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f6f5fb' : '#07080f');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* almacenamiento no disponible: el tema se mantiene solo en esta sesión */
  }
}
