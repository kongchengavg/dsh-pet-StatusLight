<h1 align="center">dsh-pet-StatusLight</h1>

<p align="center"><b>A talking desktop pet for DeepSeek Harness.</b></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh.md">中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-pet-statuslight"><img src="https://img.shields.io/npm/v/dsh-pet-statuslight?style=flat-square" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/dsh-pet-statuslight?style=flat-square" alt="license"></a>
  <a href="https://github.com/kongchengavg/dsh-pet-StatusLight"><img src="https://img.shields.io/github/repo-size/kongchengavg/dsh-pet-StatusLight?style=flat-square" alt="repo size"></a>
  <a href="https://github.com/kongchengavg/dsh-pet-StatusLight/issues"><img src="https://img.shields.io/github/issues/kongchengavg/dsh-pet-StatusLight?style=flat-square" alt="issues"></a>
  <a href="INSTALL.md"><img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" alt="Platform"></a>
  <a href="https://github.com/kongchengavg/dsh-pet-StatusLight/tree/main/assets/characters"><img src="https://img.shields.io/badge/assets-9%20characters-green?style=flat-square" alt="assets"></a>
</p>

A character portrait that reflects your model's live state — thinking, error, completed, idle — with character-specific chat bubbles when a task finishes, fails, or asks you a question. Click through to the exact session in one step. Even with the browser minimized, the system-level always-on-top mini-window keeps you company.

## Preview

<p align="center">
  <img src="assets/screenshots/characters.png" alt="Characters" width="520">
  <br><em>Nine characters, switch anytime via right-click</em>
</p>

<p align="center">
  <img src="assets/screenshots/states.png" alt="Four states" width="620">
  <br><em>Status light: thinking / error / completed / idle expressions switch automatically</em>
</p>

<p align="center">
  <img src="assets/screenshots/chatbox.png" alt="Chat bubble" width="520">
  <br><em>Character-specific chat bubbles on completion, error, and questions</em>
</p>

## Contact

Feel free to open an [issue](https://github.com/kongchengavg/dsh-pet-StatusLight/issues/new/choose) for bugs, suggestions, or questions.

## Highlights & Features

- 🐾 **9 desktop-pet characters**: Furina, Hu Tao, Aether, Nahida, Kazuha, Lumine, Zhongli, Traffic Light, Robot; switch anytime via right-click, and your choice is remembered.
- 🎭 **Live expressions**: four states — thinking, error, completed, idle — each with its own set of expressions; errors take priority and auto-recover.
- 💬 **Character chat bubbles**: pop up when a task completes, errors, or asks you a question; tap **View Details** to jump straight to the session.
- 🪟 **Always-on-top mini-window** (Windows): a transparent window independent of the browser — visible even when the browser is minimized; draggable, right-click to switch characters, auto-respawns on failure.

## Install, Uninstall & Update

### Install

**Method 1: Hand it to your AI (copy and send the text below to your AI)**

```text
Install this plugin by following INSTALL.md at https://github.com/kongchengavg/dsh-pet-StatusLight/
```

**Method 2: Manual install**

Published to npm; install with one command:

```sh
dsh plugin --profile web add dsh-pet-statuslight          # one-line npm install
# or via GitHub source:
dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git
```

> **No global dsh CLI? Use npx** — run the same commands through npx without installing dsh globally:
> ```sh
> npx -y @deepseek-ai/dsh plugin --profile web add dsh-pet-statuslight
> npx -y @deepseek-ai/dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git
> ```

Restart dsh web and the plugin loads automatically.

> Note: pnpm withholds versions published less than 24 hours ago; if you do not get the latest version, pin the version explicitly (e.g. `dsh-pet-statuslight@1.0.33`).

### Uninstall

```sh
dsh plugin --profile web remove dsh-pet-statuslight
# no global dsh CLI? use npx:
npx -y @deepseek-ai/dsh plugin --profile web remove dsh-pet-statuslight
```

Restart dsh web and the plugin is removed.

### Update

```sh
dsh plugin --profile web add dsh-pet-statuslight@<latest>   # npm source (pin version to bypass 24h hold)
# or re-pull the latest from GitHub:
dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git
# no global dsh CLI? use npx with the same arguments:
npx -y @deepseek-ai/dsh plugin --profile web add dsh-pet-statuslight@<latest>
npx -y @deepseek-ai/dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git
```

Re-adding completes the update; restart dsh web to apply.

## Usage

- **Right-click** the light or the mini-window: switch character / open the main UI / close the mini-window.
- **Left-drag** the mini-window: move it (position auto-saved).
- **Chat bubble**: tap **View Details** to jump to the session; tap **×** to dismiss instantly; auto-dismisses after 60 seconds.
- Character and position settings are stored in `.statuslight.json` in the workspace and can be edited manually.

## Future improvements

1. Add unique notification sounds for each character;
2. Add more fun characters;
3. If you have valuable feedback, feel free to open an [issue](https://github.com/kongchengavg/dsh-pet-StatusLight/issues) — I will evaluate it and upgrade the plugin as soon as possible.

## Disclaimer

This project is provided as-is, without warranty or endorsement for any particular purpose (including commercial use). Character image assets belong to their original authors and are provided for personal/learning use only — verify their licenses yourself. This is a community open-source project and is not affiliated with DeepSeek, miHoYo, or any official entity.

## License

Code is licensed under MIT (see [LICENSE](LICENSE)); character image assets belong to their original authors.
