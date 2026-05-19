# claude-web-terminal

Real terminals in your browser — CMD and Claude Code with tab switching.

> ⚠️ **Security:** This server binds to localhost only. Do NOT expose it to the internet or use tunneling tools (ngrok, cloudflare tunnel, etc.).

## Features

- Real PTY terminals via node-pty (not emulated)
- Tab switcher: run multiple terminals side by side
- Claude Code integration: launch the Claude CLI in a browser tab
- Windows CMD (or Bash on Linux/macOS)
- Terminal resize, scrollback, clickable URLs, ANSI colors
- Zero-config: no build step, no bundler

## Requirements

- Node.js 18 or later
- **Windows:** Visual Studio Build Tools 2022 with "Desktop development with C++" workload
- **Linux:** build-essential, python3
- **macOS:** Xcode Command Line Tools
- For Claude Code tab: `claude` CLI installed globally (`npm install -g @anthropic-ai/claude-code`)

## Quick start

```
git clone https://github.com/YOUR_USERNAME/claude-web-terminal.git
cd claude-web-terminal
npm install
npm start
```

Open http://localhost:3000

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+T` | New CMD tab |
| `Ctrl+Shift+W` | Close active tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |

## Troubleshooting

### `npm install` fails on `node-pty`

This is a native module requiring a C++ compiler.

- **Windows:** Install Visual Studio Build Tools 2022. Select "Desktop development with C++". Then retry `npm install`.
- **Linux:** `sudo apt install build-essential python3`
- **macOS:** `xcode-select --install`

### Claude Code tab shows "command not found"

Install the Claude CLI: `npm install -g @anthropic-ai/claude-code`

### Port 3000 is in use

`PORT=4000 npm start`

## License

MIT
