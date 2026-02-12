# EveRo v1.0.92+ Complete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform EveRo from a Windows port of roro into the first multi-model AI orchestration desktop app — where users compose teams of AI agents from different providers (Claude Code, Ollama models, future: OpenAI Codex) that collaborate on codebases through channels.

**Architecture:** EveRo is an Electron 39.x app with a minified React 19 renderer and a Node.js main process. Both are patched via string-replacement scripts that run during the build pipeline (`build-win.js` orchestrates, individual `patch-*.js` scripts modify the minified bundles). The app has an Express server on localhost:3067 for hook events, SQLite for project data, and node-pty for terminal sessions. Ollama integration uses HTTP streaming to localhost:11434.

**Tech Stack:** Electron 39.x, React 19, Express 5, better-sqlite3, node-pty, Ollama HTTP API, electron-builder (NSIS + portable)

---

## Phase 1: Model Hub & Build Verification (v1.0.92)

This phase completes what we have — verifies all patches, implements the "Tools" tab as a Model Hub, and produces a releasable build.

---

### Task 1: Verify All Existing Patches

**Files:**
- Read: `roro-win/out/main/index.js` (98KB patched)
- Read: `roro-win/out/renderer/assets/index-BFJPEAID.js` (2.15MB patched)

**Step 1: Run full build pipeline from clean state**

```bash
cd A:\ai\claude\automation\windowscov\roro-win
node scripts/build-win.js
```

Expected: All steps 1-7 complete with no errors. All verification checks PASS.

**Step 2: Verify main process patches**

Write and run a verification script:

```bash
node -e "
const fs=require('fs');
const c=fs.readFileSync('out/main/index.js','utf-8');
const checks=[
  ['notify-app.cmd',/notify-app\\.cmd/],
  ['frame:true',/frame:true/],
  ['sharp-win32-x64',/@img\/sharp-win32-x64/],
  ['USERPROFILE fallback',/USERPROFILE/],
  ['where claude',/where claude/],
  ['wmic process detection',/wmic/],
  ['single-instance lock',/requestSingleInstanceLock/],
  ['evero protocol',/setAsDefaultProtocolClient\(\"evero\"\)/],
  ['auto-launch claude',/_launchConfig/],
  ['OllamaService class',/class OllamaService/],
  ['ollama:list-models IPC',/ollama:list-models/],
  ['ollama:check-status IPC',/ollama:check-status/],
  ['ollama:set-model IPC',/ollama:set-model/],
  ['ollama:pull-model IPC',/ollama:pull-model/],
  ['createAgent ollama dispatch',/n===\"ollama\"\?new OllamaService/],
  ['__normPath helper',/__normPath/],
  ['__normFileMap helper',/__normFileMap/],
  ['EveRo window title',/title:\"EveRo\"/],
  ['evero-dev userData',/evero-dev/],
  ['evero OAuth redirect',/evero:\/\/auth\/callback/],
  ['No remaining roro branding',!c.includes('\"roro\"')]
];
let pass=0,fail=0;
checks.forEach(([name,test])=>{
  const ok=typeof test==='boolean'?test:test.test(c);
  console.log((ok?'PASS':'FAIL')+' - '+name);
  ok?pass++:fail++;
});
console.log('\\n'+pass+'/'+checks.length+' passed');
if(fail)process.exit(1);
"
```

Expected: 21/21 passed.

**Step 3: Verify renderer patches**

