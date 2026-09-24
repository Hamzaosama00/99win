/* 99win Signals service worker — network-first with offline fallback. */
const CACHE = '99win-signals-v1'
const SHELL = ['/?view=signals', '/manifest-signals.webmanifest', '/99win-logo.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return // live data — never cached

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.headers.get('accept') || '').includes('text/html')) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(req, clone))
        }
        return res
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('/?view=signals'))
      )
  )
})
