'use strict';

const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const { parse: parseUrl } = require('url');

const isWindows = process.platform === 'win32';

const SHELLS = {
  cmd: {
    command: isWindows ? 'cmd.exe' : (process.env.SHELL || '/bin/bash'),
    args: [],
    label: isWindows ? 'CMD' : 'Bash',
    initCommand: null,
  },
  claude: {
    command: isWindows ? 'cmd.exe' : (process.env.SHELL || '/bin/bash'),
    args: [],
    label: 'Claude Code',
    initCommand: 'claude\r',
  },
};

const app = express();
const port = process.env.PORT || 3000;
let boundPort = null;

app.use((req, res, next) => {
  const wsPort = boundPort !== null ? boundPort : port;
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' cdn.jsdelivr.net; " +
    "style-src 'self' cdn.jsdelivr.net; " +
    `connect-src 'self' ws://localhost:${wsPort} ws://127.0.0.1:${wsPort}; ` +
    "font-src cdn.jsdelivr.net; " +
    "img-src 'self' data:; " +
    "frame-ancestors 'none'");
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const terminals = new Map();
let nextId = 1;

server.on('upgrade', (req, socket, head) => {
  const origin = req.headers.origin;
  const addr = server.address();
  const allowed = [
    `http://localhost:${addr.port}`,
    `http://127.0.0.1:${addr.port}`,
  ];

  if (!allowed.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  const { pathname } = parseUrl(req.url);
  if (pathname !== '/pty') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws, req) => {
  const query = parseUrl(req.url, true).query;
  const shellKey = query.shell;

  if (!shellKey || !Object.prototype.hasOwnProperty.call(SHELLS, shellKey)) {
    ws.close(1008, 'Invalid shell');
    return;
  }

  const config = SHELLS[shellKey];
  const cwd = process.env.HOME || process.env.USERPROFILE || process.cwd();

  const ptyProcess = pty.spawn(config.command, config.args, {
    cols: 80,
    rows: 24,
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' },
  });

  const id = nextId++;
  terminals.set(id, ptyProcess);

  if (config.initCommand) {
    setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        try { ptyProcess.write(config.initCommand); }
        catch (e) { console.error('pty initCommand write failed:', e.message); }
      }
    }, 500);
  }

  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  ptyProcess.onExit(() => {
    terminals.delete(id);
    if (ws.readyState === ws.OPEN) {
      ws.close();
    }
  });

  ws.on('message', (raw) => {
    const msg = raw.toString();
    if (msg.charAt(0) === '{') {
      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'resize' &&
            Number.isInteger(parsed.cols) && parsed.cols > 0 && parsed.cols <= 1000 &&
            Number.isInteger(parsed.rows) && parsed.rows > 0 && parsed.rows <= 500) {
          try { ptyProcess.resize(parsed.cols, parsed.rows); }
          catch (e) { console.error('pty resize failed:', e.message); }
          return;
        }
      } catch (e) { /* not JSON — fall through to write */ }
    }
    try { ptyProcess.write(msg); }
    catch (e) { console.error('pty write failed:', e.message); }
  });

  ws.on('close', () => {
    terminals.delete(id);
    try { ptyProcess.kill(); } catch (e) {}
  });
});

function killAllTerminals() {
  for (const [, ptyProcess] of terminals) {
    try { ptyProcess.kill(); } catch (e) {}
  }
  terminals.clear();
}

process.on('exit', killAllTerminals);
process.on('SIGINT', () => { killAllTerminals(); process.exit(0); });
process.on('SIGTERM', () => { killAllTerminals(); process.exit(0); });

server.listen(port, '127.0.0.1', () => {
  boundPort = server.address().port;
  console.log(`Server running at http://localhost:${boundPort}`);
});
