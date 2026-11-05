/* Project Sales Tracker · service worker
   เมื่ออัปเดตแอป ให้เปลี่ยนเลข CACHE ทุกครั้ง (เช่น v1.0.1) */
var CACHE = 'ps-tracker-v1.18.1';
var ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;

  // หน้าแอป: ดึงฉบับใหม่จากเน็ตก่อน ถ้าเน็ตช้าเกิน 3 วินาที ตอบผิดพลาด หรือไม่มีเน็ต ใช้ฉบับในเครื่อง
  if (req.mode === 'navigate' || (sameOrigin && /\.html$|\/$/.test(url.pathname))) {
    var root = new URL(self.registration.scope).pathname;
    var net = fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok && res.type === 'basic' && (url.pathname === root || url.pathname === root + 'index.html')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copy); }); }
      return res;
    });
    e.respondWith(new Promise(function (resolve) {
      var done = false, timer;
      function use(r) { if (!done && r) { done = true; clearTimeout(timer); resolve(r); } }
      function cached(fallback) { return caches.match('./index.html').then(function (c) { use(c || fallback); }); }
      timer = setTimeout(function () { caches.match('./index.html').then(function (c) { if (c) use(c); }); }, 3000);
      net.then(function (res) { if (res && (res.ok || res.type === 'opaqueredirect')) use(res); else cached(res); }, function () { cached(Response.error()); });
    }));
    e.waitUntil(net.catch(function () { }));
    return;
  }
  // ไฟล์อื่นและฟอนต์: ใช้ฉบับในเครื่องทันที แล้วอัปเดตจากเน็ตเบื้องหลัง
  e.respondWith(caches.match(req).then(function (hit) {
    var upd = fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    });
    if (hit) { e.waitUntil(upd.catch(function () { })); return hit; }
    return upd;
  }));
});
