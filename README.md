# EveRo

**Multi-Model AI Agent Command Center for Windows**

Run Claude Code agents alongside local Ollama models in the same workspace. Real-time agent monitoring, model discovery, conversation export, and a customizable developer dashboard.

![Version](https://img.shields.io/badge/version-1.0.92-eebbc3?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-232946?style=flat-square)
![Electron](https://img.shields.io/badge/electron-39.x-b8c1ec?style=flat-square)

---

## What Is This?

EveRo is a desktop app that gives your AI agents their own workspace — like Slack, but for AI. Create multiple named agents, assign them to projects, and watch them work in real-time.

**What makes it different:**
- **Multi-model** — Claude Code (API) and Ollama (local) agents in the same project
- **Agent templates** — One-click creation of Claude or Ollama agents with capability badges
- **Model Hub** — Browse, pull, and manage Ollama models from a built-in interface
- **Conversation export** — Save chats as Markdown, JSON, or copy to clipboard
- **Customizable theme** — Navy/pink palette with more themes coming

Based on [roro](https://github.com/make-roro/roro-releases) by @pusongqi, ported to Windows with significant feature additions.

## Install

Download the latest release from [Releases](https://github.com/Evilander/evero/releases):

- **EveRo-x.x.x-win-x64.exe** — Windows installer (recommended)
- **EveRo-x.x.x-portable.exe** — Portable version (no install needed)

### Requirements

- Windows 10/11 x64
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — for Claude agents
- [Ollama](https://ollama.com/) — for local model agents (optional)

## Build from Source

### Prerequisites

- Node.js 20+
- The original roro macOS app extracted (see `roro-mac/` setup below)

### Steps

```bash
# Clone this repo
git clone https://github.com/Evilander/evero.git
cd evero

# Run the build pipeline (copies from mac source + applies all patches)
node scripts/build-win.js

# Install Windows native modules (first time only)
node scripts/setup-modules.js

# Optional: clean up before packaging
node scripts/cleanup-build.js

# Build the installer
npx electron-builder --win --x64 --publish never
```

The installer will be in `dist/`.

## Architecture

EveRo patches the original roro Electron app's minified bundles using a 15-step build pipeline. Each step is a Node.js script that applies targeted string replacements.

### Patch Pipeline

| Step | Script | What It Does |
|------|--------|-------------|
| 1-4 | `build-win.js` | Copy from macOS source + base Windows compatibility |
| 5 | `patch-process-detection.js` | Unix process commands to Windows (ps/pgrep to wmic) |
| 6 | `patch-windows-improvements.js` | Single-instance lock, auto-launch Claude, launch config |
| 7 | `patch-ollama-integration.js` | OllamaService class, model discovery IPC, agent routing |
| 8 | `patch-windows-renderer.js` | Ollama UI, keyboard shortcuts (Ctrl+L/Backspace), path splitting |
| 9 | `patch-path-normalization.js` | Windows backslash normalization for file maps |
| 10 | `patch-model-hub.js` | Model browser/pull UI in Tools tab |
| 11 | `patch-agent-model-picker.js` | Per-agent model selection dropdown |
| 12 | `patch-agent-badges.js` | Capability badges: THINK, CODE, TOOLS, LOCAL |
| 13 | `patch-agent-templates.js` | Quick-create Claude (API) / Ollama (LOCAL) agents |
| 14 | `patch-conversation-export.js` | Export conversations as Markdown/JSON/Clipboard |
| 15 | `patch-color-palette.js` | Navy/pink theme (deep navy bg, soft pink accents) |
| 16 | `patch-rebrand.js` | roro to EveRo rebrand (always last) |

### Verification

```bash
node scripts/verify-all.js
```

Runs 105 automated checks across main process, renderer, preload, files, config, and color palette.

## Features

### Multi-Model Agents
Create Claude Code agents (terminal-based, uses API) or Ollama agents (chat-based, runs locally). Each agent gets capability badges showing what it can do:

- **Claude**: `[THINK]` `[CODE]` `[TOOLS]`
- **Ollama**: `[LOCAL]`

### Model Hub
Browse your installed Ollama models, see their capabilities (completion, thinking, embedding), and pull new models — all from the Tools tab.

### Conversation Export
Export any conversation as Markdown, JSON, or copy to clipboard. The export button lives in the chat header with a dropdown menu.

### Agent Templates
One-click agent creation:
- **+ Claude Agent** `[API]` — Creates a terminal agent that auto-launches Claude Code
- **+ Ollama Agent** `[LOCAL]` — Creates a chat agent connected to your local Ollama instance

### Windows-Native
- Single-instance lock (no duplicate windows)
- Ctrl+L to toggle file viewer, Ctrl+Backspace to clear terminal
- Proper Windows path handling throughout
- Windows process detection (wmic instead of ps/pgrep)

## Roadmap

| Phase | Version | Feature |
|-------|---------|---------|
| 1 | v1.1.0 | **Palette System** — 12+ curated themes (Catppuccin, Nord, Dracula, Rose Pine) + custom creator |
| 2 | v1.2.0 | **Widget Dashboard** — System performance, AI cost tracking, weather, quick launch |
| 3 | v1.3.0 | **Agent EKG** — Real-time animated health waveforms with predictive failure detection |
| 4 | v2.0.0 | **Intelligence Layer** — Agent collaboration, session replay, voice control |

### Agent EKG (Coming in v1.3.0)

The feature that makes EveRo unique. Real-time animated waveforms showing each agent's health:

- **Green rhythm** = healthy, working normally
- **Yellow spikes** = elevated stress, high token burn
- **Red fibrillation** = critical, stuck or looping
- **Flatline** = idle

Powered by composite stress scoring from token velocity, latency jitter, error acceleration, and repetition entropy. Predicts failures before they happen.

Nobody in AI tooling is doing this. The entire industry uses retrospective dashboards. EveRo will be the first to show you your agents' vital signs in real-time.

## Contributing

This project patches minified Electron bundles via string replacement scripts. To contribute:

1. Each feature is a self-contained `scripts/patch-*.js` file
2. Patches are applied sequentially by `build-win.js`
3. Every patch includes its own verification checks
4. Run `node scripts/verify-all.js` after changes (must be 105/105)

## Credits

- [roro](https://github.com/make-roro/roro-releases) by @pusongqi — the original macOS app
- [Ollama](https://ollama.com/) — local model runtime
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — AI coding assistant

## License

MIT
