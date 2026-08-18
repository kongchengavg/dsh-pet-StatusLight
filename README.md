# dsh-plugin-StatusLight

为 [DeepSeek Harness](https://github.com/deepseek-ai) 编写的 **状态灯动态 Cordis 插件**：用角色表情实时反映模型运行状态，并在任务完成 / 出错 / 向你提问时弹出角色专属聊天框气泡。支持 **9 个角色** 随时切换，还提供 **Windows 系统级置顶透明小窗**（独立于浏览器窗口，浏览器最小化也能看到状态）。

> 中文 | [English](README.en.md)

## 特性一览

- **角色状态灯**：浮动显示当前角色表情，随模型状态自动切换——
  - 思考中 → `think` 表情
  - 出错 → `error` 表情（随机一张）
  - 完成回答 → `complete` 表情（随机一张）
  - 启动 / 空闲 → `default` 表情
  - 状态优先级：`error > think > complete > default`，出错后自动恢复
- **多角色**：内置 芙宁娜、胡桃、空、纳西妲、枫原万叶、荧、钟离、红绿灯、机器人 共 9 个角色；右键状态灯或置顶小窗即可切换，选择持久化保存
- **聊天框气泡**：任务完成 / 出错 / 向你提问时，角色头顶弹出专属聊天框（文字 + 「查看详细」跳转对应会话）；60 秒自动消失，可点红叉立即关闭
- **「查看详细」跳转**：一键定位到对应 agent / 子 agent 会话；浏览器窗口自动恢复并聚焦（不退出全屏）
- **系统级置顶小窗**（Windows）：基于 PowerShell + WPF 的置顶透明小窗，浏览器最小化时依然显示角色状态与聊天框；支持自由拖动、右键菜单、断线自动重连
- **逐像素透明**：WPF `AllowsTransparency` 每像素 Alpha 渲染，无紫边/黑边
- **持久化**：角色、网页位置、小窗位置、小窗开关均保存在工作区 `.statuslight.json`

## 目录结构

```
dsh-plugin-StatusLight/
├── src/                          # 源码（Cordis 插件定义）
│   ├── host/index.js             # Host 半部分：状态机/事件/RPC/HTTP API/小窗进程
│   ├── client/index.js           # Client 半部分：网页右下角浮动状态灯 UI
│   └── window/statuslight-window.ps1  # 置顶小窗 WPF 脚本（仓库副本）
├── assets/
│   └── characters/               # 角色素材（每角色一个文件夹，可自定义新增）
│       ├── fufu/                 # 芙宁娜
│       ├── hutao/                # 胡桃
│       ├── kong/                 # 空
│       ├── naxida/               # 纳西妲
│       ├── wanye/                # 枫原万叶
│       ├── ying/                 # 荧
│       ├── zhongli/              # 钟离
│       ├── 红绿灯/                # 红绿灯
│       └── 机器人/                # 机器人
├── docs/
│   ├── rule.zh.md                # 插件需求规则说明（原 rule.txt）
│   ├── architecture.md           # 架构设计
│   └── api.md                    # HTTP API / RPC / 配置 / 素材目录规范
├── manifest.json                 # 插件元数据
├── LICENSE                       # MIT（代码部分）
├── README.md                     # 本文档
└── README.en.md                  # English
```

### 角色素材规范

每个角色目录内固定为：

```
assets/characters/<角色文件夹>/
├── action/
│   ├── default/      # 默认/空闲表情（可多张，随机）
│   ├── think/        # 思考表情（可多张，随机）
│   ├── error/        # 出错表情（可多张，随机）
│   └── complete/     # 完成表情（可多张，随机）
└── 聊天框/            # 聊天框气泡图片（当前固定使用 聊天框_长句.png）
```

> 兼容旧布局：角色目录也可直接放在工作区根目录（`<角色文件夹>/action/...`），插件会自动探测两种布局并优先使用 `assets/characters`。

## 安装与使用

### 环境要求

- Windows（置顶小窗依赖 PowerShell 5.1 + .NET WPF，均为系统自带）
- DeepSeek Harness 运行中的会话

### 步骤

1. 将本仓库（或其中 `assets/characters` 目录）放入 DeepSeek Harness 的工作区目录。
2. 在 Harness 会话中通过 **动态 Cordis 插件机制** 加载：
   - `src/host/index.js` 作为 **Host 代码**
   - `src/client/index.js` 作为 **Client 代码**
   - 使用 `cordis_define`（kind: new，建议 idPrefix `stlt`）定义，再 `cordis_run` 运行
3. 状态灯出现在网页右下角；置顶小窗默认开启（屏幕右上角透明窗口）。
4. 右键角色可切换角色；左键拖动小窗可移动（自动保存位置）。

## 交互说明

| 操作 | 效果 |
|---|---|
| 左键拖动（小窗） | 移动置顶小窗位置（自动保存） |
| 右键（网页 / 小窗） | 切换角色 / 打开主界面 / 关闭置顶小窗 |
| 聊天框「查看详细」 | 跳转对应 agent / 子 agent 会话（恢复浏览器窗口，不退出全屏） |
| 聊天框「×」 | 关闭聊天框（两端同步，切换角色 / 开关小窗不会复活） |
| 聊天框自动消失 | 60 秒超时，或对应 agent 再次运行时提前隐藏 |

角色聊天框垂直偏移（保证文字区域恒定、图片上下对齐）：

| 角色 | 偏移 |
|---|---|
| 红绿灯 | 上移 5px |
| 机器人 | 不偏移 |
| 其他角色 | 上移 3px |

## 配置

运行配置保存在工作区 `.statuslight.json`（已加入 `.gitignore`，不会随仓库发布）：

```json
{
  "character": "胡桃",
  "position": { "x": 1358, "y": 533 },
  "window": true,
  "windowPos": { "x": 1334, "y": 509 }
}
```

| 字段 | 说明 |
|---|---|
| `character` | 当前角色（文件夹名） |
| `position` | 网页浮动状态灯位置 |
| `window` | 置顶小窗是否开启 |
| `windowPos` | 置顶小窗位置 |

## 技术栈

- **Host**：DeepSeek Harness 动态 Cordis 插件（ROOT ctx），监听 `agent/status` / `agent/error` / `tools/result` / `agent/disposed` 事件驱动状态机
- **Client**：React（无 JSX，`React.createElement`）+ `slots.inject('shell.overlay')` + `styles.insert`
- **置顶小窗**：PowerShell 5.1 + WPF（`AllowsTransparency` 逐像素透明、`Topmost`、DispatcherTimer 500ms 轮询、DPI 感知拖拽、进程自愈重连）
- **HTTP**：`webServer.register({ kind: 'prefix', path: '/statuslight' })` 提供状态快照与图片静态服务

详见 [docs/architecture.md](docs/architecture.md) 与 [docs/api.md](docs/api.md)。

## 许可

- **代码**：MIT（见 [LICENSE](LICENSE)）
- **角色图片素材**：版权归原作者 / 原作品所有，仅供个人学习使用，请自行确认使用许可；如需分发请替换为自有素材。

> 提示：本插件通过动态 Cordis 机制定义，属会话内临时扩展，重启后需重新加载；仓库内的 `src/host/index.js`、`src/client/index.js` 即定义时所用源码。
