import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Sprout, CreditCard, Truck, Check, CalendarClock, RefreshCw, ChevronDown } from "lucide-react";
import { api, rupiah } from "@/lib/api";
import { paySnap, PAY_FAIL } from "@/lib/midtrans";
import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import { QrisPayDialog } from "@/components/QrisPayDialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShipmentPanel } from "@/components/ShipmentPanel";
import { OrderActions } from "@/components/OrderActions";
import { CartBar } from "@/components/CartBar";

const STATUS_COLOR = {
  "Menunggu Pembayaran": "bg-amber-100 text-amber-700",
  "Diproses": "bg-blue-100 text-blue-700",
  "Dikirim": "bg-purple-100 text-purple-700",
  "Selesai": "bg-emerald-100 text-emerald-700",
  "Dibatalkan": "bg-red-100 text-red-700",
};

const STEPS = [
  { key: "Menunggu Pembayaran", label: "Dipesan", icon: CreditCard },
  { key: "Diproses", label: "Diproses", icon: Package },
  { key: "Dikirim", label: "Dikirim", icon: Truck },
  { key: "Selesai", label: "Selesai", icon: Check },
];

function OrderTracker({ status }) {
  const idx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center mt-4" data-testid="order-tracker">
      {STEPS.map((s, i) => {
        const done = i <= idx;
        const Icon = s.icon;
        return (
          <div key={s.key} className="flex-1 flex items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${done ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] mt-1 ${done ? "text-primary font-semibold" : "text-slate-400"}`}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 mb-4 ${i < idx ? "bg-primary" : "bg-slate-200"}`} />}
          </div>
        );
      })}
    </div>
  );
}

const Line = ({ label, value, tone = "" }) => <div className={`flex justify-between ${tone}`}><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;

function OrderDetail({ o }) {
  const [open, setOpen] = useState(false);
  const a = o.address || {};
  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs font-semibold text-primary inline-flex items-center gap-1" data-testid={`order-detail-toggle-${o.order_id}`}>
        {open ? "Sembunyikan detail" : "Lihat detail pesanan"} <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-slate-50 border p-3 text-xs space-y-3" data-testid={`order-detail-${o.order_id}`}>
          <div className="space-y-1.5">
            {o.items.map((it) => (
              <div key={`${it.product_id}-${it.variant_id || ""}`} className="flex items-center gap-2">
                <img src={it.image} alt="" className="w-9 h-9 rounded object-cover" />
                <span className="flex-1">{it.name}{it.variant_name ? ` (${it.variant_name})` : ""} <span className="text-muted-foreground">× {it.quantity}</span></span>
                <span className="font-medium">{rupiah(it.price * it.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t pt-2">
            <Line label="Subtotal" value={rupiah(o.subtotal)} />
            <Line label={`Ongkir (${o.courier})`} value={rupiah(o.shipping_cost || 0)} />
            {o.discount > 0 && <Line label={`Diskon${o.voucher_code ? ` (${o.voucher_code})` : ""}`} value={`-${rupiah(o.discount)}`} tone="text-red-600" />}
            <Line label="Total" value={<b className="text-primary">{rupiah(o.total)}</b>} />
            <Line label="Pembayaran" value={o.payment_method.toUpperCase()} />
          </div>
          <div className="border-t pt-2 space-y-0.5">
            <p className="font-semibold">Alamat pengiriman</p>
            <p>{a.name} · {a.phone}</p>
            <p className="text-muted-foreground">{[a.full, a.detail, a.district, a.city, a.postal].filter(Boolean).join(", ")}</p>
            {o.note && <p className="italic text-amber-700">Catatan: {o.note}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user]);

  const qc = useQueryClient();
  const [qrisOrder, setQrisOrder] = useState(null);
  const refreshStatus = async (o) => {
    await api.get(`/orders/${o.order_id}/payment-status`);
    qc.invalidateQueries({ queryKey: ["my-orders"] });
  };
  const payNow = (o) => (o.qris ? setQrisOrder(o) : paySnap(o.snap_token, { onDone: () => refreshStatus(o), onError: () => toast.error(PAY_FAIL) })
    .catch((e) => toast.error(e.message)));

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => (await api.get("/orders")).data,
    enabled: !!user,
  });

  return (
    <div className="min-h-screen">
      <QrisPayDialog order={qrisOrder} onClose={() => setQrisOrder(null)} onPaid={() => qc.invalidateQueries({ queryKey: ["my-orders"] })} />
      <div className="border-b sticky top-0 z-10 bg-white/70 backdrop-blur-xl border-white/70">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} data-testid="orders-back" className="p-1"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Pesanan Saya</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 pb-36 space-y-4">
        {isLoading ? (
          <div className="space-y-4" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl glass p-4 space-y-3"><div className="h-4 w-1/2 rounded bg-slate-200 animate-pulse" /><div className="flex gap-2">{[0, 1, 2].map((j) => <div key={j} className="w-12 h-12 rounded-lg bg-slate-200 animate-pulse" />)}</div><div className="h-3 w-full rounded bg-slate-200 animate-pulse" /></div>)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Sprout className="w-14 h-14 mx-auto opacity-30 mb-3" />
            <p>Belum ada pesanan.</p>
          </div>
        ) : (
          orders.map((o) => (
            <div key={o.order_id} data-testid={`order-${o.order_id}`} className="glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{o.order_id}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("id-ID")}</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[o.status] || "bg-slate-100"}`}>{o.status}</span>
              </div>
              <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
                {o.items.map((it) => <img key={`${it.product_id}-${it.variant_id || ""}`} src={it.image} alt={it.name} title={`${it.name}${it.variant_name ? ` (${it.variant_name})` : ""} × ${it.quantity}`} className="w-12 h-12 rounded-lg object-cover shrink-0" />)}
              </div>
              {o.status !== "Dibatalkan" && <OrderTracker status={o.status} />}
              <ShipmentPanel order={o} />
              <OrderActions order={o} />
              {o.delivery_slot && (
                <p className="text-xs mt-3 inline-flex items-center gap-1 bg-amber-50 text-amber-700 rounded-full px-3 py-1" data-testid={`order-schedule-${o.order_id}`}>
                  <CalendarClock className="w-3.5 h-3.5" /> Jadwal kirim {new Date(`${o.delivery_date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })} · {o.delivery_slot}
                </p>
              )}
              {o.status === "Menunggu Pembayaran" && (o.snap_token || o.qris) && (
                <div className="flex gap-2 mt-3">
                  <button data-testid={`order-pay-${o.order_id}`} onClick={() => payNow(o)} className="flex-1 h-9 rounded-xl bg-primary text-white text-sm font-semibold">Bayar Sekarang</button>
                  <button data-testid={`order-refresh-${o.order_id}`} onClick={() => refreshStatus(o)} className="h-9 px-3 rounded-xl border text-sm inline-flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Cek</button>
                </div>
              )}
              <div className="flex justify-between items-center mt-3 pt-3 border-t text-sm">
                <span className="text-muted-foreground">{o.courier} · {o.payment_method.toUpperCase()}</span>
                <span className="font-bold text-primary">{rupiah(o.total)}</span>
              </div>
              <OrderDetail o={o} />
            </div>
          ))
        )}
      </div>
      <CartBar />
    </div>
  );
}
