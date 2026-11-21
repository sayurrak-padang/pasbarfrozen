# Panduan Template Toko Online (dari Rak Sayur Padang)

Repo ini adalah web app toko online lengkap (toko HP/PWA, checkout, admin, kasir, affiliate,
langganan, resep, blog, dan lain-lain) yang bisa dipakai ulang untuk merek lain. Semua hal yang
khas merek dikumpulkan di **satu file**, yaitu `brand.config.json`, ditambah kunci rahasia di
file `.env`. Anda tidak perlu membangun dari awal: cukup ganti data, jalankan satu perintah,
lalu tayangkan.

## Isi aplikasi (semua sudah termasuk)

- **Toko untuk pembeli**: beranda gaya aplikasi HP (claymorphism), kategori, pencarian,
  Flash Sale, detail produk, keranjang, Belanja Lagi, resep dengan tombol tambah bahan,
  pasang sebagai aplikasi (PWA).
- **Checkout**: alamat dengan peta, jadwal antar, kurir instan (Grab/Gojek lewat Biteship),
  kurir reguler, Kurir Toko (COD khusus kota layanan), voucher, ongkir progresif.
- **Pembayaran**: Midtrans (QRIS langsung tampil di aplikasi, Virtual Account, e-wallet),
  Saldo toko, COD.
- **Akun**: login email/Google/OTP WhatsApp, poin, saldo, komisi affiliate, langganan
  mingguan, metode pengembalian dana, Blog, Kebijakan Privasi, Syarat dan Ketentuan, Bantuan.
- **Admin**: produk, harga web dan harga toko, HPP, stok, pesanan, komplain dan refund,
  laporan laba rugi, Kasir Toko dengan struk 58 mm, affiliate dan ranking, banner, promo,
  resep (dibantu AI), WhatsApp, pengaturan toko.

## Peta file penting

| File | Isi | Perlu diubah? |
|---|---|---|
| `brand.config.json` | Nama, logo, domain, kota, warna, teks login, pesan WA | **Ya, ini utamanya** |
| `backend/.env` | Kunci Midtrans, database, admin, Twilio, Biteship | **Ya** (salin dari `backend/.env.example`) |
| `frontend/.env` | Alamat backend, kunci Google Maps | **Ya** (salin dari `frontend/.env.example`) |
| `frontend/src/lib/infoContent.js` | Artikel Blog, Kebijakan Privasi, S&K, FAQ | Tinjau teksnya |
| `frontend/public/logo.png` | Logo persegi untuk ikon aplikasi | Opsional |
| `scripts/terapkan_merek.py` | Skrip yang menerapkan `brand.config.json` | Tidak |
| `frontend/src/brand-theme.css`, `frontend/src/config/brand.json`, `backend/brand.json` | Dibuat otomatis oleh skrip | **Jangan** diubah langsung |

## Langkah membuat toko baru

### 1. Salin repo

Pilih salah satu:

- **Di GitHub (disarankan)**: buka repo template, klik **Use this template > Create a new
  repository**, beri nama (misalnya `pasarbuah-belanja`), pilih **Private**.
  (Agar tombol itu muncul, pemilik repo sekali saja membuka **Settings > General** lalu
  mencentang **Template repository**.)
- **Manual**: unduh ZIP repo ini lalu unggah ke repo baru.

### 2. Isi `brand.config.json`

Buka file itu dan ganti nilainya. Penjelasan setiap isian:

