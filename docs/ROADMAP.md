# EveRo Roadmap — From Port to Product

> "Your Ideas, My Analysis" — This document represents the combined vision.
> Last updated: 2026-02-12

---

## The Thesis

EveRo started as a Windows port of roro. With v1.0.92, it became a multi-model AI agent platform. The next phases transform it into something that doesn't exist yet: **a real-time AI mission control center** — where you don't just chat with agents, you *feel* them working.

The EKG is the signature. The widgets make it a command center. The palette system makes it beautiful. The intelligence layer makes it alive. Together, they make EveRo the first AI tool that treats agents like living things with vital signs, not chat windows with spinners.

---

## Phase 1: Palette System (v1.1.0)

### Why First
Low complexity, high visual impact, instant user delight. Makes every screenshot shareable. Builds the foundation for all future theming.

### What
A palette selector in Settings that swaps the entire UI theme in one click. Ships with 12-15 curated presets from real design systems, plus a custom palette creator.

### Curated Presets (mapped to EveRo CSS vars)

**Dark themes (primary):**

| Name | Source | BG | Surface | Text | Accent | Vibe |
|------|--------|----|---------|----- |--------|------|
| Midnight Blush | Happy Hues #12 | #232946 | #1e2440 | #fffffe | #eebbc3 | Current default — navy/pink |
| Cyberpunk | Happy Hues #4 | #16161a | #242629 | #fffffe | #7f5af0 | Dark purple neon |
| Neon Ember | Happy Hues #13 | #0f0e17 | #1a1926 | #fffffe | #ff8906 | Black/orange fire |
| Deep Teal | Happy Hues #10 | #004643 | #001e1d | #fffffe | #f9bc60 | Forest/amber |
| Mocha | Happy Hues #16 | #271c19 | #55423d | #fffffe | #e78fb3 | Warm brown/pink |
| Catppuccin Mocha | Catppuccin | #1e1e2e | #313244 | #cdd6f4 | #89b4fa | Community favorite |
| Catppuccin Frappe | Catppuccin | #303446 | #414559 | #c6d0f5 | #8caaee | Muted dark blue |
| Rose Pine | Rosé Pine | #191724 | #1f1d2e | #e0def4 | #c4a7e7 | Purple haze |
| Rose Pine Moon | Rosé Pine | #232136 | #2a273f | #e0def4 | #c4a7e7 | Lighter purple |
| Nord | Nord | #2e3440 | #3b4252 | #d8dee9 | #88c0d0 | Arctic blue |
| Dracula | Dracula | #282a36 | #44475a | #f8f8f2 | #bd93f9 | Classic dev purple |

**Light themes (future, but ship structure now):**

| Name | Source | BG | Surface | Text | Accent |
|------|--------|----|---------|----- |--------|
| Rose Pine Dawn | Rosé Pine | #faf4ed | #fffaf3 | #464261 | #907aa9 |
| Catppuccin Latte | Catppuccin | #eff1f5 | #e6e9ef | #4c4f69 | #1e66f5 |
| Soft Rose | Happy Hues #15 | #faeee7 | #fffffe | #33272a | #ff8ba7 |
| Retro Navy | Happy Hues #17 | #fef6e4 | #f3d2c1 | #001858 | #f582ae |

### Implementation Architecture

**Storage**: Palette preference stored in `electron-store` (JSON in appData), loaded at startup.

**CSS var override**: At app launch, main process sends stored palette to renderer via IPC. Renderer injects a `<style>` element that overrides `:root` CSS custom properties. Zero bundle patching needed for runtime switching.

**Custom palette creator**: A settings panel with color pickers for each role. Uses the 10-role minimum schema:
```
background, surface, text, textMuted, textTertiary, primary, primaryLight, hover, inputBg, border
```

**Palette file format** (JSON, storable/shareable):
```json
{
  "name": "My Custom",
  "type": "dark",
  "colors": {
    "dark-bg": "#232946", "dark-surface": "#1e2440",
    "dark-text-primary": "#fffffe", "dark-text-secondary": "#b8c1ec",
    "dark-text-tertiary": "#8892b8", "primary-300": "#eebbc3",
    "primary-500": "#d4899a", "dark-hover": "#303767",
    "dark-input-bg": "#1a1f3d", "dark-border": "#2a3157"
  }
}
```

