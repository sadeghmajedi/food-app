// Service Worker — Food Recorder
// استراتژی: Network First برای فایل‌های اصلی اپ + کش برای حالت آفلاین
// نسخهٔ کش باید هم‌زمان با APP_VERSION در script.js و version.json آپدیت شود

const CACHE_VERSION = "v1.5";
const CACHE_NAME = "food-recorder-" + CACHE_VERSION;

const CORE_ASSETS = [
  "./",
  "index.html",
  "style.css",
  "script.js",
  "logo.png",
  "manifest.json",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
];

// ==================== نصب: کش‌کردن فایل‌های اصلی ====================
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

// ==================== فعال‌سازی: حذف کش‌های نسخه‌های قدیمی ====================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ==================== دریافت پیام از صفحه برای فعال‌سازی فوری نسخهٔ جدید ====================
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ==================== استراتژی fetch ====================
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // version.json همیشه مستقیم از شبکه خوانده شود؛ هرگز نباید کش شود
  // چون مبنای تشخیص «نسخهٔ جدید موجود است» در چک آپدیت است
  if (url.pathname.endsWith("version.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(
        () => new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } })
      )
    );
    return;
  }

  // بقیهٔ فایل‌ها: Network First (همیشه سعی کن نسخهٔ تازه از شبکه بگیری)
  // و اگر آفلاین بودیم، از کش برگردان
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match("index.html"))
      )
  );
});