| Isian | Contoh | Dipakai di |
|---|---|---|
| `name` | `"Pasar Buah Medan"` | Nama toko di header admin, footer, struk, label kirim, pesan WA, laporan |
| `shortName` | `"Pasar Buah"` | Nama aplikasi saat dipasang di HP |
| `slug` | `"pasarbuah"` | Nama folder penyimpanan foto (huruf kecil, tanpa spasi) |
| `domain` | `"pasarbuah.id"` | Struk, halaman Akun, Kebijakan Privasi, S&K |
| `pageTitle` | `"Pasar Buah Medan \| Buah Segar Online"` | Judul tab browser |
| `description` | `"Belanja buah segar di Kota Medan."` | Deskripsi Google dan PWA |
| `tagline` | `"Buah segar Kota Medan, diantar cepat"` | Kartu promo untuk Story affiliate |
| `copyrightYear` | `2026` | Footer |
| `walletName` | `"Saldo Pasar Buah"` | Nama saldo di dompet, checkout, refund |
| `kitchenName` | `"Dapur Pasar Buah"` | Judul halaman Resep |
| `adminName` | `"Owner Pasar Buah"` | Nama akun admin pertama |
| `logoUrl` | URL gambar logo | Header, login, admin, chat, favicon |
| `login.heroImage` | URL foto | Foto besar di halaman sambutan login |
| `login.heroCredit` | `"Nama Fotografer / Unsplash"` | Kredit foto (boleh kosong) |
| `login.heroTitle`, `login.heroText`, `login.sideTitle` | Teks | Judul dan kalimat di halaman login |
| `city.name` | `"Kota Medan"` | Header "ke Kota ...", checkout, S&K, FAQ |
| `city.short` | `"Medan"` | Teks pendek |
| `city.province` | `"Sumatera Utara"` | Syarat dan Ketentuan |
| `city.matchRegex` | `"^\\s*(kota\\s+)?medan\\s*$"` | Penentu alamat yang boleh pakai Kurir Toko / COD |
| `city.mapCenter` | `[3.5952, 98.6722]` | Titik awal peta alamat (lintang, bujur dari Google Maps) |
| `city.originPostal` | `"20111"` | Kode pos titik jemput untuk hitung ongkir |
| `city.cuisine` | `"Batak/Medan"` | Gaya masakan untuk resep yang dibuat AI |
| `messages.thanks` | `"Terima kasih sudah belanja di ...!"` | WA saat pesanan dibuat |
| `messages.delivered` | `"Selamat menikmati ...!"` | WA saat pesanan sampai |

**Warna (`colors`)**, semua dalam kode hex 6 digit:

| Isian | Bagian tampilan |
|---|---|
| `palette` | Palet Tailwind untuk teks/garis aksen: `emerald` (hijau asli), `green`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`, `red`, `orange`, `amber`, `yellow`, `lime` |
| `button` | Tombol utama (Bayar, Simpan) dan garis fokus |
| `header`, `headerDark`, `headerLight` | Header, bar keranjang, tombol chat (warna utama, sisi gelap, sisi terang) |
| `accent`, `accentLight`, `accentSoft` | Tombol +, tombol Masuk, tab aktif menu bawah |
| `yellow`, `yellowInk` | Pil jam kirim dan teks di atasnya |
| `flashFrom`, `flashTo` | Gradasi kotak Flash Sale |
| `background`, `surface` | Latar halaman dan kartu |
| `shadow` | Warna bayangan gaya clay |
| `themeColor` | Warna bilah status HP saat aplikasi dipasang |

Tips: pilih warna di [tailwindcss.com/docs/colors](https://tailwindcss.com/docs/colors) agar
serasi dengan `palette`.

### 3. Terapkan merek

Dari folder utama repo:

```bash
python3 scripts/terapkan_merek.py --cek   # periksa dulu, tidak menulis apa pun
python3 scripts/terapkan_merek.py         # terapkan
```

Skrip ini memeriksa isian, lalu memperbarui file turunan (warna, judul halaman, manifest
PWA, salinan konfigurasi untuk frontend dan backend). Kalau ada isian yang salah, skrip
menyebutkan isian mana yang perlu dibetulkan.

**Ikon aplikasi**: simpan logo persegi (minimal 512 x 512 piksel, PNG) sebagai
`frontend/public/logo.png` lalu jalankan skrip lagi. Ikon `icon-192.png`, `icon-512.png`,
`icon-maskable-512.png`, dan `apple-touch-icon.png` dibuat otomatis (butuh Pillow, sudah ada
di `backend/requirements.txt`).

### 4. Isi kunci rahasia (`.env`)

Salin `backend/.env.example` menjadi `backend/.env` dan `frontend/.env.example` menjadi
`frontend/.env`, lalu isi. **Jangan pernah** mengunggah file `.env` ke GitHub. Di Emergent,
isi lewat pengaturan Environment/Secrets.

Yang wajib untuk toko baru:

- `DB_NAME`: nama database baru agar data toko tidak tercampur.
- `JWT_SECRET`, `WEBHOOK_CRON_SECRET`, `BITESHIP_WEBHOOK_SECRET`: teks acak panjang yang
  berbeda dari toko lain.
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`: akun admin pertama (wajib ganti password saat login
  pertama).