```bash
node -e "
const fs=require('fs');
const c=fs.readFileSync('out/renderer/assets/index-BFJPEAID.js','utf-8');
const checks=[
  ['Ollama logo in PH map',/PH=\{claude:zw,codex:jw,ollama:/],
  ['Ollama logo in zY map',/zY=\{claude:zw,codex:jw,ollama:/],
  ['Ollama alt text',/ollama.*Ollama/],
  ['Ctrl+L shortcut',/ctrlKey.*key===\"l\"/],
  ['Ctrl+Backspace shortcut',/ctrlKey.*key===\"Backspace\"/],
  ['Path split regex',/split\(\/\[\/\\\\\\\\\]\/\)/],
  ['Ollama model selector button',/onClick:.*ollama/],
  ['EveRo alt text',/alt:\"EveRo\"/],
  ['EveRo sender',/sender:\"EveRo\"/],
  ['evero_transparent image',/evero_transparent/],
  ['No remaining roro branding (renderer)',!/(^|[^a-zA-Z])roro([^a-zA-Z]|$)/.test(c.replace(/errorOn|mirrorO/g,''))]
];
let pass=0,fail=0;
checks.forEach(([name,test])=>{
  const ok=typeof test==='boolean'?test:test.test(c);
  console.log((ok?'PASS':'FAIL')+' - '+name);
  ok?pass++:fail++;
});
console.log('\\n'+pass+'/'+checks.length+' passed');
"
```

Expected: 11/11 passed.

**Step 4: Commit verification results**

```bash
git add scripts/ docs/
git commit -m "verify: all v1.0.92 patches confirmed passing"
```

---

### Task 2: Implement Model Hub (Tools Tab)

The "Tools" tab currently shows "md" + "Coming soon". We transform it into a **Model Hub** — a live dashboard showing Ollama status, installed models, and model management.

**Files:**
- Create: `roro-win/scripts/patch-model-hub.js`
- Modify: `roro-win/scripts/build-win.js` (add to pipeline)
- Modify: `roro-win/out/main/index.js` (via patch - add `ollama:show-model` IPC handler)
- Modify: `roro-win/out/renderer/assets/index-BFJPEAID.js` (via patch - replace "Coming soon" with Model Hub UI)

**Step 1: Create the Model Hub patch script**

Create `roro-win/scripts/patch-model-hub.js` that patches both main process and renderer:

**Main process additions:**
- `ollama:show-model` IPC handler — calls `http://localhost:11434/api/show` with model name, returns full model details (parameter count, format, family, quantization level, context window, system prompt template, license)
- `ollama:delete-model` IPC handler — calls `http://localhost:11434/api/delete` to remove a model
- `ollama:running-models` IPC handler — calls `http://localhost:11434/api/ps` to get currently loaded models with memory usage

**Renderer replacement:**
Find the "Coming soon" placeholder:
```js
case"dms":return E.jsx("div",{...children:E.jsxs("div",{...E.jsx("h2",{...children:"md"}),E.jsx("p",{...children:"Coming soon"})
```

Replace with a self-contained React component that renders:

```
+------------------------------------------------------+
|  Model Hub                                    [Refresh]|
+------------------------------------------------------+
|  Ollama Status: ● Connected (localhost:11434)         |
|  Running Models: llama3.2 (4.2GB VRAM)               |
+------------------------------------------------------+
|                                                       |
|  Installed Models                                     |
|  ┌─────────────────────────────────────────────────┐ |
|  │ ★ kimi-k2.5          59GB   vision tools think  │ |
|  │   qwen3-coder-next   19GB   tools coding        │ |
|  │   glm-5              24GB   tools thinking       │ |
|  │   deepseek-r1         4GB   reasoning            │ |
|  │   llama3.2            2GB   general              │ |
|  └─────────────────────────────────────────────────┘ |
|                                                       |
|  [Pull New Model: _______________] [Download]         |
|                                                       |
|  Featured Models (click to pull)                      |
|  ┌───────────┐ ┌───────────┐ ┌───────────┐          |
|  │ kimi-k2.5 │ │  glm-5    │ │ qwen3-    │          |
|  │ 59.2K ↓   │ │  7.4K ↓   │ │ coder-next│          |
|  │ Moonshot   │ │  Zhipu    │ │ 66.9K ↓   │          |
|  └───────────┘ └───────────┘ └───────────┘          |
+------------------------------------------------------+
```

The component:
1. On mount, calls `window.electronAPI.ollama.checkStatus()` to get connection state
2. Calls `window.electronAPI.ollama.listModels()` to populate the installed models list
3. Calls `window.electronAPI.ollama.runningModels()` to show active models
4. Each model row shows: name, size, capability badges
5. Click a model → shows detail panel (from `ollama:show-model`)
6. "Pull New Model" input + button triggers `window.electronAPI.ollama.pullModel(name)`
7. Delete button (with confirm) triggers `window.electronAPI.ollama.deleteModel(name)`
8. Featured models section shows curated picks with download counts

