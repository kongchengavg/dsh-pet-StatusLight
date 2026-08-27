# DSH Desktop 安装指南（INSTALL_DESKTOP.md）

本文档写给 **AI 助手**：请按以下托管流程，为 DeepSeek Harness（dsh）和 [DSH Desktop](https://github.com/anywhere-labs/dsh-desktop) 安装并验证 **dsh-pet-StatusLight** 插件。安装过程中由 AI 自动处理 CLI、安装来源及 Profile，用户不需要做选择。人类用户也可以把它当作安装对照清单。

## 0. 背景（必读）

dsh-pet-StatusLight 是 **静态 dsh 插件**（bundle）：本仓库即标准 dsh 插件包（`package.json` 声明 `dsh.bundle.patch` + host/client 入口），通过 `dsh plugin --profile <name> add <npm|git>` 挂载进 Profile，由宿主自动加载——**任何会话都不需要 `cordis_*` 工具**，重启后仍生效。

> **托管安装规则（必须遵守）**：始终同时安装到 `web` 和 `desktop` 两个 Profile；每个 Profile 都优先使用 GitHub 源，只有 GitHub 安装失败时才对该 Profile 回退到 npm。不要询问用户选择 Profile、来源或命令，也不要因为当前只使用其中一个 Profile 而跳过另一个。

> 素材发现：插件会从会话工作区（agent cwd / workspaceRoot）自动定位角色素材（`assets/characters/` 或根目录布局）。

## 1. 前提检查

1. 确认本仓库目录可访问，且 `assets/characters/` 下至少存在一个角色文件夹（每个角色含 `action/` 子目录）。
2. 先执行 `dsh --version` 检查全局 CLI；成功则后续使用 `dsh`。如果命令不存在或执行失败，自动改用 `npx -y @deepseek-ai/dsh`，不要让用户选择。
3. 可执行 `dsh profile list`（使用 npx 时替换命令前缀）了解现有 Profile，但无论当前选中哪个 Profile，仍须安装 `web` 和 `desktop` 两个 Profile。

## 2. 安装

以下步骤由 AI 连续执行。除非所有自动方案均失败，否则不要中断流程向用户询问。

### 2.1 同时添加插件到 `web` 和 `desktop`

对 `web`、`desktop` 两个 Profile 分别执行以下流程：

1. 先使用 GitHub 源安装。
2. 检查该命令的退出状态及错误输出。
3. GitHub 安装成功：该 Profile 安装完成，**不要再执行 npm 安装**。
4. GitHub 安装失败：自动改用 npm 包名重试该 Profile。
5. 只有 GitHub 与 npm 均失败时，才向用户报告该 Profile 的错误信息；另一个 Profile 仍应继续尝试安装。

#### 第一步：优先使用 GitHub 源

```sh
# 已检测到全局 dsh CLI 时：
dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git
dsh plugin --profile desktop add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git

# 没有全局 dsh CLI 时，自动使用 npx：
npx -y @deepseek-ai/dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git
npx -y @deepseek-ai/dsh plugin --profile desktop add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git
```

> 上面两组命令是二选一的 **CLI 前缀方案**：检测到全局 `dsh` 时只执行第一组，否则只执行 npx 组；这不是让用户选择。两条 Profile 命令均须执行，并分别判断是否成功。

#### 第二步：仅为 GitHub 安装失败的 Profile 回退 npm

```sh
# 示例：仅执行与失败 Profile 对应的命令；不要覆盖已经成功的 GitHub 安装。
dsh plugin --profile web add dsh-pet-statuslight
dsh plugin --profile desktop add dsh-pet-statuslight

# 没有全局 dsh CLI 时，对应使用：
npx -y @deepseek-ai/dsh plugin --profile web add dsh-pet-statuslight
npx -y @deepseek-ai/dsh plugin --profile desktop add dsh-pet-statuslight
```

- `web` 与 `desktop` Profile 分别保存插件，因此两次安装必须分别完成。
- 每条成功的命令都会把 `dsh-pet-statuslight` 写入对应 Profile 的 `package.json`（dependencies + `dsh.profile.bundles`）并完成安装。
- 最终向用户简要报告两个 Profile 各自使用的来源，例如：`web：GitHub 成功；desktop：GitHub 失败，已通过 npm 成功`。

### 2.2 重启当前宿主使插件加载

安装完成后，告诉用户重启正在使用的宿主：使用 dsh web 时重启 dsh web；使用 DSH Desktop 时重启 DSH Desktop；两者都在使用时分别重启。需要重启 dsh web 时，由用户执行重启，并等待用户回复“已经重启”后再继续验证。重启后：

1. **Host 验证**（任意终端）：
   ```sh
   curl http://127.0.0.1:<dsh端口>/statuslight/api/state
   ```
   期望返回 JSON：`characters` 含 9 个角色、`character` 为当前角色、`image` 为 `/statuslight/assets/characters/...` 图片 URL。
2. **页面验证**：浏览器右下角出现角色状态灯；右键可切换角色。
3. **小窗验证**（仅 Windows）：屏幕右上角出现透明置顶小窗。

### 2.3 卸载 / 更新

```sh
# 全局 dsh CLI：
dsh plugin --profile web remove dsh-pet-statuslight
dsh plugin --profile desktop remove dsh-pet-statuslight

# npx 临时使用（未全局安装 dsh）：
npx -y @deepseek-ai/dsh plugin --profile web remove dsh-pet-statuslight
npx -y @deepseek-ai/dsh plugin --profile desktop remove dsh-pet-statuslight
```

- **卸载**：同时从 `web` 和 `desktop` 两个 Profile 移除。
- **更新**：重新执行本页 2.1 的完整托管安装流程；两个 Profile 均优先 GitHub，只有失败的 Profile 才回退 npm。

## 3. 验证清单

- ✅ `GET /statuslight/api/state` 返回 9 个角色与当前角色图片
- ✅ 页面右下角状态灯显示
- ✅（Windows）置顶小窗出现，右键可切换角色
- ✅ 任意 agent 运行时角色切「思考」，完成后弹聊天框气泡

## 4. 常见问题排查

| 现象 | 原因与处理 |
|---|---|
| API 404 / `characters` 为空 | 素材目录不在会话工作区：把仓库（`assets/characters`）放进 agent cwd 或 workspaceRoot |
| 角色图片 404 | 布局错误：应为 `assets/characters/<角色>/action/<状态>/*.png`；旧布局 `<角色>/action/...` 也兼容 |
| 置顶小窗不出现 | 仅 Windows；检查 `/statuslight/api` 可达、PowerShell 可用、日志 `status-light spawn window` |
| 网页状态灯不显示 | 小窗开启时网页角色隐藏（同一角色不重复）；可关掉小窗或检查页面右下角 |
| 静态安装后没生效 | 未重启当前宿主；或某个 Profile 安装失败。检查 `web` 和 `desktop` 两次安装结果，并用 `dsh profile list` 核对 |

## 5. 配置

工作区根目录 `.statuslight.json`（插件自动读写）：

```json
{
  "character": "红绿灯",
  "position": { "x": 1358, "y": 533 },
  "window": true,
  "windowPos": { "x": 1334, "y": 509 }
}
```

## 6. 完成确认

向用户确认：`web` 和 `desktop` 两个 Profile 均已安装成功；当前宿主中的状态灯正常、小窗（Windows）正常、agent 运行时状态切换与聊天框弹出。全部通过即为安装成功。
