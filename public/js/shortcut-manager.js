export class ShortcutManager {
  /**
   * @param {{ terminalManager, layoutManager, cmdKey: string }} opts
   */
  constructor({ terminalManager, layoutManager, cmdKey }) {
    this._tm = terminalManager;
    this._lm = layoutManager;
    this._cmdKey = cmdKey;
    this._handler = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._handler, true);
    terminalManager.setShortcutManager(this);
  }

  // Called from document capture phase
  _onKeyDown(e) {
    if (this.matchKeyDown(e)) {
      e._shortcutHandled = true;
    }
  }

  // Returns true if the event matched a shortcut (used by xterm handler to block key)
  matchKeyDown(e) {
    const ctrl = e.ctrlKey;
    const alt = e.altKey;
    const tm = this._tm;
    const lm = this._lm;

    // Ctrl+Alt+N: new terminal
    if (ctrl && alt && e.code === 'KeyN') {
      e.preventDefault();
      tm.createTerminal();
      return true;
    }

    // Ctrl+Alt+W: close active terminal
    if (ctrl && alt && e.code === 'KeyW') {
      e.preventDefault();
      tm.closeActiveTerminal();
      return true;
    }

    // Ctrl+Alt+ArrowRight: next terminal
    if (ctrl && alt && e.code === 'ArrowRight') {
      e.preventDefault();
      const nextId = tm.focusNext();
      if (nextId) {
        tm.clearActivity(nextId);
        if (lm.currentLayout === 'tabs') {
          lm.activateTab(nextId); 
        }
      }
      return true;
    }

    // Ctrl+Alt+ArrowLeft: previous terminal
    if (ctrl && alt && e.code === 'ArrowLeft') {
      e.preventDefault();
      const prevId = tm.focusPrev();
      if (prevId) {
        tm.clearActivity(prevId);
        if (lm.currentLayout === 'tabs') {
          lm.activateTab(prevId); 
        }
      }
      return true;
    }

    // Alt+1~9: switch to terminal N
    if (alt && !ctrl && e.code >= 'Digit1' && e.code <= 'Digit9') {
      e.preventDefault();
      const ids = tm.getIds();
      const idx = parseInt(e.code[5], 10) - 1;
      if (idx < ids.length) {
        const targetId = ids[idx];
        tm.focusTerminal(targetId);
        tm.clearActivity(targetId);
        if (lm.currentLayout === 'tabs') {
          lm.activateTab(targetId); 
        }
      }
      return true;
    }

    // Ctrl+Alt+M: maximize/restore active terminal
    if (ctrl && alt && e.code === 'KeyM') {
      e.preventDefault();
      tm.toggleMaximizeActive();
      return true;
    }

    // F11: toggle fullscreen
    if (e.key === 'F11') {
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
      return true;
    }

    return false;
  }

  destroy() {
    document.removeEventListener('keydown', this._handler, true);
  }
}
