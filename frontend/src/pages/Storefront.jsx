import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Sprout, Flame, Truck, Grid3x3, X } from "lucide-react";
import { CATEGORY_ICONS as ICONS } from "@/lib/categoryIcons";
import { api, fileUrl } from "@/lib/api";
import { Header } from "@/components/Header";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutModal } from "@/components/CheckoutModal";
import { PromoBanner } from "@/components/PromoBanner";
import { RecipePromoBanner } from "@/components/RecipePromoBanner";
import { HomePromos } from "@/components/HomePromos";
import { PromoRow } from "@/components/PromoCard";
import { useCart } from "@/context/CartContext";
import { CartBar } from "@/components/CartBar";
import { BuyAgainSection } from "@/components/BuyAgainSection";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ActiveOrderCard } from "@/components/ActiveOrderCard";
import { SubscriptionReminder } from "@/components/SubscriptionReminder";
import { FirstOrderBanner } from "@/components/FirstOrderBanner";
import { BRAND } from "@/config/brand";

const readMode = () => { try { return localStorage.getItem("rsp_delivery_mode") === "reguler" ? "reguler" : "instan"; } catch { return "instan"; } };

export default function Storefront() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get("c") || "");
  const [detail, setDetail] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const location = useLocation();
  // Pindah dari tab Kategori (/?c=slug) atau tekan tab Beranda (/) -> ikuti kategori di URL.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setCategory(q.get("c") || "");
    // Dari halaman lain (mis. Pesanan → Beli lagi) bar keranjang membuka /?keranjang=1.
    if (q.get("keranjang")) { setCartOpen(true); window.history.replaceState(null, "", "/"); }
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setModeState] = useState(readMode);
  const [noticeClosed, setNoticeClosed] = useState(() => sessionStorage.getItem("rsp_home_notice") === "1");
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("p");
    if (pid) api.get(`/products/${encodeURIComponent(pid)}`).then(({ data }) => setDetail(data)).catch(() => {});
  }, []);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { count } = useCart();

  const setMode = (m) => { setModeState(m); try { localStorage.setItem("rsp_delivery_mode", m); } catch { /* abaikan */ } };
  // Mode Reguler (JNE/J&T) hanya bisa untuk produk kering, jadi produk segar disembunyikan.
  const fit = (list) => (mode === "reguler" ? list.filter((p) => !(p.product || p).fresh && !(p.product || p).cold) : list);

  const { data: categories = [], isLoading: catLoading } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  const { data: rawProducts = [], isLoading } = useQuery({
    queryKey: ["products", category, search],
    queryFn: async () => (await api.get("/products", { params: { category: category || undefined, search: search || undefined } })).data,
  });
  const { data: rawBest = [] } = useQuery({ queryKey: ["best"], queryFn: async () => (await api.get("/products", { params: { best_seller: true } })).data });
  const { data: rawDisc = [] } = useQuery({ queryKey: ["disc"], queryFn: async () => (await api.get("/products", { params: { discount: true } })).data });
  const { data: rawPick = [] } = useQuery({ queryKey: ["promos", "pick"], queryFn: async () => (await api.get("/promos", { params: { section: "pick" } })).data });
  const products = fit(rawProducts);
  const bestSellers = fit(rawBest);
  const discounted = fit(rawDisc);
  const pickPromos = fit(rawPick);

  const seeEasy = () => { setCategory("easy-food"); setTimeout(() => document.getElementById("all-products")?.scrollIntoView({ behavior: "smooth" }), 50); };
  const openCheckout = () => { if (count > 0) { setCartOpen(false); setCheckoutOpen(true); } };
  const pickCategory = (slug) => { setCategory(slug); window.history.replaceState(null, "", slug ? `/?c=${encodeURIComponent(slug)}` : "/"); };
  const home = !category && !search;

  return (
    <div className="min-h-screen" data-testid="storefront">
      <Header search={search} setSearch={(v) => { setSearch(v); if (v) pickCategory(""); }} mode={mode} setMode={setMode} />

      <main className="px-4 pt-4 pb-36 space-y-6">
        {home && <ActiveOrderCard />}

        {home && <SubscriptionReminder />}

        {home && <InstallPrompt />}

        {home && <PromoBanner />}

        {home && <FirstOrderBanner />}

        {home && !noticeClosed && (
          <div className="flex items-center gap-3 rounded-2xl glass px-4 py-3 text-sm text-emerald-800" data-testid="home-notice">
            <Truck className="w-5 h-5 shrink-0" />
            <p className="flex-1 font-medium" data-testid="home-hero-ship-discount">
              {mode === "reguler" ? "Mode Reguler: produk kering, dikirim JNE / J&T ke luar kota." : `Frozen food diantar Kurir Toko di ${BRAND.city.name}. Ongkir Rp10.000 untuk 5 km pertama.`}
            </p>
            <button aria-label="Tutup" className="p-1 text-emerald-700" onClick={() => { sessionStorage.setItem("rsp_home_notice", "1"); setNoticeClosed(true); }} data-testid="home-notice-close"><X className="w-4 h-4" /></button>
          </div>
        )}

        {!search && <section>
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1" data-testid="category-rail">
            <button data-testid="category-tab-all" onClick={() => pickCategory("")}
              className="w-[72px] shrink-0 flex flex-col items-center gap-1.5">
              <span className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 transition-colors ${category === "" ? "border-emerald-400 bg-emerald-50/80 shadow-[0_0_12px_-3px_rgba(16,185,129,0.7)]" : "border-white/70 bg-white/60 backdrop-blur-md"}`}><Grid3x3 className="w-6 h-6 text-primary" /></span>
              <span className={`text-[11px] leading-tight text-center ${category === "" ? "font-bold text-primary" : "font-medium text-slate-700"}`}>Semua</span>
            </button>
            {catLoading && Array.from({ length: 4 }, (_, i) => (
              <div key={`cat-sk-${i}`} className="w-[72px] shrink-0 flex flex-col items-center gap-1.5" aria-hidden>
                <span className="w-16 h-16 rounded-2xl bg-slate-200 animate-pulse" />
                <span className="w-12 h-2.5 rounded bg-slate-200 animate-pulse" />
              </div>
            ))}
            {categories.map((c) => {
              const Icon = ICONS[c.icon] || Sprout;
              const active = category === c.slug;
              return (
                <button key={c.slug} data-testid={`category-tab-${c.slug}`} onClick={() => pickCategory(c.slug)}
                  className="w-[72px] shrink-0 flex flex-col items-center gap-1.5">
                  <span className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center border-2 transition-colors ${active ? "border-emerald-400 bg-emerald-50/80 shadow-[0_0_12px_-3px_rgba(16,185,129,0.7)]" : "border-white/70 bg-white/60 backdrop-blur-md"}`}>
                    {c.image ? <img src={fileUrl(c.image)} alt="" className="w-full h-full object-cover" /> : <Icon className="w-6 h-6 text-primary" />}
                  </span>
                  <span className={`text-[11px] leading-tight text-center line-clamp-2 ${active ? "font-bold text-primary" : "font-medium text-slate-700"}`}>{c.name}</span>
                </button>
              );
            })}
          </div>
        </section>}

        {home && <BuyAgainSection />}

        {home && <RecipePromoBanner />}

        {/* Produk Pilihan */}
        {home && (pickPromos.length > 0 || bestSellers.length > 0) && (
          <section data-testid="picks-section">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-extrabold tracking-tight">Produk Pilihan</h2>
            </div>
            {pickPromos.length > 0 ? <PromoRow items={pickPromos} onOpen={setDetail} testid="picks-row" accent="bg-amber-500" /> : (
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
              {bestSellers.map((p) => (
                <div key={p.product_id} className="w-[132px] shrink-0">
                  <ProductCard product={p} onOpen={setDetail} compact />
                </div>
              ))}
            </div>
            )}
          </section>
        )}

        {home && <HomePromos discounted={discounted} all={products} onOpen={setDetail} onSeeEasy={seeEasy} />}

        {/* Semua produk */}
        <section id="all-products" className="scroll-mt-48">
          <h2 className="text-lg font-extrabold tracking-tight mb-3">
            {search ? `Hasil: "${search}"` : category === "easy-food" ? "Menu Instan, Tinggal Masak" : category ? categories.find((c) => c.slug === category)?.name : "Semua Produk"}
            {category === "easy-food" && <button onClick={() => pickCategory("")} className="ml-3 text-xs font-medium text-primary border border-emerald-200 rounded-full px-3 py-1 align-middle hover:bg-emerald-50" data-testid="easy-food-clear">Tampilkan semua produk</button>}
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }, (_, i) => `skeleton-${i}`).map((k) => <div key={k} className="aspect-[3/4] bg-slate-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : products.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">{mode === "reguler" && rawProducts.length > 0 ? "Produk beku hanya bisa dikirim Kurir Toko. Pilih mode Instan untuk melihatnya." : "Produk tidak ditemukan."}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => <ProductCard key={p.product_id} product={p} onOpen={setDetail} />)}
            </div>
          )}
        </section>

        <footer className="pt-2 pb-4 text-center text-xs text-slate-500">
          <p className="font-bold text-slate-700">{BRAND.name}</p>
          <p className="mt-1">Bayar COD, QRIS & Transfer · Kirim Kurir Toko & JNE/J&T</p>
          <p className="mt-1">© {BRAND.copyrightYear} {BRAND.name}</p>
        </footer>
      </main>

      <CartBar onOpen={() => setCartOpen(true)} />
      <ProductDetailModal product={detail} onClose={() => setDetail(null)} />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={openCheckout} />
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
}