### Patch Scripts Needed
- `patch-palette-system.js` — Main: IPC handlers (`palette:get`, `palette:set`, `palette:list`, `palette:export`, `palette:import`). Preload: bridge. Renderer: settings UI + runtime style injection.
- Modify `patch-color-palette.js` to set the *default* palette but keep the system flexible.

### Key Sources
- **Happy Hues JSON data**: https://github.com/meodai/happyHuesColors (MIT license)
- **Catppuccin npm**: `@catppuccin/palette` (MIT)
- **Rosé Pine npm**: `@rose-pine/palette` (MIT)
- **Realtime Colors**: https://realtimecolors.com (for custom palette validation)

---

## Phase 2: Widget Dashboard (v1.2.0)

### Why
Transforms EveRo from "AI coding tool" into "developer command center." The Tools tab becomes a living dashboard. This is what makes users keep EveRo open all day, not just when coding.

### Widget Architecture

**Layout**: Pure CSS Grid (no library dependency — critical for injection approach):
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
grid-auto-rows: minmax(200px, auto);
gap: 16px;
```

**Card aesthetic**: Glassmorphism matching the palette:
```css
background: rgba(var(--surface-rgb), 0.85);
backdrop-filter: blur(12px);
border: 1px solid rgba(var(--text-rgb), 0.1);
border-radius: 12px;
box-shadow: 0 2px 4px rgba(0,0,0,0.1), 0 8px 24px rgba(0,0,0,0.2);
```

**Each widget**: Self-contained IIFE component (proven pattern from agent-badges, model-hub patches). Own state, own data fetching, own rendering.

### Widgets to Ship

#### 1. System Performance (Priority: HIGH)
**Package**: `systeminformation` (npm, 964 dependents, pure Node.js)
**Data**:
- `si.currentLoad()` → CPU % per core
- `si.mem()` → RAM used/total/available
- `si.graphics()` → GPU name, temp, VRAM, utilization
- `si.networkStats()` → rx/tx bytes/sec
- `si.fsSize()` → disk usage

**Display**: Circular SVG arc gauges for CPU/RAM, sparkline for history (ring buffer of last 60 samples at 1Hz), color-coded thresholds (green <60%, yellow 60-80%, red >80%).

**Why it matters for EveRo**: Users running Ollama need to see VRAM usage. Users running multiple Claude agents need to see CPU/RAM impact. This directly serves the AI workflow.

#### 2. AI Token Usage & Cost (Priority: HIGH)
**Data source**: Claude Code writes usage data to `~/.claude/usage/`. Parse daily/session logs.
**API**: `GET /v1/organizations/usage_report/messages` for API-level tracking.
**Display**: Large "today's spend" number, token breakdown bar (input/output/cached), burn rate sparkline, per-model pie chart (Opus/Sonnet/Haiku), budget alert threshold.

**Why it matters**: Every developer using Claude Code worries about cost. Making it visible and ambient removes anxiety. Budget alerts prevent bill shock.

#### 3. Weather (Priority: MEDIUM)
**API**: Open-Meteo (free, no key, no registration)
**Endpoint**: `https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&current=temperature_2m,weathercode,windspeed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode`
**Display**: Current temp (large), weather icon (animated SVG mapped from weather code), 5-day forecast row. Glassmorphism card with subtle gradient matching weather condition.
**Geolocation**: Use browser `navigator.geolocation` or IP-based fallback.

#### 4. Quick Launch (Priority: MEDIUM)
**Mechanism**: `shell.openPath()` (Electron built-in)
**Defaults**: VS Code, Terminal, File Explorer, Browser, Claude Code, Ollama
**Customizable**: User adds/removes apps via drag-drop or file picker
**Display**: 4x2 grid of rounded icon buttons with hover glow.

#### 5. Spotify Now Playing (Priority: LOW — requires Premium)
**Note**: As of Feb 2026, Spotify Dev Mode requires Premium account + limits to 5 test users. Extended access requires registered business with 250K MAU.
**If available**: OAuth2 flow, poll `GET /v1/me/player/currently-playing` every 5-10s, show album art + track + artist + progress bar + controls.
**Alternative**: Windows media session integration for any player (more universal).

#### 6. Project Activity Feed (Priority: HIGH — EveRo-native)
**Data**: Already available from the Express server on localhost:3067. Agent messages, file changes, hook events.
**Display**: Live scrolling feed of agent activity across all agents in the project. Each line: timestamp + agent name + action. Color-coded by agent type.

**This widget is uniquely EveRo's.** No other AI tool shows a unified activity feed across multiple agents.

### Injection Approach
- Add "Dashboard" tab alongside existing tabs in the renderer navigation
- Route it to a new case in the tab switch
- Inject full dashboard component as IIFE string
- Main process: Add IPC handlers with `dashboard:` prefix
- Preload: Add `dashboard` namespace to bridge
- New dependency: `npm install systeminformation`

### Patch Script
- `patch-dashboard-widgets.js` (main + preload + renderer, ~400 lines)

---

## Phase 3: Agent EKG / Health Monitor (v1.3.0)

### Why This Is the Feature That Makes EveRo Famous

**Nobody in the AI tooling space is doing this.** Research confirms:
- LangSmith, Braintrust, W&B Weave, Datadog, Langfuse, Helicone, AgentOps — all use retrospective analytics dashboards (Grafana paradigm)
- No tool provides continuous animated visualization of agent health
- No tool computes a real-time "stress score" from composite telemetry
- No tool does predictive failure detection (only reactive loop detection)

**The medical monitor metaphor is powerful because it works on pattern recognition.** Doctors don't read numbers — they glance at waveforms and immediately know. Developers will do the same. Green rhythm = healthy. Erratic = struggling. Flatline = idle. Red spikes = failing.

**Academic grounding**: "Beyond Accuracy: A Cognitive Load Framework" (arXiv:2601.20412, Jan 2026) demonstrates that agent "stress" is measurable and predictable. Performance cliffs correlate with Intrinsic Load (task complexity) and Extraneous Load (ambiguity). We can implement this in real-time.

### Architecture

```
TELEMETRY COLLECTION (Main Process)
├── OllamaService instrumentation
│   ├── Response latency (ms per chunk)
│   ├── Token velocity (tokens/sec)
│   ├── Error events (HTTP errors, parse failures)
│   └── Message count / session depth
│
├── Terminal agent instrumentation (Claude Code)
│   ├── Hook event timing (notify-app.cmd calls)
│   ├── Terminal output rate (chars/sec from node-pty)
│   ├── Tool call frequency (detected from output patterns)
│   └── Idle detection (no output for N seconds)
│
└── Common metrics
    ├── Activity timestamp (last event)
    ├── Conversation depth (messages sent)
    └── File change rate (from file-map updates)

