# CLAUDE.md — EveRo Development Guide

> **EveRo** — Multi-model AI agent orchestration platform for Windows
> Version: 1.0.92 | Electron 39.x | React 19 | Built: 2026-02-12

---

## Architecture

EveRo patches a pre-built Electron app (originally macOS-only) for Windows via a 16-step build pipeline. Each step is a Node.js script that performs string replacements on minified JS/CSS bundles.

```
roro-win/
├── scripts/               # Build & patch scripts
│   ├── build-win.js       # Orchestrates all 16 steps
│   ├── verify-all.js      # 111 automated checks
│   ├── patch-*.js         # Individual feature patches
│   └── _test-esm.mjs     # ES module syntax validator
├── out/                   # Patched output (source of truth at build time)
│   ├── main/index.js      # ~101KB, 3 lines (minified)
│   ├── preload/index.js   # ~8KB, 1 line
│   └── renderer/
│       ├── index.html
│       └── assets/
│           ├── index-BFJPEAID.js   # ~2.17MB, 1 line (React app)
│           └── index-CDjYEUtK.css  # ~50KB, 2 lines
├── resources/             # Icons, hooks, update config
├── node_modules/          # Windows-native dependencies
├── dist/                  # Built installers
└── package.json           # Electron-builder config
```

### Build Pipeline (16 Steps)

```
Step 1:  Copy out/ from macOS source
Step 2:  Base Windows compat (13 patches: .sh→.cmd, chmod, frame, PATH, sharp, HOME, which, titlebar)
Step 3:  Sync node_modules
Step 4:  Copy resources
Step 5:  Process detection (ps/pgrep→wmic) + UX improvements + Startup reliability
Step 6:  Ollama integration (OllamaService class + IPC handlers)
Step 7:  Windows renderer (Ollama UI, keyboard shortcuts, path splitting)
Step 8:  Path normalization (backslash→forward slash helpers)
Step 9:  Model Hub (replaces "Coming soon" with Ollama management dashboard)
Step 10: Agent model picker (dropdown for Ollama model selection)
Step 11: Agent capability badges (THINK/CODE/TOOLS/LOCAL pills)
Step 12: Smart agent templates (+ Claude Agent / + Ollama Agent buttons)
Step 13: Conversation export (Export button + save dialog)
Step 14: Color palette (Navy/pink "Midnight Blush" theme)
Step 15: Rebrand (roro → EveRo, all references + images)
Step 16: UI polish (tab labels, DM stubs, About page, dead code cleanup)
```

Run: `node scripts/build-win.js` then `npx electron-builder --win --x64`

---

## Features (v1.0.92)

### Multi-Model Agents
- **Claude agents**: Terminal-based with full Claude Code SDK integration, hooks, file operations
- **Ollama agents**: Streaming HTTP chat via localhost:11434, supports any Ollama model
- Smart template buttons: "+ Claude Agent [API]" and "+ Ollama Agent [LOCAL]"
- Per-agent capability badges: [THINK], [CODE], [TOOLS], [LOCAL]
- Agent model picker dropdown for Ollama model selection

### Model Hub
- Live Ollama connection status indicator
- Installed models list with details (parameter size, quantization, family)
- Pull new models with async download + progress
- Featured models showcase (kimi-k2.5, glm-5, qwen3-coder-next, deepseek-r1)
- Delete models, view running models

### Conversation Export
- Export button in chat header with dropdown menu
- Save as Markdown (.md), JSON (.json), or copy to clipboard
- Native save dialog with file type filters

### Windows Compatibility
- Keyboard shortcuts: Ctrl+L (file viewer), Ctrl+Backspace (terminal clear)
- Path handling: 8 file path splits fixed for backslash support
- Path normalization: `__normPath()` + `__normFileMap()` for forward slashes
- Process detection: wmic instead of ps/pgrep
- Single-instance lock with deep link routing
- Auto-launch Claude Code in terminal with configurable flags

### Color Palette (Midnight Blush)
- 74 CSS custom properties replaced
- 140+ hardcoded Tailwind utilities updated
- Body gradient, glass effects, glow accents all navy/pink
- Key colors: BG #232946, Surface #1e2440, Accent #eebbc3, Text #fffffe/#b8c1ec

### Startup Reliability
- Service init with timeouts: Auth (5s), Analytics (3s)
- Window creation right before IPC handler registration (no race condition)

