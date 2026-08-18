<h1 align="center">dsh-pet-StatusLight</h1>

<p align="center"><b>A talking desktop pet for DeepSeek Harness.</b></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.0.27-blue?style=flat-square" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" alt="Platform">
</p>

A character portrait that reflects your model's live state — thinking, error, completed, idle — with character-specific chat bubbles when a task finishes, fails, or asks you a question. Click through to the exact session in one step. Even with the browser minimized, the system-level always-on-top mini-window keeps you company.

## Contact

Feel free to open an [issue](https://github.com/kongchengavg/dsh-pet-StatusLight/issues/new/choose) for bugs, suggestions, or questions.

## Highlights & Features

- 🐾 **9 desktop-pet characters**: Furina, Hu Tao, Aether, Nahida, Kazuha, Lumine, Zhongli, Traffic Light, Robot; switch anytime via right-click, and your choice is remembered.
- 🎭 **Live expressions**: four states — thinking, error, completed, idle — each with its own set of expressions; errors take priority and auto-recover.
- 💬 **Character chat bubbles**: pop up when a task completes, errors, or asks you a question; tap **View Details** to jump straight to the session.
- 🪟 **Always-on-top mini-window** (Windows): a transparent window independent of the browser — visible even when the browser is minimized; draggable, right-click to switch characters, auto-respawns on failure.
- 🎨 **Per-pixel transparency**: WPF per-pixel alpha rendering — no fringes.
- ⚡ **Lightweight, zero-config**: a dynamic Cordis plugin loaded in-session; no Harness configuration changes required.

## Installation

**Method 1: Hand it to your AI (copy and send the text below to your AI)**

> "Install this plugin by following INSTALL.md at https://github.com/kongchengavg/dsh-pet-StatusLight/"

**Method 2: Manual install**

- **Option A: Static install (recommended, no cordis tools needed)** — this repository is a standard dsh plugin bundle; install with one command:

  ```sh
  dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git   # GitHub source, works now
  # or a local directory:
  dsh plugin --profile web add D:/Users/1/Desktop/code/agent/dsh/dsh-plugin/dsh-pet-StatusLight
  # npm package name (after publishing to npm):
  dsh plugin --profile web add dsh-pet-statuslight
  ```

  Restart dsh web and the plugin loads automatically (usable from any session, no `cordis_*` tools required).

- **Option B: Dynamic install (requires a cordis-preset session)**

  1. Put this repository (or its `assets/characters` directory) into your DeepSeek Harness workspace.
  2. In a session created with the **cordis** preset, load it via the dynamic Cordis mechanism:
     - `src/host/index.js` as the **Host code**
     - `src/client/index.js` as the **Client code**
     - `cordis_define` then `cordis_run`
  3. The status light appears at the bottom-right of the page; the always-on-top mini-window is on by default.

## Usage

- **Right-click** the light or the mini-window: switch character / open the main UI / close the mini-window.
- **Left-drag** the mini-window: move it (position auto-saved).
- **Chat bubble**: tap **View Details** to jump to the session; tap **×** to dismiss instantly; auto-dismisses after 60 seconds.
- Character and position settings are stored in `.statuslight.json` in the workspace and can be edited manually.

## Disclaimer

This project is provided as-is, without warranty or endorsement for any particular purpose (including commercial use). Character image assets belong to their original authors and are provided for personal/learning use only — verify their licenses yourself. This is a community open-source project and is not affiliated with DeepSeek, miHoYo, or any official entity.

## License

Code is licensed under MIT (see [LICENSE](LICENSE)); character image assets belong to their original authors.
