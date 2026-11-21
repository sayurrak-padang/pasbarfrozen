import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { api, LOGO_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ChatThread } from "@/components/ChatThread";
import { BRAND } from "@/config/brand";

export const ChatWidget = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [orders, setOrders] = useState([]);

  const enabled = user && user.role !== "admin" && !pathname.startsWith("/admin") && pathname !== "/login";

  useEffect(() => {
    if (!enabled || open) return;
    const check = () => api.get("/chat/unread").then(({ data }) => setUnread(data.unread)).catch(() => {});
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [enabled, open]);

  // Halaman lain (mis. Bantuan) bisa membuka chat dengan: window.dispatchEvent(new Event("rsp:open-chat"))
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("rsp:open-chat", show);
    return () => window.removeEventListener("rsp:open-chat", show);
  }, []);

  useEffect(() => {
    if (open) { setUnread(0); api.get("/orders").then(({ data }) => setOrders(data.slice(0, 20))).catch(() => {}); }
  }, [open]);

  if (!enabled) return null;

  // Tetap di dalam kolom aplikasi (lebar 480px) dan di atas bar keranjang + tab bawah.
  const right = "max(1rem, calc((100vw - 480px) / 2 + 1rem))";
  const bottom = "calc(9rem + env(safe-area-inset-bottom))";

  return (
    <>
      {open && (
        <div style={{ right, bottom: `calc(${bottom} + 4.25rem)` }} className="fixed z-50 w-[calc(100vw-2rem)] max-w-sm h-[60vh] max-h-[520px] bg-white rounded-2xl shadow-2xl border flex flex-col overflow-hidden" data-testid="chat-widget-panel">
          <div className="flex items-center gap-2 px-4 py-3 bg-primary text-white">
            <img src={LOGO_URL} alt="" className="w-8 h-8 rounded-full bg-white object-cover" />
            <div className="flex-1 leading-tight">
              <p className="font-bold text-sm">Chat {BRAND.name}</p>
              <p className="text-[11px] text-emerald-50">Admin biasanya membalas dalam beberapa menit</p>
            </div>
            <button onClick={() => setOpen(false)} data-testid="chat-widget-close"><X className="w-5 h-5" /></button>
          </div>
          <ChatThread listUrl="/chat/messages" sendUrl="/chat/messages" mine="user" orders={orders} />
        </div>
      )}
      <button data-testid="chat-widget-btn" onClick={() => setOpen(!open)}
        style={{ right, bottom }} className="fixed z-50 w-12 h-12 rounded-full neon-lens flex items-center justify-center hover:scale-105 transition-transform">
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {unread > 0 && !open && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-[11px] font-bold flex items-center justify-center" data-testid="chat-unread-badge">{unread}</span>}
      </button>
    </>
  );
};