SIGNAL PROCESSING (Main Process, 100ms tick)
├── Ring buffer (last 600 samples = 60 seconds)
├── Rolling metrics computation
│   ├── Token velocity (smoothed, 5-sample window)
│   ├── Latency jitter (std deviation of recent latencies)
│   ├── Error acceleration (d(errors)/dt)
│   ├── Repetition entropy (hash similarity of recent outputs)
│   └── Tool call rhythm (regularity of call intervals)
│
├── Composite Stress Score (0-100)
│   ├── 0-20: Idle (no recent activity)
│   ├── 20-40: Calm (steady, regular rhythm)
│   ├── 40-60: Active (working normally)
│   ├── 60-80: Elevated (high token burn, some errors)
│   └── 80-100: Critical (stuck/looping, errors accelerating)
│
├── Anomaly Detection
│   ├── Loop detection: hash(recent_outputs) similarity > 0.8
│   ├── Stuck detection: no progress for 30s despite activity
│   ├── Context exhaustion: token count approaching model limit
│   └── Cascade failure: multiple agents entering elevated simultaneously
│
└── Predictive Signals (the breakthrough)
    ├── Pre-loop: repetition entropy rising but not yet looping
    ├── Pre-stuck: latency increasing + output novelty decreasing
    └── Pre-crash: error rate accelerating (exponential fit)

IPC BRIDGE (30 Hz push from main to renderer)
├── webContents.send('telemetry:sample', Float32Array)
└── Minimal payload: [stressScore, tokenVelocity, latency, errorRate, loopRisk] per agent

