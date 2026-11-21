"""Import real Rak Sayur Padang catalog from Shopee mass-update export files.
Joins sales-info (price/stock per variation) with media-info (name/category/image) on product_id.
Writes shopee_products.json + shopee_categories.json and loads them into MongoDB.
NOTE: Shopee export files do NOT contain 'sold' or 'discount' columns -> defaulted to 0.
"""
import os, re, json, html, unicodedata
from pathlib import Path
import requests
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

SALES_URL = "https://customer-assets-4nw71qhi.emergentagent.net/job_raksayur-belanja/artifacts/7d79adb45815d664_mass_update_sales_info_276471711_20260608163724.xlsx"
MEDIA_URL = "https://customer-assets-4nw71qhi.emergentagent.net/job_raksayur-belanja/artifacts/9d7c9f6c341757df_mass_update_media_info_276471711_20260608163712.xlsx"

GROUP_MAP = {
    "Fresh & Frozen Food": ("Segar & Frozen", "Beef", True),
    "Cooking Essentials": ("Bumbu & Bahan Masak", "Flame", False),
    "Food Staples": ("Sembako Pokok", "Wheat", False),
    "Snacks": ("Camilan", "Apple", False),
    "Beverages": ("Minuman", "Apple", False),
    "Convenience / Ready-to-eat / Instant Food": ("Makanan Instan", "Wheat", False),
}


def dl(url):
    p = ROOT / ("_tmp_" + url.split("/")[-1])
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    p.write_bytes(r.content)
    return p


def clean(s):
    return html.unescape(str(s)).strip()


def slugify(name):
    n = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    n = re.sub(r"[^a-zA-Z0-9]+", "-", n).strip("-").lower()
    return n or "lainnya"


def parse_category(raw):
    """raw like 'Frozen Food Rak Sayur Padang 100854 - Food & Beverages/Fresh & Frozen Food/Frozen Processed Food'"""
    raw = clean(raw)
    if " - " in raw:
        raw = raw.split(" - ", 1)[1]
    parts = [p.strip() for p in raw.split("/") if p.strip()]
    # parts[0] usually 'Food & Beverages'; group = parts[1]
    if len(parts) >= 2:
        group = parts[1]
    elif parts:
        group = parts[0]
    else:
        group = "Lainnya"
    return group


def main():
    sales_p = dl(SALES_URL)
    media_p = dl(MEDIA_URL)

    pd_sales = pd.read_excel(sales_p, dtype=str, engine="calamine").fillna("")
    media = pd.read_excel(media_p, dtype=str, engine="calamine").fillna("")
    sales = pd_sales

    sales = sales[sales["et_title_product_id"].str.match(r"^\d+$", na=False)]
    media = media[media["et_title_product_id"].str.match(r"^\d+$", na=False)]

    # aggregate sales per product_id
    agg = {}
    for _, r in sales.iterrows():
        pid = r["et_title_product_id"].strip()
        try:
            price = int(float(r.get("et_title_variation_price") or 0))
        except ValueError:
            price = 0
        try:
            stock = int(float(r.get("et_title_variation_stock") or 0))
        except ValueError:
            stock = 0
        vname = clean(r.get("et_title_variation_name") or "")
        a = agg.setdefault(pid, {"prices": [], "stock": 0, "unit": ""})
        if price > 0:
            a["prices"].append(price)
        a["stock"] += stock
        if not a["unit"] and vname and vname.lower() not in ("nan",):
            a["unit"] = vname

    products, groups = [], {}
    idx = 0
    for _, r in media.iterrows():
        pid = r["et_title_product_id"].strip()
        s = agg.get(pid)
        if not s or not s["prices"]:
            continue
        name = clean(r.get("et_title_product_name") or "")
        if not name:
            continue
        image = clean(r.get("ps_item_cover_image") or "")
        if not image.startswith("http"):
            continue
        group = parse_category(r.get("et_title_product_category") or "")
        indo, icon, fresh = GROUP_MAP.get(group, (group or "Lainnya", "Leaf", False))
        slug = slugify(indo)
        groups[slug] = {"slug": slug, "name": indo, "icon": icon, "fresh": fresh}
        price = min(s["prices"])
        unit = s["unit"] or "pcs"
        idx += 1
        products.append({
            "product_id": pid,
            "name": name,
            "unit": unit,
            "category": slug,
            "category_name": indo,
            "fresh": fresh,
            "price": price,
            "discount": 0,
            "final_price": price,
            "sold": 0,
            "stock": s["stock"],
            "rating": 4.8,
            "image": image,
            "best_seller": False,
            "active": True,
            "in_stock": s["stock"] > 0,
            "description": f"{name} — produk asli Rak Sayur Padang. Dikemas higienis & dikirim langsung dari Padang.",
        })

    # mark top 12 by stock as featured (no real sold data available)
    for p in sorted(products, key=lambda x: x["stock"], reverse=True)[:12]:
        p["best_seller"] = True

    categories = list(groups.values())

    (ROOT / "shopee_products.json").write_text(json.dumps(products, ensure_ascii=False))
    (ROOT / "shopee_categories.json").write_text(json.dumps(categories, ensure_ascii=False))

    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    db.products.delete_many({})
    db.categories.delete_many({})
    if products:
        db.products.insert_many([dict(p) for p in products])
    if categories:
        db.categories.insert_many([dict(c) for c in categories])

    sales_p.unlink(missing_ok=True)
    media_p.unlink(missing_ok=True)
    print(f"Imported {len(products)} products, {len(categories)} categories")
    print("Categories:", [c["name"] for c in categories])


if __name__ == "__main__":
    main()
