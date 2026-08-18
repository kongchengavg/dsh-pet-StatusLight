# dsh-plugin-StatusLight

A **dynamic Cordis plugin** for [DeepSeek Harness](https://github.com/deepseek-ai) that reflects the model's live state through a character's facial expressions, and pops up character-specific chat bubbles when a task completes, errors, or asks you a question. Supports **9 characters** with instant switching, plus a **Windows system-level always-on-top transparent mini-window** (independent of the browser — visible even when the browser is minimized).

> [中文](README.zh.md) | English

## Highlights

- **Character status light**: a floating character portrait that switches with model state —
  - Thinking → `think` expression
  - Error → `error` expression (random pick)
  - Completed → `complete` expression (random pick)
  - Idle / startup → `default` expression
  - State priority: `error > think > complete > default`, auto-recovers after errors
- **Multi-character**: ships with 9 characters — Furina, Hu Tao, Aether, Nahida, Kazuha, Lumine, Zhongli, Traffic Light, Robot; right-click the light or the mini-window to switch (persisted)
- **Chat bubbles**: on completion / error / question, a character-specific chat box pops above the portrait (text + a **View Details** link that jumps to the exact session); auto-dismisses after 60 s, or immediately via the red ×
- **View Details jump**: opens the corresponding agent / subagent session; the browser window is restored and focused without leaving fullscreen
- **System-level always-on-top window** (Windows): a PowerShell + WPF transparent mini-window that keeps showing state and chat bubbles even when the browser is minimized; draggable, right-click menu, auto-respawn on failure
- **Per-pixel transparency**: WPF `AllowsTransparency` per-pixel alpha rendering — no purple/black fringes
- **Persistence**: character, page position, window position and window toggle are saved to `.statuslight.json` in the workspace

## Repository Layout

```
dsh-plugin-StatusLight/
├── src/                          # Source (Cordis plugin definition)
│   ├── host/index.js             # Host half: state machine / events / RPC / HTTP API / window process
│   ├── client/index.js           # Client half: floating status light UI in the web page
│   └── window/statuslight-window.ps1  # Always-on-top WPF window script (repo copy)
├── assets/
│   └── characters/               # Character assets (one folder per character; add your own)
│       ├── fufu/                 # Furina
│       ├── hutao/                # Hu Tao
│       ├── kong/                 # Aether
│       ├── naxida/               # Nahida
│       ├── wanye/                # Kazuha
│       ├── ying/                 # Lumine
│       ├── zhongli/              # Zhongli
│       ├── 红绿灯/                # Traffic Light
│       └── 机器人/                # Robot
├── docs/
│   ├── rule.zh.md                # Original requirement spec (was rule.txt)
│   ├── architecture.md           # Architecture design
│   └── api.md                    # HTTP API / RPC / config / asset conventions
├── manifest.json                 # Plugin metadata
├── LICENSE                       # MIT (code only)
├── README.md                     # English (default)
└── README.zh.md                  # 中文
```

### Character Asset Convention

Each character folder uses a fixed layout:

```
assets/characters/<folder>/
├── action/
│   ├── default/      # default/idle expressions (multiple OK, random pick)
│   ├── think/        # thinking expressions (multiple OK, random pick)
│   ├── error/        # error expressions (multiple OK, random pick)
│   └── complete/     # completed expressions (multiple OK, random pick)
└── 聊天框/            # chat bubble images (currently fixed to 聊天框_长句.png)
```

> Legacy layout is still supported: character folders may also live directly in the workspace root (`<folder>/action/...`). The plugin auto-detects both and prefers `assets/characters`.

## Installation & Usage

### Requirements

- Windows (the mini-window relies on PowerShell 5.1 + .NET WPF, both built-in)
- A running DeepSeek Harness session

### Steps

1. Put this repository (or at least its `assets/characters` directory) into the DeepSeek Harness workspace.
2. Load it through the **dynamic Cordis plugin mechanism** in the session:
   - `src/host/index.js` as the **Host code**
   - `src/client/index.js` as the **Client code**
   - `cordis_define` (kind: new, suggested idPrefix `stlt`), then `cordis_run`
3. The status light appears at the bottom-right of the page; the always-on-top mini-window is on by default (top-right of the screen).
4. Right-click the character to switch; left-drag the mini-window to move it (position is saved automatically).

## Interactions

| Action | Effect |
|---|---|
| Left-drag (mini-window) | Move the always-on-top window (auto-saved) |
| Right-click (page / window) | Switch character / open main UI / close mini-window |
| Chat bubble **View Details** | Jump to the agent / subagent session (restore browser, no fullscreen exit) |
| Chat bubble **×** | Dismiss (synced on both ends; never resurrects after switching characters / toggling window) |
| Auto-dismiss | 60 s timeout, or earlier when the agent runs again |

Per-character vertical offset of the chat box (keeps the text zone fixed while the image aligns):

| Character | Offset |
|---|---|
| Traffic Light | up 5px |
| Robot | none |
| Others | up 3px |

## Configuration

Runtime config lives in `.statuslight.json` in the workspace (gitignored, never published):

```json
{
  "character": "胡桃",
  "position": { "x": 1358, "y": 533 },
  "window": true,
  "windowPos": { "x": 1334, "y": 509 }
}
```

| Field | Description |
|---|---|
| `character` | Current character (folder name) |
| `position` | Floating light position in the page |
| `window` | Whether the always-on-top window is enabled |
| `windowPos` | Always-on-top window position |

## Tech Stack

- **Host**: DeepSeek Harness dynamic Cordis plugin (ROOT ctx); a state machine driven by `agent/status`, `agent/error`, `tools/result` and `agent/disposed` events
- **Client**: React (no JSX, `React.createElement`) + `slots.inject('shell.overlay')` + `styles.insert`
- **Mini-window**: PowerShell 5.1 + WPF (`AllowsTransparency` per-pixel alpha, `Topmost`, 500 ms DispatcherTimer polling, DPI-aware dragging, self-healing respawn)
- **HTTP**: `webServer.register({ kind: 'prefix', path: '/statuslight' })` serves state snapshots and images

See [docs/architecture.md](docs/architecture.md) and [docs/api.md](docs/api.md).

## License

- **Code**: MIT (see [LICENSE](LICENSE))
- **Character image assets**: owned by their original authors/works; provided for personal/learning use only — verify the license before redistribution, or replace them with your own assets.

> Note: this plugin is defined via the dynamic Cordis mechanism, so it is a session-scoped extension and must be reloaded after a restart. The files in `src/` are exactly the source used when defining the plugin.
