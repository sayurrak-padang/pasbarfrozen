"""Apply promo discounts to featured products so the Flash Sale section appears.
Updates MongoDB and persists to shopee_products.json (survives restart/fork)."""
import os, json
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

DISCOUNTS = [25, 20, 15, 30, 18, 22, 12, 28, 10, 20, 15, 25]

# pick featured (best_seller) products, fallback to top-stock
featured = list(db.products.find({"best_seller": True}, {"_id": 0}).limit(len(DISCOUNTS)))
if not featured:
    featured = list(db.products.find({}, {"_id": 0}).sort("stock", -1).limit(len(DISCOUNTS)))

updates = {}
for i, p in enumerate(featured):
    disc = DISCOUNTS[i % len(DISCOUNTS)]
    final = round(p["price"] * (1 - disc / 100))
    db.products.update_one({"product_id": p["product_id"]},
                           {"$set": {"discount": disc, "final_price": final}})
    updates[p["product_id"]] = (disc, final)

# persist to json
pj = ROOT / "shopee_products.json"
if pj.exists():
    prods = json.loads(pj.read_text(encoding="utf-8"))
    for p in prods:
        if p["product_id"] in updates:
            p["discount"], p["final_price"] = updates[p["product_id"]]
    pj.write_text(json.dumps(prods, ensure_ascii=False), encoding="utf-8")

print(f"Applied discounts to {len(updates)} products")
for pid, (d, f) in list(updates.items())[:5]:
    print(" ", pid, f"-{d}% -> Rp{f}")
