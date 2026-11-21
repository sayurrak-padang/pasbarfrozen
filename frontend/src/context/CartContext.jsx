import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CartContext = createContext(null);
export const cartKey = (i) => `${i.product_id}${i.variant_id ? `::${i.variant_id}` : ""}${i.recipe_id ? `@${i.recipe_id}` : ""}`;

const applyFlash = (i, fm) => {
  if (i.recipe_id || i.base_price == null) return i;
  const f = fm[`${i.product_id}::${i.variant_id || ""}`];
  const ok = !!f && i.quantity <= f.remaining && f.flash_price < i.base_price;
  const price = ok ? f.flash_price : i.base_price;
  const label = ok ? (f.promo ? "Promo" : "Flash Sale") : null;
  return price === i.price && ok === !!i.flash && label === i.flash_label ? i : { ...i, price, flash: ok, flash_label: label, flash_left: f?.remaining ?? null };
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("rsp_cart") || "[]").map((i) => ({ ...i, key: i.key || cartKey(i) })); } catch { return []; }
  });
  const syncRef = useRef(null);
  const flashRef = useRef({});

  useEffect(() => {
    localStorage.setItem("rsp_cart", JSON.stringify(items));
    if (!user || user.role === "admin") return;
    clearTimeout(syncRef.current);
    syncRef.current = setTimeout(() => {
      api.put("/cart", { items: items.map(({ product_id, variant_id, recipe_id, name, quantity, price }) => ({ product_id, variant_id, recipe_id, name, quantity, price })) }).catch(() => {});
    }, 1500);
  }, [items, user]);

  const addItem = (product, qty = 1, variant = null, silent = false, promo = null) => {
    const base = variant ? (product.discount ? Math.round(variant.price * (1 - product.discount / 100)) : variant.price) : product.final_price;
    const line = {
      product_id: product.product_id, name: product.name, image: product.image, unit: variant ? variant.name : product.unit,
      price: promo ? Math.round(base * (1 - promo.pct / 100)) : base, base_price: base,
      variant_id: variant?.variant_id || null, variant_name: variant?.name || null, fresh: product.fresh, cold: !!product.cold,
      weight: variant?.weight || product.weight || 500,
      recipe_id: promo?.recipe_id || null,
    };
    line.key = cartKey(line);
    setItems((prev) => (prev.some((i) => i.key === line.key)
      ? prev.map((i) => (i.key === line.key ? { ...i, quantity: i.quantity + qty } : i))
      : [...prev, { ...line, quantity: qty }]).map((i) => applyFlash(i, flashRef.current)));
    if (!silent) window.dispatchEvent(new CustomEvent("cart:add", { detail: { image: product.image } }));
  };

  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key));
  const refreshPromo = useCallback(async () => {
    try {
      const [{ data }, { data: promos }] = await Promise.all([api.get("/flash-sale"), api.get("/promos")]);
      const m = {};
      promos.forEach((x) => { const k = `${x.product_id}::${x.variant_id || ""}`; if (!m[k] || x.promo_price < m[k].flash_price) m[k] = { flash_price: x.promo_price, remaining: Infinity, promo: true }; });
      data.forEach((f) => { const k = `${f.product_id}::${f.variant_id || ""}`; if (!m[k] || f.flash_price < m[k].flash_price) m[k] = f; });
      flashRef.current = m;
    } catch (e) { console.warn("Flash sale/promo gagal dimuat", e); }
    setItems((prev) => prev.map((i) => applyFlash(i, flashRef.current)));
    let promo = null;
    try { promo = (await api.get("/recipe-promo")).data; } catch (e) { console.warn("Promo resep gagal dimuat", e); return; }
    setItems((prev) => prev.map((i) => {
      if (!i.recipe_id || i.base_price == null) return i;
      const ok = promo && promo.recipe_id === i.recipe_id && promo.product_ids.includes(i.product_id);
      const price = ok ? Math.round(i.base_price * (1 - promo.discount_pct / 100)) : i.base_price;
      return price === i.price && ok === !!i.promo_ok ? i : { ...i, price, promo_ok: ok };
    }));
  }, []);
  useEffect(() => { refreshPromo(); }, [refreshPromo]);
  const updateQty = (key, qty) => {
    if (qty <= 0) return removeItem(key);
    setItems((prev) => prev.map((i) => (i.key === key ? applyFlash({ ...i, quantity: qty }, flashRef.current) : i)));
  };
  const clearCart = () => setItems([]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const hasFresh = items.some((i) => i.fresh);
  const hasCold = items.some((i) => i.cold);

  return (
    <CartContext.Provider value={{ items, addItem, updateQty, removeItem, clearCart, count, subtotal, hasFresh, hasCold, refreshPromo }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
