/* transforma service worker — runtime caching (works with Vite's hashed asset names).
   Media (img/gif) cache-first; everything else network-first with offline fallback. */
const CACHE = 'transforma-rt-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
})
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(self.registration.showNotification(data.title || 'transforma', {
    body: data.body || '',
    icon: 'icon-512.png',
    badge: 'icon-180.png',
    tag: data.tag || 'transforma',
    renotify: true
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(clients => {
    const c = clients.find(c => 'focus' in c)
    return c ? c.focus() : self.clients.openWindow('./')
  }))
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  if (url.pathname.startsWith('/api/')) return    // never cache auth/data

  const isMedia = url.pathname.includes('/img/') || url.pathname.includes('/gif/')
  const remember = async res => {
    // Clone before handing the response body back to the page.
    if (res.ok) {
      const copy = res.clone()
      try { await (await caches.open(CACHE)).put(e.request, copy) } catch { /* cache is optional */ }
    }
    return res
  }
  if (isMedia) {
    e.respondWith(caches.open(CACHE).then(c => c.match(e.request).then(hit =>
      hit || fetch(e.request).then(remember)
    )))
  } else {
    e.respondWith(fetch(e.request).then(remember).catch(async () => {
      const hit = await caches.match(e.request)
      if (hit) return hit
      if (e.request.mode === 'navigate') return (await caches.match('index.html')) || (await caches.match('./')) || Response.error()
      return Response.error()
    }))
  }
})
