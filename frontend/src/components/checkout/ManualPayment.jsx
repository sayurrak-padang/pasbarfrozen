import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, Copy, Clock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

// Pasbar Frozen: pembayaran QRIS toko / transfer rekening dengan unggah bukti bayar.
export const MANUAL_PAYMENTS = ["qris_toko", "transfer"];
export const PAYMENT_LABEL = { cod: "COD", qris_toko: "QRIS", transfer: "Transfer Bank" };
export const paymentLabel = (m) => PAYMENT_LABEL[m] || (m || "").toUpperCase();

export const usePaymentInfo = () => useQuery({
  queryKey: ["payment-info"], staleTime: 5 * 60 * 1000,
  queryFn: async () => (await api.get("/payment-info")).data,
});

const copy = (text) => { navigator.clipboard?.writeText(text).then(() => toast.success("Disalin")).catch(() => {}); };

export const PaymentInstructions = ({ method, total }) => {
  const { data: info = {} } = usePaymentInfo();
  return (
    <div className="space-y-2 text-left" data-testid="payment-instructions">
      <p className="text-sm">Bayar <b className="text-primary">{rupiah(total)}</b> {method === "qris_toko" ? "dengan scan QRIS berikut" : "ke salah satu rekening berikut"}, lalu unggah bukti bayarnya.</p>
      {method === "qris_toko" ? (
        info.qris_image ? (
          <div className="bg-white border rounded-2xl p-3 text-center">
            <img src={fileUrl(info.qris_image)} alt="QRIS toko" className="mx-auto max-h-72 object-contain" data-testid="qris-toko-image" />
            {info.qris_name && <p className="text-xs text-muted-foreground mt-1">a.n. {info.qris_name}</p>}
          </div>
        ) : <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2">QRIS toko belum diatur. Hubungi admin lewat chat.</p>
      ) : (
        (info.banks || []).length ? (info.banks || []).map((b) => (
          <div key={`${b.bank}-${b.number}`} className="bg-white border rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="text-sm"><p className="font-semibold">{b.bank}</p><p className="font-mono">{b.number}</p><p className="text-xs text-muted-foreground">a.n. {b.holder}</p></div>
            <button type="button" onClick={() => copy(b.number)} className="p-2 rounded-lg border" aria-label="Salin nomor rekening"><Copy className="w-4 h-4" /></button>
          </div>
        )) : <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2">Rekening toko belum diatur. Hubungi admin lewat chat.</p>
      )}
      {info.note && <p className="text-xs text-muted-foreground">{info.note}</p>}
    </div>
  );
};

export const ProofUpload = ({ order, onDone }) => {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const st = order.payment_status;
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data: up } = await api.post("/orders/proof-upload", fd);
      const { data } = await api.post(`/orders/${order.order_id}/payment-proof`, { url: up.url });
      toast.success("Bukti bayar terkirim. Admin akan memeriksanya.");
      onDone?.(data);
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah bukti bayar"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2" data-testid={`proof-${order.order_id}`}>
      {st === "proof_submitted" && <p className="text-xs text-sky-700 bg-sky-50 rounded-lg p-2 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Bukti bayar sedang diperiksa admin.</p>}
      {st === "proof_rejected" && <p className="text-xs text-red-700 bg-red-50 rounded-lg p-2 flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> {order.proof_note || "Bukti bayar ditolak, silakan unggah ulang."}</p>}
      {order.payment_proof && <a href={fileUrl(order.payment_proof)} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Lihat bukti yang dikirim</a>}
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} />
      <Button type="button" className="w-full rounded-xl gap-1.5" disabled={busy} onClick={() => ref.current?.click()} data-testid={`proof-upload-${order.order_id}`}>
        <Upload className="w-4 h-4" /> {busy ? "Mengunggah..." : order.payment_proof ? "Unggah Ulang Bukti Bayar" : "Unggah Bukti Bayar"}
      </Button>
    </div>
  );
};

export const ManualPayBox = ({ order, onDone }) => (
  order.status === "Menunggu Pembayaran" ? (
    <div className="mt-3 bg-secondary rounded-xl p-3 space-y-3">
      {order.payment_status !== "proof_submitted" && <PaymentInstructions method={order.payment_method} total={order.total} />}
      <ProofUpload order={order} onDone={onDone} />
    </div>
  ) : order.paid_at ? <p className="mt-3 text-sm font-semibold text-primary flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Pembayaran diterima</p> : null
);
