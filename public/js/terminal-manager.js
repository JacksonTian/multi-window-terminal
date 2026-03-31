import { FitAddon } from '/vendor/xterm/addon-fit.mjs';
import { WebLinksAddon } from '/vendor/xterm/addon-web-links.mjs';
import { DragManager } from './drag-manager.js';

// xterm.js is loaded as UMD via <script> tag, access from global
const { Terminal } = globalThis;

export class TerminalManager {
  constructor(wsClient, container, themeManager, cmdKey = 'Ctrl', fontManager = null, i18n = null) {
    this.wsClient = wsClient;
    this.container = container;
    this.themeManager = themeManager;
    this.fontManager = fontManager;
    this.cmdKey = cmdKey;
    this.i18n = i18n;
    this.terminals = new Map(); // id -> { term, fitAddon, element, resizeObserver }
    this.counter = 0;
    this.activeId = null;
    this.changeCallbacks = [];
    this.activityCallbacks = [];
    this._dragManager = new DragManager((id1, id2) => this.swapTerminals(id1, id2));
    this.activitySet = new Set(); // terminal IDs with unread activity
    this._shortcutManager = null;

    // Update all terminals when theme changes
    if (themeManager) {
      themeManager.onChange(() => {
        const theme = themeManager.getTerminalTheme();
        for (const [, entry] of this.terminals) {
          entry.term.options.theme = theme;
        }
      });
    }

    // Update all terminals when font changes
    if (fontManager) {
      fontManager.onChange(({ fontSize, fontFamily }) => {
        for (const [, entry] of this.terminals) {
          entry.term.options.fontSize = fontSize;
          entry.term.options.fontFamily = fontFamily;
          entry.fitAddon.fit();
        }
      });
    }
  }

