import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBasket, Truck } from "lucide-react";
import { rupiah } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { FlyToCart } from "@/components/FlyToCart";
import { APP_WIDTH } from "@/components/AppShell";
import { SHIP_PROMO, shipPromoProgress } from "@/lib/shipPromo";

// Bar keranjang melayang di atas tab bawah, seperti di aplikasi belanja.
// Tanpa onOpen (mis. di halaman Pesanan), bar membuka keranjang di Beranda.
export const CartBar = ({ onOpen }) => {
  const { count, subtotal } = useCart();
  const navigate = useNavigate();
  const ref = useRef(null);
  const { left, reached, pct } = shipPromoProgress(subtotal);
  const open = onOpen || (() => navigate("/?keranjang=1"));
  return (
    <div className={`fixed inset-x-0 mx-auto w-full ${APP_WIDTH} z-30 px-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] pointer-events-none`}>
      <button
        ref={ref}
        type="button"
        onClick={open}
        data-testid="cart-drawer-trigger"
        className={`neon-lens pointer-events-auto w-full rounded-[18px] overflow-hidden transition-all duration-300 active:scale-[0.98] ${count > 0 ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0 pointer-events-none"}`}
        aria-hidden={count === 0}
        tabIndex={count > 0 ? 0 : -1}
      >
        <FlyToCart targetRef={ref} />
        <span className="flex items-center gap-2.5 pl-2 pr-3.5 py-1.5">
          <span className="w-8 h-8 rounded-xl bg-white/15 shadow-[inset_2px_2px_5px_rgba(255,255,255,0.25),inset_-2px_-2px_5px_rgba(0,0,0,0.15)] flex items-center justify-center shrink-0">
            <ShoppingBasket className="w-4 h-4" />
          </span>
          <span className="flex-1 min-w-0 text-left leading-tight">
            <span className="block font-bold text-[13px]">Lihat Keranjang · <span data-testid="cart-bar-count">{count} Barang</span></span>
            <span className="flex items-center gap-1 text-[10.5px] text-emerald-50" data-testid="cart-bar-ship-promo">
              <Truck className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {reached ? <>Diskon ongkir aktif · kode <b className="neon-text">{SHIP_PROMO.code}</b></> : <>Tambah <b className="text-white">{rupiah(left)}</b> lagi, diskon ongkir {rupiah(SHIP_PROMO.value)}</>}
              </span>
            </span>
          </span>
          <span className="font-extrabold text-[14px] tabular-nums" data-testid="cart-bar-total">{rupiah(subtotal)}</span>
        </span>
        <span className="block h-[3px] bg-black/15"><span className="block h-full bg-[var(--rs-yellow)] transition-all duration-500" style={{ width: `${pct}%` }} /></span>
      </button>
    </div>
  );
};
