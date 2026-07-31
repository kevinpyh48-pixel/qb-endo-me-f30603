/* 족보풀이 서비스워커 — 오프라인 지원(병원 지하·이동 중).
   index.html이 30MB 단일 파일이라 network-first는 매번 무겁다 →
   stale-while-revalidate: 캐시를 즉시 보여주고 뒤에서 새 버전을 받아둔다.
   토론 서버(JSONP, 타 도메인)는 건드리지 않는다.

   ⚠️ 정본은 이 파일이다(<과목>/_자동화/sw.js). deploy_jokbo.py 가 배포할 때마다
   각 배포 저장소(~/jokbo-site-me 등)의 sw.js 로 복사한다 — 손으로 고치면 세 벌이 갈라진다.
   (주석에 별표+슬래시를 쓰지 말 것: 블록 주석이 거기서 끊겨 파일 전체가 문법 오류가 된다.)

   새 버전 알림: 문서(index.html)를 다시 받았을 때 ETag(없으면 Last-Modified)가 캐시본과
   다르면 열려 있는 탭에 알린다. 그러면 앱이 "새 버전 준비됨" 배너를 띄운다.
   예전엔 이 신호가 없어서 갱신이 "다음에 열 때"만 보였고, 배포가 안 된 것처럼 보였다. */
const CACHE = "jokbo-v1";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

/* 이 요청이 앱 문서인가(이미지·아이콘이 바뀐 걸로 배너를 띄우지 않도록) */
const isDoc = (req) =>
  req.mode === "navigate" || /\/(index\.html)?$/.test(new URL(req.url).pathname);

/* 같은 파일인지 가르는 지문. GitHub Pages 는 ETag 를 준다.
   둘 다 없으면 "" === "" 가 되어 알리지 않는다 — 헛알림보다 조용한 편이 낫다. */
const stamp = (r) => (r && (r.headers.get("etag") || r.headers.get("last-modified"))) || "";

async function notifyClients() {
  const cs = await self.clients.matchAll({ type: "window" });
  cs.forEach((c) => c.postMessage({ type: "update-ready" }));
}

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
        .then(async (r) => {
          if (!r.ok) return r;
          /* 캐시에 다 넣은 뒤에 알린다 — 배너를 눌러 reload 했을 때 새 버전이 나와야 한다 */
          const fresh = hit && isDoc(e.request) && stamp(r) !== stamp(hit);
          await c.put(e.request, r.clone());
          if (fresh) await notifyClients();
          return r;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
