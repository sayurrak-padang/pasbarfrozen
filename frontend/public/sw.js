// Service worker minimal agar toko bisa dipasang sebagai aplikasi (PWA).
// Sengaja TIDAK menyimpan cache: semua permintaan langsung ke jaringan,
// jadi pembeli selalu melihat harga, stok dan tampilan terbaru setelah publish.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
