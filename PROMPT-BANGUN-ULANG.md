# Prompt Siap Tempel: Bangun Ulang Toko dari Template

Pakai prompt ini di Emergent (job baru dengan **Import from GitHub**) atau AI pembuat kode lain
yang bisa membaca repo. Ganti semua bagian dalam `<...>` dengan data merek Anda. Jangan
menempelkan kunci rahasia (Midtrans, Twilio, dan sebagainya) ke dalam prompt; isi lewat
Environment/Secrets.

---

```text
Repo ini adalah template toko online lengkap (FastAPI + MongoDB di backend/, Vite + React 19
+ Tailwind v4 + shadcn di frontend/). Semua fitur SUDAH ADA. Tugasmu hanya memasang data merek
baru dan menjalankannya. JANGAN membangun ulang, menghapus fitur, mengubah gaya tampilan,
atau menulis ulang komponen.

Data merek baru:
- Nama toko: <Pasar Buah Medan>
- Nama pendek (nama aplikasi di HP): <Pasar Buah>
- Slug (huruf kecil tanpa spasi): <pasarbuah>
- Domain: <pasarbuah.id>
- Judul tab browser: <Pasar Buah Medan | Buah Segar Online>
- Deskripsi singkat: <Belanja buah segar di Kota Medan. Diantar Grab / Gojek.>
- Tagline: <Buah segar Kota Medan, diantar cepat>
- Nama saldo: <Saldo Pasar Buah>
- Nama halaman resep: <Dapur Pasar Buah>
- Nama admin: <Owner Pasar Buah>
- URL logo: <https://...>
- Foto login (URL) dan kreditnya: <https://...> / <Nama / Unsplash>
- Judul dan kalimat login: <Buah Segar Tiap Hari> / <Langsung dari kebun di Sumatera Utara.>
- Judul login versi desktop: <Belanja Buah Jadi Mudah>
- Kota layanan: <Kota Medan>, pendek <Medan>, provinsi <Sumatera Utara>
- Koordinat pusat kota (lintang, bujur): <3.5952, 98.6722>
- Kode pos titik jemput: <20111>
- Gaya masakan untuk resep AI: <Batak/Medan>
- Pesan WA terima kasih: <Terima kasih sudah belanja di Pasar Buah Medan!>
- Pesan WA pesanan sampai: <Selamat menikmati buah segar dari Pasar Buah Medan!>
- Warna: palet Tailwind <orange>, header <#c2410c>, tombol utama <#ea580c>
  (isian warna lain boleh kamu turunkan dari palet yang sama; lihat PANDUAN-TEMPLATE.md)

Langkah yang harus dikerjakan, persis berurutan:
1. Baca PANDUAN-TEMPLATE.md sampai habis.
2. Ubah HANYA nilai di brand.config.json sesuai data di atas. Pertahankan semua nama isian.
   Untuk city.matchRegex pakai pola "^\\s*(kota\\s+)?<kota huruf kecil>\\s*$".
3. Jalankan: python3 scripts/terapkan_merek.py --cek, lalu python3 scripts/terapkan_merek.py.
   Jangan mengubah file hasil skrip secara manual (frontend/src/brand-theme.css,
   frontend/src/config/brand.json, backend/brand.json).
4. Kalau saya mengunggah logo persegi, simpan sebagai frontend/public/logo.png lalu jalankan
   skrip lagi agar ikon aplikasi dibuat ulang.
5. Pastikan variabel lingkungan backend sesuai backend/.env.example dan frontend sesuai
   frontend/.env.example. Pakai DB_NAME baru. Kalau ada variabel yang belum saya isi,
   tanyakan ke saya, jangan mengarang nilainya.
6. Di frontend/src/lib/infoContent.js, ganti artikel Blog contoh menjadi 3 artikel singkat
   yang cocok untuk <jenis toko> di <kota>. Biarkan struktur datanya sama. Ubah UPDATED ke
   tanggal hari ini.
7. Restart backend dan frontend (sudo supervisorctl restart backend frontend).
8. Periksa: header bertuliskan "ke <Kota>", warna sesuai, halaman /login menampilkan nama
   dan kalimat baru, /bantuan dan /syarat-ketentuan menyebut domain dan kota baru, admin
   panel menampilkan nama toko baru, dan tidak ada error di konsol browser maupun log backend.
9. Cari sisa nama lama dengan: grep -rn "Rak Sayur\|raksayur\|Padang" frontend/src backend/server.py
   Laporkan hasilnya ke saya (sisa di artikel atau data contoh boleh, asal disebutkan).
10. Commit dengan pesan "Pasang merek <nama toko>" dan beri tahu saya ringkasannya.
```

---

## Prompt versi pendek (kalau brand.config.json sudah Anda isi sendiri di GitHub)

```text
Repo ini template toko online yang sudah lengkap. Saya sudah mengisi brand.config.json.
Jangan mengubah kode atau tampilan. Jalankan python3 scripts/terapkan_merek.py, pastikan
variabel lingkungan sesuai backend/.env.example dan frontend/.env.example (tanyakan yang
belum ada), restart backend dan frontend, lalu periksa beranda, /login, /bantuan, dan panel
admin tanpa error. Laporkan hasilnya.
```
