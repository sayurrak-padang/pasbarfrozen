import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bike, CreditCard, Package, ChevronRight, MapPinned } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { SHIP_LABEL } from "@/components/ShipmentPanel";

const ACTIVE = ["Menunggu Pembayaran", "Diproses", "Dikirim"];
const STEP = { "Menunggu Pembayaran": 1, "Diproses": 2, "Dikirim": 3 };

// Kartu status pesanan yang sedang berjalan di Beranda (paling baru di atas).
export const ActiveOrderCard = () => {
  const { user } = useAuth();
  const { data: orders = [] } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => (await api.get("/orders")).data,
    enabled: !!user && user.role !== "admin",
    refetchInterval: 30000,
  });
  const o = orders.find((x) => ACTIVE.includes(x.status));
  if (!o) return null;
  const ship = o.shipment;
  const Icon = o.status === "Menunggu Pembayaran" ? CreditCard : o.status === "Dikirim" ? Bike : Package;
  const text = o.status === "Menunggu Pembayaran" ? "Selesaikan pembayaran pesananmu"
    : ship?.status && SHIP_LABEL[ship.status] ? SHIP_LABEL[ship.status]
    : o.status === "Dikirim" ? "Pesanan sedang diantar" : "Pesanan sedang disiapkan";
  const more = orders.filter((x) => ACTIVE.includes(x.status)).length - 1;

  return (
    <section className="rounded-2xl glass overflow-hidden" data-testid="active-order-card">
      <Link to="/orders" className="flex items-center gap-3 p-3">
        <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${o.status === "Menunggu Pembayaran" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
          <Icon className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0 leading-tight">
          <span className="block font-bold text-sm truncate" data-testid="active-order-text">{text}</span>
          <span className="block text-xs text-muted-foreground truncate">
            {o.order_id}{ship?.driver_name ? ` · ${ship.driver_name}${ship.driver_plate ? ` (${ship.driver_plate})` : ""}` : o.delivery_slot ? ` · Jadwal ${o.delivery_slot}` : ""}{more > 0 ? ` · +${more} pesanan lain` : ""}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
      </Link>
      <div className="grid grid-cols-3 gap-1 px-3 pb-3" aria-hidden>
        {[1, 2, 3].map((n) => <span key={n} className={`h-1.5 rounded-full ${STEP[o.status] >= n ? "bg-primary" : "bg-slate-200"}`} />)}
      </div>
      {ship?.tracking_link && (
        <a href={ship.tracking_link} target="_blank" rel="noreferrer" data-testid="active-order-track"
          className="flex items-center justify-center gap-1.5 border-t border-emerald-100 py-2.5 text-sm font-bold text-primary">
          <MapPinned className="w-4 h-4" /> Lacak driver live
        </a>
      )}
    </section>
  );
};
