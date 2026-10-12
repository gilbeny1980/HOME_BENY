const C='bny-v1',F=['/','/index.html','/style.css','/app.js','/icon.svg','/manifest.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title||'תזכורת',{body:d.body||'',icon:'icon.svg',dir:'rtl',lang:'he'}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow('/'))});
