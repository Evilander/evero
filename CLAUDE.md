# windowscov - EveRo (Windows Port of roro)

This project ports the macOS-only **roro** Electron app to Windows x64, rebranded as **EveRo**.

## Project Structure

```
A:\ai\claude\automation\windowscov\
├── roro-mac\                  # Source: extracted macOS app
│   ├── roro.app\              # Original .app bundle
│   └── app-extracted\         # Extracted asar contents
│
├── roro-win\                  # Windows build project
│   ├── package.json           # electron-builder config (EveRo v1.0.92)
│   ├── out\                   # Patched output (copied from mac, then patched)
│   │   ├── main\index.js     # PATCHED main process
│   │   ├── preload\index.js
│   │   └── renderer\
│   ├── node_modules\          # Windows native + JS modules
│   ├── resources\
│   │   ├── icon.ico
│   │   ├── app-update.yml     # Points to Evilander/roro-releases
│   │   └── hooks\
│   │       ├── notify-app.cmd     # Windows hook script (replaces .sh)
│   │       └── settings.json      # Hook config pointing to .cmd
│   ├── scripts\
│   │   ├── build-win.js                   # Main build/patch script (runs all patches)
│   │   ├── setup-modules.js               # Copies modules + installs native
│   │   ├── patch-process-detection.js     # ps/pgrep → wmic patch
│   │   ├── patch-windows-improvements.js  # v1.0.91 UX patches
│   │   ├── patch-ollama-integration.js    # v1.0.92 Ollama multi-model support
│   │   ├── patch-windows-renderer.js      # v1.0.92 renderer fixes + Ollama UI
│   │   ├── patch-path-normalization.js    # v1.0.92 Windows path normalization
│   │   ├── patch-rebrand.js               # v1.0.92 roro -> EveRo rebrand
│   │   ├── cleanup-build.js               # Removes unnecessary files pre-packaging
│   │   ├── create-icon.js                 # PNG → ICO conversion
│   │   └── list-dist.js                   # Lists build artifacts
│   └── dist\                  # Built output
│       ├── win-unpacked\      # Unpacked app (for testing)
│       └── EveRo-1.0.92-win-x64.exe      # NSIS installer
```

## Build Process (Full Rebuild)

```bash
# 1. Patch main process (copies from mac extracted, applies ALL patches including UX)
node scripts/build-win.js

# 2. If first time or node_modules missing: setup modules
node scripts/setup-modules.js

# 3. Optional: cleanup before packaging
node scripts/cleanup-build.js

# 4. Build installers
npx electron-builder --win --x64 --publish never
```

## Patches Applied to main/index.js

### Original Windows compat patches (v1.0.90)

| # | What | Why |
|---|------|-----|
| 2a | `notify-app.sh` → `notify-app.cmd` (13x) | Hook scripts are shell-specific |
| 2b | Remove `chmod +x` calls | Windows doesn't use Unix permissions |
| 2c | `frame:process.platform==="darwin"` → `frame:true` | Without this, Windows gets frameless window |
| 2d | PATH fallback → System32 + PowerShell | Unix paths don't exist on Windows |
| 2e | `sharp-darwin-arm64` → `sharp-win32-x64` | Platform-specific native binary |
| 2f | `HOME` → `HOME\|\|USERPROFILE\|\|homedir()` | Windows uses USERPROFILE |
| 2g | `which claude` → `where claude` (conditional) | `which` is Unix-only |
| 2h | `titleBarStyle:"hiddenInset"` → conditional | macOS-only titlebar style |
| extra | `ps`/`pgrep` → `wmic` (separate script) | Unix process detection tools |

### UX improvement patches (v1.0.91)

| # | What | Why |
|---|------|-----|
| UX-1 | `requestSingleInstanceLock()` + `second-instance` handler | Prevents duplicate windows; routes deep links to existing window |
| UX-2 | Simplified `setAsDefaultProtocolClient("roro")` | Removes broken `process.argv[1]` that caused cmd.exe errors |
| UX-3 | Auto-launch Claude Code after terminal spawn | No more manual `claude` typing; uses configurable flags |
| UX-4 | `launch-config:set/get/get-defaults` IPC handlers | Renderer can configure launch flags (model, skip-permissions, etc.) |

