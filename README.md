# mwt - Multi-Window Terminal

[![npm version](https://img.shields.io/npm/v/@jacksontian/mwt)](https://www.npmjs.com/package/@jacksontian/mwt)
[![npm downloads](https://img.shields.io/npm/dm/@jacksontian/mwt)](https://www.npmjs.com/package/@jacksontian/mwt)
[![Node.js](https://img.shields.io/node/v/@jacksontian/mwt)](https://nodejs.org)
[![License](https://img.shields.io/npm/l/@jacksontian/mwt)](LICENSE)

A lightweight web-based multi-window terminal for **local development**. Run multiple shell sessions in the browser with columns, rows, grid, and tab layouts.

> **Note:** mwt is designed for local use on your development machine. It does not provide authentication, encryption, or any access control — do not expose it to the network.

## Why mwt?

You're running three AI agents — one writing code, one running tests, one calling external APIs. You also want to watch the build logs and occasionally run a command.

Your desktop is buried under seven or eight terminal windows. You're Alt-Tabbing between them, losing track of which is which. You tried tmux but keep forgetting the shortcuts. VS Code feels too heavy when all you need is a terminal.

So you run `npx @jacksontian/mwt`, open a browser, and lay all your terminals out on a single page. No more window hunting.

## Quick Start

```bash
npx @jacksontian/mwt
```

Or install globally:

```bash
npm install -g @jacksontian/mwt
mwt
```

Then open http://localhost:1987 in your browser.

## Usage

```
mwt [options]

Options:
  -p, --port <port>  Port to listen on (default: 1987)
  --host <host>      Host to bind to (default: 127.0.0.1)
  --no-open          Do not open the browser automatically
  -h, --help         Show this help message
```

Example:

```bash
$ cd /path/to/your/project
$ mwt -p 8080
```

## Screenshots

| Columns | Rows |
|---|---|
| ![Columns](./figures/columns.png) | ![Rows](./figures/rows.png) |

| Grid | Tabs |
|---|---|
| ![Grid](./figures/grid.png) | ![Tabs](./figures/tabs.png) |

## Features

- **Multi-terminal** - Create and manage multiple terminal sessions simultaneously
- **Four layouts** - Columns, rows, grid, and tabs, switch anytime
- **Session persistence** - Reconnect without losing recent terminal output (100KB buffer per terminal)
- **Auto-reconnect** - WebSocket disconnection recovery with exponential backoff
- **Dark / Light theme** - Manual toggle or follow system preference
- **Keyboard-driven** - Common operations available via keyboard shortcuts
- **Zero build step** - No webpack, no bundler, just run

## Design principles

- **Minimal dependencies** — Backend uses only node-pty and ws. Frontend uses native ES Modules + xterm.js. No framework, no build step.
- **Browser as the UI** — Cross-platform by default. No desktop app to install.
- **Session persistence** — 100KB output buffer per terminal. Reconnect after refresh or disconnection without losing context. Only one tab per session allowed.
- **Just enough** — No SSH, no authentication, no plugins. Focused on local multi-terminal use. ~2000 lines of code.

## Comparison

| | mwt | tmux / screen | iTerm2 | Windows Terminal | VS Code terminal | ttyd | Wetty | code-server |
|---|---|---|---|---|---|---|---|---|
| **Multi-terminal** | ✅ Columns / grid / tabs | ✅ Panes / windows | ✅ Tabs / split | ✅ Tabs / split | ✅ Split / tabs | ❌ Single | ❌ Single | ✅ Integrated |
| **Runs in** | Browser | Terminal emulator | macOS app | Windows app | Desktop app | Browser | Browser | Browser |
| **Cross-platform** | ✅ Any OS with a browser | ✅ Unix/Linux/macOS | ❌ macOS only | ❌ Windows only | ✅ | ✅ | ✅ | ✅ |
| **Learning curve** | Zero config, ready instantly | High — custom keybindings | Low | Low | Low | Low | Medium | Medium |
| **Session persistence** | ✅ 100KB buffer + auto-reconnect | ✅ detach/attach | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Layout switching** | ✅ 4 layouts, one click | ✅ Manual splits | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Theme switching** | ✅ Dark/light + follows system | Manual config | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Remote / SSH** | ❌ Local only | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Best for** | Local multi-terminal dev | Server ops / local dev | macOS daily use | Windows daily use | Coding + terminal | Remote single terminal | Remote terminal | Remote development |

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## License

[MIT](./LICENSE)
