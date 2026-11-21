import { useState } from "react";
import { LayoutDashboard, Package, ShoppingBag, Ticket, Image, Shapes, ChefHat, Star, Users, AlertTriangle, MessageCircle, LineChart, Settings, LogOut, Menu, Store, Zap, Truck, Handshake, Calculator } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LOGO_URL, api } from "@/lib/api";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BRAND } from "@/config/brand";

export const ADMIN_SECTIONS = [
  ["overview", "Ringkasan", LayoutDashboard], ["products", "Produk", Package], ["orders", "Pesanan", ShoppingBag], ["kasir", "Kasir Toko", Calculator],
  ["route", "Kurir Toko", Truck], ["promos", "Atur Promo", Zap], ["affiliate", "Affiliate", Handshake], ["vouchers", "Voucher", Ticket], ["banners", "Banner", Image], ["categories", "Kategori", Shapes],
  ["recipes", "Resep", ChefHat], ["reviews", "Ulasan", Star], ["customers", "Konsumen", Users],
  ["complaints", "Komplain", AlertTriangle], ["chat", "Chat", MessageCircle], ["reports", "Laporan Penjualan", LineChart],
  ["store", "Pengaturan Toko", Settings],
];

const NavList = ({ section, onSelect, badges }) => (
  <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
    {ADMIN_SECTIONS.map(([key, label, Icon]) => (
      <button key={key} data-testid={`admin-tab-${key}`} onClick={() => onSelect(key)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${section === key ? "bg-emerald-600 text-white font-semibold shadow-sm" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}>
        <Icon className="w-4 h-4 shrink-0" />{label}
        {badges[key] > 0 && <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" data-testid={`admin-${key}-unread`}>{badges[key]}</span>}
      </button>
    ))}
  </nav>
);

const SidebarBody = ({ section, onSelect, badges, user, onLogout, onStore }) => (
  <div className="h-full flex flex-col bg-slate-900 text-slate-300">
    <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 bg-slate-950/50">
      <img src={LOGO_URL} alt="" className="w-9 h-9 rounded-lg object-cover" />
      <div><p className="text-sm font-bold text-white leading-tight">{BRAND.name}</p><p className="text-[10px] uppercase tracking-wider text-emerald-400">Admin Panel</p></div>
    </div>
    <NavList section={section} onSelect={onSelect} badges={badges} />
    <div className="p-3 border-t border-slate-800 space-y-1">
      <button onClick={onStore} data-testid="admin-back" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"><Store className="w-4 h-4" /> Lihat Toko</button>
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">{user?.name?.[0]}</div>
        <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-white truncate">{user?.name}</p><p className="text-[10px] text-slate-500 truncate">{user?.email}</p></div>
        <button onClick={onLogout} data-testid="admin-logout-btn" aria-label="Keluar" className="p-1.5 rounded-md hover:bg-slate-800 hover:text-red-400 transition-colors"><LogOut className="w-4 h-4" /></button>
      </div>
    </div>
  </div>
);

const ChatFab = ({ onOpen, hidden }) => {
  const { data } = useQuery({ queryKey: ["admin-chat-unread"], queryFn: async () => (await api.get("/admin/chat/unread")).data, refetchInterval: 15000 });
  const n = data?.unread || 0;
  if (hidden) return null;
  return (
    <button onClick={onOpen} data-testid="admin-chat-fab" aria-label="Pesan masuk"
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-xl flex items-center justify-center hover:bg-emerald-700 transition-transform hover:scale-105">
      <MessageCircle className="w-6 h-6" />
      {n > 0 && <span className="absolute -top-1 -right-1 flex"><span className="absolute inset-0 rounded-full bg-red-400 animate-ping" /><span className="relative bg-red-500 text-white text-[11px] font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1 border-2 border-white" data-testid="admin-chat-fab-count">{n > 99 ? "99+" : n}</span></span>}
    </button>
  );
};

export const AdminShell = ({ section, setSection, badges, user, onLogout, onStore, children }) => {
  const [mobile, setMobile] = useState(false);
  const title = ADMIN_SECTIONS.find(([k]) => k === section)?.[1];
  const select = (k) => { setSection(k); setMobile(false); window.scrollTo({ top: 0 }); };
  const props = { section, onSelect: select, badges, user, onLogout, onStore };
  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-800" data-testid="admin-sidebar"><SidebarBody {...props} /></aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="p-0 w-64 border-slate-800 [&>button]:text-white [&>button]:opacity-80" aria-describedby={undefined}><SheetTitle className="sr-only">Menu admin</SheetTitle><SidebarBody {...props} /></SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center gap-3 px-4 md:px-8">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100" onClick={() => setMobile(true)} aria-label="Buka menu" data-testid="admin-menu-toggle"><Menu className="w-5 h-5" /></button>
          <div><p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Dashboard Admin</p><h1 className="text-lg font-bold text-slate-900 leading-tight" data-testid="admin-section-title">{title}</h1></div>
        </header>
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      <ChatFab onOpen={() => select("chat")} hidden={section === "chat"} />
    </div>
  );
};
