export class LayoutManager {
  constructor(container, tabBar) {
    this.container = container;
    this.tabBar = tabBar;
    this.currentLayout = 'columns';
    this.activeTabId = null;
    /** @type {((id: string) => void) | null} Called after tab becomes active (focus PTY). */
    this.onTabActivate = null;
    /** @type {((layout: string) => void) | null} After refit when layout mode changes (focus PTY). */
    this.onLayoutApplied = null;
    // These will be set by app.js after construction
    this.fitAll = () => {};
    this.closeTerminal = () => {};
    this.swapTerminals = null;
  }

  setLayout(mode) {
    // Clear maximized state before switching — layout takes priority
    this._clearMaximizedState();

    // Remove all layout classes
    this.container.classList.remove('layout-columns', 'layout-rows', 'layout-grid', 'layout-tabs');
    this.container.classList.add(`layout-${mode}`);
    this.currentLayout = mode;

    if (mode === 'tabs') {
      this.tabBar.classList.remove('hidden');
      this._rebuildTabBar();
      // Activate the current tab, or the first one
      const panes = this.container.querySelectorAll('.terminal-pane');
      if (panes.length > 0) {
        const targetId = this.activeTabId && this.container.querySelector(`.terminal-pane[data-id="${this.activeTabId}"]`)
          ? this.activeTabId
          : panes[0].dataset.id;
        this.activateTab(targetId);
      }
    } else {
      this.tabBar.classList.add('hidden');
      // Make all panes visible (remove active class used by tabs)
      this.container.querySelectorAll('.terminal-pane').forEach(p => {
        p.classList.remove('active');
      });
      if (mode === 'grid') {
        this._updateGridColumns();
      }
    }

    // Refit after layout change, then restore keyboard focus to the active terminal
    requestAnimationFrame(() => {
      this.fitAll();
      requestAnimationFrame(() => {
        if (this.onLayoutApplied) {
          this.onLayoutApplied(this.currentLayout);
        }
      });
    });
  }

  onTerminalAdded(id) {
    if (this.currentLayout === 'tabs') {
      this._addTab(id);
      this.activateTab(id);
    } else if (this.currentLayout === 'grid') {
      this._updateGridColumns();
    }
    requestAnimationFrame(() => this.fitAll());
  }

  onTerminalRemoved(id) {
    if (this.currentLayout === 'tabs') {
      let nextTabId = null;
      if (this.activeTabId === id) {
        const tabs = [...this.tabBar.querySelectorAll('.tab')];
        const tidx = tabs.findIndex(t => t.dataset.id === id);
        if (tidx >= 0) {
          if (tidx < tabs.length - 1) {
            nextTabId = tabs[tidx + 1].dataset.id;
          } else if (tidx > 0) {
            nextTabId = tabs[tidx - 1].dataset.id;
          }
        }
      }
      this._removeTab(id);
      if (this.activeTabId === id) {
        if (nextTabId) {
          this.activateTab(nextTabId);
        } else {
          const firstTab = this.tabBar.querySelector('.tab');
          if (firstTab) {
            this.activateTab(firstTab.dataset.id);
          } else {
            this.activeTabId = null;
          }
        }
      }
    } else if (this.currentLayout === 'grid') {
      this._updateGridColumns();
    }
    requestAnimationFrame(() => this.fitAll());
  }

  activateTab(id) {
    this.activeTabId = id;

    // Update tab bar
    this.tabBar.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.id === id);
    });

    // Update panes
    this.container.querySelectorAll('.terminal-pane').forEach(pane => {
      pane.classList.toggle('active', pane.dataset.id === id);
    });

    // Clear activity indicator for the activated tab
    this.clearActivity(id);

    if (this.onTabActivate) {
      this.onTabActivate(id);
    }

    requestAnimationFrame(() => this.fitAll());
  }

  markActivity(id) {
    const tab = this.tabBar.querySelector(`.tab[data-id="${id}"]`);
    if (tab) {
      tab.classList.add('has-activity');
    }
    const pane = this.container.querySelector(`.terminal-pane[data-id="${id}"]`);
    if (pane) {
      pane.classList.add('has-activity');
    }
  }

  clearActivity(id) {
    const tab = this.tabBar.querySelector(`.tab[data-id="${id}"]`);
    if (tab) {
      tab.classList.remove('has-activity');
    }
    const pane = this.container.querySelector(`.terminal-pane[data-id="${id}"]`);
    if (pane) {
      pane.classList.remove('has-activity');
    }
  }

  _rebuildTabBar() {
    this.tabBar.innerHTML = '';
    const panes = this.container.querySelectorAll('.terminal-pane');
    panes.forEach(pane => {
      const paneTitle = pane.querySelector('.pane-title')?.textContent;
      this._addTab(pane.dataset.id, paneTitle);
    });
  }

  _addTab(id, label) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.id = id;
    tab.draggable = true;

    const title = document.createElement('span');
    title.className = 'tab-title';
    const idx = id.replace('term-', '');
    title.textContent = label || `Terminal ${idx}`;

    const closeBtn = document.createElement('span');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTerminal(id);
    });

    tab.appendChild(title);
    tab.appendChild(closeBtn);

    tab.addEventListener('click', () => {
      this.activateTab(id);
    });

    tab.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
    });
    tab.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tab.classList.add('drag-over');
    });
    tab.addEventListener('dragleave', () => {
      tab.classList.remove('drag-over');
    });
    tab.addEventListener('drop', (e) => {
      e.preventDefault();
      tab.classList.remove('drag-over');
      const sourceId = e.dataTransfer.getData('text/plain');
      if (sourceId && sourceId !== id && this.swapTerminals) {
        this.swapTerminals(sourceId, id);
        // Reorder tab DOM to match
        const sourceTab = this.tabBar.querySelector(`.tab[data-id="${sourceId}"]`);
        if (sourceTab) {
          const placeholder = document.createComment('tab-swap');
          sourceTab.replaceWith(placeholder);
          tab.replaceWith(sourceTab);
          placeholder.replaceWith(tab);
        }
      }
    });

    this.tabBar.appendChild(tab);
  }

  updateTabTitle(id, title) {
    const tab = this.tabBar.querySelector(`.tab[data-id="${id}"] .tab-title`);
    if (tab) {
      tab.textContent = title;
      tab.title = title;
    }
  }

  _removeTab(id) {
    const tab = this.tabBar.querySelector(`.tab[data-id="${id}"]`);
    if (tab) {
      tab.remove();
    }
  }

  _clearMaximizedState() {
    this.container.querySelectorAll('.terminal-pane.maximized').forEach(el => el.classList.remove('maximized'));
    this.container.querySelectorAll('.terminal-pane.hidden-by-maximize').forEach(el => el.classList.remove('hidden-by-maximize'));
  }

  onTerminalMaximized() {
    if (this.currentLayout === 'grid') {
      this.container.style.gridTemplateColumns = '1fr';
      this.container.style.gridTemplateRows = '1fr';
    }
  }

  onTerminalRestored() {
    if (this.currentLayout === 'grid') {
      this._updateGridColumns();
    }
  }

  onMinimizeChanged() {
    if (this.currentLayout === 'grid') {
      this._updateGridColumns();
    }
  }

  _updateGridColumns() {
    const count = this.container.querySelectorAll('.terminal-pane:not(.minimized)').length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    this.container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    this.container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }
}
