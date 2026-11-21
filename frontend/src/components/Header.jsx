import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown, UserRound, Zap, Truck, Clock3 } from "lucide-react";
import { LOGO_URL, api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { BRAND } from "@/config/brand";

export const DELIVERY_MODES = {
  instan: { title: "Dikirim Hari Ini", label: "Instan", hint: "Kurir Toko", icon: Zap, placeholder: "Cari ayam, daging, nugget, sosis..." },
  reguler: { title: "Dikirim Reguler", label: "Reguler", hint: "JNE / J&T", icon: Truck, placeholder: "Cari produk kering & sembako..." },
};

// Header gaya claymorphism, ringkas. Warna dari palet --rs-* di index.css: lokasi kirim, akun, pencarian dan pilihan pengiriman.
export const Header = ({ search, setSearch, mode, setMode }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [local, setLocal] = useState(search || "");
  const m = DELIVERY_MODES[mode] || DELIVERY_MODES.instan;
  const instan = (mode || "instan") === "instan";
  // Jadwal kirim instan tercepat (slot dari /shipping/schedule, sama dengan pilihan di checkout).
  const { data: schedule = [] } = useQuery({
    queryKey: ["schedule"], queryFn: async () => (await api.get("/shipping/schedule")).data,
    enabled: instan, staleTime: 5 * 60 * 1000, refetchInterval: 10 * 60 * 1000,
  });
  const nextDay = schedule.find((d) => d.slots?.some((x) => x.available));
  const nextSlot = nextDay?.slots.find((x) => x.available)?.slot;
  const title = instan && nextDay ? `Dikirim ${nextDay.label}` : m.title;

  const submitSearch = (e) => { e.preventDefault(); setSearch?.(local); };

  return (
    <header className="neon-lens sticky top-0 z-40 rounded-b-[22px] border-t-0 px-3.5 pt-2 pb-2.5" data-testid="app-header">
      <div className="flex items-center gap-2.5">
        <Link to="/" className="shrink-0" data-testid="logo-link">
          <img src={LOGO_URL} alt={BRAND.name} data-testid="header-logo-img" className="w-8 h-8 rounded-lg object-cover bg-white ring-1 ring-white/60" />
        </Link>
        <div className="flex-1 min-w-0 leading-tight">
          <p className="font-extrabold text-[15px] truncate" data-testid="header-delivery-title">{title}</p>
          <div className="flex items-center gap-1.5 min-w-0 text-[11.5px]">
            <Link to={user ? "/addresses" : "/login"} className="inline-flex items-center gap-0.5 text-emerald-50 shrink-0" data-testid="header-location">
              ke {BRAND.city.name} <ChevronDown className="w-3.5 h-3.5" />
            </Link>
            {setMode && instan && nextSlot && (
              <span className="inline-flex items-center gap-1 min-w-0 truncate clay-yellow rounded-full px-2 py-0.5 text-[10.5px] font-bold" data-testid="header-next-slot">
                <Clock3 className="w-3 h-3 shrink-0" /> <span className="truncate">Tercepat {nextSlot.replace("-", "–")}</span>
              </span>
            )}
          </div>
        </div>
        {user ? (
          <button onClick={() => navigate("/akun")} data-testid="user-menu-trigger" aria-label="Akun saya"
            className="w-8 h-8 rounded-full ring-2 ring-white flex items-center justify-center overflow-hidden shrink-0">
            {user.picture ? <img src={user.picture} alt="" className="w-full h-full object-cover" /> : <UserRound className="w-4 h-4" />}
          </button>
        ) : (
          <button onClick={() => navigate("/login")} data-testid="header-login-btn"
            className="shrink-0 rounded-full clay-chip text-xs font-bold px-3.5 py-1.5">
            Masuk
          </button>
        )}
      </div>

      {setSearch && (
        <form onSubmit={submitSearch} className="relative mt-2">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            data-testid="product-search-input"
            type="search"
            value={local}
            onChange={(e) => { setLocal(e.target.value); setSearch(e.target.value); }}
            placeholder={m.placeholder}
            className="w-full h-9 pl-10 pr-4 rounded-full bg-white text-slate-900 placeholder:text-slate-500 outline-none shadow-[inset_2px_3px_6px_rgba(15,60,40,0.12)] focus:ring-2 focus:ring-[var(--rs-yellow)] text-[13px]"
          />
        </form>
      )}

      {setMode && (
        <div className="mt-2 grid grid-cols-2 gap-1 p-0.5 rounded-full bg-white/15" role="group" aria-label="Pilihan pengiriman" data-testid="delivery-mode">
          {Object.entries(DELIVERY_MODES).map(([key, d]) => {
            const active = key === mode;
            const Icon = d.icon;
            return (
              <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={active} data-testid={`delivery-mode-${key}`}
                className={`flex items-center justify-center gap-1.5 rounded-full px-2 py-1 text-[12px] leading-none transition-all min-w-0 ${active ? "clay-chip" : "text-white hover:bg-white/10"}`}>
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="font-bold">{d.label}</span>
                <span className={`truncate text-[10.5px] ${active ? "text-[var(--rs-green)]/75" : "text-emerald-50/80"}`}>{d.hint}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