**Implementation approach:** Since the renderer is minified React, we inject a self-contained component using `eval()` wrapped in a `React.createElement` call. The component uses inline styles (no CSS injection needed) and calls the existing `window.electronAPI` IPC bridge.

**Step 2: Write the patch script**

```javascript
// patch-model-hub.js - see full implementation below
```

The patch inserts ~200 lines of minified React component code into the renderer's "dms" case handler, replacing the "Coming soon" placeholder. It also adds 3 new IPC handlers to the main process.

**Step 3: Add to build pipeline**

In `build-win.js`, add after the rebrand step:
```javascript
// Step 8: Apply Model Hub (Tools tab)
log('Step 8: Applying Model Hub...');
try {
  require('./patch-model-hub.js');
} catch (e) {
  log('  Model Hub patch error: ' + e.message);
}
```

**Step 4: Run build and verify**

```bash
node scripts/build-win.js
```

Expected: Step 8 shows PASS for all Model Hub verification checks.

**Step 5: Commit**

```bash
git add scripts/patch-model-hub.js scripts/build-win.js
git commit -m "feat: implement Model Hub in Tools tab - live Ollama status, model management, featured models"
```

---

### Task 3: Enhanced Agent Creation Flow

Currently creating an Ollama agent just sets a default model. Enhance the flow so users can pick a specific model during agent creation.

**Files:**
- Create: `roro-win/scripts/patch-agent-model-picker.js`
- Modify: `roro-win/scripts/build-win.js` (add to pipeline)

**Step 1: Analyze the agent creation UI**

The renderer has an agent settings panel with model logo selector buttons (Claude, Codex, Ollama). When "Ollama" is selected as the model logo, we need to show a dropdown of installed Ollama models beneath the selector.

Find the Ollama button we already added in `patch-windows-renderer.js`:
```js
onClick:()=>p("ollama")...children:"Ollama"
```

**Step 2: Write the model picker patch**

After the Ollama button, inject a conditional model dropdown:
- Only visible when `modelLogo === "ollama"`
- Fetches models from `window.electronAPI.ollama.listModels()` on render
- Shows a `<select>` dropdown with installed model names
- Stores selected model in agent metadata via existing IPC

The patch also modifies the agent metadata storage to include `ollamaModel` field, so when an Ollama agent is created, the selected model name flows through to the `OllamaService` constructor.

**Step 3: Add to build pipeline and verify**

```bash
node scripts/build-win.js
```

**Step 4: Commit**

```bash
git add scripts/patch-agent-model-picker.js scripts/build-win.js
git commit -m "feat: model picker dropdown for Ollama agents - select specific model during creation"
```

---

### Task 4: Agent Capability Badges

Show visual badges on agent cards indicating what each model can do.

**Files:**
- Create: `roro-win/scripts/patch-agent-badges.js`
- Modify: `roro-win/scripts/build-win.js`

**Step 1: Define capability badge system**

Badge types (small colored pills on agent cards):
- `THINK` (purple) — models with reasoning/thinking capability
- `CODE` (blue) — models optimized for code generation
- `VISION` (green) — models that accept image input
- `TOOLS` (orange) — models that support function/tool calling
- `CLOUD` (cyan) — models with cloud/API access
- `LOCAL` (gray) — running locally via Ollama

Known model capabilities map:
```javascript
const MODEL_CAPS = {
  'kimi-k2.5': ['THINK','VISION','TOOLS','CLOUD'],
  'glm-5': ['THINK','TOOLS','CLOUD'],
  'qwen3-coder-next': ['CODE','TOOLS','CLOUD'],
  'deepseek-r1': ['THINK','CODE'],
  'llama3.2': ['LOCAL'],
  'minimax-m2.5': ['THINK','TOOLS','CLOUD'],
  'codellama': ['CODE','LOCAL'],
  'claude': ['THINK','CODE','TOOLS','VISION'],
};
```

**Step 2: Patch renderer to show badges**

