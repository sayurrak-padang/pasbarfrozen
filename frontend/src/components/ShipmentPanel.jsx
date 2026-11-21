import { useEffect, useState } from "react";
import { Bike, Phone, MapPinned, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const SHIP_LABEL = {
  confirmed: "Mencari driver...", allocated: "Driver ditemukan", picking_up: "Driver menuju toko",
  picked: "Paket sudah diambil", dropping_off: "Driver menuju alamat pembeli", delivered: "Paket sampai",
  courier_not_found: "Driver tidak ditemukan", cancelled: "Pengiriman dibatalkan", rejected: "Ditolak kurir",
  on_hold: "Tertunda", return_in_transit: "Dikembalikan", returned: "Dikembalikan ke toko",
};
const ACTIVE = ["confirmed", "allocated", "picking_up", "picked", "dropping_off", "on_hold"];
const CANCELLABLE = ["confirmed", "allocated", "picking_up"];

export const ShipmentPanel = ({ order, admin = false, onChange }) => {
  const [ship, setShip] = useState(order.shipment || null);
  const [busy, setBusy] = useState(false);
  const instant = order.courier_type === "instan";

  useEffect(() => setShip(order.shipment || null), [order.shipment]);

  const refresh = async () => {
    const { data } = await api.get(`/orders/${order.order_id}/shipment`);
    setShip(data);
  };

  useEffect(() => {
    if (!ship || !ACTIVE.includes(ship.status)) return;
    const t = setInterval(() => refresh().catch(() => {}), 15000);
    return () => clearInterval(t);
  }, [ship?.status]);

  const act = async (fn, ok) => {
    setBusy(true);
    try { const { data } = await fn(); setShip(data); toast.success(ok); onChange?.(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
    finally { setBusy(false); }
  };
  const dispatch = () => act(() => api.post(`/admin/orders/${order.order_id}/dispatch`), instant ? "Driver sedang dicari" : "Kurir dipesan, menunggu pickup");
  const cancel = () => act(() => api.post(`/admin/orders/${order.order_id}/shipment/cancel`), "Pengiriman dibatalkan");

  const storeCourier = (order.courier || "").trim().toLowerCase() === "kurir toko";
  const canDispatch = admin && !storeCourier && (!ship || !ACTIVE.includes(ship.status)) && !["Menunggu Pembayaran", "Dibatalkan", "Selesai"].includes(order.status);

  if (!ship && !admin) return null;
  if (storeCourier && !ship) {
    return <p className="mt-3 text-xs rounded-xl border border-emerald-100 bg-emerald-50/50 p-3" data-testid={`store-courier-note-${order.order_id}`}>Kurir Toko (COD): diantar sendiri oleh toko. Ubah status ke Dikirim saat berangkat, lalu Selesai setelah uang COD diterima.</p>;
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3" data-testid={`shipment-panel-${order.order_id}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Bike className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold flex-1" data-testid={`shipment-status-${order.order_id}`}>
          {ship ? SHIP_LABEL[ship.status] || ship.status : instant ? "Driver belum dipesan" : "Kurir belum dipesan"}
        </p>
        {ship && ACTIVE.includes(ship.status) && (
          <button data-testid={`shipment-refresh-${order.order_id}`} onClick={() => refresh().catch(() => {})} className="p-1 text-muted-foreground hover:text-primary"><RefreshCw className="w-4 h-4" /></button>
        )}
        {canDispatch && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="h-8 rounded-lg" disabled={busy} data-testid={`dispatch-btn-${order.order_id}`}>
                {ship ? (instant ? "Cari Driver Lagi" : "Pesan Kurir Lagi") : "Atur Pengiriman"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Pesan {order.courier} via Biteship?</AlertDialogTitle>
                <AlertDialogDescription>{instant ? "Driver sungguhan akan dicari sekarang" : "Order pickup kurir sungguhan akan dibuat"} dan saldo Biteship akan terpotong sesuai ongkir.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="dispatch-cancel">Batal</AlertDialogCancel>
                <AlertDialogAction data-testid="dispatch-confirm" onClick={dispatch}>{instant ? "Ya, cari driver" : "Ya, pesan kurir"}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {admin && ship && CANCELLABLE.includes(ship.status) && (
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-red-600" disabled={busy} onClick={cancel} data-testid={`shipment-cancel-${order.order_id}`}>
            <XCircle className="w-4 h-4 mr-1" /> Batalkan
          </Button>
        )}
      </div>
      {ship?.driver_name && (
        <div className="mt-2 text-xs space-y-0.5" data-testid={`shipment-driver-${order.order_id}`}>
          <p><b>{ship.driver_name}</b>{ship.driver_plate ? ` · ${ship.driver_plate}` : ""}</p>
          {ship.driver_phone && <a href={`tel:${ship.driver_phone}`} className="inline-flex items-center gap-1 text-primary"><Phone className="w-3 h-3" /> {ship.driver_phone}</a>}
        </div>
      )}
      {ship?.waybill_id && <p className="mt-1 text-xs" data-testid={`shipment-waybill-${order.order_id}`}>No. Resi: <b>{ship.waybill_id}</b></p>}
      {ship?.tracking_link && (
        <a href={ship.tracking_link} target="_blank" rel="noreferrer" data-testid={`shipment-track-${order.order_id}`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary text-white text-xs font-semibold px-3 py-1.5">
          <MapPinned className="w-4 h-4" /> {instant ? "Lacak Driver Live" : "Lacak Paket"}
        </a>
      )}
    </div>
  );
};
