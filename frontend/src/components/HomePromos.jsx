import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, BadgePercent, CalendarHeart, ChefHat, ArrowRight, Plus } from "lucide-react";
import { api, rupiah } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { ProductCard } from "@/components/ProductCard";
import { PromoRow } from "@/components/PromoCard";

const EASY_IMG = "https://images.unsplash.com/photo-1603496987351-f84a3ba5ec85?crop=entropy&cs=srgb&fm=jpg&q=85&w=900";

const pad = (n) => String(n).padStart(2, "0");
const useCountdown = () => {
  const calc = () => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const s = Math.max(0, Math.floor((end - Date.now()) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  };
  const [t, setT] = useState(calc);
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id); }, []);
  return t;
};

const seededShuffle = (arr, seed) => {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const Row = ({ items, onOpen, testid }) => (
  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4" data-testid={testid}>
    {items.map((p) => <div key={p.product_id} className="w-[132px] shrink-0"><ProductCard product={p} onOpen={onOpen} compact /></div>)}
  </div>
);

const FlashCard = ({ f, onOpen }) => {
  const { addItem } = useCart();
  const pct = Math.round((1 - f.flash_price / f.normal_price) * 100);
  const soldPct = Math.min(100, Math.round((f.sold / f.quota) * 100));
  const out = f.remaining <= 0;
  const add = (e) => {
    e.stopPropagation();
    addItem(f.product, 1, (f.product.variants || []).find((v) => v.variant_id === f.variant_id) || null);
  };
  return (
    <div onClick={() => onOpen(f.product)} className="w-[132px] shrink-0 glass rounded-2xl overflow-hidden p-1.5 cursor-pointer hover:-translate-y-0.5 transition-transform" data-testid={`flash-card-${f.flash_id}`}>
      <div className="relative aspect-square bg-white rounded-xl overflow-hidden">
        <img src={f.product.image} alt={f.product.name} className={`w-full h-full object-cover ${out ? "grayscale opacity-60" : ""}`} loading="lazy" />
        <span className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">-{pct}%</span>
      </div>
      <div className="px-1 pt-1.5 pb-0.5 space-y-1">
        <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">{f.product.name}{f.variant_name ? ` · ${f.variant_name}` : ""}</p>
        <p className="text-sm font-extrabold text-red-600" data-testid={`flash-price-${f.flash_id}`}>{rupiah(f.flash_price)}</p>
        <p className="text-[11px] text-muted-foreground line-through">{rupiah(f.normal_price)}</p>
        <div className="h-1.5 rounded-full bg-red-100 overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${soldPct}%` }} /></div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-red-600 font-semibold" data-testid={`flash-remaining-${f.flash_id}`}>{out ? "Habis" : `Sisa ${f.remaining}`}</span>
          {!out && <button onClick={add} className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors" data-testid={`flash-add-${f.flash_id}`} aria-label="Tambah"><Plus className="w-4 h-4" /></button>}
        </div>
      </div>
    </div>
  );
};

const FlashSale = ({ items, flashItems, onOpen }) => {
  const t = useCountdown();
  return (
    <section id="flash-sale" className="scroll-mt-20 rounded-3xl clay-flash p-3.5" data-testid="flash-sale-section">
      <div className="flex items-center gap-2.5 mb-3 text-white flex-wrap">
        <Zap className="w-5 h-5 fill-yellow-300 text-yellow-300" />
        <h2 className="text-lg font-extrabold italic tracking-tight">FLASH SALE</h2>
        <span className="text-xs opacity-90 ml-auto">Berakhir</span>
        <span className="font-mono text-sm font-bold bg-white/90 text-red-600 rounded-lg px-2 py-0.5" data-testid="flash-sale-countdown">{t}</span>
      </div>
      {flashItems.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4" data-testid="flash-sale-row">
          {flashItems.map((f) => <FlashCard key={f.flash_id} f={f} onOpen={onOpen} />)}
          {flashItems.length < 5 && items.filter((p) => !flashItems.some((f) => f.product_id === p.product_id)).slice(0, 6 - flashItems.length).map((p) => <div key={p.product_id} className="w-[132px] shrink-0"><ProductCard product={p} onOpen={onOpen} compact /></div>)}
        </div>
      ) : <Row items={items} onOpen={onOpen} testid="flash-sale-row" />}
    </section>
  );
};

const Titled = ({ icon: Icon, color, title, sub, children, testid }) => (
  <section data-testid={testid}>
    <div className="flex items-end gap-2 mb-4">
      <Icon className={`w-5 h-5 ${color}`} />
      <div><h2 className="text-xl font-bold leading-tight">{title}</h2>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
    </div>
    {children}
  </section>
);

const EasyFood = ({ onOpen, onSeeAll }) => {
  const { data: items = [] } = useQuery({ queryKey: ["products", "easy-food", ""], queryFn: async () => (await api.get("/products", { params: { category: "easy-food" } })).data });
  if (!items.length) return null;
  return (
    <section className="rounded-3xl glass overflow-hidden" data-testid="easy-food-section">
      <div className="grid">
        <div className="relative min-h-[130px]">
          <img src={EASY_IMG} alt="Menu instan" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10 p-4 flex flex-col justify-end text-white">
            <ChefHat className="w-6 h-6 mb-1" />
            <h2 className="text-xl font-extrabold leading-tight">Menu Instan, Tinggal Masak</h2>
            <p className="text-xs opacity-90">Marinasi, tinggal goreng & siap masak</p>
            <button onClick={onSeeAll} className="mt-3 self-start inline-flex items-center gap-1 bg-white text-amber-700 text-sm font-semibold rounded-full px-4 py-1.5 hover:bg-amber-100 transition-colors" data-testid="easy-food-see-all">
              Lihat semua ({items.length}) <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-3"><Row items={items.slice(0, 12)} onOpen={onOpen} testid="easy-food-row" /></div>
      </div>
    </section>
  );
};

export const HomePromos = ({ discounted, all = [], onOpen, onSeeEasy }) => {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { flash, best, today } = useMemo(() => {
    const byDisc = [...discounted].sort((a, b) => (b.discount || 0) - (a.discount || 0));
    const shuffled = seededShuffle(discounted, Number(day));
    const flashItems = shuffled.slice(0, 10);
    const used = new Set(flashItems.map((p) => p.product_id));
    const pool = all.filter((p) => !used.has(p.product_id) && p.in_stock !== false);
    return { flash: flashItems, best: byDisc.slice(0, 12), today: seededShuffle(pool, Number(day) + 7).slice(0, 10) };
  }, [discounted, all, day]);
  const { data: flashItems = [] } = useQuery({ queryKey: ["flash-sale"], queryFn: async () => (await api.get("/flash-sale")).data });
  const { data: bestPromos = [] } = useQuery({ queryKey: ["promos", "best"], queryFn: async () => (await api.get("/promos", { params: { section: "best" } })).data });
  return (
    <>
      {(flashItems.length > 0 || flash.length > 0) && <FlashSale items={flash} flashItems={flashItems} onOpen={onOpen} />}
      <EasyFood onOpen={onOpen} onSeeAll={onSeeEasy} />
      {bestPromos.length > 0 ? (
        <Titled icon={BadgePercent} color="text-red-500" title="Diskon Terbaik" sub="Potongan harga paling besar hari ini" testid="best-discount-section">
          <PromoRow items={bestPromos} onOpen={onOpen} testid="best-discount-row" />
        </Titled>
      ) : best.length > 0 && (
        <Titled icon={BadgePercent} color="text-red-500" title="Diskon Terbaik" sub="Potongan harga paling besar hari ini" testid="best-discount-section">
          <Row items={best} onOpen={onOpen} testid="best-discount-row" />
        </Titled>
      )}
      {today.length > 0 && (
        <Titled icon={CalendarHeart} color="text-pink-500" title="Pilihan Hari Ini" sub="Rekomendasi produk berganti setiap hari" testid="today-promo-section">
          <div className="grid grid-cols-2 gap-3" data-testid="today-promo-grid">
            {today.map((p) => <ProductCard key={p.product_id} product={p} onOpen={onOpen} />)}
          </div>
        </Titled>
      )}
    </>
  );
};
