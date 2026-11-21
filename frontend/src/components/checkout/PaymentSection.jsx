import { Check, QrCode, Banknote, Landmark } from "lucide-react";

const PAYMENTS = [
  { code: "cod", name: "COD (Bayar di Tempat)", icon: Banknote, desc: "Bayar tunai saat pesanan tiba · khusus Kurir Toko" },
  { code: "qris_toko", name: "QRIS Toko", icon: QrCode, desc: "Scan QRIS toko, lalu unggah bukti bayar" },
  { code: "transfer", name: "Transfer Rekening", icon: Landmark, desc: "Transfer ke rekening toko, lalu unggah bukti bayar" },
];

export const PaymentSection = ({ payment, setPayment }) => (
  <section>
    <h4 className="font-semibold text-sm mb-2">Metode Pembayaran</h4>
    <div className="space-y-2">
      {PAYMENTS.map((p) => {
        const Icon = p.icon;
        return (
          <button key={p.code} data-testid={`payment-option-${p.code}`} onClick={() => setPayment(p.code)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${payment === p.code ? "border-primary bg-emerald-50" : "border-slate-200"}`}>
            <Icon className="w-5 h-5 text-primary" />
            <div className="text-left flex-1">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{p.desc}</p>
            </div>
            {payment === p.code && <Check className="w-4 h-4 text-primary" />}
          </button>
        );
      })}
    </div>
  </section>
);