VISUALIZATION (Renderer, 60fps Canvas 2D)
├── Waveform Generator
│   ├── Stress score → waveform morphology
│   │   ├── Idle: flat line with occasional blip
│   │   ├── Calm: gentle sine wave, regular period
│   │   ├── Active: higher amplitude, faster period
│   │   ├── Elevated: irregular peaks, occasional spikes
│   │   └── Critical: chaotic, high-frequency oscillation
│   ├── Ring buffer of 300 samples (10 seconds at 30Hz)
│   └── Cubic interpolation for smooth curves
│
├── Canvas Renderer (requestAnimationFrame)
│   ├── Phosphor persistence: rgba(bg, 0.08) fill each frame
│   ├── Grid lines: subtle accent color at 10% opacity
│   ├── Waveform: 2px stroke with shadowBlur glow
│   ├── Sweep line: bright leading edge (current position)
│   └── Color mapping: green (#10b981) → yellow (#f9bc60) → red (#ef4565)
│
└── Display Modes
    ├── Inline: mini waveform in agent sidebar card (40x20px)
    ├── Header: waveform strip in chat header (full width x 30px)
    ├── Dashboard: full EKG panel with all agents (widget)
    └── Mission Control: dedicated full-screen view
```

### Waveform Morphology Algorithm

The key insight: we're not plotting raw metrics. We're generating a **synthetic waveform** whose *shape* encodes the agent's state. Like how a doctor reads an EKG — the P wave, QRS complex, and T wave each mean something different.

```
Stress 0-20 (Idle):
  Mostly flat. Occasional small bump when background process checks status.
  Period: ~2 seconds. Amplitude: 0.05

Stress 20-40 (Calm):
  Gentle sine-like wave. Regular and predictable.
  Each "beat" = a message/tool cycle completing normally.
  Period: ~1 second. Amplitude: 0.2

Stress 40-60 (Active):
  Higher amplitude. Occasional sharp peaks (tool calls completing).
  Visible "work rhythm" — spikes cluster when agent is processing, flatten between.
  Period: variable. Amplitude: 0.4-0.6

Stress 60-80 (Elevated):
  Irregular rhythm. Some beats taller than others.
  Occasional double-peaks (retries). Baseline shifts up (sustained tension).
  Period: unstable. Amplitude: 0.6-0.8

Stress 80-100 (Critical):
  Fibrillation-like: high-frequency noise overlaid on irregular peaks.
  No clear rhythm. Amplitude near max.
  This is the visual alarm — anyone glancing at it knows something is wrong.
```

### Predictive Auto-Actions (the intelligence layer seeds)

When stress exceeds thresholds:
- **70+**: Yellow border glow on agent card. Tooltip: "Agent under load"
- **85+**: Red pulse animation. Notification: "Agent may be stuck"
- **95+ for 10s**: Auto-pause suggestion. "Agent appears to be looping. Pause and review?"
- **Flatline for 60s**: "Agent idle. Route pending tasks?" (future: auto-route)

### Implementation

**Canvas approach** (recommended over SVG for continuous animation):
- Canvas 2D with `requestAnimationFrame` at 60fps
- Ring buffer of 300 Float32 samples
- Phosphor persistence effect: `ctx.fillStyle = 'rgba(bg, 0.08)'` each frame
- Glow via `ctx.shadowBlur = 4; ctx.shadowColor = lineColor`
- Grid lines at 10% accent opacity for medical-grade aesthetic

**SVG fallback** for the mini inline version (agent sidebar card):
- `<path d={...}>` recalculated at 10Hz (lower frequency OK for small display)
- `<filter id="glow"><feGaussianBlur>` for glow effect

### Patch Scripts
- `patch-agent-telemetry.js` — Main: instrument OllamaService + terminal agent, add ring buffer, stress computation, IPC streaming
- `patch-agent-ekg.js` — Preload: telemetry bridge. Renderer: Canvas EKG component, sidebar mini-EKG, dashboard full EKG widget

### Key References
- "Cognitive Load Framework for Tool-use Agents" (arXiv:2601.20412)
- AuraGuard loop detection (github.com/auraguardhq/aura-guard)
- webgl-plot for high-performance rendering if needed
- svg-electrocardiogram (github.com/evandrewry/svg-electrocardiogram) for path shapes

---

## Phase 4: Intelligence Layer (v2.0.0)

### Why
This is where EveRo stops being a tool and becomes an **orchestrator**. The EKG gives it eyes. The intelligence layer gives it a brain.

### 4a. Agent Collaboration Protocol

Agents that can delegate tasks to each other:
- Claude agent (expensive, powerful) handles complex reasoning
- Ollama agent (free, fast) handles quick lookups, summaries, boilerplate
- The orchestrator routes based on health/load/capability

**Implementation**: A `TaskRouter` in main process that:
1. Receives task from user
2. Evaluates which agent is best suited (by type, current load, capability badges)
3. Routes to agent
4. If agent stress exceeds threshold, re-routes to another
5. Aggregates results back to user

### 4b. Session Replay

Record and replay agent work:
- Every IPC message timestamped and logged to a session file
- Replay UI: timeline scrubber, playback speed control, event markers
- Share sessions with team members (export as .evero file)
- Debug failures by rewinding to the moment before

**Why this matters**: When an agent fails at 3 AM, you can replay the session the next morning and see exactly what happened. No other AI tool offers this.

### 4c. Agent-to-Agent Communication

Not just routing from the orchestrator — agents that talk to each other:
- Claude agent: "I need a quick summary of this file. @OllamaAgent, summarize api/routes.js"
- Ollama agent processes and returns result to Claude agent's context
- Visible in chat as cross-agent messages (like @mentions in Slack)

### 4d. Voice Integration

Web Speech API (built into Chromium/Electron):
- "Hey EveRo, what's Agent 1 working on?" → reads agent status
- "Create a new Ollama agent for code review" → creates agent
- "Pause all agents" → pauses
- Uses `SpeechRecognition` API + `speechSynthesis` for responses
- Zero additional dependencies

### 4e. Cost Intelligence

Not just tracking — active cost management:
- Budget per agent, per project, per day
- Automatic model downgrade: if budget approaching limit, suggest switching from Opus to Sonnet
- Cost comparison: "This task cost $0.42 with Claude. With Ollama, it would have been free."
- Monthly report with projections

### 4f. Plugin Architecture (v2.5+)

The platform play:
- Community widgets (npm packages following an EveRo widget spec)
- Community palettes (JSON files importable via URL)
- Community agent types (beyond Claude/Ollama — OpenAI, Gemini, local llama.cpp)
- Marketplace for premium widgets/palettes
- Revenue share with creators

---

## Phase 5: Mobile Companion (v3.0.0)

React Native app:
- See all agents' health (mini EKGs on your phone)
- Send commands ("pause Agent 2", "create new agent")
- Notifications when agents need attention
- Cost dashboard on the go

Connected via WebSocket to the Express server (localhost:3067, tunneled via ngrok or similar for remote access).

---

## Monetization Strategy

### Freemium Model
**Free tier**: 3 agents, 5 palettes, basic EKG, weather + system widgets
**Pro ($9/mo)**: Unlimited agents, all palettes, custom palette creator, full EKG with predictions, all widgets, session replay, cost tracking
**Team ($29/mo/seat)**: Agent collaboration, shared projects, team dashboard, priority support

### Revenue Channels
1. **Subscriptions** (primary) — Pro/Team plans
2. **Marketplace** (future) — 30% cut on community widgets/palettes
3. **Enterprise** — Self-hosted, custom integrations, SLA
4. **Content** — YouTube tutorials, "build with EveRo" series (drives adoption)

### Why People Will Pay
- **The EKG is the hook** — it's visually stunning and genuinely useful
- **Multi-model is the moat** — no other desktop AI tool lets you run Claude + Ollama + (future: OpenAI, Gemini) in the same workspace
- **Widgets make it sticky** — once EveRo is your command center, you don't close it
- **Cost tracking saves money** — pays for itself if it prevents one $50 bill shock

---

## Code Optimization Notes

### Current Technical Debt
1. **Patch ordering fragility** — patches must run in exact order; no dependency resolution
2. **String matching brittleness** — upstream version changes break all patches
3. **No runtime error boundaries** — a bad patch crashes the whole app
4. **Large inline IIFE strings** — hard to debug, no source maps

### Optimization Opportunities
1. **External patch modules** — Move large IIFE strings to separate .js files loaded at runtime via `require()` from the unpacked asar
2. **Runtime style injection** — Instead of patching CSS at build time, inject styles at runtime (already planned for palette system)
3. **Error boundaries** — Wrap each patched component in a try/catch with fallback UI
4. **Telemetry-driven optimization** — Use EKG data to identify which agents are burning the most resources and suggest optimizations

### New Tech to Evaluate
- **Electron 40.x** — When available, evaluate for performance improvements
- **Bun runtime** — Potential replacement for Node.js in Electron for faster startup
- **WebGPU** — For GPU-accelerated EKG rendering when multiple agent waveforms are displayed
- **Model Context Protocol (MCP)** — Already supported by Claude Code; could be the standard API for agent-to-agent communication
