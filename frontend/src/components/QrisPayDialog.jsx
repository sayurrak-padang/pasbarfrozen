import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Loader2, Clock } from "lucide-react";
import { api, rupiah } from "@/lib/api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const left = (iso) => {
  if (!iso) return null;
  const t = new Date(iso.replace(" ", "T") + (/[zZ+]/.test(iso.slice(10)) ? "" : "+07:00")).getTime() - Date.now();
  return Math.max(0, Math.floor(t / 1000));
};

export const QrisPayDialog = ({ order, onClose, onPaid }) => {
  const [secs, setSecs] = useState(() => left(order?.qris?.expires_at));
  const [status, setStatus] = useState(order?.status);
  useEffect(() => {
    if (!order) return undefined;
    const t = setInterval(() => setSecs(left(order.qris?.expires_at)), 1000);
    const p = setInterval(async () => {
      try {
        const { data } = await api.get(`/orders/${order.order_id}/payment-status`);
        setStatus(data.status);
        if (data.status === "Diproses") { clearInterval(p); onPaid?.(data); }
      } catch { /* keep polling */ }
    }, 5000);
    return () => { clearInterval(t); clearInterval(p); };
  }, [order]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!order?.qris) return null;
  const expired = secs === 0 || status === "Dibatalkan";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm text-center" data-testid="qris-dialog">
        <DialogTitle className="flex items-center justify-center gap-2"><QrCode className="w-5 h-5 text-primary" /> Bayar dengan QRIS</DialogTitle>
        <DialogDescription>Scan pakai DANA, GoPay, OVO, ShopeePay, atau m-banking.</DialogDescription>
        <p className="text-2xl font-extrabold text-primary" data-testid="qris-amount">{rupiah(order.total)}</p>
        <div className={`mx-auto p-3 bg-white border rounded-2xl ${expired ? "opacity-30" : ""}`} data-testid="qris-code">
          {order.qris.qr_string ? <QRCodeSVG value={order.qris.qr_string} size={232} level="M" /> : <img src={order.qris.qr_url} alt="QRIS" className="w-[232px] h-[232px]" />}
        </div>
        {status === "Diproses" ? <p className="text-emerald-700 font-semibold" data-testid="qris-paid">Pembayaran diterima!</p>
          : expired ? <p className="text-red-600 text-sm" data-testid="qris-expired">QRIS kedaluwarsa. Pesanan akan dibatalkan otomatis.</p>
          : <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5" data-testid="qris-waiting"><Loader2 className="w-4 h-4 animate-spin" /> Menunggu pembayaran · <Clock className="w-3.5 h-3.5" /> {secs != null ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : "15:00"}</p>}
        <p className="text-[11px] text-muted-foreground">No. pesanan {order.order_id}. Halaman ini otomatis mengecek pembayaran.</p>
      </DialogContent>
    </Dialog>
  );
};
