import { Check, QrCode, Banknote, Wallet, PiggyBank } from "lucide-react";
import { rupiah } from "@/lib/api";
import { BRAND } from "@/config/brand";

const PAYMENTS = [
  { code: "cod", name: "COD (Bayar di Tempat)", icon: Banknote, desc: "Bayar tunai saat pesanan tiba" },
  { code: "qris", name: "QRIS", icon: QrCode, desc: "GoPay, OVO, DANA, ShopeePay & m-banking · via Midtrans" },
  { code: "va", name: "Virtual Account", icon: Wallet, desc: "BCA, BNI, BRI, Mandiri, Permata · via Midtrans" },
  { code: "saldo", name: BRAND.walletName, icon: PiggyBank, desc: "" },
];

export const PaymentSection = ({ payment, setPayment, balance, total }) => (
  <section>
    <h4 className="font-semibold text-sm mb-2">Metode Pembayaran</h4>
    <div className="space-y-2">
      {PAYMENTS.map((p) => {
        const Icon = p.icon;
        const short = p.code === "saldo" && balance < total;
        return (
          <button key={p.code} data-testid={`payment-option-${p.code}`} disabled={short} onClick={() => setPayment(p.code)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all disabled:opacity-50 ${payment === p.code ? "border-primary bg-emerald-50" : "border-slate-200"}`}>
            <Icon className="w-5 h-5 text-primary" />
            <div className="text-left flex-1">
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-[11px] text-muted-foreground">{p.code === "saldo" ? `Saldo Anda ${rupiah(balance)}${short ? " · tidak cukup" : ""}` : p.desc}</p>
            </div>
            {payment === p.code && <Check className="w-4 h-4 text-primary" />}
          </button>
        );
      })}
    </div>
  </section>
);
