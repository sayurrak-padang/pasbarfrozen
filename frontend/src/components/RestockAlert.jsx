import { useState } from "react";
import { BellRing, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const RestockAlert = ({ productId, variantId }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/restock-alerts", { email, product_id: productId, variant_id: variantId || null });
      setDone(true);
      toast.success("Siap! Kami kabari lewat email saat stok tersedia");
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(Array.isArray(d) ? "Email tidak valid" : d || "Gagal menyimpan");
    } finally { setBusy(false); }
  };
  if (done) {
    return <p className="flex-1 flex items-center gap-2 text-sm text-emerald-700 font-medium" data-testid="restock-alert-done"><Check className="w-4 h-4" /> Kami akan mengirim email ke {email} saat stok tersedia.</p>;
  }
  return (
    <form onSubmit={submit} className="flex-1 flex flex-col sm:flex-row gap-2" data-testid="restock-alert-form">
      <Input type="email" required placeholder="Email Anda" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" data-testid="restock-email-input" />
      <Button type="submit" disabled={busy} className="h-11 rounded-xl font-semibold gap-1.5 shrink-0" data-testid="restock-submit-btn">
        <BellRing className="w-4 h-4" /> {busy ? "Menyimpan..." : "Kabari saya"}
      </Button>
    </form>
  );
};
