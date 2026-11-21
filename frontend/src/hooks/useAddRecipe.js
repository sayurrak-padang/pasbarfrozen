import { toast } from "sonner";
import { useCart } from "@/context/CartContext";

// Masukkan semua bahan resep yang tertaut produk (dan ada stoknya) ke keranjang.
// pct > 0 berarti resep ini sedang promo: harga bahan didiskon lewat recipe_id.
export const useAddRecipe = () => {
  const { addItem } = useCart();
  return (r, pct = 0) => {
    const prods = r.ingredients.map((i) => r.products[i.product_id]).filter(Boolean);
    let n = 0;
    prods.filter((p, idx) => prods.indexOf(p) === idx).forEach((p) => {
      const v = p.variants?.length ? p.variants.find((x) => x.stock > 0) : null;
      if (p.variants?.length ? !v : p.stock <= 0) return;
      addItem(p, 1, v, true, pct ? { recipe_id: r.recipe_id, pct } : null);
      n++;
    });
    if (n) toast.success(`${n} bahan dimasukkan ke keranjang${pct ? ` (hemat ${pct}%)` : ""}`);
    else toast.error("Bahan resep ini sedang tidak tersedia");
    return n;
  };
};
