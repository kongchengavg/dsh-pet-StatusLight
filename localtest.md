# 本地测试流程（localtest.md）

> 本文档基于 **dsh-pet-StatusLight** 插件的一次完整本地测试整理，用于规范后续本地测试流程。
> 适用环境：Windows + DeepSeek Harness（dsh web，端口 3080），插件以 **link 方式**挂载本地项目目录。

---

## 0. 背景

- 插件通过 `dsh plugin --profile web add <link:本地路径>` 安装，改源码后**只需重启 dsh web** 即生效（无需重装）。
- 插件分两部分：
  - **Host 端**：`lib/index.js`（注册 `/statuslight/api/*` 路由、状态机、置顶小窗管理）
  - **Client 端**：`client/client.js`（网页右下角状态灯、聊天框、右键菜单）
- 关键端口：dsh web 服务 **3080**；置顶小窗由 host 通过 PowerShell 拉起（`statuslight-window.ps1`）。

---

## 1. 前置检查

```powershell
# 1) 确认 dsh CLI 可用
dsh --version                                    # 期望 0.1.0-rc.7 或更高

# 2) 确认 profile 与端口
dsh --profile web --dump-config 2>&1 | Select-String "dsh-pet-statuslight"
Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue   # 当前监听进程

# 3) 确认素材目录存在（9 个角色）
Get-ChildItem "assets/characters" -Directory | Select-Object Name   # 红绿灯/机器人/fufu/hutao/kong/naxida/wanye/ying/zhongli
```

**关键路径速查：**

| 项 | 路径 |
|---|---|
| DSH_HOME | `C:\Users\1\.dsh` |
| web profile | `C:\Users\1\.dsh\profiles\web` |
| profile 配置 | `...\profiles\web\package.json` + `...\profiles\web\cordis.patch.yml` |
| **dshmarket 状态（最大坑）** | `...\profiles\web\.dsh-market\state.json` |
| dsh bin | `C:\Users\1\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\lib\bin.js` |
| 插件运行配置 | 项目根 `.statuslight.json`（已被 .gitignore 排除） |

---

## 2. 安装本地插件（link 方式）

```powershell
# 在插件项目根目录执行
dsh plugin --profile web add "link:D:/Users/1/Desktop/code/agent/dsh/dsh-plugin/dsh-pet-StatusLight"
```

**安装后自动完成：**
- `profiles/web/package.json` 的 `dependencies` 增加 `"dsh-pet-statuslight": "link:..."` ✅
- `dsh.profile.bundles` 末尾追加 `"dsh-pet-statuslight"`（reconcile 自动）✅
- `profiles/web/node_modules/dsh-pet-statuslight` 符号链接指向项目目录 ✅

**验证：**

```powershell
Get-Content "$env:DSH_HOME\profiles\web\package.json"   # dependencies + bundles 都有
dsh --profile web --dump-config 2>&1 | Select-String "dsh-pet-statuslight" -Context 0,1
# 期望：# == dsh-pet-statuslight / - id: dsh-pet-statuslight /   name: dsh-pet-statuslight
```

---

## 3. ⚠️ 两个必查的"隐形开关"（本次测试最大坑）

### 3.1 profile patch 层（cordis.patch.yml）

`profiles/web/cordis.patch.yml` 中如果存在 **未注释的禁用条目**，插件不会加载：

```yaml
- id: dsh-pet-statuslight
  disabled: true        # ← 若存在此行，必须注释掉或删除
```

确认方式：`--dump-config` 中该段**不带 `disabled`**。

### 3.2 dshmarket 持久化禁用状态（★ 最关键）

**现象**：`--dump-config` 显示插件已启用，但无论重启多少次，插件都不加载（host 路由 404、`__DSH_BOOT__` 无条目、rev 不变）。

**根因**：`dshmarket`（插件市场）会在启动时**重放**它持久化的禁用清单：

```json
// C:\Users\1\.dsh\profiles\web\.dsh-market\state.json
{ "disabled": ["dsh-pet", "dsh-pet-statuslight"], "groups": {}, "groupOrder": [] }
```

`dshmarket/lib/routes.js` 启动时对 `disabled` 列表里的每个名字调用 `setEntryDisabled(name, true)`，
把 loader 树里的 entry 强制标为 disabled（`entry.update({disabled:true})`）——**与配置文件无关，纯内存覆盖**。

