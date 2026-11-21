# Pasbar Frozen (pasbarfrozen.com)

Web app toko online Pasbar Frozen, frozen food dari Pasaman Barat. Dibuat dari template
toko online Rak Sayur Padang (repo `toko-online-template`) dengan merek Pasbar Frozen.

- **Ganti merek**: ubah `brand.config.json`, lalu jalankan `python3 scripts/terapkan_merek.py`.
- **Panduan lengkap** (Bahasa Indonesia): [PANDUAN-TEMPLATE.md](PANDUAN-TEMPLATE.md)
- **Prompt siap tempel untuk Emergent/AI lain**: [PROMPT-BANGUN-ULANG.md](PROMPT-BANGUN-ULANG.md)
- **Kunci rahasia**: salin `backend/.env.example` dan `frontend/.env.example` menjadi `.env`.
  Jangan pernah commit file `.env`.

Teknologi: FastAPI + MongoDB (`backend/`), Vite + React 19 + Tailwind v4 + shadcn/ui
(`frontend/`), pembayaran Midtrans, ongkir Biteship, WhatsApp/OTP Twilio.
