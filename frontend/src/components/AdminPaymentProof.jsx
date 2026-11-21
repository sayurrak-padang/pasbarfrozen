import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MANUAL_PAYMENTS, paymentLabel } from "@/components/checkout/ManualPayment";

// Admin memeriksa bukti bayar QRIS toko / transfer lalu menyetujui atau menolak.
export const AdminPaymentProof = ({ order: o, onChange }) => {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!MANUAL_PAYMENTS.includes(o.payment_method)) return null;
  const decide = async (approve) => {
    setBusy(true);
    try {
      await api.post(`/admin/orders/${o.order_id}/verify-payment`, { approve, note });
      toast.success(approve ? "Pembayaran disetujui, pesanan diproses" : "Bukti bayar ditolak");
      onChange?.();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-2 rounded-xl border bg-white p-3 space-y-2" data-testid={`admin-proof-${o.order_id}`}>
      <p className="font-semibold">Pembayaran {paymentLabel(o.payment_method)} · {o.paid_at ? "Lunas" : o.payment_proof ? "Bukti dikirim" : "Belum ada bukti"}</p>
      {o.payment_proof && (
        <a href={fileUrl(o.payment_proof)} target="_blank" rel="noreferrer">
          <img src={fileUrl(o.payment_proof)} alt="Bukti bayar" className="max-h-64 rounded-lg border" />
        </a>
      )}
      {o.proof_note && <p className="text-muted-foreground">Catatan: {o.proof_note}</p>}
      {o.status === "Menunggu Pembayaran" && o.payment_proof && (
        <>
          <Input className="h-8 text-xs" placeholder="Catatan untuk pembeli (opsional, mis. nominal kurang)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" className="h-8 gap-1" disabled={busy} onClick={() => decide(true)} data-testid={`proof-approve-${o.order_id}`}><CheckCircle2 className="w-4 h-4" /> Setujui</Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-red-600 border-red-200" disabled={busy} onClick={() => decide(false)} data-testid={`proof-reject-${o.order_id}`}><XCircle className="w-4 h-4" /> Tolak</Button>
          </div>
        </>
      )}
    </div>
  );
};
