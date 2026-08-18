# 架构设计（Architecture）

本文档说明 dsh-StatusLight 的架构：插件如何挂载、事件如何驱动状态机、两端如何通信、置顶小窗如何工作。

## 1. 总览

```
┌──────────────────────────────  DeepSeek Harness 进程（Host）  ─────────────────────────────┐
│                                                                                            │
│  Cordis 动态插件 stlt-1（ROOT ctx，跨所有 agent/子 agent）                                   │
│                                                                                            │
│  ┌──────────────┐   agent/status / agent/error / tools/result / agent/disposed             │
│  │   状态机      │◄───────────────────────────────────────────────   Harness 事件总线        │
│  │ default/think│                                                                          │
│  │ error/complete│                                                                          │
│  └──────┬───────┘                                                                            │
│         │ 选择图片（随机）                                                                    │
│         ▼                                                                                    │
│  ┌───────────────────────────────┐        ┌───────────────────────────────┐                 │
│  │ 快照构建 buildSnapshot(since) │        │ webServer /statuslight 路由    │                 │
│  │ state/image/characters/jump/  │        │  /statuslight/api/*  JSON      │                 │
│  │ notifications/dismissed/...   │        │  /statuslight/<asset>  图片     │                 │
│  └───────┬───────────────────────┘        └───────────────┬───────────────┘                 │
│          │ RPC (harness.handle)                            │ HTTP                           │
└──────────┼─────────────────────────────────────────────────┼────────────────────────────────┘
           │                                                 │
   ┌───────▼─────────┐                              ┌────────▼─────────┐
   │  浏览器 Client    │  每 500ms host.call(state)   │ PowerShell + WPF │  每 500ms GET /api
   │  右下角浮动状态灯  │◄─────────────────────────────│  系统级置顶小窗    │◄────────────────
   │  聊天框气泡/菜单   │                              │  角色图/聊天框/拖动 │
   └─────────────────┘                              └──────────────────┘
```

## 2. 运行位置与作用域

- **Host 半部分**在 Harness 的 **ROOT ctx** 下运行（动态 Cordis 插件由会话定义，但挂在根上下文），因此能收到**所有** agent（含子 agent）的 `agent/status`、`agent/error` 事件——这正是「9 角色状态灯」能反映整棵会话树状态的原因。
- **Client 半部分**运行在浏览器页面，通过 `slots.inject('shell.overlay')` 把状态灯挂到页面覆盖层。
- **置顶小窗**是独立进程：Host 把内嵌的 PowerShell 脚本写成 `statuslight-window.ps1` 后，用 `subprocess.spawn` 启动 `powershell.exe -STA`，小窗只通过 HTTP 轮询快照，**不依赖浏览器页面存活**。

## 3. 状态机

状态：`default`（空闲）→ `think`（思考中）→ `complete`（全部完成）→ `default`，出错随时切入 `error`。

| 事件 | 触发 | 进入状态 | 保持 |
|---|---|---|---|
| `agent/status` running | 任一 agent 开始运行 | `think` | 直到全部空闲 |
| `agent/status` idle | 全部 agent 空闲 | `complete` | 6 s 后回 `default` |
| `agent/error` | 任一 agent 出错 | `error` | 8 s 后按运行状态恢复 |
| 插件启动同步 | 已存在 running agent | `think` | — |

优先级：`error > think > complete > default`；`error` 状态不会被新的 `think` 覆盖，直到超时恢复。`holdTimer` 保证状态切换后旧定时器被取消。

## 4. 角色与素材发现

- **Base 目录发现**（`findBaseDir`）：从 `agents.list()` / `sessions.list()` 的 `session.header.cwd` 与 `sandboxPolicy.workspaceRoot` 收集候选路径，`looksLikeBase` 检查是否存在 `KNOWN` 角色文件夹或 `assets/characters` 布局。
- **角色发现**（`discoverCharacters`）：优先扫描 `<base>/assets/characters/*`，其次扫描根目录 `*/`，凡含 `action/` 子目录即视为角色；记录每个角色所在位置（`assets` / `root`）。
- **图片选择**（`pickStateImage`）：按状态取 `action/<state>/` 下所有图片随机一张；`default` 兼容 `defualt` 拼写目录。聊天框固定 `聊天框_长句.png`（无则取第一张）。
- URL 统一形如 `/statuslight/<相对路径>`，图片路由按角色位置回退解析两种布局。

