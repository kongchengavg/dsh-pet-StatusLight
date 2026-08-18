// dsh-plugin-StatusLight — Client 半部分源码（v26）
// 通过 DeepSeek Harness 动态 Cordis 插件机制定义：
//   cordis_define(code.client = 本文件内容) 后 cordis_run。
// 功能：右下角浮动状态灯、角色切换菜单、聊天框气泡（查看详细/红叉）、
//       置顶小窗开关、通知缓存与忽略同步。
return {
  apply(ctx) {
    const slots = ctx.get('slots')
    if (!slots) return

    const CSS = `
.sl-widget{position:fixed;right:83px;bottom:18px;z-index:2147483000;width:130px;pointer-events:none;font-family:system-ui,-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;}
.sl-chat-stack{position:absolute;left:50%;transform:translateX(-50%);width:190px;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;bottom:135px;}
.sl-chatbox{position:relative;pointer-events:auto;width:190px;height:90px;overflow:visible;}
.sl-chatbox-img{display:block;width:190px;height:auto;user-select:none;-webkit-user-drag:none;}
.sl-chatbox-body{position:absolute;left:45px;top:19px;width:100px;height:56px;display:flex;flex-direction:column;justify-content:flex-start;align-items:center;gap:2px;pointer-events:none;}
.sl-chatbox-text{color:#2b2b3a;text-align:center;line-height:1.3;font-weight:600;overflow:hidden;width:100%;}
.sl-chatbox-link{pointer-events:auto;border:none;background:none;padding:0;margin-top:8px;font-size:11px;font-weight:700;color:#2b5fd9;text-decoration:underline;cursor:pointer;font-family:inherit;}
.sl-chatbox-link:hover{filter:brightness(1.2);}
.sl-close{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:none;background:rgba(220,60,60,.95);color:#fff;font-size:14px;font-weight:700;line-height:1;cursor:pointer;z-index:2;padding:0;}
.sl-close:hover{filter:brightness(1.15);}
.sl-light{position:relative;pointer-events:auto;width:130px;height:130px;}
.sl-light-img{display:block;width:130px;height:130px;object-fit:contain;cursor:default;user-select:none;-webkit-user-drag:none;}
.sl-menu{position:absolute;right:0;bottom:138px;background:rgba(24,24,36,.95);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:2px;min-width:116px;box-shadow:0 8px 24px rgba(0,0,0,.5);}
.sl-menu-item{padding:7px 12px;border-radius:8px;color:#eee;font-size:13px;cursor:pointer;white-space:nowrap;}
.sl-menu-item:hover{background:rgba(255,255,255,.14);}
.sl-menu-active{background:rgba(90,140,255,.35);color:#fff;font-weight:600;}
.sl-menu-sep{height:1px;background:rgba(255,255,255,.15);margin:4px 6px;}
`
    try { styles.insert(CSS) } catch (e) {}

    const StatusLight = () => {
      const [snap, setSnap] = React.useState(null)
      const [menu, setMenu] = React.useState(false)
      const [items, setItems] = React.useState([])
      const sinceRef = React.useRef(0)
      const itemsRef = React.useRef([])
      const imageRef = React.useRef(null)
      const tickRef = React.useRef(0)
      const lastJumpIdRef = React.useRef(0)
      const lastCharRef = React.useRef(null)
      const pendingFullRef = React.useRef(false)

      const closeItem = (key) => {
        itemsRef.current = itemsRef.current.filter((n) => n.key !== key)
        setItems(itemsRef.current)
      }

      const dismissItem = (n) => {
        host.call('status-light/dismiss', { seq: n.seq }).catch(() => {})
        closeItem(n.key)
      }

      const performJump = (j) => {
        const sessions = ctx.get('sessions')
        if (!sessions || !j) return
        try {
          const addr = sessions.subagentAddress(j.agentId)
          if (addr) { sessions.openSubagent(addr); return }
        } catch (e) {}
        if (j.parentId && j.mode) {
          try { sessions.openSubagent({ parentSessionId: j.parentId, childSessionId: j.agentId, mode: j.mode }); return } catch (e) {}
        }
        try { sessions.open(j.agentId); return } catch (e) {}
        if (j.parentId) { try { sessions.open(j.parentId) } catch (e) {} }
      }

      const itemFont = (n) => {
        const len = n.text ? n.text.length : 0
        return len >= 20 ? 10 : len >= 12 ? 12 : 14
      }

      React.useEffect(() => {
        const timerSvc = ctx.get('timer')
        if (!timerSvc) return
        return timerSvc.interval(() => {
          tickRef.current += 1
          const useFull = pendingFullRef.current
          const since = useFull ? 0 : sinceRef.current
          host.call('status-light/state', { since }).then((res) => {
            if (!res) return
            setSnap(res)
            if (res.image) imageRef.current = res.image
            if (res.jump && res.jump.id && res.jump.id !== lastJumpIdRef.current) {
              lastJumpIdRef.current = res.jump.id
              performJump(res.jump)
            }
            if (res.character) {
              if (lastCharRef.current && res.character.folder !== lastCharRef.current) pendingFullRef.current = true
              lastCharRef.current = res.character.folder
            }
            // 清除已被任意端忽略的通知缓存（红叉/查看详细后不复活）
            if (res.dismissed && res.dismissed.length) {
              const filtered = itemsRef.current.filter((n) => res.dismissed.indexOf(n.seq) < 0)
              if (filtered.length !== itemsRef.current.length) { itemsRef.current = filtered; setItems(filtered) }
            }
            if (res.runningAgents && res.runningAgents.length) {
              const filtered = itemsRef.current.filter((n) => !(n.kind !== 'question' && res.runningAgents.indexOf(n.agentId) >= 0))
              if (filtered.length !== itemsRef.current.length) { itemsRef.current = filtered; setItems(filtered) }
            }
            if (res.notifications && res.notifications.length) {
              let maxSeq = 0
              for (const n of res.notifications) if (n.seq > maxSeq) maxSeq = n.seq
              if (maxSeq > sinceRef.current) sinceRef.current = maxSeq
              const nowTick = tickRef.current
              const merged = {}
              for (const it of itemsRef.current) merged[it.key] = it
              for (const n of res.notifications) {
                merged['n' + n.seq] = { ...n, key: 'n' + n.seq, born: nowTick, ttl: 120 }
              }
              itemsRef.current = Object.values(merged).sort((a, b) => b.seq - a.seq).slice(0, 1)
              setItems(itemsRef.current)
            }
            if (useFull) pendingFullRef.current = false
            const next = itemsRef.current.filter((n) => tickRef.current - n.born <= n.ttl)
            if (next.length !== itemsRef.current.length) { itemsRef.current = next; setItems(next) }
          }).catch(() => {})
        }, 500)
      }, [])

      const jump = (n) => { performJump(n); dismissItem(n) }

      const selectChar = (folder) => {
        host.call('status-light/select-character', { folder }).catch(() => {})
        setMenu(false)
      }

      const toggleWindow = () => {
        const enabled = !(snap && snap.window !== false)
        host.call('status-light/window', { enabled }).catch(() => {})
        setMenu(false)
      }

      const src = (snap && snap.image) || imageRef.current || null
      const windowOn = !snap || snap.window !== false
      const offset = snap && typeof snap.chatOffset === 'number' ? snap.chatOffset : 0
      const imgShift = (-offset) + 'px'

      // 置顶小窗开启时，网页角色隐藏（只显示一个）
      if (windowOn) return null

      return React.createElement('div', { className: 'sl-widget' },
        React.createElement('div', { className: 'sl-chat-stack' },
          items.map((n) => React.createElement('div', { key: n.key, className: 'sl-chatbox' },
            React.createElement('img', { className: 'sl-chatbox-img', src: n.chatbox || '', alt: '', style: { marginTop: imgShift } }),
            React.createElement('div', { className: 'sl-chatbox-body' },
              React.createElement('div', { className: 'sl-chatbox-text', style: { fontSize: itemFont(n) + 'px' } }, n.text),
              React.createElement('button', { className: 'sl-chatbox-link', onClick: () => jump(n) }, '查看详细')
            ),
            React.createElement('button', { className: 'sl-close', onClick: () => dismissItem(n) }, '×')
          ))
        ),
        React.createElement('div', { className: 'sl-light' },
          menu && snap && snap.characters && snap.characters.length
            ? React.createElement('div', { className: 'sl-menu' },
                snap.characters.map((c) => React.createElement('div', {
                  key: c.folder,
                  className: 'sl-menu-item' + (snap.character && c.folder === snap.character.folder ? ' sl-menu-active' : ''),
                  onClick: () => selectChar(c.folder)
                }, c.name)),
                React.createElement('div', { className: 'sl-menu-sep' }),
                React.createElement('div', { className: 'sl-menu-item', onClick: toggleWindow }, '开启置顶小窗')
              )
            : null,
          React.createElement('img', {
            className: 'sl-light-img',
            src: src,
            alt: snap ? snap.state : '',
            title: snap && snap.character ? snap.character.name : '',
            draggable: false,
            onContextMenu: (e) => { e.preventDefault(); setMenu((m) => !m) },
            onClick: () => setMenu(false)
          })
        )
      )
    }

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'dsh-status-light' },
      () => React.createElement(StatusLight, null)
    ))
  }
}