Find the agent card component in the renderer (the agent list items under "Team" section). After the agent name/emoji, inject small badge pills based on the agent's model type and capabilities.

**Step 3: Commit**

```bash
git add scripts/patch-agent-badges.js scripts/build-win.js
git commit -m "feat: capability badges on agent cards - THINK, CODE, VISION, TOOLS indicators"
```

---

### Task 5: Smart Agent Templates

Pre-configured agent team templates that users can deploy with one click.

**Files:**
- Create: `roro-win/scripts/patch-agent-templates.js`
- Modify: `roro-win/scripts/build-win.js`

**Step 1: Define templates**

Templates are pre-built team configurations:

```javascript
const TEMPLATES = [
  {
    name: "Solo Coder",
    description: "Claude Code in a terminal — the classic setup",
    agents: [
      { name: "Claude", type: "terminal", modelLogo: "claude", emoji: "🤖" }
    ]
  },
  {
    name: "Code Review Team",
    description: "Claude builds, DeepSeek reviews with chain-of-thought reasoning",
    agents: [
      { name: "Builder", type: "terminal", modelLogo: "claude", emoji: "🏗️" },
      { name: "Reviewer", type: "ollama", modelLogo: "ollama", emoji: "🔍", model: "deepseek-r1" }
    ]
  },
  {
    name: "Research & Build",
    description: "Kimi K2.5 researches and reasons, Claude implements",
    agents: [
      { name: "Researcher", type: "ollama", modelLogo: "ollama", emoji: "📚", model: "kimi-k2.5" },
      { name: "Implementer", type: "terminal", modelLogo: "claude", emoji: "⚡" }
    ]
  },
  {
    name: "Full Stack",
    description: "Qwen for frontend code, Claude for backend, GLM-5 for architecture",
    agents: [
      { name: "Frontend", type: "ollama", modelLogo: "ollama", emoji: "🎨", model: "qwen3-coder-next" },
      { name: "Backend", type: "terminal", modelLogo: "claude", emoji: "⚙️" },
      { name: "Architect", type: "ollama", modelLogo: "ollama", emoji: "🏛️", model: "glm-5" }
    ]
  },
  {
    name: "Cost-Efficient Team",
    description: "All local Ollama models — zero API costs",
    agents: [
      { name: "Coder", type: "ollama", modelLogo: "ollama", emoji: "💻", model: "qwen3-coder-next" },
      { name: "Thinker", type: "ollama", modelLogo: "ollama", emoji: "🧠", model: "deepseek-r1" }
    ]
  }
];
```

**Step 2: Patch renderer**

Add a "Templates" section to the Garage view, shown when a project has no agents yet (empty state). Shows template cards with name, description, and agent preview. Clicking "Use Template" creates all agents from the template definition.

Also accessible via a `[+ Template]` button next to the existing agent creation button.

**Step 3: Patch main process**

Add `agent:create-from-template` IPC handler that:
1. Accepts a template definition
2. Creates each agent in sequence
3. For Ollama agents, verifies the model is installed (falls back to listing available models)
4. Returns created agent IDs

**Step 4: Commit**

```bash
git add scripts/patch-agent-templates.js scripts/build-win.js
git commit -m "feat: smart agent templates - one-click team deployment with curated presets"
```

---

### Task 6: Conversation Export

Allow users to export agent conversations as markdown files.

**Files:**
- Create: `roro-win/scripts/patch-conversation-export.js`
- Modify: `roro-win/scripts/build-win.js`

**Step 1: Add IPC handler**

In main process, add `conversation:export` handler that:
1. Receives agent ID and format ("markdown" or "json")
2. Gets conversation messages from OllamaService or terminal session
3. Formats as markdown with timestamps, model name, message content
4. Shows save dialog via `electron.dialog.showSaveDialog()`
5. Writes file to chosen location

**Step 2: Add UI trigger**

In renderer, add "Export" button to the agent context menu (right-click on agent in Team list). Also add it to the agent settings panel.

**Step 3: Commit**

```bash
git add scripts/patch-conversation-export.js scripts/build-win.js
git commit -m "feat: conversation export - save agent chats as markdown or JSON"
```

