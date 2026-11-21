"""One-time catalog sync (v2) applied at startup in every environment."""
import json
from datetime import datetime, timezone
from pathlib import Path

VERSION = "catalog_v2"
VEG = {"sayuran", "buah-buahan", "buah-sayur-exotic"}
COLD = {"ikan-dan-daging", "makanan-segar-beku", "dairy", "daging-sapi", "ayam", "nugget-sosis", "seafood", "camilan"}
DRY = ("asin", "kaleng", "sarden", "kering", "abon", "kerupuk")


def is_cold(category: str, name: str) -> bool:
    n = (name or "").lower()
    if any(k in n for k in DRY) and "frozen" not in n:
        return False
    return category in COLD or "frozen" in n or "beku" in n


async def apply_catalog_v2(db, logger):
    if await db.settings.find_one({"key": VERSION}):
        return
    path = Path(__file__).parent / "catalog_v2.json"
    if not path.exists():
        return
    catalog = json.loads(path.read_text())
    if not catalog:  # katalog kosong: jangan arsipkan produk yang sudah ada
        return
    cats = {c["slug"]: c["name"] for c in await db.categories.find({}, {"_id": 0, "slug": 1, "name": 1}).to_list(200)}
    existing = {p["product_id"]: p for p in await db.products.find({}, {"_id": 0}).to_list(5000)}
    now = datetime.now(timezone.utc).isoformat()
    for c in catalog:
        old = existing.get(c["product_id"])
        slug = old["category"] if old else c["category_guess"]
        cold = is_cold(slug, c["name"])
        hpp = (old or {}).get("hpp", 0)
        old_v = {v.get("variant_id"): v for v in (old or {}).get("variants") or []}
        variants = [{**v, "hpp": old_v.get(v["variant_id"], {}).get("hpp", hpp)} for v in c["variants"]]
        disc = (old or {}).get("discount", 0)
        doc = {"name": c["name"], "price": c["price"], "stock": c["stock"], "in_stock": c["stock"] > 0,
               "final_price": round(c["price"] * (1 - disc / 100)) if disc else c["price"],
               "variants": variants, "weight": c["weight"], "cold": cold, "fresh": slug in VEG,
               "images": c["images"], "active": True, "archived": False, "synced_at": now}
        if c["image"]:
            doc["image"] = c["image"]
        if old:
            await db.products.update_one({"product_id": c["product_id"]}, {"$set": doc})
        else:
            await db.products.insert_one({"product_id": c["product_id"], "category": slug, "category_name": cats.get(slug, slug),
                                          "unit": "pcs", "discount": 0, "sold": 0, "rating": 4.8, "hpp": 0, "description": "",
                                          "best_seller": False, "new_arrival": True, **doc})
    ids = [c["product_id"] for c in catalog]
    r = await db.products.update_many({"product_id": {"$nin": ids}, "archived": {"$ne": True}},
                                      {"$set": {"archived": True, "active": False, "archived_at": now}})
    await db.settings.insert_one({"key": VERSION, "at": now, "count": len(catalog), "archived": r.modified_count})
    logger.info(f"Catalog v2 synced: {len(catalog)} products, {r.modified_count} archived")


async def apply_cold_fix(db, logger):
    if await db.settings.find_one({"key": "catalog_v2b"}):
        return
    n = 0
    async for p in db.products.find({}, {"_id": 0, "product_id": 1, "category": 1, "name": 1}):
        await db.products.update_one({"product_id": p["product_id"]},
                                     {"$set": {"cold": is_cold(p["category"], p["name"]), "fresh": p["category"] in VEG}})
        n += 1
    await db.settings.insert_one({"key": "catalog_v2b", "count": n, "at": datetime.now(timezone.utc).isoformat()})
    logger.info(f"Cold/fresh flags recomputed for {n} products")