### UI Polish (v1.0.92+)
- Tab labels: "Models" (was "Tools"), "CLAUDE.md" (was "markdown")
- DMs button hidden (vestigial Supabase feature, replaced by Model Hub)
- DM IPC handlers stubbed with safe defaults (no Supabase connection attempts)
- Profile view: About EveRo page (was empty null)
- Auth system: graceful anonymous fallback when offline
- Updater: points to Evilander/evero via GitHub provider

---

## Critical Technical Patterns

### Minified Code Aliases (renderer)
These vary by component scope — always verify before patching:

| Alias | Meaning | Scope |
|-------|---------|-------|
| `E` | React JSX runtime (`jsx`, `jsxs`) | Global |
| `$` | React (hooks: `useState`, `useRef`, `useEffect`, `useCallback`, `useMemo`) | Inside `GY`/`WY` components |
| `W` | **NOT React** inside WY — it's a local `$.useRef()` return value | WY component only |

**NEVER use `W.useState` in WY component patches.** Always use `$.useState`.

### Injecting React Components
**CORRECT** — pass a function component to E.jsx:
```javascript
E.jsx(function MyComponent(){
  const [state, setState] = $.useState(false);
  return E.jsx("div", {children: "hello"});
}, {})
```

**WRONG** — IIFE returns an object (React element), causing React error #130:
```javascript
E.jsx((function(){
  const [state, setState] = $.useState(false);
  return E.jsx("div", {children: "hello"});
})(), {})  // ← the () calls it, returning an element, not a function
```

### ES Module Validation
The renderer JS is loaded as `<script type="module">`. **`node -c` cannot catch ES module errors** because it validates as CommonJS (sloppy mode).

Always validate with the ES module tester:
```bash
node scripts/_test-esm.mjs
```
Expected output: `OK-PARSE` (runtime errors are OK, syntax errors are not).

### Build Pipeline Overwrites
`build-win.js` Step 1 copies fresh files from macOS source, overwriting everything in `out/`. Any manual changes to `out/` files must be done AFTER build-win.js runs.

### Main Process IPC Pattern
IPC handlers in main are comma-separated expressions inside `if(k){...}`:
```javascript
if(k){
  c.ipcMain.handle("some:handler", async(ev,arg)=>{...}),
  c.ipcMain.handle("another:handler", async(ev)=>{...}),
  // ... note: commas, not semicolons
}
```

Insert new handlers BEFORE the `shell:openExternal` handler (established anchor point).

---

## Bug Fixes Applied (v1.0.92 Stabilization)

### 1. Ollama Button Syntax Error (ES module parse failure)
**Symptom**: White screen, `SyntaxError: missing ) after argument list`
**Root cause**: `patch-windows-renderer.js` used `codexButtonEnd.slice(0,-1) + ollamaButton` where ollamaButton started with `}),`. This produced `]}}),` — an extra `}`.
**Fix**: Changed to `codexButtonEnd + ollamaButton` with ollamaButton starting with `,`.

### 2. React Hooks Alias Mismatch
**Symptom**: White screen on project selection, `W.useState is not a function`
**Root cause**: `patch-conversation-export.js` and `patch-model-hub.js` used `W.useState` but `W` in the WY component scope is a `$.useRef()` return value, not React. React hooks are accessed via `$`.
**Fix**: Changed all `W.useState/useCallback/useEffect` to `$.useState/useCallback/useEffect` in both files.

### 3. IIFE Component Pattern (React error #130)
**Symptom**: `Element type is invalid: expected string/function, got object`
**Root cause**: Three patch files used `E.jsx((function(){...})(), {})` which calls the IIFE immediately, returning a React element (object), then passes that object to `E.jsx` which expects a function.
**Fix**: Changed to `E.jsx(function(){...}, {})` in `patch-conversation-export.js`, `patch-model-hub.js`, and `patch-agent-model-picker.js`.

### 4. Startup Race Condition
**Symptom**: White screen, no errors (IPC handlers not registered when renderer loads)
**Root cause**: Original startup reliability patch called `me()` (window creation) first, then waited up to 8s for service timeouts, then registered IPC handlers. Renderer loaded and tried to call handlers that didn't exist yet.
**Fix**: Services init with timeouts first, then `me()` right before `if(k){` so IPC handlers register immediately.

---

## Roadmap

### Phase 1: Palette System (v1.1.0) — Next Up
Runtime theme switching with 13+ curated presets + custom palette creator.

**Presets**: Midnight Blush (default), Cyberpunk, Neon Ember, Deep Teal, Mocha, Catppuccin Mocha/Frappe, Rose Pine/Moon, Nord, Dracula, Rose Pine Dawn, Catppuccin Latte

