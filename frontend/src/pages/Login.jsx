import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { LOGO_URL } from "@/config/brand";
import { OtpField } from "@/components/OtpField";
import { EmailOtpField, SignupEmailCode } from "@/components/EmailOtpField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { InfoLinks } from "@/components/InfoLinks";
import { HERO_PHOTO } from "@/lib/infoContent";
import { BRAND } from "@/config/brand";

// Halaman sambutan: foto sayur & daging segar, tombol Daftar / Masuk, lalu tautan Blog sampai Bantuan.
const Welcome = ({ go }) => (
  <div className="min-h-screen flex flex-col" data-testid="login-welcome">
    <div className="relative h-[68vh] min-h-[440px] max-h-[640px] overflow-hidden rounded-b-[32px] bg-gradient-to-br from-emerald-800 via-emerald-700 to-lime-600">
      <img src={HERO_PHOTO.src} alt={BRAND.login.heroTitle} className="absolute inset-0 w-full h-full object-cover" data-testid="login-hero-img" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 via-40% to-black/80" />
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between">
        <Link to="/" className="neon-lens flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5" data-testid="back-home-link">
          <img src={LOGO_URL} alt={BRAND.name} data-testid="login-logo-img" className="w-7 h-7 rounded-full object-cover bg-white" />
          <span className="text-[13px] font-bold">{BRAND.name}</span>
        </Link>
        <Link to="/" className="text-[13px] font-semibold text-white/90 drop-shadow px-2 py-1" data-testid="login-skip">Lihat toko</Link>
      </div>
      <div className="absolute bottom-0 inset-x-0 px-5 pb-6 text-center text-white">
        <h1 className="text-[28px] font-extrabold leading-tight drop-shadow">{BRAND.login.heroTitle}</h1>
        <p className="mt-2 text-[15px] text-white/90 leading-snug drop-shadow">{BRAND.login.heroText}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button onClick={() => go("daftar")} data-testid="welcome-register"
            className="h-12 rounded-full bg-white text-emerald-800 font-bold text-[16px] shadow-lg active:scale-[0.98] transition-transform">Daftar</button>
          <button onClick={() => go("masuk")} data-testid="welcome-login"
            className="neon-btn h-12 rounded-full font-bold text-[16px] active:scale-[0.98] transition-transform">Masuk</button>
        </div>
      </div>
    </div>
    <div className="px-4 py-5 space-y-4 flex-1">
      <InfoLinks testid="login-info-links" />
      <p className="text-center text-[11px] text-slate-500">Foto: {HERO_PHOTO.credit}</p>
    </div>
  </div>
);

