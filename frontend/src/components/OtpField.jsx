import { useEffect, useState } from "react";
import { Phone, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const OtpField = ({ phone, setPhone, code, setCode, purpose, onSent }) => {
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (!phone.trim()) { toast.error("Isi nomor WhatsApp"); return; }
    setSending(true);
    try {
      await api.post("/auth/otp/send", { phone, purpose });
      toast.success("Kode OTP dikirim ke WhatsApp Anda");
      setCooldown(60);
      onSent?.();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal mengirim kode"); }
    finally { setSending(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid={`otp-phone-${purpose}`} type="tel" placeholder="No. WhatsApp (08...)" className="pl-9 h-11" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button type="button" variant="outline" data-testid={`otp-send-${purpose}`} className="h-11 rounded-xl" disabled={sending || cooldown > 0} onClick={send}>
          {cooldown > 0 ? `${cooldown}s` : sending ? "..." : "Kirim OTP"}
        </Button>
      </div>
      <div className="relative">
        <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input data-testid={`otp-code-${purpose}`} inputMode="numeric" maxLength={6} placeholder="Kode OTP 6 digit" className="pl-9 h-11 tracking-widest" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
      </div>
    </div>
  );
};