---

### Task 7: Build & Package

**Files:**
- Read: `roro-win/package.json`
- Read: `roro-win/out/main/index.js`

**Step 1: Ensure node_modules are current**

```bash
cd A:\ai\claude\automation\windowscov\roro-win
npm install
```

Expected: All dependencies installed, native modules resolved.

**Step 2: Rebuild native modules for Electron**

```bash
npx @electron/rebuild --only better-sqlite3 --electron-version 39.5.2
```

Expected: better-sqlite3 rebuilt successfully for Electron 39.x.

**Step 3: Build Windows installer**

```bash
npx electron-builder --win --x64 --publish never
```

Expected:
- `dist/EveRo-1.0.92-win-x64.exe` (NSIS installer)
- `dist/EveRo-1.0.92-portable.exe` (portable)
- `dist/win-unpacked/` (unpacked for testing)

**Step 4: Test the built app**

Launch `dist/win-unpacked/EveRo.exe` and verify:
1. Window opens with title "EveRo"
2. Single-instance lock works (try opening again)
3. Create a project pointing to any code directory
4. Create a terminal agent → Claude Code auto-launches
5. Create an Ollama agent → Chat view appears, model picker shows
6. Tools tab shows Model Hub (if Ollama is running)
7. Ctrl+L toggles file viewer
8. File map shows correct filenames (forward slashes work)
9. Agent cards show capability badges
10. Template selector appears for new projects

**Step 5: Commit build artifacts config**

```bash
git add -A
git commit -m "build: EveRo v1.0.92 verified and packaged"
```

---

### Task 8: GitHub Release

**Step 1: Create the evero-releases repo**

```bash
gh repo create Evilander/evero-releases --public --description "EveRo - Multi-model AI orchestration for your codebase"
```

**Step 2: Create release**

```bash
gh release create v1.0.92-win \
  "dist/EveRo-1.0.92-win-x64.exe" \
  "dist/EveRo-1.0.92-portable.exe" \
  --repo Evilander/evero-releases \
  --title "EveRo v1.0.92 - Multi-Model AI Orchestration" \
  --notes "$(cat <<'EOF'
## EveRo v1.0.92 - First Multi-Model Release

EveRo is a multi-model AI orchestration desktop app for Windows. Build teams of AI agents from different providers that collaborate on your codebase.

### What's New
- **Multi-Model Support**: Create agents powered by Claude Code, Ollama (Kimi K2.5, GLM-5, DeepSeek-R1, Qwen3, and any Ollama model), or OpenAI Codex
- **Model Hub**: Live Ollama dashboard with model management, status monitoring, and featured models
- **Smart Templates**: One-click team deployment - "Code Review Team", "Research & Build", "Full Stack", "Cost-Efficient Team"
- **Capability Badges**: Visual indicators showing what each model can do (THINK, CODE, VISION, TOOLS)
- **Agent Model Picker**: Choose specific Ollama models when creating agents
- **Conversation Export**: Save agent chats as markdown
- **Windows Fixes**: Ctrl+L/Ctrl+Backspace shortcuts, proper path handling, single-instance lock

### Requirements
- Windows 10/11 x64
- [Ollama](https://ollama.com) (optional, for local models)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (optional, for Claude agents)

### Downloads
- **EveRo-1.0.92-win-x64.exe** - Windows installer
- **EveRo-1.0.92-portable.exe** - Portable (no install needed)
EOF
)"
```

**Step 3: Verify auto-update configuration**

Ensure `resources/app-update.yml` points to `Evilander/evero-releases` (already done in rebrand).

**Step 4: Commit**

```bash
git commit --allow-empty -m "release: EveRo v1.0.92 published to Evilander/evero-releases"
```

---

## Phase 2: Widget Dashboard & Agent EKG (v1.1.0)

### Task 9: Widget System Architecture

Transform the sidebar/dashboard into a widget-enabled layout. Widgets are self-contained React components that can be placed in a grid layout within the Tools tab or a dedicated "Dashboard" view.

