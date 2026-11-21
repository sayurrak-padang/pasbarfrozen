import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { BRAND } from "@/config/brand";

const KEY = "rsp_install_dismissed";
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

// Ajakan "Pasang aplikasi <nama merek>". Android/Chrome: tombol Pasang (prompt bawaan browser).
// iPhone/iPad (Safari): petunjuk Bagikan → Tambahkan ke Layar Utama. Tidak tampil jika sudah terpasang.
export const InstallPrompt = () => {
  const [evt, setEvt] = useState(null);
  const [hidden, setHidden] = useState(() => {
    try { return isStandalone() || localStorage.getItem(KEY) === "1"; } catch { return isStandalone(); }
  });
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const dismiss = () => { setHidden(true); try { localStorage.setItem(KEY, "1"); } catch { /* abaikan */ } };
  const ios = isIOS();
  if (hidden || (!evt && !ios)) return null;

  const install = async () => {
    if (evt) {
      evt.prompt();
      const { outcome } = await evt.userChoice;
      setEvt(null);
      if (outcome === "accepted") setHidden(true);
    } else setIosHelp(true);
  };

  return (
    <div className="rounded-2xl glass p-3" data-testid="install-prompt">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl border border-slate-100 shrink-0" />
        <div className="flex-1 min-w-0 leading-tight">
          <p className="font-bold text-sm">Pasang aplikasi {BRAND.shortName}</p>
          <p className="text-xs text-muted-foreground">Buka lebih cepat langsung dari layar HP</p>
        </div>
        <button onClick={install} data-testid="install-prompt-btn" className="h-9 px-3 rounded-xl bg-primary text-white text-sm font-bold flex items-center gap-1 shrink-0">
          <Download className="w-4 h-4" /> Pasang
        </button>
        <button onClick={dismiss} aria-label="Tutup" data-testid="install-prompt-close" className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      {iosHelp && (
        <p className="mt-2.5 text-xs text-slate-700 bg-emerald-50 rounded-xl px-3 py-2 leading-relaxed" data-testid="install-prompt-ios">
          Di Safari, ketuk tombol <Share className="inline w-3.5 h-3.5 -mt-0.5" /> <b>Bagikan</b> di bawah layar, lalu pilih <b>Tambahkan ke Layar Utama</b>.
        </p>
      )}
    </div>
  );
};
