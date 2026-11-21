import { useQuery } from "@tanstack/react-query";
import { Gift, Copy } from "lucide-react";
import { toast } from "sonner";
import { api, rupiah } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

// Ajakan voucher transaksi pertama: tampil untuk tamu dan pembeli yang belum pernah pesan.
export const FirstOrderBanner = () => {
  const { user } = useAuth();
  const { data: vouchers = [] } = useQuery({ queryKey: ["vouchers"], queryFn: async () => (await api.get("/vouchers")).data, staleTime: 10 * 60 * 1000 });
  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders"], queryFn: async () => (await api.get("/orders")).data, enabled: !!user && user.role !== "admin",
  });
  const v = vouchers.find((x) => x.first_order);
  if (!v || user?.role === "admin" || (user && (isLoading || orders?.some((o) => o.status !== "Dibatalkan")))) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(v.code); toast.success(`Kode ${v.code} disalin`); } catch { toast(`Kode voucher: ${v.code}`); }
  };
  return (
    <section className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-3 flex items-center gap-3" data-testid="first-order-banner">
      <span className="w-11 h-11 rounded-xl bg-amber-300 text-amber-950 flex items-center justify-center shrink-0"><Gift className="w-5 h-5" /></span>
      <div className="flex-1 min-w-0 leading-tight">
        <p className="font-extrabold text-sm text-amber-950">Transaksi pertama potongan {rupiah(v.value)}</p>
        <p className="text-xs text-amber-900/80">Min. belanja {rupiah(v.min_purchase)} · kode <b>{v.code}</b></p>
      </div>
      <button onClick={copy} data-testid="first-order-copy" className="h-9 px-3 rounded-xl bg-amber-950 text-amber-50 text-xs font-bold flex items-center gap-1 shrink-0">
        <Copy className="w-3.5 h-3.5" /> Salin
      </button>
    </section>
  );
};