**Widget framework:**
- Each widget is a card with title bar, minimize/maximize, and optional refresh
- Widgets persist their state and position to SQLite
- Grid layout with drag-to-reorder (leverages existing @dnd-kit already in dependencies)
- Widgets can be toggled on/off from settings

### Task 10: Core Widgets

**Model Hub Widget** (already planned in Task 2 — becomes a widget card)
- Ollama status, installed models, pull new models

**PC Performance Widget**
- CPU usage, RAM usage, GPU usage (VRAM), disk I/O
- Implementation: Node.js `os.cpus()`, `os.totalmem()/freemem()`, optional `nvidia-smi` parsing for GPU
- Mini sparkline charts updated every 2 seconds
- Especially useful for monitoring VRAM when running Ollama models

**Quick Launch Widget**
- Configurable grid of app launch buttons: Chrome, Firefox, VS Code, Explorer, Terminal
- Implementation: `electron.shell.openExternal()` for URLs, `child_process.exec()` for apps
- User can add custom entries (name, icon, path/URL)

**Weather Widget**
- Current conditions + 3-day forecast
- Uses free API (wttr.in or OpenWeatherMap free tier)
- Location auto-detected or user-configured
- Minimal, elegant design — temperature, icon, humidity

**Music Widget (Spotify/YouTube)**
- Spotify: Shows currently playing track via Spotify Web API (requires user OAuth)
- YouTube Music: Embedded mini-player or now-playing display
- Play/pause/skip controls
- Implementation: Spotify Web Playback SDK or REST API; YouTube via IFrame API

**Clock/Timer Widget**
- Current time, world clock for team collaboration
- Pomodoro timer for focused work sessions
- Timer alerts when agents complete long tasks

### Task 11: Agent EKG — Heartbeat Monitor

**This is EveRo's signature feature.** A real-time "heartbeat" visualization for each AI agent, showing their operational health as an EKG waveform.

**Files:**
- Create: `roro-win/scripts/patch-agent-ekg.js`

**11a: Telemetry Collection (Main Process)**

Instrument both OllamaService and terminal agents to emit telemetry:

```javascript
// Telemetry event structure
{
  agentId: string,
  timestamp: number,
  metrics: {
    responseTimeMs: number,      // How long the last response took
    tokenRate: number,           // Tokens/second (from Ollama final chunk stats)
    errorCount: number,          // Errors in sliding window
    retryCount: number,          // Retries in sliding window
    idleSeconds: number,         // Seconds since last activity
    toolCallFailures: number,    // Failed tool invocations
    contextUsagePercent: number, // How full the context window is
    loopScore: number,           // Similarity to recent queries (0-1)
  }
}
```

**For Ollama agents:** Extract timing from final streaming chunk (`total_duration`, `eval_count`, `eval_duration` — all in nanoseconds). Calculate `tokens_per_second = eval_count / eval_duration * 1e9`. Track errors from HTTP failures. Detect loops by comparing last N message embeddings.

**For terminal agents:** Parse Claude Code hook events (`tool_use`, `tool_result`, `tool_failure`, `thinking_start`, `thinking_end`). Count failures. Measure time between events. Detect loops from repeated similar tool calls.

**11b: Stress Score Algorithm**

```javascript
function computeStressScore(metrics) {
  let stress = 0;

  // High response time = thinking hard (moderate stress)
  if (metrics.responseTimeMs > 10000) stress += 20;
  else if (metrics.responseTimeMs > 5000) stress += 10;

  // Errors = something wrong (high stress)
  stress += Math.min(metrics.errorCount * 15, 45);

  // Retries = struggling (high stress)
  stress += Math.min(metrics.retryCount * 10, 30);

  // Loop detection = stuck (critical stress)
  stress += metrics.loopScore * 40;

  // Tool failures = blocked (moderate stress)
  stress += Math.min(metrics.toolCallFailures * 12, 36);

  // Context nearly full = running out of room
  if (metrics.contextUsagePercent > 90) stress += 25;
  else if (metrics.contextUsagePercent > 75) stress += 10;

  // Idle = flatline (negative stress → calm)
  if (metrics.idleSeconds > 30) stress = Math.max(0, stress - 20);

  return Math.min(100, Math.max(0, stress));
}
```

