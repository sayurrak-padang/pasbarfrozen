import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserCircle2, Save, KeyRound, Package, MapPin, PiggyBank, Handshake, LayoutDashboard, LogOut, UserRound, RotateCcw, Coins, CalendarHeart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MenuGroup, MenuRow, InfoLinks } from "@/components/InfoLinks";
import { BRAND } from "@/config/brand";

const ProfileForm = ({ user, setUser }) => {
  const [f, setF] = useState({ name: user.name, email: user.email, phone: user.phone || "" });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const { data } = await api.put("/auth/profile", f); setUser(data); setF({ name: data.name, email: data.email, phone: data.phone || "" }); toast.success("Data diri disimpan"); }
    catch (err) { toast.error(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Gagal menyimpan"); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="glass rounded-2xl p-5 space-y-3" data-testid="account-profile-form">
      <h2 className="font-semibold flex items-center gap-2"><UserCircle2 className="w-5 h-5 text-primary" /> Data Diri</h2>
      <label className="block text-xs text-muted-foreground">Nama lengkap<Input data-testid="account-name" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <label className="block text-xs text-muted-foreground">Email<Input data-testid="account-email" type="email" required disabled={!user.has_password} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      {!user.has_password && <p className="text-[11px] text-muted-foreground">Email akun Google tidak bisa diubah.</p>}
      <label className="block text-xs text-muted-foreground">No. HP / WhatsApp<Input data-testid="account-phone" placeholder="08xxxxxxxxxx" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <p className="text-[11px] text-muted-foreground" data-testid="account-phone-status">{user.phone ? (user.phone_verified ? "Nomor terverifikasi (bisa login via WhatsApp OTP)." : "Nomor belum terverifikasi.") : "Belum ada nomor."}</p>
      <Button type="submit" disabled={busy} className="gap-1" data-testid="account-save"><Save className="w-4 h-4" /> Simpan</Button>
    </form>
  );
};

const PasswordForm = () => {
  const [f, setF] = useState({ current_password: "", new_password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    if (f.new_password !== f.confirm) { toast.error("Konfirmasi password tidak sama"); return; }
    setBusy(true);
    try { await api.post("/auth/change-password", { current_password: f.current_password, new_password: f.new_password }); toast.success("Password diubah"); setF({ current_password: "", new_password: "", confirm: "" }); }
    catch (err) { toast.error(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Gagal mengubah password"); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="glass rounded-2xl p-5 space-y-3" data-testid="account-password-form">
      <h2 className="font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" /> Ubah Password</h2>
      <Input data-testid="account-current-password" type="password" required placeholder="Password lama" value={f.current_password} onChange={(e) => setF({ ...f, current_password: e.target.value })} />
      <Input data-testid="account-new-password" type="password" required minLength={8} placeholder="Password baru (min. 8 karakter)" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} />
      <Input data-testid="account-confirm-password" type="password" required placeholder="Ulangi password baru" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      <Button type="submit" variant="outline" disabled={busy} data-testid="account-password-save">Ubah Password</Button>
    </form>
  );
};

const AccountMenu = ({ user }) => {
  const items = [
    { to: "/orders", label: "Pesanan Saya", icon: Package, testid: "menu-orders" },
    { to: "/poin", label: "Poin & Voucher", icon: Coins, testid: "menu-points" },
    { to: "/langganan", label: "Paket Langganan", icon: CalendarHeart, testid: "menu-subscriptions" },
    { to: "/addresses", label: "Alamat Saya", icon: MapPin, testid: "menu-addresses" },
    { to: "/wallet", label: "Saldo Saya", icon: PiggyBank, testid: "menu-wallet" },
    { to: "/metode-pengembalian-dana", label: "Metode Pengembalian Dana", icon: RotateCcw, testid: "menu-refund-method",
      hint: user.refund_method === "bank" ? "Ke rekening bank / e-wallet" : `Ke ${BRAND.walletName}` },
    { to: "/affiliate", label: "Affiliate", icon: Handshake, testid: "menu-affiliate" },
    ...(user.role === "admin" ? [{ to: "/admin", label: "Dashboard Admin", icon: LayoutDashboard, testid: "menu-admin" }] : []),
  ];
  return (
    <MenuGroup testid="account-menu">
      {items.map((it) => <MenuRow key={it.to} {...it} />)}
    </MenuGroup>
  );
};

export default function AccountPage() {
  const { user, setUser, loading, logout } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null;
  return (
    <div className="min-h-screen" data-testid="account-page">
      <div className="bg-emerald-700 text-white rounded-b-[28px] px-4 pt-4 pb-5 shadow-md">
        <h1 className="text-lg font-extrabold">Akun Saya</h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center overflow-hidden shrink-0">
            {user.picture ? <img src={user.picture} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-6 h-6" />}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="font-bold truncate">{user.name}</p>
            <p className="text-[13px] text-emerald-50 truncate">{user.email}</p>
          </div>
        </div>
      </div>
      <div className="px-4 py-5 space-y-4">
        <AccountMenu user={user} />
        <ProfileForm user={user} setUser={setUser} />
        {user.has_password ? <PasswordForm /> : <p className="text-sm text-muted-foreground glass rounded-2xl p-5">Akun Google tidak memakai password.</p>}
        <InfoLinks testid="account-info-links" />
        <MenuGroup><MenuRow onClick={logout} label="Keluar" icon={LogOut} testid="menu-logout" danger /></MenuGroup>
        <p className="text-center text-xs text-slate-500 pt-1">{BRAND.name} · {BRAND.domain}</p>
      </div>
    </div>
  );
}