### Multi-model + renderer patches (v1.0.92)

#### Main process patches (`patch-ollama-integration.js`)

| # | What | Why |
|---|------|-----|
| OI-1 | `OllamaService` class (same interface as `ee`) | Streaming HTTP chat with Ollama API at localhost:11434 |
| OI-2 | `createAgent` dispatch: `n==="ollama"?new OllamaService(r):new ee` | Route agent creation to correct service |
| OI-3 | `modelLogo` dispatch: `n==="ollama"?"ollama":"claude"` | Correct logo for Ollama agents |
| OI-4 | Agent restore dispatch with metadata type check | Restore Ollama agents correctly on reload |
| OI-5 | `ollama:check-status` IPC handler | Ping Ollama at localhost:11434 |
| OI-6 | `ollama:list-models` IPC handler | Fetch available models from /api/tags |
| OI-7 | `ollama:set-model` IPC handler | Change model on existing OllamaService agent |
| OI-8 | `ollama:pull-model` IPC handler | Download models via /api/pull |
| OI-9 | `launch-config:get-defaults` extended with `ollamaModel` | Default model: "llama3.2" |

#### Renderer patches (`patch-windows-renderer.js`)

| # | What | Why |
|---|------|-----|
| WR-1 | Ollama SVG logo added to `PH` and `zY` maps | Display llama icon for Ollama agents |
| WR-2 | Alt text: `t.modelLogo==="ollama"?"Ollama":` added | Accessibility for Ollama logo |
| WR-3 | `k.metaKey` → `(k.metaKey\|\|k.ctrlKey)` for Ctrl+L | File viewer toggle works on Windows |
| WR-4 | `U.metaKey` → `(U.metaKey\|\|U.ctrlKey)` for Ctrl+Backspace | Terminal clear works on Windows |
| WR-5 | `.split("/")` → `.split(/[/\\]/)` (8 occurrences) | Windows backslash paths in file views |
| WR-6 | `[Claude]` event prefix → `[Hook]` | Generic hook label for multi-model |
| WR-7 | Ollama button added to model selector | Users can select Ollama agent type |

#### Path normalization patches (`patch-path-normalization.js`)

| # | What | Why |
|---|------|-----|
| PN-1 | `__normPath()` + `__normFileMap()` helpers | Normalize `\\` → `/` in all path data |
| PN-2 | `filePath:__normPath(m)` in file-activity | File activity events use forward slashes |
| PN-3 | `__normFileMap()` wraps file-map:load response | File map loads use forward slashes |
| PN-4 | `__normFileMap(n)` wraps file-map:get response | File map gets use forward slashes |

#### Rebrand patches (`patch-rebrand.js`)

| # | What | Why |
|---|------|-----|
| RB-1 | `roro-dev` → `evero-dev` in userData path | App data directory |
| RB-2 | `roro://auth/callback` → `evero://auth/callback` | OAuth redirect protocol |
| RB-3 | `name:"roro"` → `name:"EveRo"` | Bot identity in DM system |
| RB-4 | `avatar:"/roro_icon.png"` → `avatar:"/evero_icon.png"` | Bot avatar path |
| RB-5 | `setAsDefaultProtocolClient("roro")` → `("evero")` | Protocol handler registration |
| RB-6 | `roro://` → `evero://` protocol URL matching | Deep link handling |
| RB-7 | `title:"roro"` → `title:"EveRo"` | Window title bar |
| RB-8 | `roro_transparent` → `evero_transparent` in renderer | Image asset references |
| RB-9 | `roro_icon` → `evero_icon` in renderer | Icon asset references |
| RB-10 | `alt:"roro"` → `alt:"EveRo"` in renderer | Accessibility text |
| RB-11 | `sender:"roro"` → `sender:"EveRo"` in renderer | DM sender identity |
| RB-12 | Marketing copy rebranded in DM welcome | User-visible text |
| RB-13 | Rename 3 image files to `evero_*` | File names match references |

## Native Modules Strategy

| Module | Approach |
|--------|----------|
| `node-pty` | Already has win32-x64 prebuilds in unpacked dir |
| `@anthropic-ai/claude-agent-sdk` | Already has win32 ripgrep binary |
| `better-sqlite3` | Rebuilt via `@electron/rebuild` for Electron 39.x |
| `@img/sharp-win32-x64` | Installed from npm (replaces darwin-arm64) |

