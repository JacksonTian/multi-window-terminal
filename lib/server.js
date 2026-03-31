import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { SessionManager } from './session-manager.js';
import { spawnTerminal } from './pty-manager.js';

const __dirname = fileURLToPath(new URL('..', import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.map': 'application/json',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'cmd'
      : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
  execFile(cmd, args);
}

export function start(port = 1987, host = '127.0.0.1', options = {}) {
  const startCwd = process.cwd();
  const sessions = new SessionManager();

  const publicDir = join(__dirname, 'public');
  const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': 'no-store',
  };

  // HTTP server for static files
  const server = createServer(async (req, res) => {
    let filePath;
    const url = req.url.split('?')[0];

    if (url === '/') {
      filePath = join(publicDir, 'index.html');
    } else {
      filePath = join(publicDir, url);
    }

    // Prevent path traversal: resolved path must stay within publicDir
    if (!filePath.startsWith(publicDir + '/') && filePath !== join(publicDir, 'index.html')) {
      res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      res.end('Forbidden');
      return;
    }

    // Only serve known file types
    const ext = extname(filePath);
    if (!MIME_TYPES[ext]) {
      res.writeHead(403, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      res.end('Forbidden');
      return;
    }

    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext], ...SECURITY_HEADERS });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain', ...SECURITY_HEADERS });
      res.end('Not Found');
    }
  });

  // WebSocket server
  const wss = new WebSocketServer({ server });

  function handlePortInUse(err) {
    const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
    if (err.code === 'EADDRINUSE') {
      const altPort = port + 1;
      console.error(`
  mwt: failed to start — port ${port} is already in use.

  Another mwt instance is likely running on this port.

  Options:
    Start on a different port:    mwt -p ${altPort}
    Open the existing instance:   http://${displayHost}:${port}
    Stop the existing process:    kill $(lsof -ti:${port})
`);
    } else if (err.code === 'EACCES') {
      console.error(`
  mwt: failed to start — permission denied on port ${port}.

  Ports below 1024 require root privileges.

  Options:
    Use a non-privileged port:    mwt -p 1987
    Run with elevated privileges: sudo mwt -p ${port}
`);
    } else if (err.code === 'EADDRNOTAVAIL') {
      console.error(`
  mwt: failed to start — host address ${host} is not available.

  The specified host is not assigned to any network interface.

  Options:
    Bind to all interfaces:       mwt --host 0.0.0.0
    Bind to localhost:            mwt --host 127.0.0.1
`);
    } else {
      console.error(`
  mwt: failed to start — ${err.message}
`);
    }
    process.exit(1);
  }

  server.on('error', handlePortInUse);
  wss.on('error', handlePortInUse);

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId) {
      ws.close(4001, 'Missing sessionId');
      return;
    }

    const session = sessions.getOrCreate(sessionId);

    // Reject new connection if session already has an active WebSocket
    if (session.ws && session.ws.readyState === 1) {
      ws.close(4409, 'already connected');
      return;
    }

    sessions.connect(session, ws);

    // Send session-restore with existing terminal IDs
    const terminalIds = [...session.terminals.keys()];
    ws.send(JSON.stringify({ type: 'session-restore', terminals: terminalIds }));

    // Send buffered output for each existing terminal
    for (const [id, entry] of session.terminals) {
      const buffered = entry.outputBuffer.read();
      if (buffered) {
        ws.send(JSON.stringify({ type: 'buffer', id, data: buffered }));
      }
    }

    // Signal that all buffer messages have been sent
    if (terminalIds.length > 0) {
      ws.send(JSON.stringify({ type: 'restore-complete' }));
    }

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      switch (msg.type) {
        case 'create': {
          const entry = spawnTerminal({
            id: msg.id,
            cols: msg.cols,
            rows: msg.rows,
            cwd: startCwd,
            onData: (id, data) => {
              if (session.ws && session.ws.readyState === 1) {
                session.ws.send(JSON.stringify({ type: 'data', id, data }));
              }
            },
            onExit: (id, exitCode) => {
              sessions.deleteTerminal(session, id);
              if (session.ws && session.ws.readyState === 1) {
                session.ws.send(JSON.stringify({ type: 'exit', id, exitCode }));
              }
            },
          });
          if (entry) {
            session.terminals.set(msg.id, entry);
          }
          break;
        }

        case 'data': {
          const entry = session.terminals.get(msg.id);
          if (entry) {
            entry.pty.write(msg.data);
          }
          break;
        }

        case 'resize': {
          const entry = session.terminals.get(msg.id);
          if (entry) {
            try {
              entry.pty.resize(msg.cols, msg.rows);
            } catch {
              // ignore invalid resize
            }
          }
          break;
        }

        case 'close': {
          const entry = session.terminals.get(msg.id);
          if (entry) {
            entry.pty.kill();
            sessions.deleteTerminal(session, msg.id);
          }
          break;
        }
      }
    });

    ws.on('close', () => {
      sessions.disconnect(session, ws);
    });
  });


  server.listen(port, host, () => {
    const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`;
    console.log(`mwt running at ${url}`);
    if (options.open !== false) {
      openBrowser(url);
    }
  });

  // Kill all PTY processes on exit to avoid orphan processes
  function killAll() {
    sessions.killAll(); 
  }

  process.once('exit', killAll);
  process.once('SIGINT', () => {
    killAll(); process.exit(130); 
  });
  process.once('SIGTERM', () => {
    killAll(); process.exit(143); 
  });
}