**排查方法**（loader 树中 entry 的 options 自带 `disabled:true`）：
```powershell
Get-Content "$env:DSH_HOME\profiles\web\.dsh-market\state.json"
```

**修复**：把 `"dsh-pet-statuslight"` 从 `disabled` 数组移除：
```json
{ "disabled": ["dsh-pet"], "groups": {}, "groupOrder": [] }
```
> `dsh-pet`（普通宠物插件）保留禁用是正常的（profile patch 里也禁用它）。

---

## 4. 重启 dsh web（干净冷启动）

> ⚠️ 重启会中断当前 GUI 会话，但会话持久化在 `.dsh/sessions`，重启后自动恢复。
> 不要依赖 `restart-dsh-web.ps1`（其日志不可靠），用下面的手动干净重启。

```powershell
# 1) 杀 3080 监听进程
$conn = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if ($conn) { $conn | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force } }

# 2) 杀残留小窗进程（防止泄漏）
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'statuslight-window\.ps1' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# 3) 等端口释放
$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) { if (-not (Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue)) { break }; Start-Sleep -Seconds 1 }

# 4) 启动（关键：cwd 必须是 deepseek-harness 空目录）
$node = 'C:\Program Files\nodejs\node.exe'
$bin  = 'C:\Users\1\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\lib\bin.js'
$wd   = 'D:\Users\1\Desktop\code\agent\deepseek-harness'
$out  = "$env:DSH_HOME\dsh-web.out.log"; $err = "$env:DSH_HOME\dsh-web.err.log"
$p = Start-Process -FilePath $node -ArgumentList @($bin,'web') -WorkingDirectory $wd `
     -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
"new PID $($p.Id)"

# 5) 等就绪
$d2 = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $d2) { Start-Sleep -Seconds 2; if (Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue) { "server up"; break } }
```

---

## 5. 验证清单（安装成功判定）

### 5.1 Host API

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3080/statuslight/api/state" | ConvertTo-Json -Depth 4
```

期望 JSON 包含：
- `characters` **9 个角色**（红绿灯、机器人、fufu 芙宁娜、hutao 胡桃、kong 空、naxida 纳西妲、wanye 枫原万叶、ying 荧、zhongli 钟离）
- `character` 当前角色、`image` 图片 URL、`window` 布尔值
- `state`（think/error/complete/default）

> 若返回的是 HTML（SPA 首页）而非 JSON → 插件未加载，回到第 3 节排查。

### 5.2 Client 插件

```powershell
# 1) client bundle 可访问
Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3080/plugins/dsh-pet-statuslight/client.js" | Select StatusCode, RawContentLength
# 期望：200 text/javascript

# 2) __DSH_BOOT__ 里有 statuslight 条目（且 rev 变化）
$html = (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3080/").Content
$boot = ([regex]::Match($html,'window\.__DSH_BOOT__ = (\{.*?\})</script>')).Groups[1].Value | ConvertFrom-Json
$boot.entries.id -contains 'dsh-pet-statuslight'     # 期望 True

# 3) 角色图片可访问
Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3080/statuslight/assets/characters/红绿灯/action/think/thinking.png" | Select StatusCode, Headers
# 期望：200 image/png
```

### 5.3 交互功能

```powershell
# 角色切换
Invoke-RestMethod -Uri "http://127.0.0.1:3080/statuslight/api/select?folder=fufu"   # {"ok":true}
# 窗口开关
Invoke-RestMethod -Uri "http://127.0.0.1:3080/statuslight/api/window?enabled=1"     # {"ok":true,"window":true}
Invoke-RestMethod -Uri "http://127.0.0.1:3080/statuslight/api/window?enabled=0"     # {"ok":true,"window":false}
```

### 5.4 置顶小窗（Windows）

```powershell
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match 'statuslight-window\.ps1' } |
  Select-Object ProcessId, CommandLine
```
- 小窗进程应存活（常驻模式，`-Api http://127.0.0.1:3080/statuslight/api`）
- `window:true` 时小窗显示；`window:false` 时小窗隐藏但进程保留
- 小窗可拖动（位置自动保存）、右键切换角色/关闭

### 5.5 网页端显示

