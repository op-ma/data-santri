// Sistem Data Santri - MA Al-Ma'tuq
// Service Worker

// Naikkan versi ini setiap kali deploy perubahan baru, agar SW lama dibersihkan
// dan pengguna mendapat prompt "Refresh Sekarang" untuk memuat versi terbaru.
const CACHE_VERSION = "v5";
const CACHE_NAME = `santri-app-cache-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya tangani request GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Jangan pernah intersep request lintas-origin (data Google Sheets, Google Fonts,
  // Tailwind/Chart.js CDN) — biarkan langsung ke network supaya data selalu live
  // dan aset pihak ketiga tidak "disandera" oleh cache.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Network-first untuk app shell (HTML & manifest) supaya update langsung terlihat
  // begitu online, dan tetap bisa dibuka dari cache saat offline.
  const isAppShell =
    request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.json") ||
    url.pathname === "/" ||
    url.pathname.endsWith("/");

  if (isAppShell) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first untuk aset statis lain (ikon, dsb.)
  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    throw err;
  }
}

// Terima pesan dari halaman untuk langsung mengaktifkan SW baru yang sedang menunggu
// (dipicu oleh tombol "Refresh Sekarang" di banner update pada index.html)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
