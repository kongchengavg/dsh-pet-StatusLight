<h1 align="center">dsh-StatusLight</h1>

<p align="center"><b>给 DeepSeek Harness 配一个会说话的桌面宠物。</b></p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-v1.0.27-blue?style=flat-square" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platform-Windows-blue?style=flat-square" alt="Platform">
</p>

模型思考、出错、完成任务时，角色表情实时切换；完成、出错、向你提问时，角色头顶弹出专属聊天框，点一下还能跳到对应会话。就算浏览器最小化了也不怕——系统级置顶小窗继续陪着你。

## 交流

欢迎提 [issue](https://github.com/kongchengavg/dsh-StatusLight/issues/new/choose) 反馈 bug、建议或使用问题。

## 亮点及功能

- 🐾 **9 个角色桌面宠物**：芙宁娜、胡桃、空、纳西妲、枫原万叶、荧、钟离、红绿灯、机器人；右键随时切换，选择自动记住。
- 🎭 **表情实时跟随**：思考、出错、完成、空闲四种状态对应四套表情；出错优先显示，结束后自动恢复。
- 💬 **角色专属聊天框**：任务完成、出错、向你提问时弹出气泡提示，点「查看详细」直接跳到对应会话。
- 🪟 **系统级置顶小窗**（Windows）：独立于浏览器的透明小窗，浏览器最小化也照常显示；可拖动、可右键切换角色，异常退出自动重连。
- 🎨 **逐像素透明**：WPF 每像素 Alpha 渲染，无紫边。
- ⚡ **轻量免配置**：动态 Cordis 插件，会话内加载即用，不用改任何 Harness 配置。

## 安装

**方法一：交给 AI（将以下文字复制并发给 AI）**

> 「按照 https://github.com/kongchengavg/dsh-StatusLight/ 的 INSTALL.md 安装该插件」

**方法二：手动安装**

- **方式 A：静态安装（推荐，不依赖 cordis 工具）** —— 本仓库即标准 dsh 插件包：

  ```sh
  dsh plugin --profile web add D:/Users/1/Desktop/code/agent/dsh/dsh-plugin/dsh-StatusLight
  ```

  重启 dsh web 后插件自动加载（任何会话都可用，无需 `cordis_*` 工具）。

- **方式 B：动态安装（需 cordis preset 会话）**

  1. 把仓库（或其中的 `assets/characters` 目录）放进 DeepSeek Harness 的工作区。
  2. 在 **cordis** preset 的会话里用动态 Cordis 机制加载：
     - `src/host/index.js` 作为 **Host 代码**
     - `src/client/index.js` 作为 **Client 代码**
     - `cordis_define` 定义后 `cordis_run` 运行
  3. 状态灯出现在页面右下角，置顶小窗默认开启。

## 用法

- **右键**状态灯或小窗：切换角色 / 打开主界面 / 关闭置顶小窗。
- **左键拖动**小窗：移动位置（自动保存）。
- **聊天框**：点「查看详细」跳到对应会话；点「×」立即关闭；60 秒后自动消失。
- 角色与位置等配置保存在工作区 `.statuslight.json`，可手动编辑。

## 免责声明

本项目按现状提供，作者不对任何特定用途（含商业使用）提供保证或背书。角色图片素材版权归原作者所有，仅供个人学习使用，请自行确认使用许可。本项目为社区开源项目，与 DeepSeek、米哈游等官方无关。

## License

代码部分采用 MIT（见 [LICENSE](LICENSE)）；角色图片素材版权归原作者所有。
