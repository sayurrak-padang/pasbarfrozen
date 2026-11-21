import { Star, Plus, Minus, Flame, BellRing } from "lucide-react";
import { rupiah } from "@/lib/api";
import { useCart, cartKey } from "@/context/CartContext";
import { ColdBadge } from "@/components/ShippingHints";
import { isPO } from "@/lib/ref";

// compact: versi kecil untuk baris geser (Flash Sale, Menu Instan, Produk Pilihan).
export const ProductCard = ({ product, onOpen, compact = false }) => {
  const { addItem, items, updateQty } = useCart();
  const simple = !product.variants?.length;
  const key = cartKey({ product_id: product.product_id });
  const inCart = simple ? (items.find((i) => i.key === key)?.quantity || 0) : 0;
  const soldLabel = product.sold >= 1000 ? `${(product.sold / 1000).toFixed(1)}rb` : product.sold;
  const soldOut = (product.stock || 0) <= 0;

  return (
    <div
      data-testid={`product-card-${product.product_id}`}
      className={`group glass rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col ${compact ? "p-1.5" : ""}`}
    >
      <div className={`relative aspect-square overflow-hidden cursor-pointer bg-white ${compact ? "rounded-xl" : ""}`} onClick={() => onOpen(product)}>
        <img src={product.image} alt={product.name} loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        {product.discount > 0 && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
            -{product.discount}%
          </span>
        )}
        {product.best_seller && (
          <span className={`absolute ${product.discount > 0 ? "top-9" : "top-2"} left-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5`}>
            <Flame className="w-3 h-3" /> Laris
          </span>
        )}
        {product.cold && <ColdBadge className="absolute bottom-2 left-2" testid={`cold-badge-${product.product_id}`} />}
        {isPO(product.name) && <span className="absolute bottom-2 right-2 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full" data-testid={`po-badge-${product.product_id}`}>PO H+1</span>}
        {!soldOut && (inCart > 0 ? (
          <div className={`absolute top-1.5 right-1.5 flex items-center ${compact ? "h-8 [&>button]:w-6 [&>button]:h-8" : "h-9"} rounded-full neon-btn`} onClick={(e) => e.stopPropagation()} data-testid={`qty-stepper-${product.product_id}`}>
            <button aria-label="Kurangi" onClick={() => updateQty(key, inCart - 1)} className="w-8 h-9 flex items-center justify-center" data-testid={`qty-minus-${product.product_id}`}><Minus className="w-4 h-4" /></button>
            <span className="min-w-4 text-center text-sm font-extrabold tabular-nums">{inCart}</span>
            <button aria-label="Tambah" onClick={() => addItem(product)} className="w-8 h-9 flex items-center justify-center" data-testid={`qty-plus-${product.product_id}`}><Plus className="w-4 h-4" /></button>
          </div>
        ) : (
          <button
            data-testid={`add-to-cart-${product.product_id}`}
            aria-label="Tambah ke keranjang"
            onClick={(e) => { e.stopPropagation(); if (simple) addItem(product); else onOpen(product); }}
            className={`absolute top-1.5 right-1.5 ${compact ? "w-8 h-8" : "w-9 h-9"} rounded-full neon-btn flex items-center justify-center transition-transform active:scale-90`}
          >
            <Plus className={compact ? "w-4 h-4" : "w-5 h-5"} strokeWidth={2.6} />
          </button>
        ))}
        {soldOut && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">Stok Habis</span>
          </div>
        )}
      </div>

      <div className={`flex flex-col flex-1 ${compact ? "px-1 pt-1.5 pb-1" : "p-3"}`}>
        <h3 className={`${compact ? "text-[12.5px]" : "text-sm"} font-semibold text-slate-800 line-clamp-2 leading-snug cursor-pointer`} onClick={() => onOpen(product)}>
          {product.name}
        </h3>
        {!compact && <p className="text-[11px] text-muted-foreground mt-0.5">per {product.unit}</p>}

        <div className={`flex items-center gap-2 text-[11px] text-muted-foreground ${compact ? "mt-1" : "mt-1.5"}`}>
          {!compact && <><span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{product.rating}</span>
          <span>•</span></>}
          <span>Terjual {soldLabel}</span>
        </div>

        <div className="mt-auto pt-2 flex items-end justify-between gap-2">
          <div>
            <p className={`${compact ? "text-[13.5px]" : "text-[15px]"} font-extrabold text-emerald-700 leading-none`}>{product.variants?.length ? <span className="text-[10px] font-medium text-muted-foreground">mulai </span> : null}{rupiah(product.final_price)}</p>
            {product.discount > 0 && (
              <p className="text-[11px] text-muted-foreground line-through">{rupiah(product.price)}</p>
            )}
          </div>
          {soldOut ? (
            <button data-testid={`notify-me-${product.product_id}`} onClick={() => onOpen(product)}
              className="h-9 px-2.5 rounded-xl border border-emerald-200 text-primary text-[11px] font-semibold flex items-center gap-1 hover:bg-emerald-50 transition-colors shrink-0">
              <BellRing className="w-3.5 h-3.5" /> Kabari saya
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
