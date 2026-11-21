import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const EMPTY = { current: "", next: "", confirm: "" };

const errText = (d) => (typeof d === "string" ? d : Array.isArray(d) ? "Password baru minimal 8 karakter" : "Gagal mengganti password");

export const ChangePasswordDialog = ({ open, onOpenChange, forced = false, onDone }) => {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const close = (o) => { if (forced) return; if (!o) setF(EMPTY); onOpenChange(o); };

  const submit = async (e) => {
    e.preventDefault();
    if (f.next.length < 8) { toast.error("Password baru minimal 8 karakter"); return; }
    if (f.next !== f.confirm) { toast.error("Konfirmasi password tidak sama"); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: f.current, new_password: f.next });
      toast.success("Password berhasil diganti");
      setF(EMPTY);
      if (onDone) await onDone();
      if (!forced) onOpenChange(false);
    } catch (err) { toast.error(errText(err.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={`max-w-sm ${forced ? "[&>button]:hidden" : ""}`} data-testid="change-password-modal" aria-describedby={undefined}
        onInteractOutside={(e) => forced && e.preventDefault()} onEscapeKeyDown={(e) => forced && e.preventDefault()}>
        <DialogHeader><DialogTitle>{forced ? "Wajib Ganti Password Admin" : "Ganti Password"}</DialogTitle></DialogHeader>
        {forced && <p className="text-xs text-muted-foreground" data-testid="force-password-note">Demi keamanan, ganti password bawaan sebelum membuka dashboard.</p>}
        <form onSubmit={submit} className="space-y-3">
          <Input data-testid="current-password-input" type="password" placeholder="Password lama" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required />
          <Input data-testid="new-password-input" type="password" placeholder="Password baru (min. 8 karakter)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required />
          <Input data-testid="confirm-password-input" type="password" placeholder="Ulangi password baru" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} required />
          <Button data-testid="change-password-submit" type="submit" disabled={saving} className="w-full h-11 rounded-xl">{saving ? "Menyimpan..." : "Simpan Password"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
