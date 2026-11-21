import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Phone, MessageCircle, Printer, Truck, CheckCircle2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { printRoute } from "@/lib/printLabel";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const wibToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const isToko = (o) => (o.courier || "").trim().toLowerCase() === "kurir toko";
const mapUrl = (a) => (a.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([a.full, a.district, a.city].filter(Boolean).join(", "))}`);
const waUrl = (phone) => `https://wa.me/${(phone || "").replace(/\D/g, "").replace(/^0/, "62")}`;

const StopCard = ({ o, idx, onStatus }) => {
  const a = o.address || {};
  const done = o.status === "Selesai";
  return (
    <div className={`p-4 border-t first:border-t-0 ${done ? "bg-emerald-50/50" : ""}`} data-testid={`route-stop-${o.order_id}`}>
      <div className="flex items-start gap-3">
        <span className="w-7 h-7 shrink-0 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{a.name || o.user_name}</p>
            <span className="font-mono text-[11px] text-muted-foreground">{o.order_id}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${done ? "bg-emerald-100 text-emerald-700" : o.status === "Dikirim" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"}`} data-testid={`route-status-${o.order_id}`}>{o.status}</span>
          </div>
          <p className="text-xs text-slate-600">{[a.full, a.detail, a.district].filter(Boolean).join(", ")}</p>
          <p className="text-xs text-muted-foreground">{o.items.map((x) => `${x.quantity}× ${x.name}${x.variant_name ? ` (${x.variant_name})` : ""}`).join(" · ")}</p>
          {o.note && <p className="text-xs italic text-amber-700">Catatan: {o.note}</p>}
          <div className="flex gap-2 flex-wrap pt-1">
            <a href={mapUrl(a)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs h-8 px-3 rounded-lg border hover:border-primary" data-testid={`route-map-${o.order_id}`}><MapPin className="w-3.5 h-3.5 text-primary" /> Buka di Google Maps</a>
            <a href={`tel:${a.phone}`} className="inline-flex items-center gap-1 text-xs h-8 px-3 rounded-lg border hover:border-primary" data-testid={`route-call-${o.order_id}`}><Phone className="w-3.5 h-3.5" /> Telepon</a>
            <a href={waUrl(a.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs h-8 px-3 rounded-lg border text-emerald-700 hover:border-primary" data-testid={`route-wa-${o.order_id}`}><MessageCircle className="w-3.5 h-3.5" /> WA</a>
            {o.status === "Diproses" && <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onStatus(o, "Dikirim")} data-testid={`route-depart-${o.order_id}`}><Truck className="w-3.5 h-3.5" /> Berangkat</Button>}
            {o.status === "Dikirim" && <Button size="sm" className="h-8 gap-1" onClick={() => window.confirm(`Tandai ${o.order_id} selesai dan uang COD ${rupiah(o.total)} sudah diterima? Status Selesai tidak bisa diubah lagi.`) && onStatus(o, "Selesai")} data-testid={`route-done-${o.order_id}`}><CheckCircle2 className="w-3.5 h-3.5" /> Selesai, uang diterima</Button>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground">Tagih COD</p>
          <p className="font-extrabold text-primary" data-testid={`route-cod-${o.order_id}`}>{rupiah(o.total)}</p>
        </div>
      </div>
    </div>
  );
};

export const AdminStoreRoute = ({ orders }) => {
  const qc = useQueryClient();
  const [date, setDate] = useState(wibToday());
  const { data: store = {} } = useQuery({ queryKey: ["store-settings"], queryFn: async () => (await api.get("/admin/settings/store")).data });
  const groups = useMemo(() => {
    const list = orders.filter((o) => isToko(o) && o.delivery_date === date && !["Dibatalkan", "Menunggu Pembayaran"].includes(o.status));
    const slots = [...new Set(list.map((o) => o.delivery_slot || "Tanpa jadwal"))].sort();
    return slots.map((slot) => ({ slot, orders: list.filter((o) => (o.delivery_slot || "Tanpa jadwal") === slot).sort((x, y) => x.created_at.localeCompare(y.created_at)) }));
  }, [orders, date]);
  const all = groups.flatMap((g) => g.orders);
  const total = all.reduce((s, o) => s + o.total, 0);
  const collected = all.filter((o) => o.status === "Selesai").reduce((s, o) => s + o.total, 0);
  const onStatus = async (o, status) => {
    try { await api.patch(`/admin/orders/${o.order_id}`, { status }); toast.success(`${o.order_id} → ${status}`); qc.invalidateQueries({ queryKey: ["admin-orders"] }); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div className="space-y-4 max-w-4xl" data-testid="admin-store-route">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Tanggal antar
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-48" data-testid="route-date-input" />
        </label>
        <Button variant="outline" className="gap-1" disabled={!all.length} onClick={() => printRoute(date, groups, store)} data-testid="route-print-btn"><Printer className="w-4 h-4" /> Cetak Daftar Antar</Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border rounded-2xl p-4"><p className="text-xs text-muted-foreground">Pesanan diantar</p><p className="text-2xl font-bold" data-testid="route-count">{all.length}</p></div>
        <div className="bg-white border rounded-2xl p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> Total COD ditagih</p><p className="text-2xl font-bold text-primary" data-testid="route-total-cod">{rupiah(total)}</p></div>
        <div className="bg-white border rounded-2xl p-4"><p className="text-xs text-muted-foreground">Sudah diterima</p><p className="text-2xl font-bold text-emerald-700" data-testid="route-collected">{rupiah(collected)}</p></div>
      </div>
      {groups.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12 bg-white border rounded-2xl" data-testid="route-empty">Tidak ada pesanan Kurir Toko di tanggal ini.</p> : groups.map((g) => (
        <section key={g.slot} className="bg-white border rounded-2xl overflow-hidden" data-testid={`route-slot-${g.slot}`}>
          <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between text-sm">
            <span className="font-semibold">Slot {g.slot} · {g.orders.length} pesanan</span>
            <span data-testid={`route-slot-total-${g.slot}`}>COD {rupiah(g.orders.reduce((s, o) => s + o.total, 0))}</span>
          </div>
          {g.orders.map((o, i) => <StopCard key={o.order_id} o={o} idx={i} onStatus={onStatus} />)}
        </section>
      ))}
    </div>
  );
};
