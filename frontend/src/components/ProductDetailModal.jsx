import { Star, Minus, Plus, X, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import { rupiah } from "@/lib/api";
import { ProductReviews } from "@/components/Reviews";
import { ColdBadge, ColdNote } from "@/components/ShippingHints";
import { isPO } from "@/lib/ref";
import { RestockAlert } from "@/components/RestockAlert";

export const ProductDetailModal = ({ product, onClose }) => {
  const { addItem } = useCart();
  const [qty, setQty] = useState(1);
  const [variant, setVariant] = useState(null);
  useEffect(() => { setQty(1); setVariant(product?.variants?.find((v) => v.stock > 0) || product?.variants?.[0] || null); }, [product]);
  if (!product) return null;
  const variants = product.variants || [];
  const soldOut = variant ? variant.stock <= 0 : (product.stock || 0) <= 0;
  const unitPrice = variant ? (product.discount ? Math.round(variant.price * (1 - product.discount / 100)) : variant.price) : product.final_price;

  return (
    <Sheet open={!!product} onOpenChange={(o) => !o && onClose()}>
      {/* Detail produk naik dari bawah seperti di aplikasi, selebar kolom aplikasi */}
      <SheetContent side="bottom" className="mx-auto w-full max-w-[480px] h-[94dvh] p-0 gap-0 rounded-t-[28px] border-0 overflow-hidden flex flex-col [&>button:first-child]:hidden" data-testid="product-detail-modal">
        <SheetTitle className="sr-only">{product.name}</SheetTitle>
        <SheetDescription className="sr-only">Detail produk, varian, dan tombol tambah ke keranjang</SheetDescription>
        <span className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-10 h-1.5 rounded-full bg-white/80 shadow" aria-hidden />
        <button onClick={onClose} aria-label="Tutup" data-testid="detail-close-btn" className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/95 shadow flex items-center justify-center hover:bg-white"><X className="w-5 h-5" /></button>
        <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="grid">
          <div className="relative aspect-square max-h-[48dvh] w-full bg-slate-100">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            {product.discount > 0 && (
              <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">-{product.discount}%</span>
            )}
            {product.cold && <ColdBadge className="absolute bottom-9 left-3 text-xs" testid="detail-cold-badge" />}
            {isPO(product.name) && <span className="absolute bottom-9 right-3 bg-violet-600 text-white text-xs font-bold px-2.5 py-1 rounded-full" data-testid="detail-po-badge">Pre Order H+1 · dikirim besok</span>}
          </div>
          <div className="p-4 flex flex-col rounded-t-3xl -mt-6 relative bg-white">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{product.category_name}</span>
            <h2 className="text-xl font-bold text-slate-900 mt-1 leading-snug">{product.name}</h2>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-0.5"><Star className="w-4 h-4 fill-amber-400 text-amber-400" />{product.rating}</span>
              <span>•</span><span>Terjual {product.sold}</span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-primary" data-testid="detail-price">{rupiah(unitPrice)}</span>
              <span className="text-sm text-muted-foreground"> / {variant ? variant.name : product.unit}</span>
              {product.discount > 0 && <p className="text-sm text-muted-foreground line-through">{rupiah(variant ? variant.price : product.price)}</p>}
            </div>
            {variants.length > 0 && (
              <div className="mt-3" data-testid="variant-picker">
                <p className="text-xs font-semibold mb-1.5">Pilih varian</p>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {variants.map((v) => (
                    <button key={v.variant_id} data-testid={`variant-${v.variant_id}`} onClick={() => setVariant(v)}
                      className={`px-3 py-1 rounded-full border-2 text-sm transition-colors ${v.stock <= 0 ? "text-slate-400 border-dashed" : ""} ${variant?.variant_id === v.variant_id ? "border-primary bg-emerald-50 text-primary font-semibold" : "border-slate-200"}`}>
                      {v.name}{v.stock <= 0 ? " · habis" : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed mt-3 ">{product.description}</p>
            {product.cold && <div className="mt-3"><ColdNote testid="detail-cold-note" /></div>}
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 mt-3">
              <Truck className="w-4 h-4" />
              {product.fresh || product.cold ? "Produk beku · hanya Kurir Toko" : "Produk kering · bisa JNE/J&T"} · Stok {variant ? variant.stock : product.stock}
            </div>
          </div>
        </div>
        <ProductReviews productId={product.product_id} />
        </div>
        <div className="border-t bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] flex items-center gap-3 shadow-[0_-6px_16px_rgba(15,23,42,0.06)]" data-testid="detail-action-bar">
          {soldOut ? (
            <div className="flex-1 space-y-1.5" data-testid="detail-sold-out">
              <p className="text-xs font-semibold text-slate-700">Stok sedang habis. Kabari saya lewat email saat tersedia lagi.</p>
              <RestockAlert key={`${product.product_id}-${variant?.variant_id || ""}`} productId={product.product_id} variantId={variant?.variant_id} />
            </div>
          ) : (<>
              <div className="flex items-center gap-2 bg-secondary rounded-full">
                <button onClick={() => setQty(Math.max(1, qty - 1))} data-testid="detail-dec" className="w-9 h-9 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                <span className="w-6 text-center font-semibold" data-testid="detail-qty">{qty}</span>
                <button onClick={() => setQty(qty + 1)} data-testid="detail-inc" className="w-9 h-9 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
              </div>
              <Button data-testid="detail-add-to-cart" disabled={variants.length > 0 && !variant} onClick={() => { addItem(product, qty, variant); onClose(); }} className="flex-1 h-12 rounded-2xl text-base font-bold">
                {variants.length > 0 && !variant ? "Pilih varian dulu" : `Tambah · ${rupiah(unitPrice * qty)}`}
              </Button>
          </>)}
        </div>
      </SheetContent>
    </Sheet>
  );
};
