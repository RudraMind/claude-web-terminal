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

  if (!shellKey || !SHELLS[shellKey]) {
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
        ptyProcess.write(config.initCommand);
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
        if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch (e) { /* not JSON — fall through to write */ }
    }
    ptyProcess.write(msg);
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
  console.log(`Server running at http://localhost:${port}`);
});
