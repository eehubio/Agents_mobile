const CACHE='eeagent-mobile-v7-docs';
const ASSETS=["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./docs/index.json", "./docs/agent-01.md", "./docs/agent-02.md", "./docs/agent-03.md", "./docs/agent-04.md", "./docs/agent-05.md", "./docs/agent-06.md", "./docs/agent-07.md", "./docs/agent-08.md", "./docs/agent-09.md", "./docs/agent-10.md", "./docs/agent-11.md", "./docs/agent-12.md", "./docs/agent-13.md", "./docs/agent-14.md", "./docs/agent-15.md", "./docs/agent-16.md", "./docs/agent-17.md", "./docs/agent-18.md", "./docs/agent-19.md", "./docs/agent-20.md", "./docs/agent-21.md", "./docs/agent-22.md", "./docs/agent-23.md", "./docs/agent-24.md", "./docs/agent-25.md", "./docs/agent-26.md", "./docs/agent-27.md", "./docs/agent-28.md", "./docs/agent-29.md", "./docs/agent-30.md", "./docs/agent-31.md", "./docs/agent-32.md", "./docs/agent-33.md", "./docs/agent-34.md", "./docs/agent-35.md", "./docs/agent-36.md", "./docs/agent-37.md", "./docs/agent-38.md", "./docs/agent-39.md", "./docs/agent-40.md", "./docs/agent-41.md", "./docs/agent-42.md", "./docs/agent-43.md", "./docs/agent-44.md", "./docs/agent-45.md", "./docs/agent-46.md", "./docs/agent-47.md"];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(async cache=>{
      const results=await Promise.allSettled(
        ASSETS.map(asset=>cache.add(new Request(asset,{cache:'reload'})))
      );
      const failed=results.filter(result=>result.status==='rejected');
      if(failed.length)console.warn('EEAgent precache partial failure',failed.length);
    })
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request,fallbackUrl){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response&&response.ok)cache.put(request,response.clone());
    return response;
  }catch(error){
    return (await cache.match(request)) ||
      (fallbackUrl ? await cache.match(fallbackUrl) : undefined) ||
      Response.error();
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const isMarkdown=url.pathname.endsWith('.md');
  const isAppDocument=url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');

  if(event.request.mode==='navigate'||isAppDocument){
    event.respondWith(networkFirst(event.request,'./index.html'));
    return;
  }
  if(isMarkdown){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      if(response&&response.ok){
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
      }
      return response;
    }))
  );
});
