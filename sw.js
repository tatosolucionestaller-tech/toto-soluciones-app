const CACHE='tato-static-v12';
const ASSETS=['./','./index.html','./solicitud.html','./solicitud.js','./config.js','./style.css','./logo-tato.jpg','./icon-192.png','./icon-512.png','./manifest.webmanifest','./workflow-utils.mjs'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
if(u.pathname.endsWith('/solicitud.html')||u.pathname.endsWith('/solicitud.js')||u.pathname.endsWith('/config.js')||u.pathname.endsWith('/index.html')||u.pathname==='/'||u.pathname.endsWith('/app.js')||u.pathname.endsWith('/app-real.html')){e.respondWith(fetch(e.request));return;}
e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