## Key Technical Notes

- **Minified JS**: `out/main/index.js` is bundled into ~3 very long lines. Use node scripts (not grep) to search/extract context.
- **robocopy quirk**: Returns exit code 1 on success (files copied). Only 8+ is error.
- **electron-rebuild**: Use `--only better-sqlite3` to avoid rebuilding node-pty (which fails on GetCommitHash.bat).
- **npmRebuild: false**: Set in package.json to prevent electron-builder from trying to rebuild native modules (we handle it manually).
- **asarUnpack**: Native modules (`.node`, `.dll`) and specific packages are unpacked from asar at runtime.
- **dist locking**: Kill all `EveRo.exe` processes before rebuilding — dist/win-unpacked files get locked.
- **Auto-launch**: Terminal auto-runs `claude` with flags from `_launchConfig`. Default: auto-launch enabled, no extra flags.
- **Ollama integration**: OllamaService class streams responses from `http://localhost:11434/api/chat`. Supports any Ollama model. Default model: `llama3.2`. Notable models: kimi-k2.5, glm-5, minimax-m2.5, qwen3-coder-next.
- **Agent types**: `"terminal"` = Claude Code (terminal+hooks), `"ollama"` = Ollama chat (streaming HTTP, no terminal). Both share the same agent interface.

## Upstream

- **Upstream repo**: `make-roro/roro-releases` (binary releases only, no source code)
- **Source repo**: `Evilander/evero` (full source — scripts, config, resources, docs, roadmap)
- **Release repo**: `Evilander/evero-releases` (binary releases + auto-update)
- **Version**: 1.0.92 (multi-model Ollama integration + renderer fixes + EveRo rebrand)
- **App**: Electron 39.x, React 19, Express server on localhost:3067, Claude Code integration via hooks

## Release

Auto-update points to `Evilander/evero-releases`. To publish:
```bash
# Build and publish to GitHub releases
npx electron-builder --win --x64 --publish always
# Or create release manually with gh cli
gh release create v1.0.92-win dist/EveRo-1.0.92-win-x64.exe dist/EveRo-1.0.92-portable.exe --repo Evilander/evero-releases
```

## Roadmap

Detailed implementation plans in `memory/roadmap.md`. Summary:

| Phase | Version | Feature | Status |
|-------|---------|---------|--------|
| 1 | v1.1.0 | **Palette System** — 12+ curated themes (Catppuccin, Nord, Dracula, Rosé Pine, Happy Hues) + custom creator | Planned |
| 2 | v1.2.0 | **Widget Dashboard** — System perf, AI cost tracker, weather, quick launch, activity feed | Planned |
| 3 | v1.3.0 | **Agent EKG** — Real-time animated health waveforms, composite stress scoring, predictive failure detection | Planned |
| 4 | v2.0.0 | **Intelligence Layer** — Agent collaboration, session replay, voice control, cost intelligence | Planned |
| 5 | v3.0.0 | **Mobile Companion** — React Native app for remote agent monitoring | Planned |

### The Breakthrough: Agent EKG
Nobody in AI tooling is doing real-time animated agent health visualization. The entire industry uses retrospective Grafana-style dashboards. EveRo's EKG will be the first to:
- Render continuous animated waveforms encoding agent health as morphology
- Compute composite stress scores from token velocity, latency jitter, error acceleration, repetition entropy
- Predict failures before they happen (pre-loop, pre-stuck, pre-crash detection)
- Use medical-grade aesthetics (phosphor persistence, grid lines, glow effects)

Academic grounding: "Cognitive Load Framework for Tool-use Agents" (arXiv:2601.20412, Jan 2026) confirms agent stress is measurable and predictable.

### Key Dependencies for Next Phases
- `systeminformation` — PC performance metrics (CPU, RAM, GPU, disk)
- `@catppuccin/palette`, `@rose-pine/palette` — Curated color palettes (MIT)
- Open-Meteo API — Weather data (free, no key)
- Canvas 2D + requestAnimationFrame — EKG rendering (built-in)
