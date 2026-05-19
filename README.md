# RUDRA — claude-web-terminal

**Real terminals in your browser.** Run CMD shells and Claude Code side-by-side in a polished tab UI, served from localhost.

> **Security:** The server binds to `127.0.0.1` only. Never expose it to the internet or run it behind a tunnel (ngrok, Cloudflare Tunnel, etc.).

---

## What it is

RUDRA is a localhost web app that gives you full PTY terminals in any browser tab — no Electron, no extensions, no cloud. It uses `node-pty` to spawn real shell processes on your machine and streams them to [xterm.js](https://xtermjs.org/) over WebSocket.

Two shell types are built in:

| Shell | What it opens |
|---|---|
| **CMD** | `cmd.exe` on Windows, `$SHELL` on Linux/macOS |
| **Claude Code** | Same shell, then auto-runs `claude` on launch |

---

## Features

- Real PTY terminals — not a fake emulator. Arrow keys, `Ctrl+C`, tab completion, colors, everything works
- Multiple tabs with Ctrl+Shift+T / Ctrl+Shift+C shortcuts
- **Split pane** — view two terminals side-by-side with a draggable divider
- Inline tab rename — double-click any tab label
- Dead tab detection — process exit shown immediately in-terminal and in the status bar
- Zero build step — vanilla JS, no bundler, no TypeScript, no framework
- All UI assets loaded from CDN — no static build required

---

## Requirements

### All platforms
- **Node.js 18 or later** — [nodejs.org/en/download](https://nodejs.org/en/download)
- **Claude Code tab** (optional): `claude` CLI installed globally

```bash
npm install -g @anthropic-ai/claude-code
```

### Windows
Visual Studio Build Tools are required to compile `node-pty`.

1. Download **Visual Studio Build Tools 2022**: [aka.ms/vs/17/release/vs_BuildTools.exe](https://aka.ms/vs/17/release/vs_BuildTools.exe)
2. Run the installer
3. Select **"Desktop development with C++"** workload
4. Install (~4 GB)

Then run `npm install` in the project folder.

> Already have Visual Studio 2022 (not just Build Tools)? You're set — skip this step.

### Linux (Ubuntu/Debian)

```bash
sudo apt update && sudo apt install -y build-essential python3
```

### macOS

```bash
xcode-select --install
```

---

## Quick start

```bash
git clone https://github.com/RudraMind/claude-web-terminal.git
cd claude-web-terminal
npm install
npm start
```

Open **http://localhost:3000** in your browser.

On first load, a Claude Code terminal opens automatically. Click **+ ▾** to open a CMD shell instead.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+T` | New CMD terminal |
| `Ctrl+Shift+C` | New Claude Code terminal |
| `Ctrl+Shift+W` | Close active tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+\` | Split right |

---

## Split pane

Click **⊟ ▾** in the header, then **Split Right** or **Split Down**.

- Both panes run independent terminals
- Drag the divider to resize (20%–80% range)
- Click either pane to focus it (status bar updates)
- Click **Unsplit** in the same dropdown to return to single-pane view

---

## Configuration

### Change port

```bash
PORT=4000 npm start
```

Then open http://localhost:4000.

### Run on startup (Windows — Task Scheduler)

1. Open Task Scheduler
2. Create Basic Task → "RUDRA terminal"
3. Trigger: At log on
4. Action: Start a program
   - Program: `node`
   - Arguments: `server.js`
   - Start in: `C:\path\to\claude-web-terminal`

---

## Troubleshooting

### `npm install` fails — `node-pty` build error

`node-pty` is a native module requiring a C++ compiler. The error usually looks like:

```
gyp ERR! build error
```

**Windows fix:** Install Visual Studio Build Tools 2022 with the "Desktop development with C++" workload (see Requirements above). After installing, run `npm install` again.

**Linux fix:**
```bash
sudo apt install build-essential python3
npm install
```

**macOS fix:**
```bash
xcode-select --install
npm install
```

---

### Claude Code tab shows a blank terminal or "command not found: claude"

The `claude` CLI is not installed or not on PATH.

```bash
npm install -g @anthropic-ic/claude-code
```

Then verify it works:

```bash
claude --version
```

If you installed it but it's still not found, the shell PATH inside the PTY may differ from your regular terminal. Add the npm global bin to your system PATH:

```bash
# Find the path
npm root -g
# On Windows it's usually: C:\Users\<you>\AppData\Roaming\npm
```

---

### Port 3000 is already in use

```
Error: listen EADDRINUSE :::3000
```

Either kill the process on port 3000, or use a different port:

```bash
# Windows — find the PID
netstat -ano | findstr :3000
# Then kill it
taskkill /PID <pid> /F

# Or just use a different port
PORT=4000 npm start
```

---

### Terminal renders but keyboard input does nothing

Ensure you are on the latest commit. An earlier version was missing the `term.onData` → WebSocket send wire-up. Pull the latest and reinstall:

```bash
git pull
npm install
npm start
```

---

### Browser shows "WebSocket connection failed"

The server is not running, or you are connecting from a different origin.

1. Confirm `npm start` is running and shows `Server running at http://localhost:3000`
2. Access the app at exactly `http://localhost:3000` — not `127.0.0.1:3000` (both work, but make sure you are not opening a saved HTML file from disk)
3. The server only accepts connections from `localhost` — this is intentional

---

### xterm.js canvas is blank or has wrong dimensions

This is a resize timing issue. Press `Ctrl+Shift+W` to close the tab and open a new one with `Ctrl+Shift+T`. If it happens consistently, try a different browser (tested on Chrome, Edge, Firefox).

---

## Architecture

```
browser (xterm.js)  ←→  WebSocket /pty?shell=cmd  ←→  server.js  ←→  node-pty  ←→  cmd.exe / bash
```

- `server.js` — Express static file server + WebSocket upgrade handler. Spawns a PTY per connection. Shell type selected via URL query parameter (`?shell=cmd` or `?shell=claude`).
- `public/app.js` — Tab and split pane manager. One `xterm.Terminal` + one WebSocket per tab.
- `public/styles.css` — Full design system with CSS custom properties. No external CSS frameworks.
- `public/index.html` — Static shell. All assets loaded from CDN (xterm.js, JetBrains Mono font).

No build step. No transpilation. Refresh the page to pick up JS/CSS changes during development.

---

## Security

- The server **only** accepts WebSocket upgrades from `http://localhost:<port>` and `http://127.0.0.1:<port>`. Any other `Origin` header gets a 403.
- The server **only** accepts the `/pty` WebSocket path. All other paths get a 404.
- Shell selection is validated against an allowlist (`cmd`, `claude`). Any other value closes the connection immediately.
- **Do not expose this server to the internet.** It spawns real shell processes on your machine with your user's permissions. Treat it like a local dev tool, not a service.

---

## Contributing

1. Fork the repo
2. Make your changes in `public/` (frontend) or `server.js` (backend)
3. Test manually: `npm start`, open http://localhost:3000, verify terminals work
4. Submit a PR with a description of what changed and why

There is no test suite yet. PRs that add one are welcome.

---

## License

MIT — see [LICENSE](LICENSE)
