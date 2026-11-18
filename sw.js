/* MovesMethod Coach Tool: keeps the tool opening with no signal.
   The page always tries the network first (so updates show up straight away)
   and falls back to the last copy it saved when the network is slow or gone. */
var CACHE = 'mm-coach-v1';
var PAGE = new URL('./index.html', self.location).href;
var CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('mm-coach-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function late(ms) { return new Promise(function (_, no) { setTimeout(function () { no(new Error('slow')); }, ms); }); }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // the tool itself: network first, saved copy if offline or the network takes more than 4 seconds
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      var net = fetch(req).then(function (r) { if (r && r.ok) c.put(PAGE, r.clone()); return r; });
      return Promise.race([net, late(4000)]).catch(function () {
        return c.match(PAGE).then(function (hit) {
          if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
          return net;
        });
      });
    }));
    return;
  }

  // icons, manifest and fonts: use the saved copy, refresh it in the background
  if (url.origin === self.location.origin || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req).then(function (hit) {
        var net = fetch(req).then(function (r) { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; });
        if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
        return net;
      });
    }));
  }
});
