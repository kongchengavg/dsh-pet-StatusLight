# 安装指南（INSTALL.md）

本文档写给 **AI 助手**：请按以下步骤，为 DeepSeek Harness（dsh）安装并验证 **dsh-pet-StatusLight** 插件。人类用户也可以把它当作安装对照清单。

## 0. 背景（必读）

dsh-pet-StatusLight 是 **静态 dsh 插件**（bundle）：本仓库即标准 dsh 插件包（`package.json` 声明 `dsh.bundle.patch` + host/client 入口），通过 `dsh plugin --profile <name> add <npm|git>` 挂载进 profile，由宿主自动加载——**任何会话都不需要 `cordis_*` 工具**，重启后仍生效。

> 素材发现：插件会从会话工作区（agent cwd / workspaceRoot）自动定位角色素材（`assets/characters/` 或根目录布局）。

## 1. 前提检查

1. 确认本仓库目录可访问，且 `assets/characters/` 下至少存在一个角色文件夹（每个角色含 `action/` 子目录）。
2. 确认 `dsh` CLI 可用（`dsh --version` 或 `npx -y @deepseek-ai/dsh --version`）。

## 2. 安装

### 2.1 添加插件到 profile

任选一种来源（推荐 npm 包名，已发布）：

```sh
dsh plugin --profile web add dsh-pet-statuslight   # npm 一键安装
dsh plugin --profile web add git+https://github.com/kongchengavg/dsh-pet-StatusLight.git   # GitHub 源
```

- `<profile>`：当前使用的 dsh 前端 profile（通常为 `web`；可用 `dsh profile list` 查看）。
- 命令会把 `dsh-pet-statuslight` 写入该 profile 的 `package.json`（dependencies + `dsh.profile.bundles`）并完成安装。

### 2.2 重启 dsh web 使插件加载

安装后重启 dsh web 服务（或在 Harness 界面执行重启；`.dsh` 下通常有重启脚本）。重启后：

1. **Host 验证**（任意终端）：
   ```sh
   curl http://127.0.0.1:<dsh端口>/statuslight/api/state
   ```
   期望返回 JSON：`characters` 含 9 个角色、`character` 为当前角色、`image` 为 `/statuslight/assets/characters/...` 图片 URL。
2. **页面验证**：浏览器右下角出现角色状态灯；右键可切换角色。
3. **小窗验证**（仅 Windows）：屏幕右上角出现透明置顶小窗。

### 2.3 卸载 / 更新

```sh
dsh plugin --profile web remove dsh-pet-statuslight   # 卸载
dsh plugin --profile web add <新来源>              # 更新（重新 add 即可）
```

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
| 静态安装后没生效 | 未重启 dsh web；或 add 时 profile 名不对（`dsh profile list` 核对） |

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

向用户确认：状态灯正常、小窗（Windows）正常、agent 运行时状态切换与聊天框弹出。全部通过即为安装成功。
