# API 参考（API Reference）

本文档列出插件暴露的接口：Client↔Host RPC、HTTP API、配置与素材目录约定。

## 1. Client ↔ Host RPC（harness.handle / host.call）

由 Client 调用（`host.call('status-light/xxx', args)`），返回 Promise。

### `status-light/state`

- 入参：`{ since?: number }` —— 增量拉取，仅返回 `seq > since` 的通知
- 返回：状态快照

```jsonc
{
  "desktopHost": true,                // 是否由 DSH Desktop 承载
  "desktopNotificationsEnabled": false, // Desktop 原生通知是否开启；false 时气泡回退为普通 web 行为
  "desktopClientActive": true,        // Desktop renderer 是否可见且位于前台
  "currentViewedSession": "session-current", // 当前会话；可空
  "state": "think",                    // default | think | error | complete
  "image": "/statuslight/assets/characters/hutao/action/think/%E6%80%9D%E8%80%83.png", // 当前角色图 URL（可空）
  "character": { "folder": "hutao", "name": "胡桃" },
  "characters": [ { "folder": "红绿灯", "name": "红绿灯" }, /* ...9 个 */ ],
  "position": { "x": 1358, "y": 533 }, // 网页位置（可空）
  "window": true,                      // 置顶小窗开关
  "jump": null,                        // 待跳转：{ id, agentId, parentId, mode }（60s TTL）
  "chatOffset": 3,                     // 聊天框垂直偏移
  "runningAgents": [ "session-..." ],  // 正在运行的 agent id 列表
  "dismissed": [],                     // 已忽略的通知 seq 集合
  "notifications": [                   // 新通知（增量）
    { "seq": 12, "kind": "complete", "text": "「xx」完成啦",
      "agentId": "session-...", "parentId": null, "mode": null,
      "canJump": true,                 // Desktop 原生通知开启时：前台且不同会话；关闭时与普通 web 一样恒为 true
      "chatbox": "/statuslight/assets/characters/.../聊天框_长句.png" }
  ]
}
```

### `status-light/select-character`

- 入参：`{ folder: string }`；返回 `{ ok: boolean, character?: { folder, name } }`

### `status-light/save-position`

- 入参：`{ x: number, y: number }`（网页状态灯位置）；返回 `{ ok }`

### `status-light/window`

- 入参：`{ enabled: boolean }`；返回 `{ ok, window }`。开启会立即拉起小窗进程，关闭则终止。

### `status-light/dismiss`

- 入参：`{ seq: number }`；返回 `{ ok }`。标记通知忽略（持久化到会话内存，随快照同步）。

## 2. HTTP API（置顶小窗 / 外部调用）

根路径：`http://127.0.0.1:<harness-port>/statuslight/api`。以下均返回 JSON。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api` 或 `/api/state` | 全量状态快照（同 RPC `since=0`） |
| GET | `/api/select?folder=<角色>` | 切换角色 |
| GET | `/api/window?enabled=1\|0` | 开关置顶小窗 |
| GET | `/api/jump?agent=<id>&seq=<n>&parent=<id>&mode=<mode>` | 设置跳转（60 s TTL），并可用 `seq` 在同一次请求中忽略通知；Desktop 专用模式仅接受不同于当前会话的目标 |
| GET | `/api/dismiss?seq=<n>` | 忽略通知 |
| GET | `/api/view?session=<id>&visible=1&active=1&read=1` | 上报当前会话、页面可见性及 Desktop 前台状态；`read=1` 时将目标会话通知标记为已读 |
| GET | `/api/pos?x=<n>&y=<n>` | 保存小窗位置 |
| GET | `/statuslight/<角色>/action/<状态>/<文件>` | 静态图片（两种布局自动回退） |

> 图片路由示例：`/statuslight/assets/characters/hutao/action/think/思考.png` 或旧布局 `/statuslight/hutao/action/think/思考.png` 均可命中。

## 3. 配置（.statuslight.json）

保存在 Host 探测到的 Base 目录（工作区），由 Host 读写：

| 字段 | 类型 | 说明 |
|---|---|---|
| `character` | string | 当前角色文件夹名 |
| `position` | {x,y} | 网页浮动状态灯位置 |
| `window` | boolean | 置顶小窗开关 |
| `windowPos` | {x,y} | 置顶小窗位置（DIP） |

## 4. 素材目录约定

### 角色文件夹（`assets/characters/<folder>/` 或 `<folder>/`）

| 路径 | 用途 | 说明 |
|---|---|---|
| `action/default/` | 默认/空闲 | 多张随机；兼容 `defualt` 拼写 |
| `action/think/` | 思考 | 多张随机 |
| `action/error/` | 出错 | 多张随机 |
| `action/complete/` | 完成 | 多张随机 |
| `聊天框/` | 聊天气泡 | 当前固定使用 `聊天框_长句.png`，缺失时取第一张 |

支持格式：png / jpg / jpeg / gif / webp / svg。

### 显示名映射（KNOWN）

| 文件夹 | 显示名 |
|---|---|
| fufu | 芙宁娜 |
| hutao | 胡桃 |
| kong | 空 |
| naxida | 纳西妲 |
| wanye | 枫原万叶 |
| ying | 荧 |
| zhongli | 钟离 |
| 红绿灯 | 红绿灯 |
| 机器人 | 机器人 |

> 未知文件夹名回退为文件夹名本身显示；`chatOffsetOf` 对未知角色默认 +3。

## 5. 事件（Host 监听）

| 事件 | 载荷要点 | 用途 |
|---|---|---|
| `agent/status` | `{ agent, status: 'running'\|'idle' }` | 状态机 + complete 通知 |
| `agent/error` | `{ agent }` | error 状态 + 错误通知 |
| `tools/result` | `(exec, result)` | `exec.name === 'ask_user_question'` → question 通知 |
| `agent/disposed` | `{ agent }` | 清理 running 计数 |
