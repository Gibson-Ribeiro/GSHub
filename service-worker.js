const CACHE_NAME = "capivaras-gestao-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./cardapio.html",
  "./style.css",
  "./app.js",
  "./cardapio.js",
  "./pedidos.js",
  "./data-service.js",
  "./supabase-config.js",
  "./pwa.js",
  "./manifest.json",
  "./logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response&&response.ok){
        const clone=response.clone();
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request,clone));
      }
      return response;
    }).catch(()=>caches.match(event.request).then(cached=>{
      if(cached)return cached;
      if(event.request.mode==="navigate")return caches.match("./index.html");
      return cached;
    }))
  );
});