**Architecture**: Main process stores palette in `palette-config.json`. Preload bridges 7 methods. Renderer injects `<style id="evero-palette-override">` that overrides CSS vars at runtime. No rebuild needed to switch themes.

**Status**: Patch written (`patch-palette-system.js`) but disabled — needs `W.useState` → `$.useState` fix and IIFE → function component fix before re-enabling.

### Phase 2: Widget Dashboard (v1.2.0)
Replace Tools tab with a living dashboard of glassmorphic widgets:
- **System Performance**: CPU/RAM/GPU/disk gauges via `systeminformation`
- **AI Token Usage & Cost**: Parse Claude Code usage logs, daily spend, burn rate
- **Weather**: Open-Meteo API (free, no key), animated weather icons
- **Quick Launch**: Configurable app launcher grid
- **Project Activity Feed**: Live cross-agent event stream (uniquely EveRo)

### Phase 3: Agent EKG (v1.3.0) — The Breakthrough Feature
Real-time animated health waveforms encoding agent state as morphology.

**Nobody in AI tooling does this.** Every competitor uses retrospective Grafana-style dashboards. EveRo renders continuous animated waveforms:
- Canvas 2D at 60fps with phosphor persistence effect
- Composite stress score (0-100) from: token velocity, latency jitter, error acceleration, repetition entropy
- Waveform shapes: flat (idle), sine (calm), peaks (active), spikes (elevated), fibrillation (critical)
- Predictive failure detection: pre-loop, pre-stuck, pre-crash warnings
- Medical-grade aesthetics: grid lines, glow effects, sweep line

**Academic basis**: arXiv:2601.20412 — "Cognitive Load Framework for Tool-use Agents" (Jan 2026)

### Phase 4: Intelligence Layer (v2.0.0)
- **Agent Collaboration**: TaskRouter that delegates between Claude (expensive, powerful) and Ollama (free, fast) based on task complexity and agent load
- **Session Replay**: Timestamped IPC recording with timeline scrubber and playback
- **Agent-to-Agent Communication**: @mention routing between agents
- **Voice Control**: Web Speech API for hands-free agent management
- **Cost Intelligence**: Per-agent budgets, auto-downgrade suggestions, monthly projections
- **Plugin Architecture**: Community widgets, palettes, agent types, marketplace

### Phase 5: Mobile Companion (v3.0.0)
React Native app: mini EKGs on your phone, remote agent commands, push notifications, cost dashboard. Connected via WebSocket to Express server.

---

## Agent Prompting Patterns (Research-Backed, 2025-2026)

These patterns should be applied when prompting subagents, Ollama models, and multi-agent workflows.

### Always Apply

**Chain of Draft (CoD)** — For local/Ollama models, append to system prompt:
> "Think step by step, but only keep a minimum draft for each thinking step, with 5 words at most."
Reduces token count 60-92% with zero accuracy loss. (arXiv:2502.18600)

**Emotional Prompting** — Append to any task prompt:
> "This is very important. Embrace this challenge as an opportunity to demonstrate excellence."
+8-115% performance across tasks. Activates latent model capability. (arXiv:2307.11760, Microsoft)

**Structured Deliverables** — Always specify exact output format. Fewer tools in context = better selection accuracy. Reduces extraneous cognitive load. (arXiv:2601.20412)

### Multi-Agent Patterns

**MSARL (Split Reasoning/Execution)** — Separate "Reasoning Agent" (plans tool use) from "Tool Agent" (executes + interprets). 1.5B split agents beat 7B single agents by 14-16%. (arXiv:2508.08882, ICLR 2026)

**Cognitive Load Routing** — Route tasks by model sensitivity:
```
P_success = exp(-(k * CognitiveLoad + b))
```
| Model | k | Resilience |
|---|---|---|
| Fine-tuned 32B | 0.034 | Very resilient |
| GPT-4o | 0.067 | Moderate |
| Claude 3.7 | 0.073 | Moderate |
| Qwen3-8B | 0.085 | Fragile under load |

**Heterogeneous Debate** — Different specialist agents argue positions, Judge agent decides. Use rationale alignment (explicit agree/disagree with evidence). (arXiv:2511.07784)

### Self-Improvement

**Reflexion** — After failure: analyze trajectory, identify critical mistake, store reflection (max 3). Prepend reflections to next attempt. (arXiv:2303.11366)