Stress ranges:
- **0-20**: Green — healthy, productive rhythm
- **21-50**: Yellow — elevated, working hard
- **51-75**: Orange — stressed, may need attention
- **76-100**: Red — critical, likely stuck or in error loop

**11c: EKG Waveform Rendering (Renderer)**

An SVG path animated at 60fps that mimics an ECG waveform:

```
    ╱╲
───╱  ╲───╱╲────  (normal rhythm, green)
        ╲╱

   ╱╲  ╱╲  ╱╲
──╱  ╲╱  ╲╱  ╲──  (elevated, faster peaks, yellow)

  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲  (critical, rapid irregular, red)

  ─────────────────  (flatline, gray — idle)
```

- **Amplitude** = stress level (higher peaks = more stressed)
- **Frequency** = activity rate (more peaks/sec = more active)
- **Color** = stress zone (green → yellow → orange → red)
- **Flatline** = idle (gray, flat line with occasional tiny blip)

Implementation: SVG `<path>` element with `d` attribute updated via requestAnimationFrame. Path points generated from a circular buffer of stress scores sampled at 1Hz. CSS transitions for color changes. Each agent gets its own EKG strip.

**11d: Team Vitals Dashboard**

A dedicated view showing all agents' EKGs side by side:

```
┌──────────────────────────────────────────┐
│  Team Vitals                    [Pause]  │
├──────────────────────────────────────────┤
│  🏗️ Builder (Claude)     ♥ 72bpm  🟢    │
│  ───╱╲───╱╲───╱╲───╱╲───╱╲───╱╲──    │
│                                          │
│  🔍 Reviewer (DeepSeek-R1)  ♥ 45bpm 🟡  │
│  ──╱╲──────╱╲──────╱╲──────╱╲────    │
│                                          │
│  🏛️ Architect (GLM-5)   ♥ 12bpm  ⚪    │
│  ────────────────────────────────────    │
│                                          │
│  Overall: 🟢 Team healthy               │
│  Active: 2/3  |  Avg stress: 28%        │
└──────────────────────────────────────────┘
```

**11e: Autonomous Response System**

When the main orchestrator detects anomalies:

| Condition | Detection | Response |
|-----------|-----------|----------|
| Agent stuck (stress > 80 for > 60s) | Sustained high stress | Show notification: "Agent X appears stuck. Suggest: reset context / change approach / delegate to another agent" |
| Agent idle (flatline > 5 min) | No activity | If pending tasks exist, route one to the idle agent |
| Agent looping (loopScore > 0.8) | Similar queries repeated | Auto-pause agent, show "Agent X may be in a loop" warning |
| Context exhaustion (> 95%) | Context usage metric | Suggest context compaction or starting new session |

### Task 12: Cross-Agent Context Sharing

Agents in the same project share a context bus. When one agent learns something about the codebase (discovers a file, understands a pattern), it publishes to the bus. Other agents can subscribe.

**Implementation:** Add a `ProjectContextBus` class to main process that:
- Stores key-value context entries per project
- Broadcasts context updates via IPC to all agent views
- Persists context to SQLite between sessions

### Task 13: Agent-to-Agent Delegation

An agent can hand off a subtask to another agent in the same project. Example: the "Architect" agent can say "have the Frontend agent implement this component" and it routes automatically.

**Implementation:** Add delegation IPC handler. When an Ollama agent's response contains `@AgentName: <task>`, parse it and route to the target agent as a new message.

### Task 14: Workflow Pipelines

Define multi-step workflows: "Research -> Plan -> Implement -> Review -> Commit". Each step maps to an agent. Pipeline progress is shown in a visual timeline.

**Implementation:** Add pipeline definition UI to project settings. Store pipeline configs in SQLite. Execute steps sequentially, passing output of one agent as input to the next.

---

## Ollama API Reference (for implementation)

Key endpoints used by EveRo:

