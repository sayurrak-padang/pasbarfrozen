import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, Clock, Users, ShoppingBasket, ArrowLeft, Check, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl, rupiah } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { CartBar } from "@/components/CartBar";
import { CartDrawer } from "@/components/CartDrawer";
import { CheckoutModal } from "@/components/CheckoutModal";
import { Button } from "@/components/ui/button";
import { useAddRecipe } from "@/hooks/useAddRecipe";
import { BRAND } from "@/config/brand";

const Shell = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const openCheckout = () => { setCartOpen(false); if (!user) { navigate("/login"); return; } setCheckoutOpen(true); };
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-4 py-6 pb-36">{children}</main>
      <CartBar onOpen={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={openCheckout} />
      <CheckoutModal open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  );
};

const RecipeCard = ({ r, i, promo }) => {
  const addRecipe = useAddRecipe();
  const [state, setState] = useState("idle");
  const pct = promo?.recipe_id === r.recipe_id ? promo.discount_pct : 0;
  // Tombol cepat: ambil detail resep lalu masukkan semua bahannya tanpa membuka halaman resep.
  const quickAdd = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (state === "busy") return;
    setState("busy");
    try {
      const { data } = await api.get(`/recipes/${r.recipe_id}`);
      setState(addRecipe({ ...data, recipe_id: r.recipe_id }, pct) ? "done" : "idle");
    } catch { toast.error("Gagal memuat bahan resep"); setState("idle"); }
  };
  return (
  <Link to={`/resep/${r.recipe_id}`} data-testid={`recipe-card-${r.recipe_id}`} style={{ animationDelay: `${i * 60}ms` }}
    className="group glass rounded-2xl overflow-hidden hover:shadow-md hover:-translate-y-1 transition-[transform,box-shadow] duration-200 animate-in fade-in slide-in-from-bottom-2">
    <div className="relative aspect-[4/3] bg-emerald-50 overflow-hidden">
      {r.image ? <img src={fileUrl(r.image)} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        : <div className="w-full h-full flex items-center justify-center"><ChefHat className="w-12 h-12 text-emerald-300" /></div>}
      {pct > 0 && <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">Bahan hemat {pct}%</span>}
    </div>
    <div className="p-4">
      <h3 className="font-bold text-slate-900 line-clamp-1">{r.title}</h3>
      <p className="text-sm text-slate-500 line-clamp-2 mt-1 min-h-[2.5rem]">{r.description}</p>
      <div className="flex gap-3 mt-3 text-xs text-slate-600">
        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-primary" /> {r.cook_minutes} mnt</span>
        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-primary" /> {r.servings} porsi</span>
        <span className="flex items-center gap-1"><ShoppingBasket className="w-3.5 h-3.5 text-primary" /> {r.ingredient_count} bahan</span>
      </div>
      <button type="button" onClick={quickAdd} data-testid={`recipe-quick-add-${r.recipe_id}`}
        className={`mt-3 w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition ${state === "done" ? "bg-emerald-50 text-primary border border-emerald-200" : "bg-primary text-white"}`}>
        {state === "busy" ? <Loader2 className="w-4 h-4 animate-spin" /> : state === "done" ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {state === "done" ? "Bahan sudah di keranjang" : "Masukkan semua bahan"}
      </button>
    </div>
  </Link>
  );
};

export function RecipesPage() {
  const { data: recipes = [], isLoading } = useQuery({ queryKey: ["recipes"], queryFn: async () => (await api.get("/recipes")).data });
  const { data: promo } = useQuery({ queryKey: ["recipe-promo"], queryFn: async () => (await api.get("/recipe-promo")).data });
  return (
    <Shell>
      <div className="mb-8 max-w-2xl" data-testid="recipes-page">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5"><ChefHat className="w-4 h-4" /> {BRAND.kitchenName}</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">Resep Masakan Rumahan</h1>
        <p className="text-slate-600 mt-2">Pilih resep, lalu masukkan semua bahannya ke keranjang dengan sekali klik.</p>
      </div>
      {isLoading ? <div className="grid gap-6" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="rounded-2xl overflow-hidden glass"><div className="aspect-[4/3] bg-slate-200 animate-pulse" /><div className="p-4 space-y-2"><div className="h-4 w-2/3 rounded bg-slate-200 animate-pulse" /><div className="h-3 w-full rounded bg-slate-200 animate-pulse" /></div></div>)}</div> : recipes.length === 0 ? (
        <p className="text-muted-foreground py-16" data-testid="recipes-empty">Belum ada resep. Nantikan resep pertama dari kami!</p>
      ) : (
        <div className="grid grid-cols-1 gap-6">{recipes.map((r, i) => <RecipeCard key={r.recipe_id} r={r} i={i} promo={promo} />)}</div>
      )}
    </Shell>
  );
}

