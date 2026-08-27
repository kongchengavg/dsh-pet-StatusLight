// dsh-pet-StatusLight — environment router only.
// Ordinary dsh web and DSH Desktop intentionally use separate implementation files.
window.__ModuleLoader__.load({
  id: 'dsh-pet-statuslight',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const LOADS_KEY = '__DSH_STATUSLIGHT_CLIENT_LOADS__'
    const IMPLEMENTATIONS = {
      web: { id: 'dsh-pet-statuslight/web', url: '/statuslight/client/web.js?rev=1.0.37-return-read-1' },
      desktop: { id: 'dsh-pet-statuslight/desktop', url: '/statuslight/client/desktop.js?rev=desktop-split-3-focus-read' },
    }

    const loadImplementation = (kind) => {
      const registry = window[LOADS_KEY] || (window[LOADS_KEY] = {})
      if (registry[kind]) return registry[kind]
      const selected = IMPLEMENTATIONS[kind]
      registry[kind] = new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = selected.url
        script.async = true
        script.dataset.statuslightClient = kind
        script.onload = () => resolve()
        script.onerror = () => {
          delete registry[kind]
          reject(new Error('dsh-pet-statuslight: failed to load ' + kind + ' client'))
        }
        document.head.appendChild(script)
      })
      return registry[kind]
    }

    const resolveKind = async (ctx) => {
      // desktopWindow 是首选快速路径；Profile=web 的 Desktop renderer 在部分启动顺序下
      // 可能尚未发布该 service，因此再以 Host 快照中的 desktopHost 作为权威兜底。
      if (ctx.get('desktopWindow') !== undefined) return 'desktop'
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          if (typeof fetch !== 'function') break
          const response = await fetch('/statuslight/api/state?since=0', { cache: 'no-store' })
          if (!response || (response.ok === false)) throw new Error('status-light host unavailable')
          const snap = await response.json()
          if (snap && typeof snap.desktopHost === 'boolean') return snap.desktopHost ? 'desktop' : 'web'
        } catch (e) {}
        if (attempt < 2 && typeof setTimeout === 'function') {
          await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)))
        }
      }
      return 'web'
    }

    async function apply(ctx) {
      // 只按 Desktop 宿主判断，不读取当前 Profile 名称。
      const kind = await resolveKind(ctx)
      const selected = IMPLEMENTATIONS[kind]
      await loadImplementation(kind)
      const implementation = require(selected.id)
      if (!implementation || typeof implementation.apply !== 'function') {
        throw new Error('dsh-pet-statuslight: invalid ' + kind + ' client implementation')
      }
      return implementation.apply(ctx)
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
