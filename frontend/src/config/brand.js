// Data merek untuk seluruh tampilan. JANGAN ubah nilainya di sini:
// ubah brand.config.json di folder utama repo, lalu jalankan
//   python3 scripts/terapkan_merek.py
// Skrip itu menyalin isinya ke ./brand.json yang dibaca file ini.
import data from "./brand.json";

export const BRAND = data;
export const STORE_NAME = data.name;
export const SHORT_NAME = data.shortName;
export const DOMAIN = data.domain;
export const LOGO_URL = data.logoUrl;
export const WALLET_NAME = data.walletName;
export const CITY = data.city;
// Cocokkan isian "kota" pada alamat dengan kota layanan (dipakai untuk Kurir Toko / COD).
export const CITY_RE = new RegExp(data.city.matchRegex, "i");
export const isServiceCity = (city) => CITY_RE.test(city || "");
export const MAP_CENTER = { lat: data.city.mapCenter[0], lng: data.city.mapCenter[1] };
