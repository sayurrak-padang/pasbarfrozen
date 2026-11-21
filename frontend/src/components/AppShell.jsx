import { NavLink, useLocation } from "react-router-dom";
import { Home, ChefHat, LayoutGrid, ReceiptText, UserRound } from "lucide-react";

// Lebar maksimum "layar aplikasi". Di HP tampil penuh, di laptop/komputer tampil
// sebagai kolom selebar HP di tengah layar supaya terasa seperti aplikasi.
export const APP_WIDTH = "max-w-[480px]";

const TABS = [
  { to: "/", label: "Beranda", icon: Home, end: true },
  { to: "/resep", label: "Resep", icon: ChefHat },
  { to: "/kategori", label: "Kategori", icon: LayoutGrid },
  { to: "/orders", label: "Pesanan", icon: ReceiptText },
  { to: "/akun", label: "Akun", icon: UserRound },
];

const NO_NAV = ["/login"];

export const BottomNav = () => (
  <nav
    data-testid="bottom-nav"
    className={`fixed bottom-0 inset-x-0 mx-auto w-full ${APP_WIDTH} z-40 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pointer-events-none`}
  >
    <div className="clay-nav pointer-events-auto grid grid-cols-5 rounded-[22px] px-1 py-1">
    {TABS.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        data-testid={`bottom-nav-${label.toLowerCase()}`}
        className={({ isActive }) =>
          `flex flex-col items-center gap-0.5 rounded-2xl pt-1.5 pb-1 text-[10.5px] font-semibold transition-all ${isActive ? "neon-pill" : "text-slate-500 hover:text-slate-700"}`}
      >
        {({ isActive }) => (
          <>
            <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.4 : 1.8} />
            {label}
          </>
        )}
      </NavLink>
    ))}
    </div>
  </nav>
);

export const AppShell = ({ children }) => {
  const { pathname } = useLocation();
  const showNav = !NO_NAV.includes(pathname);
  return (
    <div className="min-h-screen bg-slate-300/70">
      <div
        data-testid="app-shell"
        className={`relative mx-auto ${APP_WIDTH} min-h-screen app-ambient shadow-[0_0_40px_rgba(15,23,42,0.12)] ${showNav ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))]" : ""}`}
      >
        {/* Animasi halus saat pindah tab. Hanya fade (tanpa transform) agar bar keranjang yang fixed tidak ikut bergeser. */}
        <div key={pathname} className="animate-in fade-in-0 duration-300 motion-reduce:animate-none">
          {children}
        </div>
      </div>
      {showNav && <BottomNav />}
    </div>
  );
};