- 网页右下角出现状态灯角色（小窗关闭时）
- 右键网页角色可切换角色
- 聊天框：任务完成/出错/提问时弹出，"查看详细"跳转会话，"×"关闭

---

## 6. 本次测试已修复的 bug（供回归）

| Bug | 根因 | 修复文件 |
|---|---|---|
| 关闭小窗后网页角色不出现（需刷新） | 后台标签页 `setInterval` 被浏览器节流，轮询不更新 | `client/client.js`：加 `visibilitychange` 监听，页面可见时强制同步 |
| 拖动小窗后切换角色，小窗跳回原位置 | 拖动结束时未更新 `$script:baseTop`，切换角色触发 `Apply-Offset` 用旧 baseTop | `statuslight-window.ps1` + `lib/index.js` 内嵌 PS1：拖动结束更新 `baseTop` |
| `.statuslight.json` 永不更新（window 状态无法持久化） | 包内模式判断 `baseDir === PACKAGE_BASE_RAW` 误伤 link 安装 | `lib/index.js`：改为 `baseDir.indexOf('/node_modules/') >= 0` 才跳过读写 |
| 切换为小窗角色后网页角色延迟隐藏（~1.5s） | client 有 3-tick 宽限期（WINDOW_GRACE_TICKS） | `client/client.js`：改为 `windowOn = targetWindow` 立即隐藏 |
| 网页聊天框"查看详细"位置 | CSS margin-top 需下移 | `client/client.js`：`.sl-chatbox-link` margin-top 8→28px |

---

## 7. 测试结束：取消本地测试

```powershell
# 1) 移除插件（更新 package.json dependencies + bundles + lockfile）
dsh plugin --profile web remove dsh-pet-statuslight

# 2) 清理残留符号链接（pnpm remove 的孤儿链接，需用 cmd 删除）
cmd /c rmdir "C:\Users\1\.dsh\profiles\web\node_modules\dsh-pet-statuslight"

# 3) 确认清理干净
$pj = Get-Content "$env:DSH_HOME\profiles\web\package.json" -Raw | ConvertFrom-Json
$pj.dependencies.'dsh-pet-statuslight'                # 应为空
$pj.dsh.profile.bundles -contains 'dsh-pet-statuslight'  # 应为 False

# 4) 重启 dsh web（见第 4 节），运行中的旧进程才完全卸载插件
```

**注意**：`dsh plugin remove` 只改磁盘配置，**运行中的服务器仍加载插件**，必须重启才完全卸载。

---

## 8. 常见问题排查速查

| 现象 | 原因与处理 |
|---|---|
| `/statuslight/api/state` 返回 HTML | 插件未加载：查 `cordis.patch.yml` 是否禁用 + **查 `.dsh-market/state.json` disabled 列表** |
| `__DSH_BOOT__` rev 不变、无 statuslight 条目 | 同上，dshmarket 持久化禁用覆盖（第 3.2 节） |
| 改源码后不生效 | client/host 都是静态 bundle，**必须重启 dsh web**；link 安装无需重装 |
| 小窗不出现 | 仅 Windows；查小窗进程是否 spawn、`window:true` 状态、`-Api` 端口 |
| 角色图片 404 | 素材布局：应为 `assets/characters/<角色>/action/<状态>/*.png` |
| 多个小窗进程 | 旧服务器泄漏的进程，手动 kill 后干净重启（第 4 节） |
| 端口 3080 被占用 | 杀监听进程 + 残留 node/powershell 后重启 |

---

## 9. 上传 GitHub / 切换远程安装

```sh
# 本地测试完成后，提交修改并推送到 GitHub
git add client/client.js lib/index.js
git commit -m "fix: ..."
git push origin main

# 安装 GitHub 版本
dsh plugin --profile web add git+https://github.com/<owner>/dsh-pet-StatusLight.git
```

**上传前注意**：
- `.gitignore` 已排除 `.statuslight.json`（含本机路径）、`/statuslight-window.ps1`（运行时生成）——正确
- `lib/index.js` 内嵌的 PS1 已含全部修复，安装远程版后 host 会重新生成脚本，**无需提交** `statuslight-window.ps1`
- 安装后如遇"插件不加载"，同样检查 `cordis.patch.yml` 与 `.dsh-market/state.json`
