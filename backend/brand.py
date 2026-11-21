"""Data merek untuk backend (nama toko, kota layanan, teks pesan).

JANGAN ubah nilainya di sini. Ubah brand.config.json di folder utama repo lalu jalankan
    python3 scripts/terapkan_merek.py
Skrip itu menyalin isinya ke backend/brand.json yang dibaca file ini.
"""
import json
from pathlib import Path

BRAND = json.loads((Path(__file__).parent / "brand.json").read_text(encoding="utf-8"))
STORE_NAME = BRAND["name"]
CITY = BRAND["city"]