| Endpoint | Method | Purpose | EveRo Feature |
|----------|--------|---------|---------------|
| `/api/chat` | POST | Streaming chat completion | OllamaService core |
| `/api/tags` | GET | List installed models | Model Hub, agent picker |
| `/api/show` | POST | Model details + **capabilities array** | Capability badges, Model Hub details |
| `/api/pull` | POST | Download model (streaming progress) | Model Hub download |
| `/api/delete` | DELETE | Remove model | Model Hub management |
| `/api/ps` | GET | Running models + VRAM usage | Model Hub status, PC widget |
| `/api/version` | GET | Server version | Model Hub status |

**Critical discovery:** `/api/show` returns a `capabilities` array with values like `["completion", "vision", "tools", "thinking", "embedding"]`. This replaces our hardcoded capability map — we can auto-detect what each model supports.

**Streaming stats:** Every final chat chunk includes `eval_count`, `eval_duration` (nanoseconds), `total_duration`, `load_duration`, `prompt_eval_count`, `prompt_eval_duration`. This feeds directly into the EKG telemetry and performance dashboard.

**Tool calling format:** Models with `"tools"` capability accept a `tools` array in the chat request with OpenAI-compatible function definitions. Responses include `tool_calls` in the message. Best practice: use `stream: false` when tools are provided for reliable behavior.

---

## Critical Files Reference

| File | Role | Size |
|------|------|------|
| `out/main/index.js` | Patched main process | ~99KB |
| `out/renderer/assets/index-BFJPEAID.js` | Patched React renderer | ~2.15MB |
| `scripts/build-win.js` | Build orchestrator (Steps 1-8+) | ~200 lines |
| `scripts/patch-ollama-integration.js` | OllamaService + IPC handlers | ~250 lines |
| `scripts/patch-windows-renderer.js` | Renderer fixes + Ollama UI | ~200 lines |
| `scripts/patch-path-normalization.js` | Windows path normalization | ~140 lines |
| `scripts/patch-rebrand.js` | roro → EveRo rebrand | ~200 lines |
| `scripts/patch-model-hub.js` | **NEW** - Model Hub (Tools tab) | ~300 lines |
| `scripts/patch-agent-model-picker.js` | **NEW** - Model picker dropdown | ~150 lines |
| `scripts/patch-agent-badges.js` | **NEW** - Capability badges | ~150 lines |
| `scripts/patch-agent-templates.js` | **NEW** - Smart templates | ~250 lines |
| `scripts/patch-conversation-export.js` | **NEW** - Chat export | ~100 lines |
| `scripts/patch-windows-improvements.js` | v1.0.91 UX patches | ~180 lines |
| `scripts/patch-process-detection.js` | ps/pgrep → wmic | ~80 lines |
| `package.json` | EveRo electron-builder config | ~130 lines |
| `resources/app-update.yml` | Points to Evilander/evero-releases | 5 lines |

## Patch Execution Order

```
build-win.js orchestrates:
  Step 1: Copy from mac source
  Step 2: Base Windows compat patches (inline in build-win.js)
  Step 3: npm install note
  Step 4: Copy resources
  Step 5: patch-process-detection.js + patch-windows-improvements.js
  Step 6: patch-ollama-integration.js + patch-windows-renderer.js + patch-path-normalization.js
  Step 7: patch-rebrand.js
  Step 8: patch-model-hub.js                    ← NEW
  Step 9: patch-agent-model-picker.js           ← NEW
  Step 10: patch-agent-badges.js                ← NEW
  Step 11: patch-agent-templates.js             ← NEW
  Step 12: patch-conversation-export.js         ← NEW
```

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Renderer string replacement hits wrong occurrence | Broken UI | Use unique multi-char context strings, verify with PASS/FAIL checks |
| Model Hub component too large for inline injection | Build fails | Minify the component, use separate injected `<script>` tag if needed |
| Ollama not installed | Empty Model Hub | Show "Install Ollama" CTA with download link |
| Template model not installed | Template fails | Check model availability, prompt to pull missing models |
| electron-builder fails on native modules | No build output | Use `npmRebuild: false`, manual `@electron/rebuild --only better-sqlite3` |
| Minified variable names shift between patches | Cascading failures | Each patch re-reads the file, uses unique anchor patterns, verifies |
