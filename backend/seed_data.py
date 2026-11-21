"""Seed data simulating Rak Sayur Padang Shopee catalog (sample of the 704 active products)."""

CATEGORIES = [
    {"slug": "sayuran-segar", "name": "Sayuran Segar", "icon": "Leaf", "fresh": True},
    {"slug": "buah-segar", "name": "Buah Segar", "icon": "Apple", "fresh": True},
    {"slug": "bumbu-dapur", "name": "Bumbu Dapur", "icon": "Flame", "fresh": True},
    {"slug": "lauk-daging", "name": "Lauk & Daging", "icon": "Beef", "fresh": True},
    {"slug": "sembako-kering", "name": "Sembako Kering", "icon": "Wheat", "fresh": False},
]

IMG = {
    "sayur": [
        "https://images.unsplash.com/photo-1695654400093-d8ae9f7ded66?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1662318183265-5bbe6578d1b0?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1528696353932-be229661fd48?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    ],
    "buah": [
        "https://images.unsplash.com/photo-1628689469838-524a4a973b8e?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1641642399576-487909d0ddbc?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1610832958506-aa56368176cf?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    ],
    "bumbu": [
        "https://images.unsplash.com/photo-1612192666309-f2da37265a8a?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1686231386813-c5951b0bf9b1?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1606913079621-e64bd28682ba?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    ],
    "lauk": [
        "https://images.unsplash.com/photo-1682991136736-a2b44623eeba?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1604503468506-a8da13d82791?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1587593810167-a84920ea0781?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1633096013004-e2cb4023b560?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    ],
    "sembako": [
        "https://images.unsplash.com/photo-1686820740687-426a7b9b2043?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1643622357625-c013987d90e7?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
        "https://images.unsplash.com/photo-1586201375761-83865001e31c?crop=entropy&cs=srgb&fm=jpg&q=85&w=600",
    ],
}

# name, price, unit, category_slug, img_pool, discount%, sold, stock
_RAW = [
    ("Bayam Hijau Segar", 6000, "ikat", "sayuran-segar", "sayur", 15, 1250, 48),
    ("Kangkung Segar", 5000, "ikat", "sayuran-segar", "sayur", 20, 2100, 60),
    ("Sawi Hijau", 7000, "ikat", "sayuran-segar", "sayur", 0, 820, 35),
    ("Buncis Muda", 12000, "500 gr", "sayuran-segar", "sayur", 10, 540, 25),
    ("Wortel Brastagi", 10000, "500 gr", "sayuran-segar", "sayur", 25, 1800, 70),
    ("Kentang Dieng", 14000, "1 kg", "sayuran-segar", "sayur", 0, 960, 40),
    ("Tomat Merah Segar", 9000, "500 gr", "sayuran-segar", "sayur", 12, 1340, 55),
    ("Brokoli Hijau", 18000, "500 gr", "sayuran-segar", "sayur", 15, 410, 18),
    ("Terong Ungu", 8000, "500 gr", "sayuran-segar", "sayur", 0, 300, 30),
    ("Timun Lokal", 7000, "500 gr", "sayuran-segar", "sayur", 10, 670, 44),

    ("Pisang Cavendish", 22000, "1 sisir", "buah-segar", "buah", 18, 2400, 50),
    ("Jeruk Medan Manis", 25000, "1 kg", "buah-segar", "buah", 20, 1900, 38),
    ("Apel Fuji", 32000, "1 kg", "buah-segar", "buah", 15, 1100, 26),
    ("Mangga Harum Manis", 28000, "1 kg", "buah-segar", "buah", 22, 1560, 33),
    ("Semangka Merah", 20000, "1 buah", "buah-segar", "buah", 0, 740, 20),
    ("Pepaya California", 15000, "1 buah", "buah-segar", "buah", 10, 980, 42),
    ("Anggur Hijau Import", 48000, "500 gr", "buah-segar", "buah", 25, 620, 15),
    ("Alpukat Mentega", 30000, "1 kg", "buah-segar", "buah", 12, 1330, 28),

    ("Cabai Merah Keriting", 18000, "250 gr", "bumbu-dapur", "bumbu", 0, 3200, 80),
    ("Cabai Rawit Merah", 22000, "250 gr", "bumbu-dapur", "bumbu", 10, 2800, 65),
    ("Bawang Merah", 16000, "500 gr", "bumbu-dapur", "bumbu", 15, 4100, 90),
    ("Bawang Putih", 19000, "500 gr", "bumbu-dapur", "bumbu", 12, 3600, 85),
    ("Jahe Merah", 12000, "250 gr", "bumbu-dapur", "bumbu", 0, 540, 30),
    ("Kunyit Segar", 9000, "250 gr", "bumbu-dapur", "bumbu", 0, 410, 25),
    ("Serai / Sereh", 6000, "ikat", "bumbu-dapur", "bumbu", 0, 380, 40),
    ("Daun Jeruk", 5000, "50 gr", "bumbu-dapur", "bumbu", 0, 290, 33),

    ("Ayam Broiler Potong", 38000, "1 ekor", "lauk-daging", "lauk", 15, 1750, 30),
    ("Dada Ayam Fillet", 42000, "500 gr", "lauk-daging", "lauk", 10, 1420, 24),
    ("Daging Sapi Rendang", 135000, "1 kg", "lauk-daging", "lauk", 8, 680, 12),
    ("Ikan Nila Segar", 32000, "1 kg", "lauk-daging", "lauk", 12, 540, 18),
    ("Telur Ayam Negeri", 28000, "1 kg", "lauk-daging", "lauk", 5, 2900, 60),
    ("Ikan Lele Segar", 24000, "1 kg", "lauk-daging", "lauk", 10, 430, 22),

    ("Beras Sokan Premium", 72000, "5 kg", "sembako-kering", "sembako", 10, 1650, 45),
    ("Beras Solok Super", 85000, "5 kg", "sembako-kering", "sembako", 8, 1240, 38),
    ("Minyak Goreng Bimoli", 38000, "2 liter", "sembako-kering", "sembako", 12, 2200, 55),
    ("Gula Pasir Gulaku", 17000, "1 kg", "sembako-kering", "sembako", 5, 1980, 70),
    ("Tepung Terigu Segitiga", 14000, "1 kg", "sembako-kering", "sembako", 0, 870, 50),
    ("Telur Asin (isi 10)", 32000, "1 pack", "sembako-kering", "sembako", 10, 610, 40),
    ("Mie Instan (1 dus)", 115000, "40 pcs", "sembako-kering", "sembako", 15, 1430, 28),
    ("Kecap Manis Bango", 24000, "520 ml", "sembako-kering", "sembako", 8, 990, 48),
    ("Garam Dapur Halus", 6000, "500 gr", "sembako-kering", "sembako", 0, 760, 65),
    ("Kerupuk Jangek Padang", 28000, "250 gr", "sembako-kering", "sembako", 10, 520, 36),
]


def build_products():
    cat_fresh = {c["slug"]: c["fresh"] for c in CATEGORIES}
    cat_name = {c["slug"]: c["name"] for c in CATEGORIES}
    products = []
    for i, (name, price, unit, cat, pool, disc, sold, stock) in enumerate(_RAW, start=1):
        imgs = IMG[pool]
        img = imgs[i % len(imgs)]
        final_price = round(price * (1 - disc / 100)) if disc else price
        products.append({
            "product_id": f"RSP{704 - len(_RAW) + i:04d}",
            "name": name,
            "unit": unit,
            "category": cat,
            "category_name": cat_name[cat],
            "fresh": cat_fresh[cat],
            "price": price,
            "discount": disc,
            "final_price": final_price,
            "sold": sold,
            "stock": stock,
            "rating": round(4.6 + (i % 4) * 0.1, 1),
            "image": img,
            "best_seller": sold >= 1500,
            "active": True,
            "description": f"{name} kualitas terbaik langsung dari petani lokal Sumatera Barat. Dikemas higienis dan dikirim segar dari Rak Sayur Padang.",
        })
    return products
