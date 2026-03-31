const LANG_KEY = 'mwt-lang';

// Display labels shown in the language menu
export const langLabels = {
  en: 'English',
  zh: '中文',
};

const messages = {
  en: {
    newTerminal: 'New Terminal',
    columns: 'Columns',
    rows: 'Rows',
    grid: 'Grid',
    tabs: 'Tabs',
    keyboardShortcuts: 'Keyboard Shortcuts',
    toggleFullscreen: 'Toggle fullscreen',
    toggleTheme: 'Toggle theme',
    settings: 'Settings',

    // Settings modal
    settingsTitle: 'Settings',
    settingsFont: 'Font',
    settingsFontSize: 'Size',
    settingsFontFamily: 'Family',
    settingsFontFamilyPlaceholder: 'e.g. Menlo, monospace',

    // Shortcuts modal
    shortcutsTitle: 'Keyboard Shortcuts',
    shortcutsGroupTerminals: 'Terminals',
    shortcutsNewTerminal: 'New Terminal',
    shortcutsCloseTerminal: 'Close Terminal',
    shortcutsMaximizeTerminal: 'Maximize / Restore Terminal',
    shortcutsGroupNavigation: 'Navigation',
    shortcutsNextTerminal: 'Next Terminal',
    shortcutsPrevTerminal: 'Previous Terminal',
    shortcutsSwitchTerminal: 'Switch to Terminal 1–9',
    shortcutsGroupWindow: 'Window',
    shortcutsToggleFullscreen: 'Toggle Fullscreen',

    // Terminal pane
    terminalTitle: (num) => `Terminal ${num}`,
    maximizeTerminal: (cmdKey) => `Maximize terminal (${cmdKey}+Shift+M)`,
    closeTerminalBtn: (cmdKey) => `Close terminal (${cmdKey}+Shift+\`)`,

    // Button tooltips with shortcut
    newTerminalTooltip: (cmdKey) => `New Terminal (${cmdKey}+\`)`,
    fullscreenTooltip: 'Toggle fullscreen (F11)',
    shortcutsTooltip: 'Keyboard Shortcuts',

    // Notifications
    terminalHasNewOutput: (title) => `${title} has new output`,
    notificationBody: 'Click to switch to this terminal',

    // Empty state
    emptyStateShortcuts: 'Shortcuts',
    emptyStateLayouts: 'Layouts',
    emptyStateLayoutList: 'Columns · Rows · Grid · Tabs',

    // Status bar
    statusTerminals: (n) => n === 1 ? '1 terminal' : `${n} terminals`,

    // Overlays
    alreadyConnected: 'mwt is already open in another tab.',
    serverDisconnected: 'Server disconnected. Please restart the server and refresh.',
  },
  zh: {
    newTerminal: '新建终端',
    columns: '并排',
    rows: '横排',
    grid: '网格',
    tabs: '标签页',
    keyboardShortcuts: '键盘快捷键',
    toggleFullscreen: '切换全屏',
    toggleTheme: '切换主题',
    settings: '设置',

    // Settings modal
    settingsTitle: '设置',
    settingsFont: '字体',
    settingsFontSize: '大小',
    settingsFontFamily: '字体族',
    settingsFontFamilyPlaceholder: '例如 Menlo, monospace',

    // Shortcuts modal
    shortcutsTitle: '键盘快捷键',
    shortcutsGroupTerminals: '终端',
    shortcutsNewTerminal: '新建终端',
    shortcutsCloseTerminal: '关闭终端',
    shortcutsMaximizeTerminal: '最大化 / 还原终端',
    shortcutsGroupNavigation: '导航',
    shortcutsNextTerminal: '下一个终端',
    shortcutsPrevTerminal: '上一个终端',
    shortcutsSwitchTerminal: '切换到终端 1–9',
    shortcutsGroupWindow: '窗口',
    shortcutsToggleFullscreen: '切换全屏',

    // Terminal pane
    terminalTitle: (num) => `终端 ${num}`,
    maximizeTerminal: (cmdKey) => `最大化终端 (${cmdKey}+Shift+M)`,
    closeTerminalBtn: (cmdKey) => `关闭终端 (${cmdKey}+Shift+\`)`,

    // Button tooltips with shortcut
    newTerminalTooltip: (cmdKey) => `新建终端 (${cmdKey}+\`)`,
    fullscreenTooltip: '切换全屏 (F11)',
    shortcutsTooltip: '键盘快捷键',

    // Notifications
    terminalHasNewOutput: (title) => `${title} 有新输出`,
    notificationBody: '点击切换到此终端',

    // Empty state
    emptyStateShortcuts: '快捷键',
    emptyStateLayouts: '布局',
    emptyStateLayoutList: '并排 · 横排 · 网格 · 标签页',

    // Status bar
    statusTerminals: (n) => `${n} 个终端`,

    // Overlays
    alreadyConnected: 'mwt 已在另一个标签页中打开。',
    serverDisconnected: '服务器已断开，请重启服务后刷新页面。',
  },
};

class I18n {
  constructor() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && messages[saved]) {
      this.lang = saved;
    } else {
      // Auto-detect from browser language
      const browser = navigator.language || 'en';
      this.lang = browser.startsWith('zh') ? 'zh' : 'en';
    }
    this._callbacks = [];
  }

  t(key, ...args) {
    const val = messages[this.lang][key];
    if (typeof val === 'function') {
      return val(...args);
    }
    return val ?? key;
  }

  setLang(lang) {
    if (!messages[lang] || lang === this.lang) {
      return;
    }
    this.lang = lang;
    localStorage.setItem(LANG_KEY, lang);
    this._applyToDOM();
    for (const cb of this._callbacks) {
      cb(lang);
    }
  }

  getLangs() {
    return Object.keys(langLabels);
  }

  onChange(cb) {
    this._callbacks.push(cb);
  }

  // Apply translations to elements with data-i18n attribute
  _applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = messages[this.lang][key];
      if (typeof val === 'string') {
        el.textContent = val;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      const val = messages[this.lang][key];
      if (typeof val === 'string') {
        el.placeholder = val;
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.dataset.i18nTitle;
      const val = messages[this.lang][key];
      if (typeof val === 'string') {
        el.title = val;
      }
    });
  }

  // Call once on page load to initialize DOM text
  applyToDOM() {
    this._applyToDOM();
  }
}

export const i18n = new I18n();