## 5. 通知与忽略（dismiss）语义

- 通知产生：`complete`（running→idle）、`error`（agent/error）、`question`（`tools/result` 中 `exec.name === 'ask_user_question'`）。
- 文本：`「标题」完成啦 / 出错了 / 需要你选择`（标题取自 `sessionTitle`）。
- 通知带 `seq` 自增；快照按 `since` 增量返回。
- **忽略必须两端同步持久**：× 或「查看详细」触发 `status-light/dismiss` RPC / `/api/dismiss?seq=`，Host 记录进 `dismissed` 集合；快照携带 `dismissed[]`，Client 对缓存项做修剪，因此**切换角色、开关小窗、刷新页面都不会让已忽略的通知复活**。
- 小窗 `runningAgents` 隐藏规则：当最新通知对应 agent 仍在运行（非 question 类）时提前隐藏聊天框。

## 6. 「查看详细」跳转链路

1. 小窗点「查看详细」→ `POST /api/jump?agent=&parent=&mode=` + `/api/dismiss?seq=` → Host 设置 `pendingJump`（60 s TTL）→ 调 `Open-Gui` 恢复/聚焦浏览器窗口（**只 `SetForegroundWindow`，不 `ShowWindow(5)`，避免退出浏览器全屏**）→ `Hide-Chat`。
2. Client 每 500 ms 轮询快照，发现新 `jump.id` 后 `performJump`：优先 `sessions.subagentAddress(agentId)` → `openSubagent(addr)`；否则按 `parentId + mode` 打开子会话；最后回退 `sessions.open(agentId)`。

## 7. 置顶小窗（Windows）

- **进程**：Host 将内嵌 PS1 模板写入 `<baseDir>/statuslight-window.ps1`（仓库副本在 `src/window/`），`subprocess.spawn` 启动，参数带 `-Api http://127.0.0.1:<port>/statuslight/api` 与 `-Config <baseDir>/.statuslight.json`。
- **渲染**：WPF `WindowStyle=None + AllowsTransparency + Background=Transparent + Topmost + ShowInTaskbar=false`；Grid 内：聊天框 Image（190×90）、TextBlock 文字、「查看详细」链接、红色 × Border、角色 Image（130×130 底部居中）。
- **轮询**：DispatcherTimer 500 ms `GET /api`（无参即全量快照）→ 更新角色图（URL 变化才下载）、应用 `chatOffset` 偏移、显示/隐藏聊天框、60 s 超时隐藏（`chatUntil = tick+120`）。
- **拖动**：`MouseLeftButtonDown` 记录 `PointToScreen` 起点 + 窗口 Left/Top，`MouseMove` 中按 `VisualTreeHelper.GetDpi` 的 DpiScale 换算物理像素→DIP，`CaptureMouse` 保证快速拖动不掉帧；`MouseLeftButtonUp` 保存 `/api/pos`。交互子元素（查看详细、×）在 `MouseLeftButtonDown` 置 `e.Handled=$true` 阻止拖动。
- **右键菜单**：切换角色（`/api/select?folder=`）/ 打开主界面 / 关闭置顶小窗（`/api/window?enabled=0`）。
- **自愈**：进程退出后按失败次数指数退避重连（1 s → 15 s 封顶）；插件停止/更新时 `killWindow()` 释放。

## 8. 角色偏移（chatOffset）

不同角色立绘在 130×130 画布内站位不同，用 `chatOffsetOf(folder)` 返回聊天框图片的垂直偏移（红绿灯 +5、机器人 0、其余 +3）。页面端对聊天框图片做 `marginTop:-offset`；小窗端 `Apply-Offset` 扩展窗口高度并重排各元素，保证**文字/链接绝对位置恒定**。

## 9. 关键设计取舍

| 取舍 | 理由 |
|---|---|
| ROOT ctx 挂事件 | 覆盖全部 agent/子 agent，而非仅当前会话 |
| 快照增量 + 全量双模式 | Client 用 `since` 增量拉取；角色切换后一次性全量刷新避免漏通知 |
| 通知只显示最新一条 | 避免遮挡；`slice(0,1)` 按 seq 倒序 |
| HTTP 而非 RPC 给小窗 | 小窗独立进程，无法访问 Cordis 服务；HTTP 是唯一可行通道 |
| PS1 运行时生成到 baseDir | 小窗脚本需要本地文件 + 独立进程；仓库副本作为源码 |
