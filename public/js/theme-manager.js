const STORAGE_KEY = 'mwt-theme';

const DARK_TERMINAL_THEME = {
  background: '#0a0c12',
  foreground: '#e4e7f2',
  cursor: '#6c8cff',
  cursorAccent: '#0a0c12',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  black: '#5c657c',
  red: '#e05560',
  green: '#7ec699',
  yellow: '#e6c07b',
  blue: '#6c8cff',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#e4e7f2',
  brightBlack: '#9aa4ba',
  brightRed: '#ff6b76',
  brightGreen: '#98e6b3',
  brightYellow: '#ffd68a',
  brightBlue: '#8aa4ff',
  brightMagenta: '#e0a0ff',
  brightCyan: '#7fd4e0',
  brightWhite: '#ffffff',
};

const LIGHT_TERMINAL_THEME = {
  background: '#ffffff',
  foreground: '#1a1d2e',
  cursor: '#4a6cf7',
  cursorAccent: '#ffffff',
  selectionBackground: '#b4d5fe',
  selectionForeground: '#1a1d2e',
  black: '#1a1d2e',
  red: '#d43d4e',
  green: '#2a9d4e',
  yellow: '#b8860b',
  blue: '#4a6cf7',
  magenta: '#a626a4',
  cyan: '#0e7490',
  white: '#d0d5e0',
  brightBlack: '#9098b0',
  brightRed: '#e55966',
  brightGreen: '#3bb563',
  brightYellow: '#d49e1a',
  brightBlue: '#6b8af9',
  brightMagenta: '#c45bcf',
  brightCyan: '#1a9bb5',
  brightWhite: '#f0f2f5',
};

export class ThemeManager {
  constructor() {
    this._listeners = [];
    this._mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Listen for OS theme changes
    this._mediaQuery.addEventListener('change', () => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        this._apply(this._systemTheme());
      }
    });

    // Apply initial theme
    const saved = localStorage.getItem(STORAGE_KEY);
    this._apply(saved || this._systemTheme());
  }

  get current() {
    return document.documentElement.dataset.theme || 'dark';
  }

  toggle() {
    const next = this.current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    this._apply(next);
  }

  getTerminalTheme() {
    return this.current === 'dark' ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME;
  }

  onChange(callback) {
    this._listeners.push(callback);
  }

  _systemTheme() {
    return this._mediaQuery.matches ? 'dark' : 'light';
  }

  _apply(theme) {
    document.documentElement.dataset.theme = theme;
    for (const cb of this._listeners) {
      cb(theme);
    }
  }
}
