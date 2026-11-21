import { BRAND } from "@/config/brand";

// Isi halaman Blog, Kebijakan Privasi, Syarat dan Ketentuan, dan Bantuan.
//
// CATATAN UNTUK PEMILIK TOKO: semua teks di file ini adalah DRAF awal yang disusun
// agar wajar untuk toko frozen food online di Pasaman Barat. Mohon ditinjau (dan bila perlu
// dikonsultasikan ke ahli hukum) sebelum dianggap final, terutama Kebijakan Privasi
// dan Syarat dan Ketentuan. Ubah tanggal UPDATED setiap kali isinya diganti.

export const UPDATED = "20 November 2026";
// Nama toko, domain, dan kota diambil dari brand.config.json. Artikel Blog di bawah
// adalah contoh; ganti isinya sesuai merek dan kota Anda.
export const STORE = BRAND.name;
const DOMAIN = BRAND.domain;
const CITY = BRAND.city.name;

// Foto stok: Unsplash License (bebas dipakai komersial, tanpa wajib atribusi).
// Tetap dicantumkan kecil di halaman login sebagai bentuk apresiasi.
export const HERO_PHOTO = {
  src: BRAND.login.heroImage,
  credit: BRAND.login.heroCredit || "",
};

// ---------------- Blog ----------------
export const BLOG_POSTS = [
  {
    slug: "menyimpan-frozen-food",
    title: "Cara Menyimpan Frozen Food Supaya Tetap Enak",
    excerpt: "Langsung masuk freezer, jangan bekukan ulang, dan pakai yang lama lebih dulu. Panduan singkat begitu pesanan sampai.",
    image: "https://images.unsplash.com/photo-1666013942642-b7b54ecafd7d?auto=format&fit=crop&w=800&q=70",
    date: "20 November 2026",
    minutes: 3,
    body: [
      "Produk beku kami kirim dalam kemasan tertutup. Supaya rasa dan teksturnya tetap terjaga sampai dimasak, ikuti langkah berikut begitu pesanan sampai.",
      "## Masukkan freezer secepatnya",
      "Jangan biarkan produk beku di suhu ruang terlalu lama. Simpan di freezer (-18°C) paling lambat 30 menit setelah diterima.",
      "## Jangan bekukan ulang",
      "Produk yang sudah cair sebaiknya langsung dimasak. Membekukan ulang membuat tekstur nugget, sosis, dan daging berubah dan rasanya berkurang.",
      "## Pakai yang lama lebih dulu",
      "Tulis tanggal beli di kemasan, lalu letakkan stok baru di belakang. Dengan begitu tidak ada yang terlupa sampai lewat tanggal.",
      "## Bagi per porsi",
      "Daging dan ayam ukuran 1 kg bisa dibagi per porsi masak sebelum dibekukan, supaya Anda hanya mencairkan secukupnya.",
    ],
  },
  {
    slug: "mencairkan-daging-dan-ayam",
    title: "Mencairkan Daging dan Ayam Beku dengan Aman",
    excerpt: "Pindahkan ke chiller semalam sebelum dimasak. Hindari air panas. Begini cara mencairkan yang aman dan cepat.",
    image: "https://images.unsplash.com/photo-1666013942642-b7b54ecafd7d?auto=format&fit=crop&w=800&q=70&crop=bottom",
    date: "15 November 2026",
    minutes: 3,
    body: [
      "Daging sapi, ayam, dan seafood beku paling enak bila dicairkan perlahan. Ini tiga cara yang aman.",
      "## 1. Di chiller semalam (paling baik)",
      "Pindahkan dari freezer ke chiller (0 sampai 4°C) malam sebelumnya. Cara ini menjaga tekstur dan cairan daging.",
      "## 2. Rendam air dingin (lebih cepat)",
      "Biarkan dalam plastik tertutup rapat, rendam di air dingin, dan ganti airnya setiap 30 menit. Daging 500 g biasanya cair dalam 1 sampai 2 jam.",
      "## 3. Langsung dimasak",
      "Nugget, sosis, kentang goreng, dan dimsum bisa langsung digoreng, dikukus, atau dipanggang dari keadaan beku.",
      "## Yang sebaiknya dihindari",
      "Jangan mencairkan dengan air panas atau dibiarkan di meja dapur berjam-jam, karena bakteri cepat berkembang di suhu ruang.",
    ],
  },
  {
    slug: "stok-frozen-food-seminggu",
    title: "Stok Frozen Food untuk Menu Keluarga Seminggu",
    excerpt: "Ayam, daging, nugget, sosis, dan bumbu. Daftar belanja sekali jalan supaya menu harian siap kapan saja.",
    image: "https://images.unsplash.com/photo-1666013942642-b7b54ecafd7d?auto=format&fit=crop&w=800&q=70&crop=top",
    date: "10 November 2026",
    minutes: 3,
    body: [
      "Dengan stok frozen food yang tepat, Anda tidak perlu ke pasar setiap hari. Ini contoh daftar belanja untuk keluarga kecil selama seminggu.",
      "## Lauk utama",
      "Ayam (paha, dada fillet, sayap) untuk digoreng, dibakar, atau digulai, dan daging sapi slice untuk tumisan dan sukiyaki.",
      "## Lauk praktis",
      "Nugget dan sosis untuk bekal anak dan sarapan cepat. Seafood seperti udang atau bakso ikan untuk variasi.",
      "## Pelengkap",
      "Kulit lumpia, kulit dimsum, mie, dan sayuran beku campur. Tambahkan saus dan bumbu supaya rasa lebih lengkap.",
      "Semua bahan di atas tersedia di kategori masing-masing. Cek juga menu Resep untuk ide masakan lengkap dengan tombol tambah ke keranjang.",
    ],
  },
  {
    slug: "cara-kami-mengantar",
    title: "Dari Freezer ke Pintu Rumah: Cara Kami Mengantar Pesanan",
    excerpt: `Pesanan dikemas rapat lalu diantar kurir toko di ${CITY}, atau dikirim lewat JNE dan J&T ke luar kota.`,
    image: "https://images.unsplash.com/photo-1666013942642-b7b54ecafd7d?auto=format&fit=crop&w=800&q=70&crop=left",
    date: "5 November 2026",
    minutes: 2,
    body: [
      "Banyak yang bertanya bagaimana frozen food bisa sampai tetap beku. Ini proses singkatnya.",
      "## 1. Pilih alamat dan kurir",
      `Saat checkout Anda memilih alamat pengiriman. Di ${CITY} pesanan bisa diantar kurir toko, dengan ongkir mulai Rp10.000 untuk 5 km pertama.`,
      "## 2. Disiapkan mendekati jadwal kirim",
      "Produk baru dikeluarkan dari freezer saat pesanan siap dikemas, bukan berjam-jam sebelumnya.",
      "## 3. Dikemas rapat",
      "Produk beku dikemas terpisah dan rapat supaya suhunya tetap terjaga selama perjalanan.",
      "## 4. Diantar atau dikirim",
      "Kurir toko mengantar langsung ke alamat Anda. Untuk luar kota, pesanan dikirim lewat JNE atau J&T. Status pengiriman bisa dipantau di halaman Pesanan.",
    ],
  },
];

