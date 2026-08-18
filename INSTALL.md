# 安装指南（INSTALL.md）

本文档写给 **AI 助手**：请按以下步骤，为 DeepSeek Harness（dsh）安装并验证 **dsh-StatusLight** 插件。人类用户也可以把它当作安装对照清单。

## 0. 背景（必读）

dsh-StatusLight 是 **动态 Cordis 插件**，不是 npm 包：它通过 Harness 会话内的 `cordis_define` / `cordis_run` 机制把代码加载进当前进程。因此：

- 安装前必须先把本仓库（至少 `assets/characters` 目录）放到 Harness 的**工作区目录**（agent 的 cwd 或 sandboxPolicy.workspaceRoot）下，插件会从这里发现角色素材。
- 插件是**会话级临时扩展**：Harness 重启后需要按本文档重新加载。
- 系统级置顶小窗仅支持 **Windows**（依赖 PowerShell 5.1 + WPF）；非 Windows 环境只能使用网页状态灯。

## 1. 前提检查

1. 确认当前会话工作区能找到本仓库目录，且 `assets/characters/` 下至少存在一个角色文件夹（每个角色含 `action/` 子目录，如 `assets/characters/红绿灯/action/`）。
2. 确认动态 Cordis 插件工具可用：`cordis_define`、`cordis_run`。
3. 确认相关服务存在（缺失时插件会自动降级，不阻塞安装）：`fs`、`agents`、`webServer`、`timer`、`subprocess`、`sessions`。

## 2. 安装步骤

### 2.1 读取源码（不要改动）

用读取工具读取以下两个文件的**完整内容**：

| 文件 | 用途 |
|---|---|
| `src/host/index.js` | 作为插件的 **Host 代码** |
| `src/client/index.js` | 作为插件的 **Client 代码** |

### 2.2 定义插件

调用 `cordis_define`：

- `plugin`：`kind = "new"`，`idPrefix = "stlt"`（3–6 位小写字母，Host 会分配最终 pluginId）
- `name`：`StatusLight 状态灯`
- `purpose`：一句话说明（如「DeepSeek Harness 状态灯：角色表情跟随模型状态，聊天框气泡通知，Windows 置顶小窗」）
- `code.host` = `src/host/index.js` 全文
- `code.client` = `src/client/index.js` 全文

成功返回 `pluginId` 与 `packageId`（形如 `stlt-1` / `pkg-1`）。

> 若提示插件已存在（历史安装过），改用 `kind = "existing"` + 原 `pluginId` 追加新包，不要新建插件。

### 2.3 运行插件

调用 `cordis_run`：

- `pluginId`、`packageId` 用 2.2 的返回值
- `mode = "run"`（首次安装）

- 若返回 `awaiting-approval`：告诉用户在界面中**允许**该请求，然后等待。
- 若返回 `starting`：进入异步激活，等待系统报告最终成功/失败。

### 2.4 验证安装

插件 apply 完成后（通常数秒内），逐项验证：

1. **HTTP 验证**（任意终端执行）：
   ```sh
   curl http://127.0.0.1:<dsh端口>/statuslight/api/state
   ```
   期望返回 JSON：`characters` 数组包含 9 个角色（红绿灯、机器人、fufu、hutao、kong、naxida、wanye、ying、zhongli），`character` 为当前角色，`state` 为当前状态。
   `<dsh端口>` 是 Harness web 端口（通常 3080）；插件路由前缀固定为 `/statuslight`。
2. **页面验证**：浏览器右下角出现角色状态灯。
3. **置顶小窗验证**（仅 Windows）：屏幕右上角出现透明小窗；右键可切换角色、左键可拖动。
4. **触发验证**：让任意 agent 执行一个任务，观察角色切到「思考」表情，任务完成后弹出聊天框气泡。

## 3. 常见问题排查

| 现象 | 原因与处理 |
|---|---|
| API 返回 404 或 `characters` 为空 | 未找到 base 目录：确认仓库（`assets/characters`）位于 agent cwd 或 workspaceRoot 下 |
| 角色图片 404 | 素材布局错误：应为 `assets/characters/<角色>/action/<状态>/*.png`；旧布局 `<角色>/action/...` 同样兼容 |
| 置顶小窗不出现 | 仅 Windows 支持；检查 `/statuslight/api` 可达性、PowerShell 是否可用、插件日志中的 `status-light spawn window` |
| 网页状态灯不显示 | 置顶小窗开启时网页角色会隐藏（同一角色不重复显示）；可关掉小窗（右键菜单）或检查页面右下角 |
| 需要升级插件 | 用同一 `pluginId` 重新 `cordis_define`（existing）+ `cordis_run`（mode=`update`） |
| 已忽略的聊天框又出现 | 正常机制不允许；若出现请反馈 issue |

## 4. 配置

运行后可手动编辑工作区根目录的 `.statuslight.json`（插件会自动读写）：

```json
{
  "character": "红绿灯",
  "position": { "x": 1358, "y": 533 },
  "window": true,
  "windowPos": { "x": 1334, "y": 509 }
}
```

## 5. 完成确认

安装完成后，向用户确认：

- ✅ 网页右下角状态灯正常显示
- ✅（Windows）置顶小窗正常，右键可切换角色
- ✅ 任意 agent 运行时状态灯切换、结束后弹出聊天框

全部通过即为安装成功。
