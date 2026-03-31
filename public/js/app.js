import { WSClient } from './ws-client.js';
import { TerminalManager } from './terminal-manager.js';
import { LayoutManager } from './layout-manager.js';
import { ThemeManager } from './theme-manager.js';
import { FontManager } from './font-manager.js';
import { ShortcutManager } from './shortcut-manager.js';
import { i18n, langLabels } from './i18n.js';

const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const cmdKey = isMac ? 'Cmd' : 'Ctrl';

// Initialize i18n
i18n.applyToDOM();

function _applyDynamicTitles() {
  document.getElementById('btn-new-terminal').title = i18n.t('newTerminalTooltip', cmdKey);
  document.getElementById('btn-fullscreen').title = i18n.t('fullscreenTooltip');
  document.getElementById('btn-shortcuts').title = i18n.t('shortcutsTooltip');
}

const wsClient = new WSClient();
const container = document.getElementById('terminal-container');
const tabBar = document.getElementById('tab-bar');
const emptyState = document.getElementById('empty-state');
const statusTerminalCount = document.getElementById('status-terminal-count');
const statusActiveTerminal = document.getElementById('status-active-terminal');

function updateStatusBar() {
  const count = terminalManager.getCount();
  statusTerminalCount.textContent = i18n.t('statusTerminals', count);
  const activeId = terminalManager.activeId;
  statusActiveTerminal.textContent = activeId ? terminalManager.getTitle(activeId) : '';
}

function updateEmptyState() {
  emptyState.classList.toggle('hidden', terminalManager.getCount() > 0);
}

document.getElementById('btn-empty-new-terminal').addEventListener('click', () => {
  terminalManager.createTerminal();
});

const themeManager = new ThemeManager();
const fontManager = new FontManager();
const layoutManager = new LayoutManager(container, tabBar);
const terminalManager = new TerminalManager(wsClient, container, themeManager, cmdKey, fontManager, i18n);

// Restore layout immediately (like theme/font) so it's consistent on page load
const LAYOUT_KEY = 'mwt-layout';
const ACTIVE_TAB_KEY = 'mwt-active-tab';
{
  const savedLayout = localStorage.getItem(LAYOUT_KEY);
  if (savedLayout) {
    document.querySelectorAll('.layout-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.layout === savedLayout);
    });
    layoutManager.currentLayout = savedLayout;
    container.classList.remove('layout-columns', 'layout-rows', 'layout-grid', 'layout-tabs');
    container.classList.add(`layout-${savedLayout}`);
    if (savedLayout === 'tabs') {
      tabBar.classList.remove('hidden');
    }
  }
}

layoutManager.onTabActivate = (id) => {
  terminalManager.focusTerminal(id);
};

layoutManager.onLayoutApplied = () => {
  const id = terminalManager.activeId || terminalManager.getIds()[0];
  if (id) {
    terminalManager.focusTerminal(id);
  }
};

// Language dropdown
const langDropdown = document.getElementById('lang-dropdown');
const btnLang = document.getElementById('btn-lang');
const btnLangLabel = document.getElementById('btn-lang-label');
const langMenu = document.getElementById('lang-menu');

