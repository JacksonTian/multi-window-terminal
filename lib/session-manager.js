const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000;     // check every minute

export class SessionManager {
  constructor() {
    this._sessions = new Map(); // sessionId -> { terminals, ws, disconnectedAt }

    const timer = setInterval(() => this._cleanup(), CLEANUP_INTERVAL_MS);
    timer.unref();
  }

  /** Return existing session or create a new one. */
  getOrCreate(sessionId) {
    let session = this._sessions.get(sessionId);
    if (!session) {
      session = { terminals: new Map(), ws: null, disconnectedAt: null };
      this._sessions.set(sessionId, session);
    }
    return session;
  }

  get(sessionId) {
    return this._sessions.get(sessionId);
  }

  /** Mark a session as connected to the given WebSocket. */
  connect(session, ws) {
    session.ws = ws;
    session.disconnectedAt = null;
  }

  /** Mark a session as disconnected. */
  disconnect(session, ws) {
    if (session.ws === ws) {
      session.ws = null;
      session.disconnectedAt = Date.now();
    }
  }

  /** Remove a terminal entry from a session. */
  deleteTerminal(session, id) {
    session.terminals.delete(id);
  }

  /** Kill all PTY processes across all sessions. */
  killAll() {
    for (const session of this._sessions.values()) {
      for (const entry of session.terminals.values()) {
        try {
          entry.pty.kill();
        } catch { /* ignore */ }
      }
    }
  }

  _cleanup() {
    const now = Date.now();
    for (const [sessionId, session] of this._sessions) {
      if (session.disconnectedAt && (now - session.disconnectedAt) > SESSION_TIMEOUT_MS) {
        for (const [, entry] of session.terminals) {
          entry.pty.kill();
        }
        session.terminals.clear();
        this._sessions.delete(sessionId);
      }
    }
  }
}
