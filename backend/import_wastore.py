"""Impor katalog Pasbar Frozen dari WAStore (https://wastore.id/toko-pasbar-frozen) ke MongoDB.

Cara pakai (dari folder backend/, butuh MONGO_URL dan DB_NAME di .env):

    python3 import_wastore.py --scrape                 # ambil dari WAStore, simpan wastore_products.json, lalu impor
    python3 import_wastore.py --scrape --dry-run       # hanya ambil dan simpan JSON, tidak menyentuh database
    python3 import_wastore.py --file wastore_products.json   # impor dari file JSON yang sudah ada

Format file JSON: daftar objek
    {"name": "...", "price": 25000, "image": "https://...", "category": "Ayam",
     "stock": 20 (opsional), "description": "..." (opsional), "url": "..." (opsional)}

Aturan:
- Produk dicocokkan dengan nama (huruf kecil, spasi dirapikan). Yang sudah ada diperbarui harga, foto,
  kategori dan sifat beku/keringnya; HPP, stok yang sudah diatur admin, dan diskon tidak diubah.
- Produk baru dibuat aktif dengan stok awal --stock (bawaan 20).
- Produk lama yang tidak ada di WAStore TIDAK dihapus atau diarsipkan.
- Sifat beku (cold=True, hanya Kurir Toko) atau kering (cold=False, boleh JNE/J&T) ditentukan oleh
  kategori dan kata kunci nama. Admin tetap bisa mengubahnya per produk.
"""
import argparse
import html
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests

ROOT = Path(__file__).parent
STORE_URL = "https://wastore.id/toko-pasbar-frozen"
OUT = ROOT / "wastore_products.json"
UA = {"User-Agent": "Mozilla/5.0 (katalog Pasbar Frozen)"}

# Kategori WAStore -> (slug, nama, ikon, beku?)
CATEGORIES = {
    "dairy": ("dairy", "Dairy", "Milk", True),
    "daging sapi": ("daging-sapi", "Daging Sapi", "Beef", True),
    "ayam": ("ayam", "Ayam", "Flame", True),
    "nugget & sosis": ("nugget-sosis", "Nugget & Sosis", "Snowflake", True),
    "seafood": ("seafood", "Seafood", "Fish", True),
    "camilan": ("camilan", "Camilan", "Croissant", None),
    "saus & bumbu": ("saus-bumbu", "Saus & Bumbu", "CookingPot", False),
    "lainnya": ("lainnya", "Lainnya", "Package", None),
}
FROZEN_WORDS = ("beku", "frozen", "nugget", "sosis", "sausage", "dimsum", "dim sum", "siomay", "gyoza", "kulit",
                "tortilla", "pastry", "mix veg", "vegatable", "vegetable", "kentang", "french fries", "fries",
                "bakso", "otak", "risol", "lumpia", "pangsit", "basah", "keju", "mozarella", "mozzarella", "daging",
                "beef", "ayam", "chicken", "udang", "ikan", "cumi", "fillet", "karage", "katsu", "burger", "smoked")
DRY_WORDS = ("saus", "sauce", "kecap", "bumbu", "tepung", "minyak", "mayo", "mayonaise", "kering", "sambal", "gula", "garam",
             "penyedap", "kaldu", "biskuit", "keripik", "kerupuk")


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def classify(category: str, name: str):
    key = norm(category)
    slug, cname, icon, cold = CATEGORIES.get(key, ("lainnya", "Lainnya", "Package", None))
    n = norm(name)
    if cold is None:
        if any(w in n for w in DRY_WORDS) and not any(w in n for w in ("basah", "frozen", "beku")):
            cold = False
        else:
            cold = any(w in n for w in FROZEN_WORDS)
    return slug, cname, icon, cold


def unit_of(name: str) -> str:
    m = re.search(r"(\d+(?:[.,]\d+)?\s*(?:kg|gr|g|ml|l)\b(?:/\d+\s*kg)?|isi\s*\d+)", name, re.I)
    return m.group(0) if m else "pcs"


# ---------------- Scrape ----------------
def _get(url: str) -> str:
    for i in range(3):
        try:
            r = requests.get(url, headers=UA, timeout=30)
            if r.status_code == 200:
                return r.text
        except requests.RequestException:
            pass
        time.sleep(1 + i)
    return ""