function buildLangMenu() {
  langMenu.innerHTML = '';
  for (const [code, label] of Object.entries(langLabels)) {
    const btn = document.createElement('button');
    btn.className = 'lang-option' + (code === i18n.lang ? ' active' : '');
    btn.innerHTML = `<span>${label}</span><svg class="lang-check" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    btn.addEventListener('click', () => {
      i18n.setLang(code);
      btnLangLabel.textContent = label;
      buildLangMenu();
      langDropdown.classList.remove('open');
      _applyDynamicTitles();
      terminalManager.updateI18n(i18n, cmdKey);
      updateStatusBar();
    });
    langMenu.appendChild(btn);
  }
}

btnLangLabel.textContent = langLabels[i18n.lang];
buildLangMenu();

btnLang.addEventListener('click', (e) => {
  e.stopPropagation();
  langDropdown.classList.toggle('open');
});

document.addEventListener('click', () => {
  langDropdown.classList.remove('open');
});

// Theme toggle
document.getElementById('btn-theme-toggle').addEventListener('click', () => {
  themeManager.toggle();
});

// Cross-wire layout manager and terminal manager
layoutManager.fitAll = () => terminalManager.fitAll();
layoutManager.closeTerminal = (id) => terminalManager.closeTerminal(id);
layoutManager.swapTerminals = (id1, id2) => terminalManager.swapTerminals(id1, id2);

// Activity notification: visual indicators + browser notifications + title flash
const originalTitle = document.title;
let titleFlashTimer = null;

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

const notificationCooldown = new Map(); // id -> timestamp
const NOTIFICATION_DEBOUNCE_MS = 2000;

terminalManager.onActivity((id, cleared) => {
  if (cleared) {
    layoutManager.clearActivity(id);
    // If no more unread activity, stop title flash
    if (terminalManager.activitySet.size === 0) {
      clearInterval(titleFlashTimer);
      titleFlashTimer = null;
      document.title = originalTitle;
    }
    return;
  }

  layoutManager.markActivity(id);

  // Browser notification when page is hidden
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    const now = Date.now();
    const lastNotify = notificationCooldown.get(id) || 0;
    if (now - lastNotify > NOTIFICATION_DEBOUNCE_MS) {
      notificationCooldown.set(id, now);
      const title = terminalManager.getTitle(id);
      const n = new Notification(i18n.t('terminalHasNewOutput', title), {
        body: i18n.t('notificationBody'),
        tag: `mwt-${id}`,
      });
      n.onclick = () => {
        window.focus();
        terminalManager.focusTerminal(id);
        if (layoutManager.currentLayout === 'tabs') {
          layoutManager.activateTab(id);
        }
        n.close();
      };
    }
  }

  // Title flash when page is hidden
  if (document.hidden && !titleFlashTimer) {
    let flash = true;
    titleFlashTimer = setInterval(() => {
      document.title = flash ? `[*] ${originalTitle}` : originalTitle;
      flash = !flash;
    }, 1000);
  }
});

// Stop title flash when page becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    clearInterval(titleFlashTimer);
    titleFlashTimer = null;
    document.title = originalTitle;
  }
});

// Request notification permission on first user interaction
document.addEventListener('click', requestNotificationPermission, { once: true });

terminalManager.onChange((event) => {
  if (event.type === 'add') {
    layoutManager.onTerminalAdded(event.id);
    updateEmptyState();
    updateStatusBar();
  } else if (event.type === 'remove') {
    layoutManager.onTerminalRemoved(event.id);
    updateEmptyState();
    updateStatusBar();
  } else if (event.type === 'title') {
    layoutManager.updateTabTitle(event.id, event.title);
    updateStatusBar();
  } else if (event.type === 'maximize') {
    layoutManager.onTerminalMaximized();
  } else if (event.type === 'restore') {
    layoutManager.onTerminalRestored();
  }
});

container.addEventListener('focusin', () => updateStatusBar());

// New Terminal button
document.getElementById('btn-new-terminal').addEventListener('click', () => {
  terminalManager.createTerminal();
});

// Settings modal
const settingsModal = document.getElementById('settings-modal');
const inputFontSize = document.getElementById('input-font-size');
const inputFontFamily = document.getElementById('input-font-family');
const fontSizeValue = document.getElementById('font-size-value');

function syncSettingsUI() {
  inputFontSize.value = fontManager.fontSize;
  fontSizeValue.textContent = `${fontManager.fontSize}px`;
  inputFontFamily.value = fontManager.fontFamily;
}

document.getElementById('btn-settings').addEventListener('click', () => {
  syncSettingsUI();
  settingsModal.classList.remove('hidden');
});

document.getElementById('btn-settings-close').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    settingsModal.classList.add('hidden');
  }
});

inputFontSize.addEventListener('input', () => {
  fontSizeValue.textContent = `${inputFontSize.value}px`;
  fontManager.setFontSize(parseInt(inputFontSize.value, 10));
});

inputFontFamily.addEventListener('change', () => {
  const val = inputFontFamily.value.trim();
  if (val) {
    fontManager.setFontFamily(val);
  }
});

// Update button titles with platform-appropriate shortcut hints
_applyDynamicTitles();

// Shortcuts modal
const shortcutsModal = document.getElementById('shortcuts-modal');

document.getElementById('btn-shortcuts').addEventListener('click', () => {
  shortcutsModal.classList.remove('hidden');
});

document.getElementById('btn-shortcuts-close').addEventListener('click', () => {
  shortcutsModal.classList.add('hidden');
});

shortcutsModal.addEventListener('click', (e) => {
  if (e.target === shortcutsModal) {
    shortcutsModal.classList.add('hidden');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!shortcutsModal.classList.contains('hidden')) {
      shortcutsModal.classList.add('hidden');
    }
    if (!settingsModal.classList.contains('hidden')) {
      settingsModal.classList.add('hidden');
    }
  }
}, true);


// Fill platform-appropriate shortcut keys in modal
function renderShortcutKeys() {
  document.querySelectorAll('.shortcut-key[data-shortcut]').forEach(el => {
    const raw = el.dataset.shortcut;
    if (isMac) {
      el.textContent = raw
        .replace(/ctrl/gi, '⌃')
        .replace(/alt/gi, '⌥')
        .replace(/shift/gi, '⇧')
        .replace(/\+/g, '');
    } else {
      el.textContent = raw
        .replace(/ctrl/gi, 'Ctrl')
        .replace(/alt/gi, 'Alt')
        .replace(/shift/gi, 'Shift');
    }
  });
}
renderShortcutKeys();

// Layout persistence
function saveLayoutState() {
  localStorage.setItem(LAYOUT_KEY, layoutManager.currentLayout);
  if (layoutManager.activeTabId) {
    localStorage.setItem(ACTIVE_TAB_KEY, layoutManager.activeTabId);
  }
}

// Layout switcher
document.querySelectorAll('.layout-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Sync active terminal to layout manager before switching, so tabs
    // activates the same terminal the user is currently focused on.
    if (terminalManager.activeId) {
      layoutManager.activeTabId = terminalManager.activeId;
    }
    layoutManager.setLayout(btn.dataset.layout);
    saveLayoutState();
  });
});

// Fullscreen toggle
document.getElementById('btn-fullscreen').addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
});

document.addEventListener('fullscreenchange', () => {
  setTimeout(() => terminalManager.fitAll(), 100);
});

// Keyboard shortcuts
new ShortcutManager({ terminalManager, layoutManager, cmdKey });

// Prevent browser back navigation to avoid losing terminal sessions
history.pushState(null, '', location.href);
window.addEventListener('popstate', () => {
  history.pushState(null, '', location.href);
});

// Window resize -> refit all
window.addEventListener('resize', () => {
  terminalManager.fitAll();
});

// Session restore handler
wsClient.onSessionRestore((terminalIds) => {
  // Clear any existing client-side terminals (e.g., on re-reconnect)
  terminalManager.clearAll();

  if (terminalIds.length === 0) {
    // New session - create first terminal
    terminalManager.createTerminal();
  } else {
    // Restore existing terminals
    for (const id of terminalIds) {
      terminalManager.restoreTerminal(id);
    }
  }

  // Restore layout from localStorage
  const savedLayout = localStorage.getItem(LAYOUT_KEY);
  if (savedLayout) {
    document.querySelectorAll('.layout-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.layout === savedLayout);
    });
    layoutManager.setLayout(savedLayout);
  }

  const savedActiveTab = localStorage.getItem(ACTIVE_TAB_KEY);
  if (savedActiveTab && layoutManager.currentLayout === 'tabs') {
    layoutManager.activateTab(savedActiveTab);
  }

});

// Unmute terminals after buffer replay completes
wsClient.onRestoreComplete(() => {
  terminalManager.unmuteAll();
});

// Show overlay when this tab is rejected (another tab already connected)
wsClient.onAlreadyConnected(() => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg-primary,#1e1e1e);z-index:9999;';
  const p = document.createElement('p');
  p.style.cssText = 'color:var(--text-primary,#ccc);font-family:monospace;font-size:14px;';
  p.textContent = i18n.t('alreadyConnected');
  overlay.appendChild(p);
  document.body.appendChild(overlay);
});

// Show overlay when reconnection gives up after too many failures
wsClient.onGiveUp(() => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:var(--bg-primary,#1e1e1e);z-index:9999;';
  const p = document.createElement('p');
  p.style.cssText = 'color:var(--text-primary,#ccc);font-family:monospace;font-size:14px;';
  p.textContent = i18n.t('serverDisconnected');
  overlay.appendChild(p);
  document.body.appendChild(overlay);
});
