# dsh-plugin-StatusLight

为 [DeepSeek Harness](https://github.com/deepseek-ai) 配备的**状态灯插件**：角色表情状态灯 + 系统级置顶小窗。模型思考、出错、完成回答时切换角色表情，并用角色聊天框气泡提示用户。

## 功能

- **状态灯**：浮动显示当前角色表情，跟随模型状态切换——
  - 思考中 → `action/think` 图片
  - 出错 → `action/error` 图片（随机一张）
  - 完成回答 → `action/complete` 图片（随机一张）
  - 启动/空闲 → `action/default` 图片
  - 优先级：`error > think > complete > default`
- **多角色**：支持 芙宁娜 / 胡桃 / 空 / 纳西妲 / 枫原万叶 / 荧 / 钟离 / 红绿灯 / 机器人，右键状态灯可切换（选择持久化）
- **聊天框气泡**：模型完成/出错/向你提问时，在角色头顶弹出角色专属聊天框（文字 + "查看详细"跳转对应会话），60 秒自动消失，可点红叉关闭
- **系统级置顶小窗**（Windows）：独立于浏览器的置顶透明小窗，浏览器最小化时依然显示角色状态与聊天框；支持拖动、右键切换角色
- **透明背景**：WPF 逐像素透明渲染，无紫边

## 角色文件结构

```
dsh-plugin-StatusLight/
├── 角色文件夹/            # 每个角色一个文件夹（可自定义新增）
│   ├── action/
│   │   ├── default/       # 默认/空闲表情
│   │   ├── think/         # 思考表情
│   │   ├── error/         # 出错表情（可多张，随机）
│   │   └── complete/      # 完成表情（可多张，随机）
│   └── 聊天框/            # 聊天框气泡图片（当前固定使用 聊天框_长句.png）
├── rule.txt               # 插件规则说明
├── plugin-host.js         # Cordis 插件 Host 半部分源码
├── plugin-client.js       # Cordis 插件 Client 半部分源码
└── statuslight-window.ps1 # 置顶小窗脚本（Host 运行时生成）
```

角色文件夹与 `action` 子目录的对应关系（显示名映射）：

| 角色名 | 文件夹名 |
|---|---|
| 芙宁娜 | fufu |
| 胡桃 | hutao |
| 空 | kong |
| 纳西妲 | naxida |
| 枫原万叶 | wanye |
| 荧 | ying |
| 钟离 | zhongli |
| 红绿灯 | 红绿灯 |
| 机器人 | 机器人 |

## 安装与使用

1. 将角色文件夹（及 `rule.txt`）放在 DeepSeek Harness 的工作区目录。
2. 在 Harness 会话中通过动态 Cordis 插件机制，将 `plugin-host.js` 作为 Host 代码、`plugin-client.js` 作为 Client 代码定义并运行（`cordis_define` + `cordis_run`）。
3. 状态灯出现在页面右下角；置顶小窗默认开启（`TopMost` 透明窗口）。
4. 右键状态灯/小窗角色可切换角色；左键拖动小窗可移动位置（自动保存）。

## 交互说明

- **左键**：拖动置顶小窗位置（自动保存）
- **右键**：切换角色 / 打开主界面 / 关闭置顶小窗
- **聊天框**：
  - **查看详细**：跳转到对应 agent/子 agent 会话（浏览器窗口自动恢复聚焦，不退出全屏）
  - **红叉 ×**：关闭聊天框（两端同步，切换角色/开关小窗不会复活）
  - 60 秒后自动消失；对应 agent 再次运行时自动取消
- **角色偏移**：红绿灯聊天框上移 5px、机器人不偏移、其余角色上移 3px（文字绝对位置恒定）

## 配置

运行配置保存在工作区 `.statuslight.json`（已加入 `.gitignore`，不随仓库发布）：

```json
{
  "character": "红绿灯",
  "position": { "x": 1358, "y": 533 },
  "window": true,
  "windowPos": { "x": 1334, "y": 509 }
}
```

## 许可

请自行确认角色图片素材的使用许可；代码部分可按个人使用自由修改。
