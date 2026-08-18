// dsh-pet-StatusLight — Host 半部分（静态 dsh bundle 入口）
// 通过 dsh plugin --profile web add dsh-pet-statuslight 安装，由宿主自动加载。
// 功能：状态机（default/think/error/complete）、通知、角色/配置持久化、
//       公开 API 与图片路由、置顶小窗进程管理、聊天框忽略（dismiss）。
// 角色素材目录支持两种布局：
//   A. <baseDir>/assets/characters/<角色>（推荐，本仓库结构）
//   B. <baseDir>/<角色>（兼容旧布局）
import { fileURLToPath } from 'node:url'

// 包内素材根目录（npm 分发）：lib/index.js 位于 <pkg>/lib/，包根即素材父目录。
// 素材随 npm 包分发后，任何工作区/会话都能显示角色。
const PACKAGE_BASE_RAW = (() => {
  try { return fileURLToPath(new URL('../', import.meta.url)).replace(/\\/g, '/') } catch (e) { return null }
})()

export const name = 'dsh-pet-statuslight'

export function apply(ctx) {
    const fs = ctx.get('fs')
    const agentsSvc = ctx.get('agents')
    const sessionsSvc = ctx.get('sessions')
    const timer = ctx.get('timer')
    const webServer = ctx.get('webServer')
    const subagents = ctx.get('subagents')
    const sessionTitle = ctx.get('sessionTitle')
    const sandboxPolicy = ctx.get('sandboxPolicy')
    const subprocess = ctx.get('subprocess')

    const KNOWN = { fufu: '芙宁娜', hutao: '胡桃', kong: '空', naxida: '纳西妲', wanye: '枫原万叶', ying: '荧', zhongli: '钟离', '红绿灯': '红绿灯', '机器人': '机器人' }
    const IMG_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
    const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }
    const CONFIG_NAME = '.statuslight.json'
    const WINDOW_SCRIPT = 'statuslight-window.ps1'

    let baseDir = null
    let characters = []
    let character = '红绿灯'
    let state = 'default'
    let images = { default: null, think: null, error: null, complete: null }
    let pendingPick = null
    let basePromise = null
    let running = new Map()
    let runningCount = 0
    let notifSeq = 0
    let notifications = []
    const chatboxPromises = new Map()
    let holdTimer = null
    let pendingJump = null
    let jumpId = 0
    let jumpTimer = null
    let dismissed = new Set()
    let charLocations = new Map()

    let cfg = { character: '红绿灯', position: null, window: true, windowPos: null }
    let cfgTarget = null
    let windowHandle = null
    let windowEnabled = true
    let lastExitMs = 0
    let failStreak = 0
    let respawnTimer = null
    let apiBase = null
    let scriptPath = null

    const join = (...parts) => parts.join('/')
    const extOf = (name) => { const i = name.lastIndexOf('.'); return i < 0 ? '' : name.slice(i + 1).toLowerCase() }
    const isImage = (name) => IMG_EXT.indexOf(extOf(name)) >= 0
    const norm = (p) => String(p).replace(/\\/g, '/')
    const charName = (folder) => KNOWN[folder] || folder
    const urlFor = (rel) => '/statuslight/' + rel.split('/').map((s) => encodeURIComponent(s)).join('/')
    const tryNow = () => { try { return Date.now() } catch (e) { return 0 } }
    const chatOffsetOf = (folder) => folder === '红绿灯' ? 5 : folder === '机器人' ? 0 : 3
    // 角色目录前缀：assets/characters/ 或根目录
    const charRel = (folder) => (charLocations.get(folder) === 'assets' ? 'assets/characters/' : '') + folder

    // ---------- 文件与图片 ----------
    async function listRelImages(relDir) {
      if (!fs || !baseDir) return []
      try {
        const target = await fs.resolve(baseDir + '/' + relDir)
        const entries = await fs.listDir(target)
        const out = []
        for (const e of entries) {
          if (e.type === 'file' && isImage(e.name)) out.push(relDir + '/' + e.name)
        }
        return out
      } catch (err) { return [] }
    }

    async function pickStateImage(folder, s) {
      const rel = charRel(folder)
      const dirs = s === 'default' ? ['default', 'defualt'] : [s]
      let list = []
      for (const d of dirs) {
        list = await listRelImages(rel + '/action/' + d)
        if (list.length) break
      }
      if (!list.length) {
        for (const d of ['default', 'defualt']) {
          list = await listRelImages(rel + '/action/' + d)
          if (list.length) break
        }
      }
      if (!list.length) return null
      return urlFor(list[Math.floor(Math.random() * list.length)])
    }

    // 聊天框固定使用 聊天框_长句.png
    async function pickChatbox(folder, text) {
      const list = await listRelImages(charRel(folder) + '/聊天框')
      if (!list.length) return null
      const want = '聊天框_长句.png'
      const found = list.find((p) => p.indexOf(want) >= 0)
      return urlFor(found || list[0])
    }

    // ---------- 根目录、角色、配置 ----------
    async function looksLikeBase(cand) {
      try {
        const target = await fs.resolve(cand)
        const entries = await fs.listDir(target)
        for (const e of entries) {
          if (e.type !== 'directory') continue
          if (KNOWN[e.name]) return true
          try {
            const info = await fs.stat(await fs.resolve(cand + '/' + e.name + '/action'))
            if (info && info.type === 'directory') return true
          } catch (err) {}
        }
        // assets/characters 布局
        try {
          const at = await fs.resolve(cand + '/assets/characters')
          const aes = await fs.listDir(at)
          for (const e of aes) {
            if (e.type !== 'directory') continue
            const info = await fs.stat(await fs.resolve(cand + '/assets/characters/' + e.name + '/action'))
            if (info && info.type === 'directory') return true
          }
        } catch (err) {}
      } catch (err) {}
      return false
    }

    async function findBaseDir() {
      if (!fs) return null
      const candidates = []
      try {
        if (agentsSvc) for (const a of agentsSvc.list()) {
          const cwd = a.session && a.session.header && a.session.header.cwd
          if (cwd && candidates.indexOf(norm(cwd)) < 0) candidates.push(norm(cwd))
        }
      } catch (err) {}
      try {
        if (sessionsSvc) for (const s of sessionsSvc.list()) {
          const cwd = s.header && s.header.cwd
          if (cwd && candidates.indexOf(norm(cwd)) < 0) candidates.push(norm(cwd))
        }
      } catch (err) {}
      try {
        if (sandboxPolicy && sandboxPolicy.workspaceRoot) {
          const c = norm(sandboxPolicy.workspaceRoot)
          if (candidates.indexOf(c) < 0) candidates.push(c)
        }
      } catch (err) {}
      // 新增：dsh web 进程的启动目录（静态 host 环境有 process）
      try {
        if (typeof process !== 'undefined' && process.cwd) {
          const c = norm(process.cwd())
          if (candidates.indexOf(c) < 0) candidates.push(c)
        }
      } catch (err) {}
      // 先检查候选目录本身
      for (const cand of candidates) {
        if (await looksLikeBase(cand)) return cand
      }
      // 再检查候选目录的一级子目录（素材可能在 cwd 下的子项目里）
      for (const cand of candidates) {
        try {
          const target = await fs.resolve(cand)
          const entries = await fs.listDir(target)
          for (const e of entries) {
            if (e.type !== 'directory') continue
            const sub = cand + '/' + e.name
            if (candidates.indexOf(sub) < 0 && await looksLikeBase(sub)) return sub
          }
        } catch (err) {}
      }
      // 兜底：包内素材（npm 分发，任何工作区/会话都可用）
      if (PACKAGE_BASE_RAW && await looksLikeBase(PACKAGE_BASE_RAW)) return PACKAGE_BASE_RAW
      return null
    }

    async function discoverCharacters() {
      if (!fs || !baseDir) return
      const found = []
      // 优先 assets/characters 布局
      const assetDir = baseDir + '/assets/characters'
      try {
        const at = await fs.resolve(assetDir)
        const aes = await fs.listDir(at)
        for (const e of aes) {
          if (e.type !== 'directory') continue
          try {
            const info = await fs.stat(await fs.resolve(assetDir + '/' + e.name + '/action'))
            if (info && info.type === 'directory') found.push({ folder: e.name, name: charName(e.name), loc: 'assets' })
          } catch (err) {}
        }
      } catch (err) {}
      // 兼容根目录布局
      try {
        const target = await fs.resolve(baseDir)
        const entries = await fs.listDir(target)
        for (const e of entries) {
          if (e.type !== 'directory') continue
          if (found.some((c) => c.folder === e.name)) continue
          try {
            const info = await fs.stat(await fs.resolve(baseDir + '/' + e.name + '/action'))
            if (info && info.type === 'directory') found.push({ folder: e.name, name: charName(e.name), loc: 'root' })
          } catch (err) {}
        }
      } catch (err) {}
      if (found.length) {
        characters = found.map((c) => ({ folder: c.folder, name: c.name }))
        charLocations = new Map()
        for (const c of found) charLocations.set(c.folder, c.loc)
        if (!characters.some((c) => c.folder === character)) character = characters[0].folder
      }
    }

    async function loadConfig() {
      if (!fs || !baseDir) return
      // 包内模式（npm 分发素材）：不在 node_modules 里读写运行配置
      if (PACKAGE_BASE_RAW && baseDir === PACKAGE_BASE_RAW) return
      try {
        cfgTarget = await fs.resolve(baseDir + '/' + CONFIG_NAME)
        const text = await fs.readText(cfgTarget)
        const data = JSON.parse(text)
        if (data && typeof data === 'object') {
          if (typeof data.character === 'string') cfg.character = data.character
          if (data.position && typeof data.position.x === 'number' && typeof data.position.y === 'number') cfg.position = { x: data.position.x, y: data.position.y }
          if (typeof data.window === 'boolean') cfg.window = data.window
          if (data.windowPos && typeof data.windowPos.x === 'number' && typeof data.windowPos.y === 'number') cfg.windowPos = { x: data.windowPos.x, y: data.windowPos.y }
        }
      } catch (err) {}
    }

    async function saveConfig() {
      if (!fs || !cfgTarget) return
      try { await fs.writeText(cfgTarget, JSON.stringify(cfg, null, 2)) } catch (err) { console.log('status-light save:', err && err.message) }
    }

    async function refreshCharacterImages() {
      images = { default: null, think: null, error: null, complete: null }
      refreshImage(state)
    }

    function ensureBase() {
      if (baseDir) return Promise.resolve()
      if (basePromise) return basePromise
      basePromise = (async () => {
        try {
          baseDir = await findBaseDir()
          if (baseDir) {
            await discoverCharacters()
            await loadConfig()
            if (characters.some((c) => c.folder === cfg.character)) character = cfg.character
            windowEnabled = !!cfg.window
            await refreshCharacterImages()
            if (webServer) apiBase = 'http://127.0.0.1:' + webServer.port + '/statuslight/api'
            if (windowEnabled) spawnWindow()
          }
        } finally {
          basePromise = null
        }
      })()
      return basePromise
    }

    // ---------- 状态机（优先级 error > think > complete > default） ----------
    function clearHold() { if (holdTimer) { try { holdTimer() } catch (e) {} holdTimer = null } }

    function refreshImage(s) {
      images[s] = null
      pendingPick = pickStateImage(character, s).then((url) => {
        images[s] = url
        pendingPick = null
      }).catch(() => { pendingPick = null })
    }

    function enterState(s) {
      if (state === s) return
      clearHold()
      state = s
      refreshImage(s)
    }

    function scheduleHold(ms, cb) {
      clearHold()
      if (timer) holdTimer = timer.timeout(cb, ms)
    }

    function onThinkStart() { if (state !== 'error') enterState('think') }

    function onAllIdle() {
      if (state !== 'error') {
        enterState('complete')
        scheduleHold(6000, () => { if (runningCount === 0) enterState('default') })
      }
    }

    function onError() {
      enterState('error')
      scheduleHold(8000, () => { if (runningCount > 0) enterState('think'); else enterState('default') })
    }

    // ---------- 通知 ----------
    function agentTitle(agent) {
      try {
        if (sessionTitle && agent.session) {
          const snap = sessionTitle.get(agent.session)
          if (snap && snap.title) return snap.title
        }
      } catch (err) {}
      return null
    }

    function pushNotification(kind, agent) {
      const title = agentTitle(agent)
      let text
      if (kind === 'error') text = title ? title + ' 出错了' : '出错了'
      else if (kind === 'question') text = title ? title + ' 需要你选择' : '需要你选择'
      else text = title ? title + ' 完成啦' : '完成啦'
      const header = agent.session ? agent.session.header : undefined
      const parentId = header && header.parentSession ? header.parentSession : null
      const n = { seq: ++notifSeq, kind, text, agentId: agent.id, parentId, mode: null, chatbox: null }
      const p = pickChatbox(character, text).then((url) => { n.chatbox = url }).catch(() => {})
      chatboxPromises.set(n.seq, p)
      if (parentId && subagents) {
        subagents.listChildren(parentId).then((entries) => {
          const e = (entries || []).find((x) => x.kind === 'child' && x.id === agent.id)
          if (e && e.mode) n.mode = e.mode
        }).catch(() => {})
      }
      notifications.push(n)
      if (notifications.length > 60) notifications.splice(0, notifications.length - 60)
    }

    function dismissNotification(seq) {
      if (typeof seq === 'number' && Number.isFinite(seq)) dismissed.add(seq)
    }

    // ---------- 快照 ----------
    async function buildSnapshot(since) {
      await ensureBase()
      if (pendingPick) { try { await pendingPick } catch (e) {} }
      const s = typeof since === 'number' ? since : 0
      const fresh = notifications.filter((n) => n.seq > s && !dismissed.has(n.seq))
      for (const n of fresh) {
        if (!n.chatbox && chatboxPromises.has(n.seq)) { try { await chatboxPromises.get(n.seq) } catch (e) {} }
      }
      return {
        state,
        image: images[state] || null,
        character: { folder: character, name: charName(character) },
        characters: characters.map((c) => ({ folder: c.folder, name: c.name })),
        position: cfg.position,
        window: windowEnabled,
        jump: pendingJump,
        chatOffset: chatOffsetOf(character),
        runningAgents: Array.from(running.keys()),
        dismissed: Array.from(dismissed),
        notifications: fresh.map((n) => ({ seq: n.seq, kind: n.kind, text: n.text, agentId: n.agentId, parentId: n.parentId, mode: n.mode, chatbox: n.chatbox }))
      }
    }

    async function setCharacter(folder) {
      if (!folder || !characters.some((c) => c.folder === folder)) return false
      character = folder
      cfg.character = folder
      await saveConfig()
      await refreshCharacterImages()
      for (const n of notifications) {
        if (dismissed.has(n.seq)) continue
        const p = pickChatbox(folder, n.text).then((url) => { n.chatbox = url }).catch(() => {})
        chatboxPromises.set(n.seq, p)
      }
      return true
    }

    async function setWindow(enabled) {
      windowEnabled = !!enabled
      cfg.window = windowEnabled
      await saveConfig()
      if (windowEnabled) spawnWindow()
      else killWindow()
      return windowEnabled
    }

    function setPendingJump(agentId, parentId, mode) {
      if (!agentId) return
      pendingJump = { id: ++jumpId, agentId: String(agentId), parentId: parentId ? String(parentId) : null, mode: mode ? String(mode) : null }
      if (jumpTimer) { try { jumpTimer() } catch (e) {} }
      jumpTimer = timer ? timer.timeout(() => { pendingJump = null; jumpTimer = null }, 60000) : null
    }

    // ---------- 图片 + 公开 API 路由 ----------
    function sendJson(res, obj, status) {
      try {
        res.writeHead(status || 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' })
        res.end(JSON.stringify(obj))
      } catch (e) {}
    }

    if (webServer && fs) {
      ctx.effect(() => webServer.register({
        kind: 'prefix',
        path: '/statuslight',
        handler: async (req, res) => {
          try {
            await ensureBase()
            if (!baseDir) { res.writeHead(404); res.end(); return }
            const pathname = (req.url || '/').split('?')[0]
            const parts = pathname.split('/').filter(Boolean)
            parts.shift()
            if (!parts.length) { res.writeHead(404); res.end(); return }
            if (parts[0] === 'api') {
              const qs = (req.url || '').split('?')[1] || ''
              const params = {}
              for (const kv of qs.split('&')) {
                if (!kv) continue
                const i = kv.indexOf('=')
                if (i < 0) params[decodeURIComponent(kv)] = ''
                else params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1))
              }
              const cmd = parts[1] || 'state'
              if (cmd === 'state') { const since = Number(params.since); const snap = await buildSnapshot(Number.isFinite(since) && since > 0 ? since : 0); return sendJson(res, snap) }
              if (cmd === 'select') { const ok = await setCharacter(params.folder || null); return sendJson(res, { ok }) }
              if (cmd === 'window') { const enabled = params.enabled === '1' || params.enabled === 'true'; await setWindow(enabled); return sendJson(res, { ok: true, window: windowEnabled }) }
              if (cmd === 'jump') { setPendingJump(params.agent, params.parent, params.mode); return sendJson(res, { ok: true }) }
              if (cmd === 'dismiss') { dismissNotification(Number(params.seq)); return sendJson(res, { ok: true }) }
              if (cmd === 'pos') {
                const x = Number(params.x); const y = Number(params.y)
                if (Number.isFinite(x) && Number.isFinite(y)) { cfg.windowPos = { x: Math.round(x), y: Math.round(y) }; await saveConfig() }
                return sendJson(res, { ok: true })
              }
              return sendJson(res, { ok: false }, 404)
            }
            if (parts.length < 2) { res.writeHead(404); res.end(); return }
            const folder = decodeURIComponent(parts[0])
            const rel = parts.slice(1).map((p) => decodeURIComponent(p)).join('/')
            // 图片路由兼容两种布局：assets/characters/<folder>/... 与 <folder>/...
            const candidates = []
            if (charLocations.get(folder) === 'assets') candidates.push(baseDir + '/assets/characters/' + folder + '/' + rel)
            candidates.push(baseDir + '/' + folder + '/' + rel)
            let served = false
            for (const abs of candidates) {
              if (abs.indexOf('..') >= 0 || abs.indexOf('\\') >= 0) { res.writeHead(403); res.end(); return }
              try {
                const target = await fs.resolve(abs)
                const info = await fs.stat(target)
                if (info && info.type === 'file') {
                  const bytes = await fs.readBytes(target, undefined, 20 * 1024 * 1024)
                  res.writeHead(200, { 'Content-Type': MIME[extOf(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
                  res.end(bytes)
                  served = true
                  break
                }
              } catch (err) {}
            }
            if (!served) { res.writeHead(404); res.end() }
          } catch (err) {
            try { res.writeHead(500); res.end() } catch (e) {}
          }
        }
      }))
    }

    // ---------- 置顶小窗（Windows PowerShell + WPF，脚本运行时生成到 statuslight-window.ps1） ----------
    const PS1 = '\uFEFF' + 'param(\n' + '  [string]$Api = "http://127.0.0.1:3080/statuslight/api",\n' + '  [string]$Config = ""\n' + ')\n' +
      'Add-Type -AssemblyName PresentationFramework\nAdd-Type -AssemblyName PresentationCore\nAdd-Type -AssemblyName WindowsBase\n$ErrorActionPreference = "SilentlyContinue"\n' +
      'Add-Type -TypeDefinition @"\nusing System;\nusing System.Runtime.InteropServices;\npublic static class SLWin {\n  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);\n  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);\n  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);\n}\n"@\n' +
      '$root = $Api\n$idx = $Api.IndexOf("/statuslight/api")\nif ($idx -ge 0) { $root = $Api.Substring(0, $idx) }\n$mainUrl = $root\n$wc = New-Object System.Net.WebClient\n' +
      'function Find-GuiWindow {\n  $cands = New-Object System.Collections.ArrayList\n  foreach ($name in @("chrome", "msedge", "firefox", "brave", "opera", "360chrome", "qqbrowser", "seamonkey")) {\n    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue\n    foreach ($p in $procs) {\n      if ($p.MainWindowHandle -ne 0) {\n        if ($p.MainWindowTitle -like "*DeepSeek Harness*") { return $p.MainWindowHandle }\n        [void]$cands.Add($p.MainWindowHandle)\n      }\n    }\n  }\n  if ($cands.Count -gt 0) { return [int]$cands[0] }\n  return 0\n}\n' +
      'function Open-Gui {\n  $hwnd = Find-GuiWindow\n  if ($hwnd -ne 0) {\n    try {\n      if ([SLWin]::IsIconic($hwnd)) { [void][SLWin]::ShowWindow($hwnd, 9) }\n      [void][SLWin]::SetForegroundWindow($hwnd)\n      return\n    } catch {}\n  }\n  try { Start-Process $mainUrl } catch {}\n}\n' +
      '$window = New-Object System.Windows.Window\n$window.WindowStyle = [System.Windows.WindowStyle]::None\n$window.ResizeMode = [System.Windows.ResizeMode]::NoResize\n$window.AllowsTransparency = $true\n$window.Background = [System.Windows.Media.Brushes]::Transparent\n$window.Topmost = $true\n$window.ShowInTaskbar = $false\n$window.Width = 190\n$window.Height = 236\n$window.Left = [System.Windows.SystemParameters]::PrimaryScreenWidth - 210\n$window.Top = 20\n' +
      'if ($Config -ne "" -and (Test-Path $Config)) { try { $cfg = Get-Content -Raw -Encoding UTF8 -Path $Config | ConvertFrom-Json; if ($cfg.windowPos -and $null -ne $cfg.windowPos.x -and $null -ne $cfg.windowPos.y) { $window.Left = [double]$cfg.windowPos.x; $window.Top = [double]$cfg.windowPos.y } } catch {} }\n' +
      '$script:baseTop = [double]$window.Top\n' +
      '$grid = New-Object System.Windows.Controls.Grid\n$grid.Width = 190\n$grid.Height = 236\n' +
      '$chatImg = New-Object System.Windows.Controls.Image\n$chatImg.Width = 190\n$chatImg.Height = 90\n$chatImg.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Left\n$chatImg.VerticalAlignment = [System.Windows.VerticalAlignment]::Top\n$chatImg.Margin = New-Object System.Windows.Thickness(0, 4, 0, 0)\n$chatImg.Stretch = [System.Windows.Media.Stretch]::Uniform\n$chatImg.Visibility = [System.Windows.Visibility]::Collapsed\n[void]$grid.Children.Add($chatImg)\n' +
      '$chatText = New-Object System.Windows.Controls.TextBlock\n$chatText.Margin = New-Object System.Windows.Thickness(0, 19, 0, 0)\n$chatText.Width = 100\n$chatText.Height = 34\n$chatText.ClipToBounds = $true\n$chatText.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center\n$chatText.VerticalAlignment = [System.Windows.VerticalAlignment]::Top\n$chatText.TextWrapping = [System.Windows.TextWrapping]::Wrap\n$chatText.TextTrimming = [System.Windows.TextTrimming]::CharacterEllipsis\n$chatText.TextAlignment = [System.Windows.TextAlignment]::Center\n$chatText.FontFamily = New-Object System.Windows.Media.FontFamily("Microsoft YaHei")\n$chatText.FontSize = 13\n$chatText.FontWeight = [System.Windows.FontWeights]::Bold\n$chatText.Foreground = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(43, 43, 58))\n$chatText.Visibility = [System.Windows.Visibility]::Collapsed\n[void]$grid.Children.Add($chatText)\n' +
      '$viewLink = New-Object System.Windows.Controls.TextBlock\n$viewLink.Margin = New-Object System.Windows.Thickness(0, 64, 0, 0)\n$viewLink.Width = 100\n$viewLink.Height = 18\n$viewLink.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center\n$viewLink.VerticalAlignment = [System.Windows.VerticalAlignment]::Top\n$viewLink.Text = "查看详细"\n$viewLink.TextAlignment = [System.Windows.TextAlignment]::Center\n$viewLink.FontFamily = New-Object System.Windows.Media.FontFamily("Microsoft YaHei")\n$viewLink.FontSize = 11\n$viewLink.FontWeight = [System.Windows.FontWeights]::Bold\n$viewLink.Foreground = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(43, 95, 217))\n$viewLink.TextDecorations = [System.Windows.TextDecorations]::Underline\n$viewLink.Cursor = [System.Windows.Input.Cursors]::Hand\n$viewLink.Visibility = [System.Windows.Visibility]::Collapsed\n' +
      '$viewLink.Add_MouseLeftButtonDown({ param($s, $e) $e.Handled = $true })\n$viewLink.Add_MouseLeftButtonUp({ param($s, $e) $e.Handled = $true; if ($script:lastNotif -ne $null) { $q = "/jump?agent=" + [uri]::EscapeDataString([string]$script:lastNotif.agentId); if ($script:lastNotif.parentId) { $q += "&parent=" + [uri]::EscapeDataString([string]$script:lastNotif.parentId) }; if ($script:lastNotif.mode) { $q += "&mode=" + [uri]::EscapeDataString([string]$script:lastNotif.mode) }; try { Invoke-RestMethod -Uri ($Api + $q) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}; try { Invoke-RestMethod -Uri ($Api + "/dismiss?seq=" + [int]$script:lastNotif.seq) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {} }; Open-Gui; Hide-Chat })\n' +
      '[void]$grid.Children.Add($viewLink)\n' +
      '$closeBtn = New-Object System.Windows.Controls.Border\n$closeBtn.Width = 20\n$closeBtn.Height = 20\n$closeBtn.CornerRadius = New-Object System.Windows.CornerRadius(10)\n$closeBtn.Background = New-Object System.Windows.Media.SolidColorBrush([System.Windows.Media.Color]::FromRgb(220, 60, 60))\n$closeBtn.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Right\n$closeBtn.VerticalAlignment = [System.Windows.VerticalAlignment]::Top\n$closeBtn.Margin = New-Object System.Windows.Thickness(0, 6, 6, 0)\n$closeBtn.Cursor = [System.Windows.Input.Cursors]::Hand\n$closeBtn.Visibility = [System.Windows.Visibility]::Collapsed\n' +
      '$closeInner = New-Object System.Windows.Controls.TextBlock\n$closeInner.Text = "×"\n$closeInner.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center\n$closeInner.VerticalAlignment = [System.Windows.VerticalAlignment]::Center\n$closeInner.Foreground = [System.Windows.Media.Brushes]::White\n$closeInner.FontSize = 13\n$closeInner.FontWeight = [System.Windows.FontWeights]::Bold\n$closeBtn.Child = $closeInner\n' +
      '$closeBtn.Add_MouseLeftButtonDown({ param($s, $e) $e.Handled = $true })\n$closeBtn.Add_MouseLeftButtonUp({ param($s, $e) $e.Handled = $true; if ($script:lastNotif -ne $null) { try { Invoke-RestMethod -Uri ($Api + "/dismiss?seq=" + [int]$script:lastNotif.seq) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {} }; Hide-Chat })\n' +
      '[void]$grid.Children.Add($closeBtn)\n' +
      '$charImg = New-Object System.Windows.Controls.Image\n$charImg.Width = 130\n$charImg.Height = 130\n$charImg.HorizontalAlignment = [System.Windows.HorizontalAlignment]::Center\n$charImg.VerticalAlignment = [System.Windows.VerticalAlignment]::Bottom\n$charImg.Stretch = [System.Windows.Media.Stretch]::Uniform\n[void]$grid.Children.Add($charImg)\n$window.Content = $grid\n' +
      '$script:state = $null\n$script:lastImg = ""\n$script:lastChat = ""\n$script:lastSeq = 0\n$script:tick = 0\n$script:drag = $null\n$script:lastNotif = $null\n$script:chatUntil = 0\n$script:curOffset = 0\n' +
      'function Hide-Chat { $script:chatUntil = 0; $chatImg.Visibility = [System.Windows.Visibility]::Collapsed; $chatText.Visibility = [System.Windows.Visibility]::Collapsed; $viewLink.Visibility = [System.Windows.Visibility]::Collapsed; $closeBtn.Visibility = [System.Windows.Visibility]::Collapsed }\n' +
      'function Apply-Offset([int]$offset) { if ($offset -eq $script:curOffset) { return }; $script:curOffset = $offset; $grow = [Math]::Max(0, $offset); $down = [Math]::Max(0, -$offset); $window.Height = 236 + $grow; $window.Top = $script:baseTop - $grow; $chatImg.Margin = New-Object System.Windows.Thickness(0, (4 + $down), 0, 0); $chatText.Margin = New-Object System.Windows.Thickness(0, (19 + $grow), 0, 0); $viewLink.Margin = New-Object System.Windows.Thickness(0, (64 + $grow), 0, 0); $closeBtn.Margin = New-Object System.Windows.Thickness(0, (6 + $down), 6, 0) }\n' +
      'function Read-Json { try { return Invoke-RestMethod -Uri $Api -TimeoutSec 3 -UseBasicParsing } catch { return $null } }\n' +
      'function New-Bitmap([byte[]]$bytes) { $ms = New-Object System.IO.MemoryStream(,$bytes); $bi = New-Object System.Windows.Media.Imaging.BitmapImage; $bi.BeginInit(); $bi.StreamSource = $ms; $bi.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad; $bi.EndInit(); $bi.Freeze(); return $bi }\n' +
      'function Set-CharImage([string]$url) { if ($url -eq "" -or $url -eq $script:lastImg) { return }; $script:lastImg = $url; try { $bytes = $wc.DownloadData($root + $url); $charImg.Source = New-Bitmap $bytes } catch { $script:lastImg = "" } }\n' +
      'function Set-ChatImage([string]$url) { if ($url -eq "" -or $url -eq $script:lastChat) { return }; $script:lastChat = $url; try { $bytes = $wc.DownloadData($root + $url); $chatImg.Source = New-Bitmap $bytes } catch { $script:lastChat = "" } }\n' +
      'function Show-Menu {\n  $menu = New-Object System.Windows.Controls.ContextMenu\n  $chars = $script:state.characters\n  if ($chars -ne $null) {\n    foreach ($c in $chars) {\n      $item = New-Object System.Windows.Controls.MenuItem\n      $item.Header = [string]$c.name\n      $item.Tag = [string]$c.folder\n      $item.Add_Click({ param($sender, $evt) $folder = $sender.Tag; try { Invoke-RestMethod -Uri ($Api + "/select?folder=" + [uri]::EscapeDataString($folder)) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {} })\n      [void]$menu.Items.Add($item)\n    }\n    $sep = New-Object System.Windows.Controls.Separator\n    [void]$menu.Items.Add($sep)\n  }\n  $open = New-Object System.Windows.Controls.MenuItem\n  $open.Header = "打开主界面"\n  $open.Add_Click({ Open-Gui })\n  [void]$menu.Items.Add($open)\n  $win = New-Object System.Windows.Controls.MenuItem\n  $win.Header = "关闭置顶小窗"\n  $win.Add_Click({ try { Invoke-RestMethod -Uri ($Api + "/window?enabled=0") -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {}; $window.Close() })\n  [void]$menu.Items.Add($win)\n  $menu.Placement = [System.Windows.Controls.Primitives.PlacementMode]::MousePoint\n  $menu.PlacementTarget = $window\n  $menu.IsOpen = $true\n}\n' +
      '$window.Add_MouseLeftButtonDown({ param($s, $e) $dpiX = 1.0; $dpiY = 1.0; try { $d = [System.Windows.Media.VisualTreeHelper]::GetDpi($s); $dpiX = [double]$d.DpiScaleX; $dpiY = [double]$d.DpiScaleY } catch {}; $p = $s.PointToScreen($e.GetPosition($s)); $script:drag = @{ sx = $p.X; sy = $p.Y; fx = $s.Left; fy = $s.Top; dx = $dpiX; dy = $dpiY }; [void]$s.CaptureMouse() })\n' +
      '$window.Add_MouseMove({ param($s, $e) if ($script:drag -ne $null) { $p = $s.PointToScreen($e.GetPosition($s)); $s.Left = $script:drag.fx + ($p.X - $script:drag.sx) / $script:drag.dx; $s.Top = $script:drag.fy + ($p.Y - $script:drag.sy) / $script:drag.dy } })\n' +
      '$window.Add_MouseLeftButtonUp({ param($s, $e) if ($script:drag -ne $null) { $script:drag = $null; if ($s.IsMouseCaptured) { $s.ReleaseMouseCapture() }; $g = [Math]::Max(0, $script:curOffset); try { Invoke-RestMethod -Uri ($Api + "/pos?x=" + [int]$s.Left + "&y=" + ([int]$s.Top + $g)) -TimeoutSec 2 -UseBasicParsing | Out-Null } catch {} } })\n' +
      '$window.Add_MouseRightButtonUp({ Show-Menu })\n' +
      '$timer = New-Object System.Windows.Threading.DispatcherTimer\n$timer.Interval = [TimeSpan]::FromMilliseconds(500)\n' +
      '$timer.Add_Tick({ $script:tick++; $s = Read-Json; if ($null -eq $s) { return }; $script:state = $s; if ($s.image) { Set-CharImage ([string]$s.image) }; if ($null -ne $s.chatOffset) { Apply-Offset ([int]$s.chatOffset) }; if ($script:lastNotif -ne $null -and $script:lastNotif.kind -ne "question" -and $s.runningAgents -and @($s.runningAgents) -contains [string]$script:lastNotif.agentId) { Hide-Chat }; if ($s.notifications -and $s.notifications.Count -gt 0) { $n = $s.notifications[$s.notifications.Count - 1]; if ([int]$n.seq -gt $script:lastSeq) { $script:lastSeq = [int]$n.seq; $script:lastNotif = $n; if ($n.chatbox) { Set-ChatImage ([string]$n.chatbox) }; $len = [int]$n.text.Length; if ($len -ge 20) { $chatText.FontSize = 10 } elseif ($len -ge 12) { $chatText.FontSize = 12 } else { $chatText.FontSize = 14 }; $chatText.Text = [string]$n.text; $chatImg.Visibility = [System.Windows.Visibility]::Visible; $chatText.Visibility = [System.Windows.Visibility]::Visible; $viewLink.Visibility = [System.Windows.Visibility]::Visible; $closeBtn.Visibility = [System.Windows.Visibility]::Visible; $script:chatUntil = $script:tick + 120 } elseif ($n.chatbox -ne $null -and [string]$n.chatbox -ne $script:lastChat) { $script:lastNotif = $n; if ($n.chatbox) { Set-ChatImage ([string]$n.chatbox) } } }; if ($script:chatUntil -gt 0 -and $script:tick -ge $script:chatUntil) { Hide-Chat } })\n' +
      '$timer.Start()\n$window.Show()\n$app = New-Object System.Windows.Application\n[void]$app.Run($window)\n'

    async function spawnWindow() {
      if (!subprocess || !fs || !baseDir || !apiBase || windowHandle) return
      try {
        if (!scriptPath) {
        // 包内模式：小窗脚本写到系统临时目录（避免写入 node_modules）
        if (PACKAGE_BASE_RAW && baseDir === PACKAGE_BASE_RAW) {
          let tmp = '/tmp'
          try { if (typeof process !== 'undefined' && process.env) tmp = process.env.TEMP || process.env.TMP || tmp } catch (e) {}
          scriptPath = tmp + '/' + WINDOW_SCRIPT
        } else {
          scriptPath = baseDir + '/' + WINDOW_SCRIPT
        }
      }
        const target = await fs.resolve(scriptPath)
        await fs.writeText(target, PS1)
        const exe = await subprocess.resolveExecutable('powershell.exe')
        const handle = subprocess.spawn({
          argv: [exe, '-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA', '-WindowStyle', 'Hidden', '-File', scriptPath, '-Api', apiBase, '-Config', baseDir + '/' + CONFIG_NAME],
          cwd: baseDir,
          stdio: { stdin: 'ignore', stdout: { maxBytes: 8192 }, stderr: { maxBytes: 8192 } },
          graceMs: 3000
        })
        windowHandle = handle
        handle.done.then((outcome) => {
          if (windowHandle === handle) windowHandle = null
          onWindowExited(handle.pid, outcome)
        }).catch(() => {
          if (windowHandle === handle) windowHandle = null
        })
      } catch (err) {
        console.log('status-light spawn window:', err && err.message)
      }
    }

    function killWindow() {
      if (respawnTimer) { try { respawnTimer() } catch (e) {} respawnTimer = null }
      if (windowHandle) { try { windowHandle.terminate() } catch (e) {} windowHandle = null }
    }

    function onWindowExited(pid, outcome) {
      if (!windowEnabled) return
      const now = tryNow()
      const rapid = lastExitMs > 0 && now - lastExitMs < 3000
      if (rapid) failStreak++
      else failStreak = 0
      lastExitMs = now
      const delay = rapid ? Math.min(15000, 1000 * Math.pow(2, Math.min(failStreak, 4))) : 2000
      if (respawnTimer) { try { respawnTimer() } catch (e) {} }
      respawnTimer = timer ? timer.timeout(() => { respawnTimer = null; spawnWindow() }, delay) : null
    }

    // ---------- 事件 ----------
    ctx.on('agent/status', (payload) => {
      try {
        const agent = payload && payload.agent
        if (!agent) return
        const id = agent.id
        if (payload.status === 'running') {
          if (!running.has(id)) {
            running.set(id, 1); runningCount++
            onThinkStart()
          }
        } else if (payload.status === 'idle') {
          if (running.has(id)) {
            running.delete(id); runningCount--
            if (runningCount < 0) runningCount = 0
            if (runningCount === 0) onAllIdle()
            pushNotification('complete', agent)
          }
        }
      } catch (e) { console.log('status-light status:', e && e.message) }
    })

    ctx.on('agent/error', (payload) => {
      try {
        const agent = payload && payload.agent
        if (!agent) return
        onError()
        pushNotification('error', agent)
      } catch (e) { console.log('status-light error:', e && e.message) }
    })

    ctx.on('tools/result', (exec, result) => {
      try {
        if (exec && exec.name === 'ask_user_question' && exec.agent) {
          pushNotification('question', exec.agent)
        }
      } catch (e) { console.log('status-light tool:', e && e.message) }
    })

    ctx.on('agent/disposed', (payload) => {
      try {
        const agent = payload && payload.agent
        if (!agent) return
        if (running.has(agent.id)) {
          running.delete(agent.id); runningCount--
          if (runningCount <= 0) { runningCount = 0; onAllIdle() }
        }
      } catch (e) {}
    })

    // 退出时关闭置顶小窗
    ctx.effect(() => () => { killWindow() })

    // 启动同步：已在运行的 agent 视为 thinking
    try {
      if (agentsSvc) for (const a of agentsSvc.list()) {
        if (a.status === 'running' && !running.has(a.id)) { running.set(a.id, 1); runningCount++ }
      }
    } catch (e) {}
    if (runningCount > 0) enterState('think')

    ensureBase().catch(() => {})
}