// ---------------- Kebijakan Privasi ----------------
export const PRIVACY = [
  { h: "Ringkasan", p: [
    `${STORE} ("kami") menghargai privasi Anda. Kebijakan ini menjelaskan data apa yang kami kumpulkan saat Anda memakai situs dan aplikasi ${DOMAIN}, untuk apa data itu dipakai, dan pilihan yang Anda miliki. Kami mengikuti Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi.`,
  ] },
  { h: "Data yang kami kumpulkan", p: [
    "Data akun: nama, alamat email, nomor HP atau WhatsApp, dan foto profil bila Anda masuk dengan Google.",
    "Data pesanan: alamat pengiriman, titik lokasi peta, daftar belanja, catatan pesanan, metode pembayaran, dan riwayat transaksi Saldo.",
    "Data pengembalian dana: nama bank atau e-wallet, nomor rekening, dan nama pemilik rekening bila Anda memilih refund ke rekening.",
    "Data teknis: jenis perangkat, browser, dan halaman yang dibuka, untuk menjaga keamanan dan memperbaiki layanan.",
  ] },
  { h: "Untuk apa data dipakai", p: [
    "Memproses dan mengantar pesanan, termasuk membagikan nama, nomor HP, dan alamat kepada kurir pengantar.",
    "Menghubungi Anda tentang status pesanan lewat WhatsApp, email, atau chat di aplikasi.",
    "Memproses pembayaran, refund, poin, voucher, dan komisi affiliate.",
    "Mencegah penipuan dan penyalahgunaan akun.",
    "Mengirim info promo, hanya bila Anda tidak menolaknya. Anda bisa berhenti kapan saja.",
  ] },
  { h: "Pihak lain yang menerima data", p: [
    "Kami tidak menjual data pribadi Anda. Data hanya dibagikan seperlunya kepada mitra yang membantu layanan kami: penyedia pembayaran (Midtrans), mitra kurir, layanan pesan WhatsApp dan email, serta penyedia server dan peta.",
    "Kami juga dapat memberikan data bila diwajibkan oleh hukum atau permintaan resmi aparat yang berwenang.",
  ] },
  { h: "Penyimpanan dan keamanan", p: [
    "Data disimpan selama akun Anda aktif dan selama diperlukan untuk kewajiban pembukuan dan pajak. Password disimpan dalam bentuk terenkripsi (hash) dan tidak bisa dilihat oleh admin.",
    "Kami tidak menyimpan nomor kartu atau PIN pembayaran Anda. Pembayaran digital diproses langsung oleh penyedia pembayaran.",
  ] },
  { h: "Hak Anda", p: [
    "Anda dapat melihat dan mengubah data diri di menu Akun, meminta salinan data, meminta koreksi, atau meminta akun dan data Anda dihapus dengan menghubungi kami lewat menu Bantuan. Permintaan kami proses paling lambat 3 x 24 jam kerja.",
  ] },
  { h: "Perubahan kebijakan", p: [
    "Bila kebijakan ini berubah, tanggal pembaruan di atas ikut diganti. Perubahan penting akan kami umumkan di aplikasi.",
  ] },
];

