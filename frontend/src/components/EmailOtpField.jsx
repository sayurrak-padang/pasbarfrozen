import { useEffect, useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

export const SignupEmailCode = ({ email, code, setCode }) => {
  const [wait, setWait] = useState(0);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const send = async () => {
    if (!email) { toast.error("Isi email terlebih dahulu"); return; }
    setSending(true);
    try { await api.post("/auth/signup-email/send", { email }); toast.success("Kode verifikasi dikirim ke email Anda"); setWait(60); }
    catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal mengirim kode"); }
    finally { setSending(false); }
  };
  return (
    <div className="space-y-1.5" data-testid="signup-email-code">
      <p className="text-xs text-muted-foreground">Verifikasi email (wajib)</p>
      <div className="flex gap-2">
        <Input data-testid="signup-email-code-input" inputMode="numeric" maxLength={6} placeholder="Kode 6 digit" className="h-11 flex-1 tracking-[0.3em] placeholder:tracking-normal text-center font-semibold"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        <button type="button" onClick={send} disabled={sending || wait > 0} data-testid="signup-email-send"
          className="h-11 px-3 rounded-md border text-sm font-medium inline-flex items-center gap-1 hover:border-primary disabled:opacity-50">
          <Send className="w-4 h-4" /> {wait > 0 ? `${wait}s` : "Kirim kode"}
        </button>
      </div>
    </div>
  );
};

export const EmailOtpField = ({ email, setEmail, code, setCode }) => {
  const [wait, setWait] = useState(0);
  const [sending, setSending] = useState(false);
  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);
  const send = async () => {
    if (!email) { toast.error("Isi email terlebih dahulu"); return; }
    setSending(true);
    try { await api.post("/auth/email-otp/send", { email }); toast.success("Kode dikirim ke email Anda"); setWait(60); }
    catch (e) { toast.error(e.response?.data?.detail?.[0]?.msg || e.response?.data?.detail || "Gagal mengirim kode"); }
    finally { setSending(false); }
  };
  return (
    <div className="space-y-3" data-testid="email-otp-field">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="email-otp-email" type="email" required placeholder="Email terdaftar" className="pl-9 h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="button" onClick={send} disabled={sending || wait > 0} data-testid="email-otp-send"
          className="h-11 px-3 rounded-md border text-sm font-medium inline-flex items-center gap-1 hover:border-primary disabled:opacity-50">
          <Send className="w-4 h-4" /> {wait > 0 ? `${wait}s` : "Kirim kode"}
        </button>
      </div>
      <Input data-testid="email-otp-code" inputMode="numeric" maxLength={6} placeholder="Kode 6 digit dari email" className="h-11 tracking-[0.4em] placeholder:tracking-normal text-center font-semibold"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
    </div>
  );
};
