/* MOAYÉ'S Gestion Pro — fonctionnement hors ligne.
   La page est d'abord demandée au réseau (pour avoir toujours la dernière version),
   puis à la copie locale quand il n'y a pas de connexion. Les données passent par Firebase, jamais par ce cache. */
const CACHE = 'moayes-v2-shell-4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './logo.png'];
const LIBS = ['www.gstatic.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n.startsWith('moayes-') && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin && (u.pathname.includes('/igc/') || u.pathname.includes('/end/'))) return; // IGC Gestion a son propre fonctionnement hors ligne
  if (r.mode === 'navigate' || (u.origin === location.origin && /\/(index\.html)?$/.test(u.pathname))){
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', cp)); return res; })
      .catch(() => caches.match('./index.html').then(x => x || caches.match('./'))));
    return;
  }
  if (u.origin === location.origin || LIBS.includes(u.hostname)){
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')){ const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