  _buildTerminal(id) {
    const num = id.replace('term-', '');

    // Create DOM
    const pane = document.createElement('div');
    pane.className = 'terminal-pane';
    pane.dataset.id = id;

    const header = document.createElement('div');
    header.className = 'pane-header';

    const title = document.createElement('span');
    title.className = 'pane-title';
    title.textContent = this.i18n ? this.i18n.t('terminalTitle', num) : `Terminal ${num}`;

    // Drag to swap
    this._dragManager.attach(pane, header, id);

    const headerActions = document.createElement('div');
    headerActions.className = 'pane-actions';

    const maximizeBtn = document.createElement('button');
    maximizeBtn.className = 'pane-maximize';
    maximizeBtn.title = this.i18n ? this.i18n.t('maximizeTerminal', this.cmdKey) : `Maximize terminal (${this.cmdKey}+Shift+M)`;
    maximizeBtn.innerHTML = '<svg class="icon-maximize" width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>'
      + '<svg class="icon-restore" width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M4 5H2.5A1.5 1.5 0 001 6.5v8A1.5 1.5 0 002.5 16h8a1.5 1.5 0 001.5-1.5V13" stroke="currentColor" stroke-width="1.5"/></svg>';
    maximizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMaximize(id);
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pane-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = this.i18n ? this.i18n.t('closeTerminalBtn', this.cmdKey) : `Close terminal (${this.cmdKey}+Shift+\`)`;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTerminal(id);
    });

    headerActions.appendChild(maximizeBtn);
    headerActions.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(headerActions);

    const body = document.createElement('div');
    body.className = 'terminal-body';

    pane.appendChild(header);
    pane.appendChild(body);
    this.container.appendChild(pane);

    // Create xterm instance
    const term = new Terminal({
      cursorBlink: true,
      fontSize: this.fontManager ? this.fontManager.fontSize : 14,
      fontFamily: this.fontManager ? this.fontManager.fontFamily : "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Menlo', monospace",
      lineHeight: 1.15,
      minimumContrastRatio: 4.5,
      theme: this.themeManager ? this.themeManager.getTerminalTheme() : {},
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(body);

    // Block xterm from sending app shortcut keys to the terminal process
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') {
        return true;
      }
      // Already handled by document capture phase — block xterm
      if (e._shortcutHandled) {
        return false;
      }
      // Focus is in xterm and capture phase didn't fire — try shortcut manager directly
      if (this._shortcutManager) {
        e._shortcutHandled = true;
        if (this._shortcutManager.matchKeyDown(e)) {
          return false;
        }
      }
      return true;
    });

    // Fit after layout settles
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        term.scrollToBottom();
      } catch { /* ignore if not visible */ }
    });

    // ResizeObserver with debounce
    let fitTimeout = null;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(fitTimeout);
      fitTimeout = setTimeout(() => {
        try {
          fitAddon.fit();
          term.scrollToBottom();
        } catch { /* ignore */ }
      }, 50);
    });
    resizeObserver.observe(body);

    // Wire xterm -> server (muted during buffer replay to suppress escape sequence responses)
    let muted = false;
    term.onData((data) => {
      if (!muted) {
        this.wsClient.sendData(id, data);
      }
    });

    term.onResize(({ cols, rows }) => {
      this.wsClient.resizeTerminal(id, cols, rows);
    });

    // Wire server -> xterm
    this.wsClient.onTerminalData(id, (data) => {
      term.write(data);
      if (id !== this.activeId && !this.activitySet.has(id)) {
        this.activitySet.add(id);
        this._notifyActivity(id);
      }
    });

    this.wsClient.onTerminalExit(id, () => {
      this.closeTerminal(id);
    });

    // Update pane/tab title when shell reports a new title (e.g. cwd via OSC)
    term.onTitleChange((newTitle) => {
      title.textContent = newTitle;
      title.title = newTitle;
      this._notifyChange({ type: 'title', id, title: newTitle });
    });

    // Track active terminal on focus and clear activity
    pane.addEventListener('mousedown', () => {
      this.setActiveTerminal(id);
      this.clearActivity(id);
    });
    term.textarea?.addEventListener('focus', () => {
      this.setActiveTerminal(id);
      this.clearActivity(id);
    });

    const setMuted = (v) => {
      muted = v;
    };
    this.terminals.set(id, { term, fitAddon, element: pane, resizeObserver, setMuted });
    this._notifyChange({ type: 'add', id });
    this.setActiveTerminal(id);
    term.focus();

    return { term, fitAddon, element: pane, resizeObserver, setMuted };
  }

  setShortcutManager(sm) {
    this._shortcutManager = sm;
  }

  createTerminal() {
    const id = `term-${++this.counter}`;
    const { fitAddon } = this._buildTerminal(id);

    // Get initial dimensions and create server-side PTY
    const dims = fitAddon.proposeDimensions();
    this.wsClient.createTerminal(id, dims?.cols || 80, dims?.rows || 24);

    return id;
  }

  restoreTerminal(id) {
    // Update counter to avoid future ID collisions
    const num = parseInt(id.replace('term-', ''), 10);
    if (num > this.counter) {
      this.counter = num;
    }

    const { fitAddon, setMuted } = this._buildTerminal(id);

    // Mute xterm -> server during buffer replay to prevent escape sequence
    // responses (cursor position reports, device attributes) from being
    // interpreted as shell commands
    setMuted(true);

    // PTY already exists server-side, just sync the size
    const dims = fitAddon.proposeDimensions();
    this.wsClient.resizeTerminal(id, dims?.cols || 80, dims?.rows || 24);

    return id;
  }

  unmuteTerminal(id) {
    const entry = this.terminals.get(id);
    if (entry) {
      entry.setMuted(false);
    }
  }

  unmuteAll() {
    for (const [, entry] of this.terminals) {
      entry.setMuted(false);
    }
  }

  clearAll() {
    for (const [id, entry] of this.terminals) {
      this.wsClient.removeListeners(id);
      entry.resizeObserver.disconnect();
      entry.term.dispose();
      entry.element.remove();
    }
    this.terminals.clear();
    this.counter = 0;
    this.activeId = null;
  }

  closeTerminal(id) {
    const entry = this.terminals.get(id);
    if (!entry) {
      return;
    }

    const idsBefore = this.getIds();
    const idx = idsBefore.indexOf(id);

    // If closing a maximized terminal, restore others first
    if (entry.element.classList.contains('maximized')) {
      for (const [, e] of this.terminals) {
        e.element.classList.remove('hidden-by-maximize');
      }
    }

    this.wsClient.closeTerminal(id);
    this.wsClient.removeListeners(id);
    entry.resizeObserver.disconnect();
    entry.term.dispose();
    entry.element.remove();
    this.terminals.delete(id);

    if (this.activeId === id) {
      let nextId = null;
      if (idx >= 0) {
        if (idx < idsBefore.length - 1) {
          nextId = idsBefore[idx + 1];
        } else if (idx > 0) {
          nextId = idsBefore[idx - 1];
        }
      }
      this.activeId = nextId;
    }
    this._syncPaneFocus();

    const focusId = this.activeId;
    if (focusId) {
      requestAnimationFrame(() => {
        if (this.terminals.has(focusId)) {
          this.focusTerminal(focusId);
        }
      });
    }

    this._notifyChange({ type: 'remove', id });
  }

  /** Updates active terminal state and pane-focused styling (call before focus when switching programmatically). */
  setActiveTerminal(id) {
    if (!this.terminals.has(id)) {
      return;
    }
    this.activeId = id;
    this._syncPaneFocus();
  }

  _syncPaneFocus() {
    const active = this.activeId;
    for (const [tid, entry] of this.terminals) {
      entry.element.classList.toggle('pane-focused', tid === active);
    }
  }

  focusTerminal(id) {
    const entry = this.terminals.get(id);
    if (entry) {
      this.setActiveTerminal(id);
      entry.term.focus();
    }
  }

  fitAll() {
    for (const [, entry] of this.terminals) {
      requestAnimationFrame(() => {
        try {
          entry.fitAddon.fit();
          entry.term.scrollToBottom();
        } catch { /* ignore */ }
      });
    }
  }

  fitTerminal(id) {
    const entry = this.terminals.get(id);
    if (entry) {
      requestAnimationFrame(() => {
        try {
          entry.fitAddon.fit();
          entry.term.scrollToBottom();
        } catch { /* ignore */ }
      });
    }
  }

  toggleMaximize(id) {
    const entry = this.terminals.get(id);
    if (!entry) {
      return;
    }

    const pane = entry.element;
    const isMaximized = pane.classList.contains('maximized');

    if (isMaximized) {
      // Restore: show all panes
      pane.classList.remove('maximized');
      for (const [, e] of this.terminals) {
        e.element.classList.remove('hidden-by-maximize');
      }
      this._notifyChange({ type: 'restore', id });
    } else {
      // Maximize: hide others, expand this one
      for (const [otherId, e] of this.terminals) {
        if (otherId !== id) {
          e.element.classList.add('hidden-by-maximize');
        }
      }
      pane.classList.add('maximized');
      this._notifyChange({ type: 'maximize', id });
    }

    requestAnimationFrame(() => this.fitAll());
  }

  getMaximizedId() {
    for (const [id, entry] of this.terminals) {
      if (entry.element.classList.contains('maximized')) {
        return id;
      }
    }
    return null;
  }

  getCount() {
    return this.terminals.size;
  }

  getIds() {
    return [...this.terminals.keys()];
  }

  updateI18n(i18n, cmdKey) {
    this.i18n = i18n;
    if (cmdKey) {
      this.cmdKey = cmdKey;
    }
    for (const [id, entry] of this.terminals) {
      const pane = entry.element;
      const maximizeBtn = pane.querySelector('.pane-maximize');
      const closeBtn = pane.querySelector('.pane-close');
      if (maximizeBtn) {
        maximizeBtn.title = i18n.t('maximizeTerminal', this.cmdKey);
      }
      if (closeBtn) {
        closeBtn.title = i18n.t('closeTerminalBtn', this.cmdKey);
      }
      // Only update title if it hasn't been overridden by the shell (OSC)
      const titleEl = pane.querySelector('.pane-title');
      if (titleEl && !titleEl.title) {
        const num = id.replace('term-', '');
        titleEl.textContent = i18n.t('terminalTitle', num);
      }
    }
  }

  getTitle(id) {
    const entry = this.terminals.get(id);
    if (entry) {
      const paneTitle = entry.element.querySelector('.pane-title');
      if (paneTitle) {
        return paneTitle.textContent;
      }
    }
    const idx = id.replace('term-', '');
    return this.i18n ? this.i18n.t('terminalTitle', idx) : `Terminal ${idx}`;
  }

  focusNext() {
    const ids = this.getIds();
    if (ids.length <= 1) {
      return;
    }
    const idx = ids.indexOf(this.activeId);
    const nextId = ids[(idx + 1) % ids.length];
    this.focusTerminal(nextId);
    return nextId;
  }

  focusPrev() {
    const ids = this.getIds();
    if (ids.length <= 1) {
      return;
    }
    const idx = ids.indexOf(this.activeId);
    const prevId = ids[(idx - 1 + ids.length) % ids.length];
    this.focusTerminal(prevId);
    return prevId;
  }

  closeActiveTerminal() {
    const id = this.activeId || this.getIds()[0];
    if (id) {
      this.closeTerminal(id);
    }
  }

  toggleMaximizeActive() {
    const id = this.activeId || this.getIds()[0];
    if (id) {
      this.toggleMaximize(id);
    }
  }

  onChange(callback) {
    this.changeCallbacks.push(callback);
  }

  onActivity(callback) {
    this.activityCallbacks.push(callback);
  }

  clearActivity(id) {
    if (this.activitySet.delete(id)) {
      this._notifyActivity(id, true);
    }
  }

  _notifyChange(event) {
    for (const cb of this.changeCallbacks) {
      cb(event);
    }
  }

  _notifyActivity(id, cleared = false) {
    for (const cb of this.activityCallbacks) {
      cb(id, cleared);
    }
  }

  swapTerminals(id1, id2) {
    const entry1 = this.terminals.get(id1);
    const entry2 = this.terminals.get(id2);
    if (!entry1 || !entry2) {
      return;
    }

    const el1 = entry1.element;
    const el2 = entry2.element;

    // Swap DOM positions using a placeholder
    const placeholder = document.createComment('swap');
    el1.replaceWith(placeholder);
    el2.replaceWith(el1);
    placeholder.replaceWith(el2);

    // Swap Map entries to keep iteration order consistent
    const keys = [...this.terminals.keys()];
    const idx1 = keys.indexOf(id1);
    const idx2 = keys.indexOf(id2);
    const entries = [...this.terminals.entries()];
    [entries[idx1], entries[idx2]] = [entries[idx2], entries[idx1]];
    this.terminals = new Map(entries);

    this._notifyChange({ type: 'swap', id1, id2 });
    requestAnimationFrame(() => this.fitAll());
  }
}