const Ingredient = ({ ing, product, pct }) => {
  const out = product && !product.variants?.length && product.stock <= 0;
  const price = product && (pct ? Math.round(product.final_price * (1 - pct / 100)) : product.final_price);
  return (
    <li className="flex items-center gap-3 py-2.5 border-b last:border-0" data-testid={`recipe-ingredient-${ing.name}`}>
      {product ? <img src={product.image} alt="" className="w-11 h-11 rounded-lg object-cover" /> : <div className="w-11 h-11 rounded-lg bg-slate-100" />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{ing.name} {ing.qty && <span className="text-slate-500 font-normal">· {ing.qty}</span>}</p>
        {product && <p className="text-xs text-primary font-semibold">{product.name.slice(0, 50)} · {pct > 0 && <s className="text-slate-400 font-normal mr-1">{rupiah(product.final_price)}</s>}{rupiah(price)}{out ? " · stok habis" : ""}</p>}
      </div>
    </li>
  );
};

export function RecipeDetailPage() {
  const { id } = useParams();
  const addRecipe = useAddRecipe();
  const [added, setAdded] = useState(false);
  const { data: r, isLoading, isError } = useQuery({ queryKey: ["recipe", id], queryFn: async () => (await api.get(`/recipes/${id}`)).data, retry: false });
  const { data: promo } = useQuery({ queryKey: ["recipe-promo"], queryFn: async () => (await api.get("/recipe-promo")).data });
  const pct = promo?.recipe_id === id ? promo.discount_pct : 0;

  const addAll = () => { if (addRecipe({ ...r, recipe_id: id }, pct)) setAdded(true); };


  return (
    <Shell>
      <Link to="/resep" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-primary mb-4" data-testid="recipe-back"><ArrowLeft className="w-4 h-4" /> Semua resep</Link>
      {isLoading ? <div className="space-y-4" aria-hidden><div className="aspect-[4/3] rounded-2xl bg-slate-200 animate-pulse" /><div className="h-6 w-2/3 rounded bg-slate-200 animate-pulse" /><div className="h-3 w-full rounded bg-slate-200 animate-pulse" /><div className="h-3 w-5/6 rounded bg-slate-200 animate-pulse" /></div> : isError || !r ? <p data-testid="recipe-not-found">Resep tidak ditemukan.</p> : (
        <div className="grid gap-8" data-testid="recipe-detail">
          <div className="space-y-6">
            <div className="rounded-2xl overflow-hidden aspect-[16/10] bg-emerald-50">
              {r.image ? <img src={fileUrl(r.image)} alt={r.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ChefHat className="w-16 h-16 text-emerald-300" /></div>}
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900" data-testid="recipe-title">{r.title}</h1>
              <p className="text-slate-600 mt-2">{r.description}</p>
              <div className="flex gap-4 mt-3 text-sm text-slate-700">
                <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-primary" /> {r.cook_minutes} menit</span>
                <span className="flex items-center gap-1"><Users className="w-4 h-4 text-primary" /> {r.servings} porsi</span>
              </div>
            </div>
            <section>
              <h2 className="text-lg font-bold mb-3">Cara Memasak</h2>
              <ol className="space-y-3">
                {r.steps.map((s, idx) => (
                  <li key={`${idx}-${s.slice(0, 12)}`} className="flex gap-3" data-testid={`recipe-step-${idx}`}>
                    <span className="w-7 h-7 shrink-0 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                    <p className="text-sm text-slate-700 leading-relaxed pt-1">{s}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <aside>
            <div className="glass rounded-2xl p-5">
              <h2 className="text-lg font-bold mb-1">Bahan-bahan</h2>
              {pct > 0 && <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5 mb-2" data-testid="recipe-promo-badge">Resep Pilihan Minggu Ini · bahan tertaut diskon {pct}% lewat tombol di bawah (s/d {promo.ends_on})</p>}
              <ul>{r.ingredients.map((i) => <Ingredient key={`${i.name}-${i.product_id || ""}`} ing={i} product={r.products[i.product_id]} pct={pct} />)}</ul>
              <Button onClick={addAll} className="w-full h-12 rounded-full mt-4 gap-2 font-semibold active:scale-95 transition-transform" data-testid="recipe-add-all-btn">
                {added ? <Check className="w-5 h-5" /> : <ShoppingBasket className="w-5 h-5" />} Masukkan semua bahan ke keranjang
              </Button>
              <p className="text-[11px] text-slate-500 mt-2 text-center">Bahan tanpa tautan produk perlu disiapkan sendiri.</p>
            </div>
          </aside>
        </div>
      )}
    </Shell>
  );
}
