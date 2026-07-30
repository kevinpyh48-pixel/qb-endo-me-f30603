/* 족보풀이 서비스워커 — 오프라인 지원(병원 지하·이동 중).
   index.html이 26MB 단일 파일이라 network-first는 매번 무겁다 →
   stale-while-revalidate: 캐시를 즉시 보여주고 뒤에서 새 버전을 받아둔다.
   갱신은 다음 실행(재방문)에 반영된다. 토론 서버(JSONP, 타 도메인)는 건드리지 않는다. */
const CACHE = "jokbo-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== location.origin) return;   /* JSONP·외부는 그대로 */
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request);
      const net = fetch(e.request)
        .then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })
        .catch(() => hit);
      return hit || net;
    })
  );
});
