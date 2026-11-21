import { Plus } from "lucide-react";
import { rupiah } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export const PromoCard = ({ x, onOpen, accent = "bg-red-600" }) => {
  const { addItem } = useCart();
  const pct = Math.round((1 - x.promo_price / x.normal_price) * 100);
  const add = (e) => {
    e.stopPropagation();
    addItem(x.product, 1, (x.product.variants || []).find((v) => v.variant_id === x.variant_id) || null);
  };
  return (
    <div onClick={() => onOpen(x.product)} className="w-[132px] shrink-0 glass rounded-2xl overflow-hidden p-1.5 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-[transform,box-shadow]" data-testid={`promo-card-${x.promo_id}`}>
      <div className="relative aspect-square bg-white rounded-xl overflow-hidden">
        <img src={x.product.image} alt={x.product.name} className="w-full h-full object-cover" loading="lazy" />
        <span className={`absolute top-2 left-2 ${accent} text-white text-[11px] font-bold px-1.5 py-0.5 rounded`}>-{pct}%</span>
      </div>
      <div className="px-1 pt-1.5 pb-0.5 space-y-1">
        <p className="text-xs font-medium line-clamp-2 min-h-[2rem]">{x.product.name}{x.variant_name ? ` · ${x.variant_name}` : ""}</p>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold text-primary" data-testid={`promo-price-${x.promo_id}`}>{rupiah(x.promo_price)}</p>
            <p className="text-[11px] text-muted-foreground line-through">{rupiah(x.normal_price)}</p>
          </div>
          <button onClick={add} className="w-7 h-7 rounded-full neon-btn flex items-center justify-center shrink-0" data-testid={`promo-add-${x.promo_id}`} aria-label="Tambah"><Plus className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};

export const PromoRow = ({ items, onOpen, testid, accent }) => (
  <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4" data-testid={testid}>
    {items.map((x) => <PromoCard key={x.promo_id} x={x} onOpen={onOpen} accent={accent} />)}
  </div>
);
