# mwt - 多窗口终端

[![npm version](https://img.shields.io/npm/v/@jacksontian/mwt)](https://www.npmjs.com/package/@jacksontian/mwt)
[![npm downloads](https://img.shields.io/npm/dm/@jacksontian/mwt)](https://www.npmjs.com/package/@jacksontian/mwt)
[![Node.js](https://img.shields.io/node/v/@jacksontian/mwt)](https://nodejs.org)
[![License](https://img.shields.io/npm/l/@jacksontian/mwt)](LICENSE)

一个轻量级的基于浏览器的多窗口终端，专为**本地开发**设计。在浏览器中运行多个 Shell 会话，支持列、行、网格和标签页布局。

> **注意：** mwt 设计用于在你的开发机器上本地使用。它不提供身份验证、加密或任何访问控制——请勿将其暴露在网络中。

## 为什么选择 mwt？

你在跑三个 AI Agent，一个在写代码，一个在跑测试，一个在调用外部 API。与此同时，你还想看构建日志，偶尔查一条命令。

桌面上已经堆了七八个终端窗口，来回 Alt-Tab 切换，找不到刚才那个窗口在哪。你试过 tmux，但每次都要查快捷键。VS Code 太重，只想要个终端而已。

于是你运行 `npx @jacksontian/mwt`，打开浏览器，把所有终端铺在一个页面里。再也不用切窗口了。

## 快速开始

```bash
npx @jacksontian/mwt
```

或全局安装：

```bash
npm install -g @jacksontian/mwt
mwt
```

然后在浏览器中打开 http://localhost:1987。

## 使用方法

```
mwt [options]

Options:
  -p, --port <port>  监听端口（默认：1987）
  --host <host>      绑定主机（默认：127.0.0.1）
  --no-open          不自动打开浏览器
  -h, --help         显示帮助信息
```

示例：

```bash
$ cd /path/to/your/project
$ mwt -p 8080
```

## 截图

| 列布局 | 行布局 |
|---|---|
| ![列布局](./figures/columns.png) | ![行布局](./figures/rows.png) |

| 网格布局 | 标签页布局 |
|---|---|
| ![网格布局](./figures/grid.png) | ![标签页布局](./figures/tabs.png) |

## 功能特性

- **多终端** — 同时创建和管理多个终端会话
- **四种布局** — 列、行、网格和标签页，随时切换
- **会话持久化** — 断线重连不丢失最近的终端输出（每个终端 100KB 缓冲）
- **自动重连** — WebSocket 断线后指数退避自动恢复
- **深色 / 浅色主题** — 手动切换或跟随系统偏好
- **键盘驱动** — 常用操作均可通过快捷键完成
- **零构建步骤** — 无 webpack，无打包工具，直接运行

## 设计原则

- **极简依赖** — 后端只有 node-pty 和 ws，前端原生 ES Modules + xterm.js，无框架无构建步骤。
- **浏览器即界面** — 天然跨平台，无需安装桌面应用。
- **会话不丢失** — 100KB 输出缓冲，刷新或断线后自动恢复；同一 session 仅允许一个标签页连接。
- **够用就好** — 不做 SSH、认证、插件。专注本地多终端，代码约 2000 行。

## 对比

| | mwt | tmux / screen | iTerm2 | Windows Terminal | VS Code 终端 | ttyd | Wetty | code-server |
|---|---|---|---|---|---|---|---|---|
| **多终端管理** | ✅ 列 / 网格 / 标签页 | ✅ 窗格 / 窗口 | ✅ 标签页 / 分屏 | ✅ 标签页 / 分屏 | ✅ 分屏 / 标签页 | ❌ 单终端 | ❌ 单终端 | ✅ 内嵌终端 |
| **运行环境** | 浏览器 | 终端模拟器 | macOS 应用 | Windows 应用 | 桌面应用 | 浏览器 | 浏览器 | 浏览器 |
| **跨平台** | ✅ 任意有浏览器的系统 | ✅ Unix/Linux/macOS | ❌ 仅 macOS | ❌ 仅 Windows | ✅ | ✅ | ✅ | ✅ |
| **上手成本** | 零配置，开箱即用 | 高，需学习快捷键体系 | 低 | 低 | 低 | 低 | 中等 | 中等 |
| **会话持久化** | ✅ 100KB 缓冲 + 自动重连 | ✅ detach/attach | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **布局切换** | ✅ 四种布局一键切换 | ✅ 手动分屏 | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **主题切换** | ✅ 深色/浅色 + 跟随系统 | 需手动配置 | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **远程/SSH** | ❌ 仅本地 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **适用场景** | 本地开发多终端 | 服务器运维/本地开发 | macOS 日常使用 | Windows 日常使用 | 编码 + 终端一体化 | 远程单终端 | 远程终端 | 远程开发 |

## 更新日志

请查看 [CHANGELOG.md](./CHANGELOG.md) 了解版本历史。

## 许可证

[MIT](./LICENSE)
