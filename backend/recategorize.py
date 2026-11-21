"""Map products to Rak Sayur Padang Shopee shop (etalase) categories. Updates DB + json, keeps price/stock edits."""
import os, re, json
from pathlib import Path
import pandas as pd
from pymongo import MongoClient
from dotenv import load_dotenv
from import_shopee import MEDIA_URL, dl, clean

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

CATEGORIES = [
    ("sayuran", "Sayuran", "Leaf", True),
    ("buah-buahan", "Buah-buahan", "Apple", True),
    ("ikan-dan-daging", "Ikan dan Daging", "Beef", True),
    ("bumbu-instan", "Bumbu Instan", "Flame", False),
    ("bumbu-dapur", "Bumbu Dapur", "Flame", True),
    ("buah-sayur-exotic", "Buah Sayur Exotic", "Apple", True),
    ("ikan-asin", "Ikan Asin", "Fish", False),
    ("roti-kue", "Roti & Kue", "Croissant", False),
    ("makanan-segar-beku", "Makanan Segar & Beku", "Snowflake", True),
    ("minuman", "Minuman", "CupSoda", False),
    ("bahan-baking", "Bahan Baking", "CakeSlice", False),
    ("kebutuhan-memasak", "Kebutuhan Memasak", "CookingPot", False),
    ("bahan-pokok", "Bahan Pokok", "Package", False),
    ("makanan-instan", "Makanan Instan", "Soup", False),
    ("set-hadiah-hampers", "Set Hadiah & Hampers", "Gift", False),
    ("susu-olahan", "Susu & Olahan", "Milk", False),
    ("new-arrival", "New Arrival", "Sparkles", False),
    ("sembako", "Sembako", "Wheat", False),
]
META = {c[0]: c for c in CATEGORIES}

# (path substring, slug) — first match wins
RULES = [
    ("Fruits/Tropical & Exotic", "buah-sayur-exotic"), ("Fruits/Berries", "buah-sayur-exotic"),
    ("Fruits/", "buah-buahan"),
    ("Vegetables/Fresh Herbs", "bumbu-dapur"), ("Vegetables/Garlic, Ginger", "bumbu-dapur"),
    ("Vegetables/Chilli & Capsicum", "bumbu-dapur"), ("Herbs & Spices", "bumbu-dapur"), ("Pepper", "bumbu-dapur"),
    ("Vegetables/", "sayuran"), ("Fresh & Frozen Food/Mushroom", "sayuran"),
    ("Dried Seafood", "ikan-asin"),
    ("Meat/", "ikan-dan-daging"), ("Seafood/", "ikan-dan-daging"),
    ("Processed Meat", "makanan-segar-beku"), ("Frozen Processed", "makanan-segar-beku"),
    ("Vegetarian Meat", "makanan-segar-beku"), ("Beancurd", "makanan-segar-beku"),
    ("Cooking Paste", "bumbu-instan"), ("Stock, Gravy", "bumbu-instan"), ("Flour Coating", "bumbu-instan"),
    ("Flavour Enhancers", "bumbu-instan"),
    ("Food Staples/Rice", "sembako"), ("Cooking Essentials/Sugar", "sembako"), ("Cooking Essentials/Oil", "sembako"),
    ("Dairy & Eggs/Eggs", "sembako"),
    ("Food Staples/", "bahan-pokok"),
    ("Baking Needs/", "bahan-baking"),
    ("Bakery/", "roti-kue"),
    ("Dairy & Eggs/", "susu-olahan"),
    ("Food & Beverages/Beverages/", "minuman"),
    ("Convenience", "makanan-instan"), ("Snacks/", "makanan-instan"),
    ("Gift Set", "set-hadiah-hampers"),
    ("Cooking Essentials/", "kebutuhan-memasak"), ("Home & Living/", "kebutuhan-memasak"),
]

EXOTIC = re.compile(r"import|exotic|eksotik|zucchini|zukini|asparagus|kale|romaine|lettuce|iceberg|brokoli|broccoli|"
                    r"paprika|kiwi|avocado|alpukat|anggur|strawberr|blueberr|buah naga|lollo|baby (?:corn|buncis|wortel)|"
                    r"jamur (?:shimeji|enoki|shitake|shiitake)|bit merah|beetroot|pakcoy jepang|horenzo|rosemary|"
                    r"thyme|parsley|basil|dill|celery|seledri stick|lobak jepang|kyuri|okra|labu (?:madu|kabocha)", re.I)


def classify(path, name):
    slug = next((s for k, s in RULES if k in path), "kebutuhan-memasak")
    if slug in ("sayuran", "buah-buahan") and EXOTIC.search(name):
        slug = "buah-sayur-exotic"
    return slug


def main():
    media = pd.read_excel(dl(MEDIA_URL), dtype=str, engine="calamine").fillna("")
    paths = {r["et_title_product_id"].strip(): clean(r["et_title_product_category"]).split(" - ", 1)[-1]
             for _, r in media.iterrows() if re.match(r"^\d+$", r["et_title_product_id"].strip())}
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    products = list(db.products.find({}, {"_id": 0}))
    newest = {p["product_id"] for p in sorted(products, key=lambda p: int(p["product_id"]), reverse=True)[:24]}
    counts = {}
    for p in products:
        slug = classify(paths.get(p["product_id"], ""), p["name"])
        _, name, _, fresh = META[slug]
        upd = {"category": slug, "category_name": name, "fresh": fresh, "new_arrival": p["product_id"] in newest}
        db.products.update_one({"product_id": p["product_id"]}, {"$set": upd})
        p.update(upd)
        counts[name] = counts.get(name, 0) + 1
    cats = [{"slug": s, "name": n, "icon": i, "fresh": f, "virtual": s == "new-arrival"} for s, n, i, f in CATEGORIES]
    db.categories.delete_many({})
    db.categories.insert_many([dict(c) for c in cats])
    (ROOT / "shopee_products.json").write_text(json.dumps(products, ensure_ascii=False))
    (ROOT / "shopee_categories.json").write_text(json.dumps(cats, ensure_ascii=False))
    counts["New Arrival"] = len(newest)
    print(json.dumps(counts, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
