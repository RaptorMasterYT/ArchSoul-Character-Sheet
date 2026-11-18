/* ArchSoul — keeps the sheet on this device.
   The page itself: always asked of the website first, so an upload shows the moment you refresh; the copy kept
   here is only used when there is no connection. Everything else of the site's own (the sound clips, the icons):
   the kept copy at once, refreshed quietly behind it. Firebase and other sites are never touched. */
var V = "archsoul-25ce9448c3-e28755";
var CORE = ["./", "./assets/manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("archsoul-") === 0 && k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request; if (r.method !== "GET") return;
  var u = new URL(r.url); if (u.origin !== self.location.origin) return;
  if (r.mode === "navigate") {
    e.respondWith(fetch(r).then(function (res) {
      if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put("./", cp); }); }
      return res;
    }).catch(function () { return caches.match("./").then(function (m) { return m || Response.error(); }); }));
    return;
  }
  e.respondWith(caches.match(r).then(function (m) {
    var net = fetch(r).then(function (res) {
      if (res && res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () { return m || Response.error(); });
    return m || net;
  }));
});
