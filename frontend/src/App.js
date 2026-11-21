import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { ChatWidget } from "@/components/ChatWidget";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { api } from "@/lib/api";
import Storefront from "@/pages/Storefront";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Orders from "@/pages/Orders";
import Addresses from "@/pages/Addresses";
import WalletPage from "@/pages/Wallet";
import { RecipesPage, RecipeDetailPage } from "@/pages/Recipes";
import AccountPage from "@/pages/Account";
import AffiliatePage from "@/pages/Affiliate";
import CategoriesPage from "@/pages/Categories";
import SubscriptionsPage from "@/pages/Subscriptions";
import PointsPage from "@/pages/Points";
import { BlogListPage, BlogPostPage, PrivacyPage, TermsPage, HelpPage } from "@/pages/Info";
import RefundMethodPage from "@/pages/RefundMethod";
import { AppShell } from "@/components/AppShell";
import { captureRef } from "@/lib/ref";

function AuthCallback() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const processed = useRef(false);
  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { navigate("/"); return; }
    const sessionId = match[1];
    (async () => {
      try {
        localStorage.removeItem("rsp_token");
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        localStorage.setItem("rsp_token", data.session_token);
        setUser(data.user);
        window.history.replaceState(null, "", "/");
        navigate("/");
      } catch {
        navigate("/login");
      }
    })();
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Memproses login...</p>
      </div>
    </div>
  );
}

function AppRouter() {
  const location = useLocation();
  useEffect(() => { captureRef(); }, []);
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      {/* Semua halaman pembeli tampil seperti aplikasi HP (tab bawah + kolom selebar HP) */}
      <Route element={<AppShell><Outlet /></AppShell>}>
        <Route path="/akun" element={<AccountPage />} />
        <Route path="/affiliate" element={<AffiliatePage />} />
        <Route path="/" element={<Storefront />} />
        <Route path="/kategori" element={<CategoriesPage />} />
        <Route path="/langganan" element={<SubscriptionsPage />} />
        <Route path="/poin" element={<PointsPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/addresses" element={<Addresses />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/resep" element={<RecipesPage />} />
        <Route path="/resep/:id" element={<RecipeDetailPage />} />
        <Route path="/metode-pengembalian-dana" element={<RefundMethodPage />} />
        <Route path="/blog" element={<BlogListPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/kebijakan-privasi" element={<PrivacyPage />} />
        <Route path="/syarat-ketentuan" element={<TermsPage />} />
        <Route path="/bantuan" element={<HelpPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Toaster position="top-center" richColors />
          <AppRouter />
          <ChatWidget />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
