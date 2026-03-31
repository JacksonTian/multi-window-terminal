export class WSClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map(); // id -> { onData, onExit }
    this.pendingMessages = [];
    this.reconnectDelay = 1000;
    this.reconnectAttempts = 0;
    this.onReconnectCallbacks = [];
    this.onSessionRestoreCallback = null;
    this.onRestoreCompleteCallback = null;
    this.onAlreadyConnectedCallback = null;
    this.onGiveUpCallback = null;
    this.sessionId = this._getOrCreateSessionId();
    this.connect();
  }

  _getOrCreateSessionId() {
    const key = 'mwt-session-id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}?sessionId=${this.sessionId}`);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000;
      this.reconnectAttempts = 0;
      // flush pending messages
      for (const msg of this.pendingMessages) {
        this.ws.send(msg);
      }
      this.pendingMessages = [];
    };

    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'session-restore') {
        if (this.onSessionRestoreCallback) {
          this.onSessionRestoreCallback(msg.terminals);
        }
        return;
      }

      if (msg.type === 'buffer') {
        const listener = this.listeners.get(msg.id);
        if (listener && listener.onData) {
          listener.onData(msg.data);
        }
        return;
      }

      if (msg.type === 'restore-complete') {
        if (this.onRestoreCompleteCallback) {
          this.onRestoreCompleteCallback();
        }
        return;
      }

      const listener = this.listeners.get(msg.id);
      if (!listener) {
        return;
      }

      if (msg.type === 'data' && listener.onData) {
        listener.onData(msg.data);
      } else if (msg.type === 'exit' && listener.onExit) {
        listener.onExit(msg.exitCode);
      }
    };

    this.ws.onclose = (event) => {
      if (event.code === 4409) {
        if (this.onAlreadyConnectedCallback) {
          this.onAlreadyConnectedCallback();
        }
        return;
      }
      this.reconnectAttempts += 1;
      if (this.reconnectAttempts > 5) {
        if (this.onGiveUpCallback) {
          this.onGiveUpCallback();
        }
        return;
      }
      setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10000);
        this.connect();
        for (const cb of this.onReconnectCallbacks) {
          cb();
        }
      }, this.reconnectDelay);
    };
  }

  send(obj) {
    const data = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      this.pendingMessages.push(data);
    }
  }

  createTerminal(id, cols, rows) {
    this.send({ type: 'create', id, cols, rows });
  }

  sendData(id, data) {
    this.send({ type: 'data', id, data });
  }

  resizeTerminal(id, cols, rows) {
    this.send({ type: 'resize', id, cols, rows });
  }

  closeTerminal(id) {
    this.send({ type: 'close', id });
  }

  onTerminalData(id, callback) {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, {});
    }
    this.listeners.get(id).onData = callback;
  }

  onTerminalExit(id, callback) {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, {});
    }
    this.listeners.get(id).onExit = callback;
  }

  removeListeners(id) {
    this.listeners.delete(id);
  }

  onReconnect(callback) {
    this.onReconnectCallbacks.push(callback);
  }

  onSessionRestore(callback) {
    this.onSessionRestoreCallback = callback;
  }

  onRestoreComplete(callback) {
    this.onRestoreCompleteCallback = callback;
  }

  onAlreadyConnected(callback) {
    this.onAlreadyConnectedCallback = callback;
  }

  onGiveUp(callback) {
    this.onGiveUpCallback = callback;
  }
}