- `CORS_ORIGINS`, `CORS_ORIGIN_REGEX`: domain toko baru.
- `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`: dari akun Midtrans
  merek baru. Mulai dengan sandbox (`false`) untuk uji coba.
- `REACT_APP_BACKEND_URL` (frontend): alamat https toko.

Opsional: Twilio (OTP dan WhatsApp), Biteship (ongkir sungguhan), Google Maps.

### 5. Tinjau teks halaman informasi

Buka `frontend/src/lib/infoContent.js`. Nama toko, domain, dan kota sudah otomatis dari
`brand.config.json`, tetapi artikel Blog adalah contoh untuk toko sayur di Padang. Ganti
artikelnya dan tinjau Kebijakan Privasi serta Syarat dan Ketentuan (sebaiknya dengan ahli
hukum). Ubah tanggal `UPDATED`.

### 6. Isi produk

Setelah aplikasi jalan, masuk sebagai admin lalu buka **Produk > Ekspor/Impor** untuk
mengunggah daftar produk lewat Excel, atau tambah satu per satu. Katalog bawaan (file
`backend/catalog_v2.json` dan `backend/shopee_products.json`) adalah produk Rak Sayur Padang;
ganti atau kosongkan sebelum tayang untuk merek lain.

Atur juga di admin: **Pengaturan Toko** (alamat dan nomor jemput kurir), **Promo/Voucher**
(kode bawaan seperti `PADANG25` bisa dinonaktifkan atau diganti), **Banner**.

### 7. Tayangkan lewat Emergent

1. Di Emergent, buat job baru lalu pilih **Import from GitHub** dan pilih repo baru Anda.
2. Tempel prompt dari file `PROMPT-BANGUN-ULANG.md` ke chat agen Emergent.
3. Isi Environment/Secrets sesuai langkah 4.
4. Setelah agen selesai dan pratinjau benar, klik **Deploy/Publish**, lalu hubungkan domain.
5. Di dashboard Midtrans, isi **Payment Notification URL** dengan
   `https://domainanda/api/payments/midtrans/notification`, dan minta Midtrans mengaktifkan
   QRIS untuk Core API agar QR langsung tampil di aplikasi.

Catatan Emergent: situs yang tayang berasal dari workspace Emergent, bukan langsung dari
GitHub. Kalau Anda mengubah repo di GitHub setelah job dibuat, minta agen menarik
perubahannya dulu sebelum menekan "Save to GitHub", supaya perubahan tidak tertimpa.

## Mengubah merek yang sudah tayang

Ubah `brand.config.json`, jalankan `python3 scripts/terapkan_merek.py`, commit, lalu
Re-publish. Data pelanggan, pesanan, dan produk di database tidak berubah.

## Daftar periksa sebelum tayang

- [ ] `brand.config.json` sudah diisi dan `--cek` menyatakan OK
- [ ] Logo dan ikon aplikasi sudah diganti
- [ ] `.env` backend dan frontend sudah diisi, `DB_NAME` baru
- [ ] Kunci Midtrans milik merek baru, URL notifikasi sudah diisi
- [ ] Teks Blog, Kebijakan Privasi, S&K, FAQ sudah ditinjau
- [ ] Katalog produk dan voucher sudah sesuai merek baru
- [ ] Pengaturan Toko (titik jemput) sudah diisi di admin
- [ ] Login admin pertama berhasil dan password sudah diganti
- [ ] Uji satu pesanan sandbox dari keranjang sampai terbayar