// ---------------- Syarat dan Ketentuan ----------------
export const TERMS = [
  { h: "Umum", p: [
    `Dengan membuat akun atau berbelanja di ${DOMAIN}, Anda menyetujui syarat dan ketentuan ini. Layanan ${STORE} saat ini melayani pengantaran di wilayah ${CITY}, ${BRAND.city.province}.`,
  ] },
  { h: "Akun", p: [
    "Anda bertanggung jawab menjaga kerahasiaan password dan kode verifikasi (OTP). Jangan berikan kode OTP kepada siapa pun, termasuk yang mengaku sebagai admin kami.",
    "Kami berhak menonaktifkan akun yang dipakai untuk penipuan, penyalahgunaan promo, atau tindakan yang merugikan pihak lain.",
  ] },
  { h: "Produk, harga, dan berat", p: [
    "Daging, ayam, seafood, dan produk beku lainnya adalah produk yang mudah rusak. Ukuran, warna, dan berat per buah bisa sedikit berbeda dari foto. Untuk produk yang dijual per berat, toleransi selisih timbangan adalah sekitar 5 persen.",
    "Harga dapat berubah mengikuti harga pasar. Harga yang berlaku adalah harga saat Anda melakukan checkout.",
    "Bila sebagian barang habis setelah Anda memesan, kami akan menghubungi Anda untuk mengganti dengan barang serupa atau mengembalikan dana barang tersebut.",
  ] },
  { h: "Pembayaran", p: [
    "Pembayaran dapat dilakukan dengan Saldo, QRIS, Virtual Account, atau bayar di tempat (COD) bila tersedia untuk pesanan Anda. Pesanan non-COD diproses setelah pembayaran diterima. Batas waktu pembayaran digital adalah 60 menit.",
  ] },
  { h: "Pengiriman", p: [
    "Anda memilih tanggal dan jam antar saat checkout. Jadwal dapat bergeser karena cuaca, lalu lintas, atau ketersediaan kurir. Kami akan memberi kabar bila terjadi keterlambatan.",
    "Pastikan alamat, titik peta, dan nomor HP penerima benar. Biaya pengantaran ulang karena data yang salah atau penerima tidak di tempat dapat dibebankan kepada pembeli.",
  ] },
  { h: "Pembatalan", p: [
    "Pesanan dapat dibatalkan langsung dalam 10 menit setelah dibuat. Setelah itu, pembatalan diajukan dan ditinjau admin. Pesanan yang sudah diambil kurir tidak dapat dibatalkan.",
  ] },
  { h: "Komplain dan pengembalian dana", p: [
    "Bila barang rusak, busuk, kurang, atau tidak sesuai, ajukan komplain melalui halaman Pesanan paling lambat 1 x 24 jam setelah pesanan diterima, sertakan foto barang.",
    "Komplain yang disetujui akan kami ganti dengan barang baru atau kami kembalikan dananya. Pengembalian dana dikirim sesuai Metode Pengembalian Dana yang Anda pilih di menu Akun: ke Saldo (langsung masuk) atau ke rekening bank / e-wallet (ditransfer admin dalam 1 sampai 3 hari kerja, tanpa biaya).",
    "Pesanan yang dibayar dengan Saldo selalu dikembalikan ke Saldo.",
  ] },
  { h: "Saldo, poin, voucher, dan affiliate", p: [
    `Saldo hanya dapat dipakai untuk berbelanja di ${DOMAIN}. Poin dan voucher memiliki ketentuan masing-masing yang tertera di aplikasi dan tidak dapat diuangkan.`,
    "Komisi affiliate diberikan untuk pesanan yang selesai dan tidak dibatalkan. Kami berhak membatalkan komisi dari transaksi yang tidak wajar.",
  ] },
  { h: "Batas tanggung jawab", p: [
    "Tanggung jawab kami atas suatu pesanan paling banyak sebesar nilai pesanan tersebut. Simpan produk beku di freezer dan olah sesuai petunjuk agar kualitasnya terjaga.",
  ] },
  { h: "Perubahan ketentuan", p: [
    "Syarat dan ketentuan ini dapat diperbarui sewaktu-waktu. Dengan tetap memakai layanan setelah perubahan, Anda dianggap menyetujui versi terbaru.",
  ] },
];