def _meta(page: str, prop: str) -> str:
    m = re.search(rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']*)', page, re.I) or \
        re.search(rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']{re.escape(prop)}["\']', page, re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def _jsonld_product(page: str) -> dict:
    for block in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', page, re.S | re.I):
        try:
            data = json.loads(block.strip())
        except ValueError:
            continue
        for d in data if isinstance(data, list) else [data, *data.get("@graph", [])] if isinstance(data, dict) else []:
            if isinstance(d, dict) and "Product" in str(d.get("@type")):
                return d
    return {}


def product_links(listing: str, base: str) -> list:
    links = re.findall(r'href=["\']([^"\']*/toko-pasbar-frozen/p/[^"\'#?]+)', listing)
    return list(dict.fromkeys(urljoin(base, l) for l in links))


def parse_product(url: str) -> dict:
    page = _get(url)
    if not page:
        return {}
    ld = _jsonld_product(page)
    offers = ld.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    name = ld.get("name") or _meta(page, "og:title")
    price = offers.get("price") or _meta(page, "product:price:amount")
    if not price:
        m = re.search(r"Rp\s*([\d.]+)", page)
        price = m.group(1) if m else 0
    image = ld.get("image") or _meta(page, "og:image")
    if isinstance(image, list):
        image = image[0] if image else ""
    cat = ld.get("category") or ""
    if not cat:
        m = re.search(r'(?:kategori|category)[^<>]{0,40}>\s*([^<]{2,40})<', page, re.I)
        cat = m.group(1) if m else ""
    try:
        price = int(re.sub(r"\D", "", str(price).split(",")[0].split(".00")[0]) or 0)
    except ValueError:
        price = 0
    return {"name": html.unescape(name).strip(), "price": price, "image": image, "category": html.unescape(cat).strip(),
            "description": (ld.get("description") or _meta(page, "og:description"))[:500], "url": url}


def scrape(max_pages: int = 40) -> list:
    links, seen_pages = [], set()
    for n in range(1, max_pages + 1):
        url = STORE_URL if n == 1 else f"{STORE_URL}?page={n}"
        page = _get(url)
        if not page:
            break
        new = [l for l in product_links(page, STORE_URL) if l not in links]
        key = tuple(new)
        if not new or key in seen_pages:
            break
        seen_pages.add(key)
        links += new
        print(f"  halaman {n}: +{len(new)} produk (total {len(links)})")
    print(f"Ditemukan {len(links)} tautan produk. Mengambil detail...")
    out = []
    for i, l in enumerate(links, 1):
        p = parse_product(l)
        if p.get("name") and p.get("price"):
            out.append(p)
        else:
            print(f"  ! gagal membaca {l}")
        if i % 20 == 0:
            print(f"  {i}/{len(links)}")
    return out


# ---------------- Import ----------------
def import_products(rows: list, stock: int) -> None:
    from pymongo import MongoClient
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc).isoformat()
    existing = {norm(p["name"]): p for p in db.products.find({}, {"_id": 0, "product_id": 1, "name": 1})}
    created = updated = 0
    cats = {}
    for r in rows:
        slug, cname, icon, cold = classify(r.get("category", ""), r["name"])
        cats.setdefault(slug, {"slug": slug, "name": cname, "icon": icon, "fresh": False, "virtual": False, "image": r.get("image", "")})
        price = int(r["price"])
        base = {"name": r["name"], "category": slug, "category_name": cname, "cold": bool(cold), "fresh": False,
                "image": r.get("image") or "/logo.png", "price": price, "source": "wastore", "synced_at": now}
        old = existing.get(norm(r["name"]))
        if old:
            doc = db.products.find_one({"product_id": old["product_id"]}, {"_id": 0, "discount": 1})
            disc = (doc or {}).get("discount", 0) or 0
            base["final_price"] = round(price * (1 - disc / 100)) if disc else price
            db.products.update_one({"product_id": old["product_id"]}, {"$set": {**base, "active": True, "archived": False}})
            updated += 1
        else:
            pid = f"pf_{uuid.uuid4().hex[:12]}"
            st = int(r.get("stock") or stock)
            db.products.insert_one({**base, "product_id": pid, "unit": unit_of(r["name"]), "discount": 0, "final_price": price,
                                    "sold": 0, "stock": st, "in_stock": st > 0, "rating": 0, "hpp": 0, "best_seller": False,
                                    "new_arrival": False, "active": True, "archived": False,
                                    "description": r.get("description") or f"{r['name']} dari Pasbar Frozen."})
            existing[norm(r["name"])] = {"product_id": pid, "name": r["name"]}
            created += 1
    for c in cats.values():
        db.categories.update_one({"slug": c["slug"]}, {"$setOnInsert": c}, upsert=True)
    cold_n = sum(1 for r in rows if classify(r.get("category", ""), r["name"])[3])
    print(f"Selesai: {created} produk baru, {updated} diperbarui. Beku: {cold_n}, kering: {len(rows) - cold_n}.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scrape", action="store_true", help="ambil data dari WAStore")
    ap.add_argument("--file", help="impor dari file JSON")
    ap.add_argument("--dry-run", action="store_true", help="jangan tulis ke database")
    ap.add_argument("--stock", type=int, default=20, help="stok awal produk baru (bawaan 20)")
    a = ap.parse_args()
    if a.scrape:
        rows = scrape()
        OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=1))
        print(f"Disimpan {len(rows)} produk ke {OUT.name}")
    elif a.file:
        rows = json.loads(Path(a.file).read_text())
    else:
        ap.print_help()
        sys.exit(1)
    if not rows:
        print("Tidak ada produk. Periksa halaman WAStore atau isi file JSON secara manual.")
        sys.exit(1)
    for r in rows[:5]:
        print("  contoh:", r["name"], r["price"], r.get("category"), "-> beku" if classify(r.get("category", ""), r["name"])[3] else "-> kering")
    if not a.dry_run:
        import_products(rows, a.stock)


if __name__ == "__main__":
    main()