export default function Login() {
  const { login, register, otpLogin, emailOtpLogin } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const step = params.get("mode"); // kosong = halaman sambutan, "masuk" / "daftar" = formulir
  const [mode, setMode] = useState(step === "daftar" ? "register" : "email-otp");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");


  const switchMode = (m) => { setMode(m); setCode(""); };
  const go = (to) => setParams({ mode: to });
  // Ikuti tombol kembali/maju browser: ?mode=daftar selalu formulir daftar.
  useEffect(() => {
    if (step === "daftar") switchMode("register");
    else if (step === "masuk") setMode((m) => { if (m === "register") { setCode(""); return "email-otp"; } return m; });
  }, [step]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "login") {
        const u = await login(form.email, form.password);
        toast.success(`Selamat datang, ${u.name}!`);
        navigate(u.role === "admin" ? "/admin" : "/");
      } else if (mode === "email-otp") {
        if (code.length !== 6) { toast.error("Masukkan kode 6 digit dari email"); return; }
        const u = await emailOtpLogin(form.email, code);
        toast.success(`Selamat datang, ${u.name}!`);
        navigate(u.role === "admin" ? "/admin" : "/");
      } else if (mode === "otp") {
        const u = await otpLogin(phone, code);
        toast.success(`Selamat datang, ${u.name}!`);
        navigate(u.role === "admin" ? "/admin" : "/");
      } else {
        if (form.password !== confirmPw) { toast.error("Ulangi password tidak sama"); return; }
        if (code.length !== 6) { toast.error("Masukkan kode verifikasi 6 digit dari email"); return; }
        const u = await register(form.name, form.email, form.password, phone, code);
        toast.success(`Akun dibuat, selamat datang ${u.name}!`);
        navigate("/");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (!step) return <Welcome go={go} />;

  return (
    <div className="min-h-screen flex">
      <div className="hidden flex-1 bg-gradient-to-br from-emerald-600 to-green-500 items-center justify-center p-12 relative overflow-hidden">
        <img src="https://images.unsplash.com/photo-1488459716781-31db52582fe9?crop=entropy&cs=srgb&fm=jpg&q=85&w=900" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
        <div className="relative text-white max-w-md">
          <img src={LOGO_URL} alt={BRAND.name} data-testid="login-logo-img" className="w-16 h-16 rounded-2xl object-cover mb-5 bg-white" />
          <h2 className="text-4xl font-extrabold leading-tight">{BRAND.login.sideTitle}</h2>
          <p className="mt-4 text-emerald-50">Masuk untuk checkout, lacak pesanan, dan nikmati diskon ongkir dengan kode ONGKIR10 dari {BRAND.name}.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-primary" data-testid="back-welcome-link">
            <ArrowLeft className="w-4 h-4" /> Kembali
          </Link>
          <h1 className="text-2xl font-bold">{mode === "register" ? "Daftar Akun" : "Masuk Akun"}</h1>
          <p className="text-sm text-muted-foreground mt-1">{mode === "register" ? "Buat akun baru untuk mulai belanja." : "Selamat datang kembali!"}</p>

          {mode !== "register" && (
            <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-xl p-1 mt-5">
              <button type="button" data-testid="login-tab-email-otp" onClick={() => switchMode("email-otp")} className={`h-9 rounded-lg text-sm font-medium ${mode === "email-otp" ? "bg-white shadow" : "text-muted-foreground"}`}>Kode Email</button>
              <button type="button" data-testid="login-tab-email" onClick={() => switchMode("login")} className={`h-9 rounded-lg text-sm font-medium ${mode === "login" ? "bg-white shadow" : "text-muted-foreground"}`}>Password</button>
              <button type="button" data-testid="login-tab-otp" onClick={() => switchMode("otp")} className={`h-9 rounded-lg text-sm font-medium ${mode === "otp" ? "bg-white shadow" : "text-muted-foreground"}`}>WhatsApp</button>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "email-otp" ? (
              <EmailOtpField email={form.email} setEmail={(v) => setForm({ ...form, email: v })} code={code} setCode={setCode} />
            ) : mode === "otp" ? (
              <OtpField phone={phone} setPhone={setPhone} code={code} setCode={setCode} purpose="login" />
            ) : (
              <>
                {mode === "register" && (
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input data-testid="register-name" required placeholder="Nama lengkap" className="pl-9 h-11" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                )}
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input data-testid="login-email" required type="email" placeholder="Email" className="pl-9 h-11" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input data-testid="login-password" required type={showPw ? "text" : "password"} placeholder="Password" className="pl-9 pr-11 h-11" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"} data-testid="login-password-toggle"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-slate-900 hover:bg-slate-100 transition-colors">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === "register" && (
                  <div>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input data-testid="register-password-confirm" required type={showPw ? "text" : "password"} placeholder="Ulangi password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                        className={`pl-9 h-11 ${confirmPw && confirmPw !== form.password ? "border-red-400 focus-visible:ring-red-400" : ""}`} />
                    </div>
                    {confirmPw && confirmPw !== form.password && <p className="text-[11px] text-red-600 mt-1" data-testid="register-password-mismatch">Password tidak sama</p>}
                  </div>
                )}
                {mode === "register" && (
                  <div className="pt-1 space-y-2">
                    <SignupEmailCode email={form.email} code={code} setCode={setCode} />
                    <Input data-testid="register-phone" inputMode="tel" placeholder="No. WhatsApp (opsional, untuk notifikasi pesanan)" className="h-11" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                )}
              </>
            )}
            <Button data-testid="submit-auth-btn" type="submit" disabled={loading} className="w-full h-11 rounded-xl font-semibold">
              {loading ? "Memproses..." : mode === "register" ? "Daftar" : "Masuk"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-slate-200" /><span className="text-xs text-muted-foreground">atau</span><div className="flex-1 h-px bg-slate-200" />
          </div>

          <Button data-testid="google-login-btn" onClick={googleLogin} variant="outline" className="w-full h-11 rounded-xl font-medium gap-2">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
            Lanjut dengan Google
          </Button>

          {mode === "register" && (
            <p className="text-center text-[11.5px] mt-4 text-muted-foreground" data-testid="register-consent">
              Dengan mendaftar, Anda menyetujui <Link to="/syarat-ketentuan" className="text-primary font-semibold">Syarat dan Ketentuan</Link> serta <Link to="/kebijakan-privasi" className="text-primary font-semibold">Kebijakan Privasi</Link> kami.
            </p>
          )}

          <p className="text-center text-sm mt-6 text-muted-foreground">
            {mode === "register" ? "Sudah punya akun? " : "Belum punya akun? "}
            <button data-testid="toggle-auth-mode" onClick={() => go(mode === "register" ? "masuk" : "daftar")} className="text-primary font-semibold">
              {mode === "register" ? "Masuk" : "Daftar"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