// ---------------- Bantuan (FAQ) ----------------
export const FAQ = [
  { group: "Pesanan & Pengiriman", items: [
    { q: "Wilayah mana saja yang dilayani?", a: `Saat ini kami mengantar ke seluruh ${CITY}. Ongkir dihitung otomatis dari titik alamat Anda saat checkout.` },
    { q: "Kapan pesanan saya diantar?", a: "Sesuai tanggal dan jam antar yang Anda pilih saat checkout. Jam antar tersedia setiap hari pukul 09.00 sampai 18.00 WIB." },
    { q: "Bagaimana cara melacak pesanan?", a: "Buka tab Pesanan. Di sana terlihat status pesanan dan, bila sudah dikirim, info kurir dan pelacakannya." },
    { q: "Bisakah saya membatalkan pesanan?", a: "Bisa langsung dalam 10 menit setelah memesan. Lewat dari itu, ajukan pembatalan di halaman Pesanan dan admin akan meninjaunya selama pesanan belum diambil kurir." },
  ] },
  { group: "Pembayaran & Pengembalian Dana", items: [
    { q: "Metode pembayaran apa saja yang tersedia?", a: "Saldo, QRIS (termasuk GoPay dan ShopeePay), Virtual Account bank, dan bayar di tempat (COD) bila tersedia untuk pesanan Anda." },
    { q: "Barang saya rusak atau kurang, apa yang harus dilakukan?", a: "Buka pesanan di tab Pesanan lalu tekan Komplain, pilih barang yang bermasalah dan lampirkan foto, paling lambat 1 x 24 jam setelah diterima." },
    { q: "Ke mana uang refund dikirim?", a: "Sesuai pilihan di Akun > Metode Pengembalian Dana. Pilih Saldo agar dana langsung masuk, atau rekening bank / e-wallet agar ditransfer admin dalam 1 sampai 3 hari kerja tanpa biaya." },
  ] },
  { group: "Akun", items: [
    { q: "Saya lupa password.", a: "Di halaman Masuk, pilih Kode Email atau WhatsApp. Kami kirim kode 6 digit untuk masuk tanpa password, lalu Anda bisa mengganti password di menu Akun." },
    { q: "Bagaimana cara menghapus akun?", a: "Hubungi kami lewat chat di bawah ini dan sebutkan email akun Anda. Penghapusan diproses paling lambat 3 x 24 jam kerja." },
  ] },
];
