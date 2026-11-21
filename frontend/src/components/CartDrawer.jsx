import { Minus, Plus, Trash2, ShoppingBag, Truck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { rupiah } from "@/lib/api";
import { isPO } from "@/lib/ref";
import { SHIP_PROMO, shipPromoProgress } from "@/lib/shipPromo";
import { SaveSubscription } from "@/components/SaveSubscription";

export const CartDrawer = ({ open, onOpenChange, onCheckout }) => {
  const { items, updateQty, removeItem, subtotal, count, hasFresh } = useCart();
  const { left, reached, pct: progress } = shipPromoProgress(subtotal);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0" data-testid="cart-drawer" aria-describedby={undefined}>
        <SheetHeader className="p-5 border-b">
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" /> Keranjang ({count})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
            <ShoppingBag className="w-14 h-14 mb-3 opacity-30" />
            <p className="font-medium">Keranjang masih kosong</p>
            <p className="text-sm">Yuk belanja sayur segar!</p>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xs text-emerald-700 flex items-center gap-1.5 mb-1.5">
                  <Truck className="w-3.5 h-3.5" />
                  {reached ? `Pakai kode ${SHIP_PROMO.code} saat checkout: diskon ongkir ${rupiah(SHIP_PROMO.value)}` : `Belanja ${rupiah(left)} lagi untuk pakai kode ${SHIP_PROMO.code} (diskon ongkir ${rupiah(SHIP_PROMO.value)})`}
                </p>
                <div className="h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {items.map((it) => (
                <div key={it.key} data-testid={`cart-item-${it.key}`} className="flex gap-3 bg-white rounded-xl border p-2">
                  <img src={it.image} alt={it.name} className="w-16 h-16 rounded-lg object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold line-clamp-1">{it.name}</p>
                    {it.variant_name && <p className="text-[11px] text-emerald-700 font-medium">Varian: {it.variant_name}</p>}
                    {it.recipe_id && it.price < (it.base_price ?? it.price + 1) && <p className="text-[10px] font-bold text-red-600" data-testid={`cart-promo-label-${it.key}`}>Promo resep · <s className="font-normal text-slate-400">{rupiah(it.base_price)}</s></p>}
                    {it.flash && <p className="text-[10px] font-bold text-red-600" data-testid={`cart-flash-label-${it.key}`}>{it.flash_label || "Flash Sale"} · <s className="font-normal text-slate-400">{rupiah(it.base_price)}</s></p>}
                    {!it.flash && it.flash_left != null && it.flash_left > 0 && <p className="text-[10px] text-amber-700" data-testid={`cart-flash-over-${it.key}`}>Harga flash hanya untuk maks. {it.flash_left} pcs</p>}
                    <p className="text-xs text-muted-foreground">per {it.unit}</p>
                    <p className="text-sm font-bold text-primary mt-0.5">{rupiah(it.price)}</p>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => removeItem(it.key)} data-testid={`remove-${it.key}`} className="text-muted-foreground hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1.5 bg-secondary rounded-full">
                      <button onClick={() => updateQty(it.key, it.quantity - 1)} data-testid={`dec-${it.key}`} className="w-7 h-7 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="text-sm font-semibold w-5 text-center">{it.quantity}</span>
                      <button onClick={() => updateQty(it.key, it.quantity + 1)} data-testid={`inc-${it.key}`} className="w-7 h-7 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t p-5 space-y-3">
              {items.some((i) => isPO(i.name)) && (
                <p className="text-xs bg-violet-50 text-violet-700 border border-violet-100 rounded-xl p-2.5" data-testid="cart-po-note">Keranjang berisi produk Pre Order H+1 — pesanan dikirim paling cepat besok.</p>
              )}
              {hasFresh && (
                <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Keranjang berisi produk segar — pengiriman hanya via kurir instan (Grab/Gojek) atau Kurir Toko untuk COD.
                </p>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold text-lg">{rupiah(subtotal)}</span>
              </div>
              <SaveSubscription />
              <Button data-testid="checkout-proceed-button" onClick={onCheckout} className="w-full h-12 rounded-xl text-base font-semibold">
                Lanjut ke Pembayaran
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