**MARS** — $2.20 self-improvement cycle: diagnose failures → cluster by type → generate 3 enhancement variants (Concise/Reasoning/Specific) → select best per category. Turned GPT-3.5 from 36% to 49% on GPQA in one cycle. (arXiv:2601.11974)

### Agent EKG Signals (for v1.3.0)

| Signal | Measures | Capture Method |
|---|---|---|
| Token velocity | Throughput | tokens/sec from streaming |
| Latency jitter | Load spikes | variance in inter-token timing |
| Error acceleration | Selection interference | tool failures over sliding window |
| Repetition entropy | Stuck/looping | Shannon entropy of n-gram dist |
| Mode-switching freq | Cognitive interference | reasoning/tool transitions |
| Attentional distance | Memory load | turns between dependent ops |

Performance hits a CLIFF, not a slope. The EKG waveform should compress and spike as cognitive load approaches the model's `k` threshold. (arXiv:2601.20412)

### Subagent Prompt Template
```
You are a {domain_expert} specialist.
This is important — give it your absolute best.

TASK: {specific_task}

APPROACH: Think step by step, 5 words max per step.

DELIVERABLE: Return results in this exact format:
{structured_format}

CONSTRAINTS:
- {constraint_1}
- {constraint_2}
```

---

## Creative Feature Ideas (Future Exploration)

### Agent Personality Profiles
Let users customize agent behavior beyond model selection. A Claude agent could be "Thorough" (tries harder, costs more) or "Quick" (fast responses, less verification). Ollama agents could have temperature/top-p presets tied to named personalities like "Creative Writer" or "Code Reviewer."

### Project Health Score
A composite score per project combining: code quality signals from Claude agent feedback, test pass rates, agent stress history, and time-to-completion trends. Displayed as a badge on the project card. Over time, shows whether a project is getting healthier or accumulating tech debt.

### Agent Memory & Context Carry
Persistent memory per agent that survives across sessions. An Ollama "Code Review" agent remembers your coding conventions. A Claude agent remembers your architecture decisions. Uses embeddings stored in better-sqlite3 for retrieval.

### Workflow Templates
Pre-built multi-agent workflows: "Code Review Pipeline" (Ollama summarizes diff → Claude deep reviews), "Documentation Generator" (Claude reads code → Ollama formats docs), "Bug Triage" (both agents independently analyze, results compared).

### Terminal Multiplexer
Split the terminal view to show multiple agent terminals side by side. See Claude and Ollama working simultaneously on different parts of the same project. Inspired by tmux but integrated into the EveRo UI.

### Smart Notifications
OS-level notifications based on agent state: "Claude finished the refactor", "Ollama model download complete", "Agent 2 might be stuck (stress 85+)". Uses Electron `Notification` API with custom icons and actions.

### Command Palette
Ctrl+K command palette (like VS Code) for quick actions: switch theme, create agent, export conversation, toggle Model Hub, jump to project, search across conversations.

### Conversation Search
Full-text search across all conversation history. Find that code snippet Claude wrote last week. Filter by agent type, date range, project. Powered by better-sqlite3 FTS5.

### Agent Benchmarking
Compare model performance: send the same prompt to Claude and Ollama simultaneously, display results side by side with timing/cost. Helps users choose the right model for each task type.

---

## Verification

Run `node scripts/verify-all.js` — expects **111/111 checks passing**.

Categories:
- Main process: 38 checks (Windows compat, UX, Ollama, paths, rebrand, DM stubs, startup)
- Renderer: 29 checks (Ollama UI, shortcuts, paths, badges, templates, export, rebrand, UI polish)
- Files: 14 checks (all required files exist, old files removed)
- Config: 10 checks (package.json settings)
- Colors: 15 checks (CSS palette values)
- Startup: 5 checks (init order, timeouts, error handling)

---

## Release

Auto-update points to `Evilander/evero` (GitHub provider).

```bash
# Build
node scripts/build-win.js
npx electron-builder --win --x64 --publish never

# Artifacts
dist/EveRo-1.0.92-win-x64.exe       # NSIS installer
dist/EveRo-1.0.92-portable.exe       # Portable executable
dist/win-unpacked/                    # Unpacked app (for testing)

# Release (with auto-update manifest)
npx electron-builder --win --x64 --publish always
# Or manual:
gh release create v1.0.92-win dist/EveRo-1.0.92-win-x64.exe dist/EveRo-1.0.92-portable.exe --repo Evilander/evero
```

## Source Repository

All-in-one: `Evilander/evero` (source on `source` branch, releases on `main` branch)
