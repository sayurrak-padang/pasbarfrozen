import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCart } from "@/context/CartContext";

// Masukkan lagi semua barang dari pesanan lama ke keranjang (yang masih aktif dan ada stoknya).
export const useBuyAgain = () => {
  const { addItem } = useCart();
  return async (order) => {
    let added = 0;
    for (const it of order.items) {
      try {
        const { data: p } = await api.get(`/products/${it.product_id}`);
        const v = it.variant_id ? p.variants?.find((x) => x.variant_id === it.variant_id) : null;
        if (!p.active || (it.variant_id ? !v || v.stock <= 0 : p.stock <= 0)) continue;
        addItem(p, it.quantity, v, true);
        added++;
      } catch (e) { console.warn(`Produk ${it.product_id} tidak tersedia`, e); }
    }
    if (added) toast.success(`${added} produk dimasukkan ke keranjang`);
    else toast.error("Produk pesanan ini sudah tidak tersedia");
    return added;
  };
};
