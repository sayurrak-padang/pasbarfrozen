import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, XCircle, AlertTriangle, ImagePlus, X, Star } from "lucide-react";
import { ReviewDialog } from "@/components/Reviews";
import { toast } from "sonner";
import { api, fileUrl, rupiah } from "@/lib/api";
import { useBuyAgain } from "@/hooks/useBuyAgain";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REASONS = ["Produk rusak/busuk", "Produk kurang/tidak sesuai", "Salah kirim produk", "Kualitas tidak baik", "Lainnya"];
const minsLeft = (iso) => Math.max(0, 10 - (Date.now() - new Date(iso).getTime()) / 60000);

const CancelDialog = ({ order, open, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const quick = minsLeft(order.created_at) > 0;
  const submit = async () => {
    try {
      const { data } = await api.post(`/orders/${order.order_id}/cancel`, { reason });
      toast.success(data.status === "Dibatalkan" ? "Pesanan dibatalkan" : "Pengajuan pembatalan dikirim ke admin");
      onDone(); onClose();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined} data-testid="cancel-dialog">
        <DialogHeader><DialogTitle>{quick ? "Batalkan Pesanan" : "Ajukan Pembatalan"}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{quick ? "Pesanan langsung dibatalkan." : "Lewat dari 10 menit, pembatalan perlu disetujui admin."} Jika sudah dibayar, dana dikembalikan ke Saldo.</p>
        <Textarea data-testid="cancel-reason" placeholder="Alasan pembatalan" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button data-testid="cancel-submit" variant="destructive" onClick={submit}>{quick ? "Batalkan Sekarang" : "Kirim Pengajuan"}</Button>
      </DialogContent>
    </Dialog>
  );
};

const ComplaintDialog = ({ order, open, onClose }) => {
  const [f, setF] = useState({ reason: REASONS[0], description: "", items: [], photos: [] });
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try { const { data } = await api.post("/chat/upload", fd); setF((p) => ({ ...p, photos: [...p.photos, data.url].slice(0, 5) })); }
    catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
    e.target.value = "";
  };
  const submit = async () => {
    try { await api.post("/complaints", { order_id: order.order_id, ...f }); toast.success("Komplain terkirim, admin akan meninjau"); onClose(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined} data-testid="complaint-dialog">
        <DialogHeader><DialogTitle>Komplain Pesanan {order.order_id}</DialogTitle></DialogHeader>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => <button key={r} data-testid={`complaint-reason-${REASONS.indexOf(r)}`} onClick={() => setF({ ...f, reason: r })} className={`text-xs px-3 py-1 rounded-full border ${f.reason === r ? "bg-primary text-white border-primary" : ""}`}>{r}</button>)}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold">Produk bermasalah</p>
          {order.items.map((i, idx) => {
            const label = `${i.name}${i.variant_name ? ` (${i.variant_name})` : ""}`;
            return (
              <label key={`${i.product_id}-${i.variant_id || ""}`} className="flex items-center gap-2 text-sm">
                <Checkbox data-testid={`complaint-item-${idx}`} checked={f.items.includes(label)} onCheckedChange={(v) => setF((p) => ({ ...p, items: v ? [...p.items, label] : p.items.filter((x) => x !== label) }))} />
                <span className="line-clamp-1">{label} × {i.quantity}</span>
              </label>
            );
          })}
        </div>
        <Textarea data-testid="complaint-description" placeholder="Ceritakan masalahnya" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="flex gap-2 flex-wrap">
          {f.photos.map((p) => <span key={p} className="relative"><img src={fileUrl(p)} alt="" className="w-16 h-16 rounded-lg object-cover" /><button onClick={() => setF({ ...f, photos: f.photos.filter((x) => x !== p) })} className="absolute -top-1 -right-1 bg-white rounded-full shadow"><X className="w-3 h-3" /></button></span>)}
          {f.photos.length < 5 && <label className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer" data-testid="complaint-photo-label"><ImagePlus className="w-5 h-5 text-muted-foreground" /><input type="file" accept="image/*" className="hidden" onChange={upload} data-testid="complaint-photo-input" /></label>}
        </div>
        <Button data-testid="complaint-submit" onClick={submit}>Kirim Komplain</Button>
      </DialogContent>
    </Dialog>
  );
};

export const OrderActions = ({ order }) => {
  const buyAgainFn = useBuyAgain();
  const qc = useQueryClient();
  const [dlg, setDlg] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, []);
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-orders"] });
  const cancellable = ["Menunggu Pembayaran", "Diproses"].includes(order.status) && !["confirmed", "allocated", "picking_up", "picked", "dropping_off"].includes(order.shipment?.status);
  const pending = order.cancel_request?.status === "pending";
  const left = minsLeft(order.created_at);

  const buyAgain = () => buyAgainFn(order);

  return (
    <div className="mt-3 space-y-2">
      {order.cancel_request && (
        <p className={`text-xs rounded-lg px-3 py-2 ${pending ? "bg-amber-50 text-amber-700" : order.cancel_request.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`} data-testid={`cancel-request-status-${order.order_id}`}>
          Pengajuan pembatalan: {pending ? "menunggu persetujuan admin" : order.cancel_request.status === "approved" ? "disetujui" : `ditolak${order.cancel_request.note ? ` – ${order.cancel_request.note}` : ""}`}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="gap-1" onClick={buyAgain} data-testid={`buy-again-${order.order_id}`}><RotateCcw className="w-4 h-4" /> Beli Lagi</Button>
        {cancellable && !pending && (
          <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={() => setDlg("cancel")} data-testid={`cancel-order-${order.order_id}`}>
            <XCircle className="w-4 h-4" /> {left > 0 ? `Batalkan (${Math.ceil(left)} mnt)` : "Ajukan Pembatalan"}
          </Button>
        )}
        {["Dikirim", "Selesai"].includes(order.status) && (
          <Button size="sm" variant="outline" className="gap-1 text-amber-700" onClick={() => setDlg("complaint")} data-testid={`complain-order-${order.order_id}`}><AlertTriangle className="w-4 h-4" /> Komplain</Button>
        )}
        {order.status === "Selesai" && (
          <Button size="sm" className="gap-1 rounded-full" onClick={() => setDlg("review")} data-testid={`review-order-${order.order_id}`}><Star className="w-4 h-4" /> Beri Ulasan</Button>
        )}
      </div>
      {order.status === "Dibatalkan" && (order.paid_at || order.payment_method === "saldo") && <p className="text-xs text-emerald-700">Dana {rupiah(order.total)} dikembalikan ke Saldo.</p>}
      <CancelDialog order={order} open={dlg === "cancel"} onClose={() => setDlg(null)} onDone={refresh} />
      <ComplaintDialog order={order} open={dlg === "complaint"} onClose={() => setDlg(null)} />
      {dlg === "review" && <ReviewDialog order={order} open onClose={() => setDlg(null)} />}
    </div>
  );
};
