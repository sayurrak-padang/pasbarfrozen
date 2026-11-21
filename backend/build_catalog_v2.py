"""Build catalog_v2.json from Shopee 'Data Barang' (sales) + 'data Media' exports."""
import html
import json
import re
import sys
from pathlib import Path
from python_calamine import CalamineWorkbook
from recategorize import classify

ROOT = Path(__file__).parent
W = re.compile(r"(\d+(?:[.,]\d+)?)\s*(kg|kilo|gram|gr|g|ml|liter|ltr|l)\b", re.I)
UNIT = {"kg": 1000, "kilo": 1000, "gram": 1, "gr": 1, "g": 1, "ml": 1, "liter": 1000, "ltr": 1000, "l": 1000}
COLD_PATHS = ("Fresh & Frozen Food/Meat", "Seafood", "Processed Meat", "Frozen Processed", "Beancurd", "Vegetarian Meat")


def weight_of(*texts) -> int:
    for t in texts:
        m = W.search(t or "")
        if m:
            g = float(m.group(1).replace(",", ".")) * UNIT[m.group(2).lower()]
            return int(min(max(g, 50), 30000))
    return 500


def rows(path):
    return CalamineWorkbook.from_path(path).get_sheet_by_name("Sheet1").to_python()[6:]


def main(sales_path, media_path):
    media = {}
    for r in rows(media_path):
        if not r[0]:
            continue
        imgs = [str(u).strip() for u in r[4:13] if str(u).strip().startswith("http")]
        path = html.unescape(str(r[3])).split(" - ", 1)[-1]
        media[str(r[0])] = {"name": html.unescape(str(r[2])).strip(), "path": path, "images": imgs}
    out = {}
    for r in rows(sales_path):
        if not r[0]:
            continue
        pid = str(r[0])
        m = media.get(pid, {"name": html.unescape(str(r[1])).strip(), "path": "", "images": []})
        p = out.setdefault(pid, {"product_id": pid, "name": m["name"], "image": m["images"][0] if m["images"] else "",
                                 "images": m["images"], "category_guess": classify(m["path"], m["name"]),
                                 "cold": any(k in m["path"] for k in COLD_PATHS), "variants": [], "weight": weight_of(m["name"])})
        price, stock = int(float(r[6] or 0)), int(float(r[8] or 0))
        vname = html.unescape(str(r[3] or "")).strip()
        if vname:
            p["variants"].append({"variant_id": str(r[2]), "name": vname, "price": price, "stock": stock, "weight": weight_of(vname, m["name"])})
        else:
            p.update(price=price, stock=stock)
    for p in out.values():
        if p["variants"]:
            p["price"] = min(v["price"] for v in p["variants"])
            p["stock"] = sum(v["stock"] for v in p["variants"])
    (ROOT / "catalog_v2.json").write_text(json.dumps(list(out.values()), ensure_ascii=False))
    print(len(out), "products,", sum(len(p["variants"]) for p in out.values()), "variants,",
          sum(1 for p in out.values() if p["cold"]), "cold")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
