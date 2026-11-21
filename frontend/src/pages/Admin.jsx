import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ticket, Plus, Trash2, Pencil } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { AdminOverview } from "@/components/AdminOverview";
import { AdminRecipes } from "@/components/AdminRecipes";
import { AdminReviews } from "@/components/AdminReviews";
import { ProductEditDialog } from "@/components/ProductEditDialog";
import { AdminStoreSettings } from "@/components/AdminStoreSettings";
import { AdminChat, useAdminUnread } from "@/components/AdminChat";
import { AdminReports, downloadBlob } from "@/components/AdminReports";
import { Download, Upload, Archive } from "lucide-react";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { AdminOrders } from "@/components/AdminOrders";
import { VariantPriceCell } from "@/components/VariantPriceCell";
import { AdminPromos } from "@/components/AdminPromos";
import { HppZeroDialog } from "@/components/HppZeroDialog";
import { AdminStoreRoute } from "@/components/AdminStoreRoute";
import { AdminAffiliate } from "@/components/AdminAffiliate";
import { AdminKasir } from "@/components/AdminKasir";
import { AdminCustomers, AdminComplaints, AdminCategories } from "@/components/AdminExtras";
import { AdminRefundTransfers } from "@/components/AdminRefunds";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductToolbar, BulkBar, ConfirmDelete } from "@/components/AdminProductTools";
import { api, rupiah } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { AdminBanners } from "@/components/AdminBanners";

export default function Admin() {
  const { user, loading, logout, checkAuth } = useAuth();
  const isAdmin = user?.role === "admin" && !user?.must_change_password;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState([]);
  const [view, setView] = useState("active");
  const [section, setSection] = useState("overview");
  const [hppZeroOpen, setHppZeroOpen] = useState(false);
  const chatUnread = useAdminUnread();
  const [vform, setVform] = useState({ code: "", type: "percentage", value: 10, max_discount: 15000, min_purchase: 50000, description: "" });

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) navigate("/login");
  }, [loading, user]);

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: async () => (await api.get("/admin/stats")).data, enabled: isAdmin });
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: async () => (await api.get("/admin/products")).data, enabled: isAdmin });
  const { data: orders = [] } = useQuery({ queryKey: ["admin-orders"], queryFn: async () => (await api.get("/admin/orders")).data, enabled: isAdmin });
  const { data: vouchers = [] } = useQuery({ queryKey: ["admin-vouchers"], queryFn: async () => (await api.get("/admin/vouchers")).data, enabled: isAdmin });

  const createVoucher = async () => {
    if (!vform.code.trim()) { toast.error("Isi kode voucher"); return; }
    try {
      await api.post("/admin/vouchers", { ...vform, code: vform.code.toUpperCase() });
      qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
      setVform({ code: "", type: "percentage", value: 10, max_discount: 15000, min_purchase: 50000, description: "" });
      toast.success("Voucher dibuat");
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal membuat voucher"); }
  };
  const toggleVoucher = async (v) => {
    await api.patch(`/admin/vouchers/${v.code}`, { active: !v.active });
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
  };
  const deleteVoucher = async (code) => {
    await api.delete(`/admin/vouchers/${code}`);
    qc.invalidateQueries({ queryKey: ["admin-vouchers"] });
    toast.success("Voucher dihapus");
  };

  const updateProduct = async (id, field, value) => {
    await api.patch(`/admin/products/${id}`, { [field]: value });
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    toast.success("Produk diperbarui");
  };

  const importHpp = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/products/hpp-import", fd);
      toast.success(`Harga/HPP/harga toko diperbarui: ${data.updated} baris${data.skipped ? `, ${data.skipped} baris dilewati` : ""}`);
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setHppZeroOpen(true);
    } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengimpor"); }
    e.target.value = "";
  };

  const filtered = products.filter((p) => (view === "archived" ? p.archived : view === "out" ? !p.archived && (p.stock || 0) <= 0 : !p.archived) && p.name.toLowerCase().includes(search.toLowerCase()));
  const pageItems = filtered.slice(0, limit);
  const refreshProducts = () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); qc.invalidateQueries({ queryKey: ["products"] }); };
  const archiveProduct = async (p, archived) => {
    await api.patch(`/admin/products/${p.product_id}`, { archived });
    toast.success(archived ? "Produk diarsipkan" : "Produk dipulihkan");
    refreshProducts();
  };
  const deleteProduct = async (id) => {
    await api.delete(`/admin/products/${id}`);
    toast.success("Produk dihapus");
    setSelected((s) => s.filter((x) => x !== id));
    refreshProducts();
  };

  if (!user || user.role !== "admin") return null;
  if (user.must_change_password) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" data-testid="admin-force-password">
        <ChangePasswordDialog open forced onOpenChange={() => {}} onDone={checkAuth} />
      </div>
    );
  }

  return (
    <AdminShell section={section} setSection={setSection} badges={{ chat: chatUnread }} user={user}
      onLogout={async () => { await logout(); navigate("/login"); }} onStore={() => navigate("/")}>
        <Tabs value={section} onValueChange={setSection}>
          <TabsContent value="overview" className="mt-0"><AdminOverview stats={stats} orders={orders} onOpenOrders={() => setSection("orders")} /></TabsContent>
          <TabsContent value="recipes" className="mt-0"><AdminRecipes /></TabsContent>
          <TabsContent value="promos" className="mt-0"><AdminPromos /></TabsContent>
          <TabsContent value="route" className="mt-0"><AdminStoreRoute orders={orders} /></TabsContent>
          <TabsContent value="affiliate" className="mt-0"><AdminAffiliate /></TabsContent>
          <TabsContent value="reviews" className="mt-0"><AdminReviews /></TabsContent>
          <TabsContent value="chat"><AdminChat /></TabsContent>
          <TabsContent value="reports"><AdminReports /></TabsContent>
          <TabsContent value="customers"><AdminCustomers /></TabsContent>
          <TabsContent value="complaints"><AdminRefundTransfers /><AdminComplaints /></TabsContent>
          <TabsContent value="categories"><AdminCategories /></TabsContent>

          <TabsContent value="store"><AdminStoreSettings /></TabsContent>

          <TabsContent value="banners"><AdminBanners /></TabsContent>

          <TabsContent value="products">
            <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
              <ProductToolbar onAdd={() => setEditing({})} onDone={refreshProducts} />
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {[["active", "Katalog"], ["out", `Stok Habis (${products.filter((p) => !p.archived && (p.stock || 0) <= 0).length})`], ["archived", `Arsip (${products.filter((p) => p.archived).length})`]].map(([v, l]) => (
                  <button key={v} data-testid={`product-view-${v}`} onClick={() => { setView(v); setSelected([]); }} className={`text-xs px-3 h-7 rounded-md ${view === v ? "bg-white shadow font-semibold" : "text-muted-foreground"}`}>{l}</button>
                ))}
              </div>
            </div>
            <BulkBar ids={selected} archivedView={view === "archived"} onClear={() => setSelected([])} onDone={refreshProducts} />
            <div className="flex flex-wrap gap-2 items-center mb-4">
              <Input data-testid="admin-product-search" placeholder="Cari produk..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm h-10" />
              <button onClick={() => setHppZeroOpen(true)} className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-full px-3 py-1 inline-flex items-center gap-1 transition-colors" data-testid="hpp-missing-count">
                {products.filter((p) => !p.archived && (p.variants?.length ? !p.variants.some((v) => v.hpp) : !p.hpp)).length} produk HPP belum diisi · <Archive className="w-3 h-3" /> Tinjau & arsipkan
              </button>
              <HppZeroDialog open={hppZeroOpen} onOpenChange={setHppZeroOpen} onDone={refreshProducts} />
              <Button variant="outline" size="sm" className="ml-auto gap-1" data-testid="hpp-template-btn" onClick={() => downloadBlob("/admin/products/hpp-template.xlsx", {}, "template-hpp.xlsx")}><Download className="w-4 h-4" /> Template Harga, HPP & Harga Toko</Button>
              <label className="inline-flex items-center gap-1 h-9 px-3 rounded-md border text-sm cursor-pointer hover:bg-slate-50" data-testid="hpp-import-label">
                <Upload className="w-4 h-4" /> Upload Harga, HPP & Harga Toko
                <input type="file" accept=".xlsx,.csv" className="hidden" onChange={importHpp} data-testid="hpp-import-input" />
              </label>
            </div>
            <div className="bg-white rounded-2xl border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[740px]">
                <thead className="bg-slate-50 text-left text-xs text-muted-foreground">
                  <tr><th className="p-3 w-8"><Checkbox data-testid="select-all-products" checked={pageItems.length > 0 && pageItems.every((p) => selected.includes(p.product_id))} onCheckedChange={(v) => setSelected(v ? pageItems.map((p) => p.product_id) : [])} /></th><th className="p-3">Produk</th><th className="p-3">Harga</th><th className="p-3">HPP</th><th className="p-3" title="Harga untuk Kasir Toko. Kosong = ikut harga web">Harga Toko</th><th className="p-3">Diskon %</th><th className="p-3">Stok</th><th className="p-3">Status</th><th className="p-3">Aksi</th></tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => (
                    <tr key={p.product_id} data-testid={`admin-product-${p.product_id}`} className={`border-t ${selected.includes(p.product_id) ? "bg-emerald-50/50" : ""}`}>
                      <td className="p-3"><Checkbox data-testid={`select-product-${p.product_id}`} checked={selected.includes(p.product_id)} onCheckedChange={(v) => setSelected((s) => v ? [...s, p.product_id] : s.filter((x) => x !== p.product_id))} /></td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          <div><p className="font-medium line-clamp-1 max-w-[160px]">{p.name}</p><p className="text-xs text-muted-foreground">{p.category_name}</p></div>
                        </div>
                      </td>
                      {p.variants?.length ? <td className="p-3" colSpan={3}><VariantPriceCell p={p} onSaved={refreshProducts} /></td> : (<>
                      <td className="p-3"><Input type="number" defaultValue={p.price} className="w-24 h-8" onBlur={(e) => Number(e.target.value) !== p.price && updateProduct(p.product_id, "price", Number(e.target.value))} data-testid={`price-${p.product_id}`} /></td>
                      <td className="p-3"><Input type="number" defaultValue={p.hpp || 0} className={`w-24 h-8 ${p.hpp ? "" : "border-amber-300 bg-amber-50"}`} title={p.hpp ? "" : "HPP belum diisi"} onBlur={(e) => Number(e.target.value) !== (p.hpp || 0) && updateProduct(p.product_id, "hpp", Number(e.target.value))} data-testid={`hpp-${p.product_id}`} /></td>
                      <td className="p-3"><Input type="number" min={0} defaultValue={p.store_price || ""} placeholder="Web" className="w-24 h-8" title="Kosong = kasir pakai harga web" onBlur={(e) => (Number(e.target.value) || 0) !== (p.store_price || 0) && updateProduct(p.product_id, "store_price", Math.max(0, Number(e.target.value) || 0))} data-testid={`store-price-${p.product_id}`} /></td>
                      </>)}
                      <td className="p-3"><Input type="number" defaultValue={p.discount} className="w-16 h-8" onBlur={(e) => Number(e.target.value) !== p.discount && updateProduct(p.product_id, "discount", Number(e.target.value))} data-testid={`discount-${p.product_id}`} /></td>
                      <td className="p-3"><Input type="number" defaultValue={p.stock} className="w-16 h-8" onBlur={(e) => Number(e.target.value) !== p.stock && updateProduct(p.product_id, "stock", Number(e.target.value))} data-testid={`stock-${p.product_id}`} /></td>
                      <td className="p-3">
                        <Button size="sm" variant={p.active ? "default" : "outline"} className="h-8 text-xs" data-testid={`toggle-${p.product_id}`} onClick={() => updateProduct(p.product_id, "active", !p.active)}>
                          {p.active ? "Aktif" : "Nonaktif"}
                        </Button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center">
                          <button data-testid={`edit-product-${p.product_id}`} onClick={() => setEditing(p)} className="p-2 rounded-lg hover:bg-emerald-50 text-muted-foreground hover:text-primary" title="Edit"><Pencil className="w-4 h-4" /></button>
                          <button data-testid={`archive-product-${p.product_id}`} onClick={() => archiveProduct(p, !p.archived)} className="p-2 rounded-lg hover:bg-amber-50 text-muted-foreground hover:text-amber-600" title={p.archived ? "Pulihkan" : "Arsipkan"}><Archive className="w-4 h-4" /></button>
                          <ConfirmDelete title={`Hapus "${p.name.slice(0, 40)}"?`} onConfirm={() => deleteProduct(p.product_id)}
                            trigger={<button data-testid={`delete-product-${p.product_id}`} className="p-2 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Hapus"><Trash2 className="w-4 h-4" /></button>} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3" data-testid="admin-product-count">Menampilkan {Math.min(limit, filtered.length)} dari {filtered.length} produk</p>
            {filtered.length > limit && (
              <Button variant="outline" data-testid="admin-product-load-more" className="mt-2 rounded-xl" onClick={() => setLimit(limit + 50)}>Tampilkan lebih banyak</Button>
            )}
            <ProductEditDialog product={editing} onClose={() => setEditing(null)}
              onSaved={() => { setEditing(null); refreshProducts(); }} />
          </TabsContent>

          <TabsContent value="orders"><AdminOrders orders={orders} /></TabsContent>
          <TabsContent value="kasir" forceMount className="mt-0 data-[state=inactive]:hidden"><AdminKasir products={products} active={section === "kasir"} /></TabsContent>

          <TabsContent value="vouchers">
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border p-4 lg:col-span-1 h-fit">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Buat Voucher</h3>
                <div className="space-y-2">
                  <Input data-testid="voucher-code-input" placeholder="KODE (cth: HEMAT10)" value={vform.code} onChange={(e) => setVform({ ...vform, code: e.target.value.toUpperCase() })} className="h-9" />
                  <Select value={vform.type} onValueChange={(v) => setVform({ ...vform, type: v })}>
                    <SelectTrigger className="h-9" data-testid="voucher-type-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Diskon Persen (%)</SelectItem>
                      <SelectItem value="fixed">Potongan Tetap (Rp)</SelectItem>
                      <SelectItem value="free_shipping">Gratis Ongkir</SelectItem>
                      <SelectItem value="shipping_discount">Diskon Ongkir (Rp)</SelectItem>
                    </SelectContent>
                  </Select>
                  {vform.type !== "free_shipping" && (
                    <Input data-testid="voucher-value-input" type="number" placeholder={vform.type === "percentage" ? "Nilai % (cth 10)" : "Potongan Rp"} value={vform.value} onChange={(e) => setVform({ ...vform, value: Number(e.target.value) })} className="h-9" />
                  )}
                  {vform.type === "percentage" && (
                    <Input data-testid="voucher-maxdisc-input" type="number" placeholder="Maks diskon Rp (0 = tanpa batas)" value={vform.max_discount} onChange={(e) => setVform({ ...vform, max_discount: Number(e.target.value) })} className="h-9" />
                  )}
                  <Input data-testid="voucher-minpurchase-input" type="number" placeholder="Min belanja Rp" value={vform.min_purchase} onChange={(e) => setVform({ ...vform, min_purchase: Number(e.target.value) })} className="h-9" />
                  <Input data-testid="voucher-desc-input" placeholder="Deskripsi singkat" value={vform.description} onChange={(e) => setVform({ ...vform, description: e.target.value })} className="h-9" />
                  <Button data-testid="create-voucher-btn" onClick={createVoucher} className="w-full h-9 rounded-xl">Simpan Voucher</Button>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-2">
                {vouchers.length === 0 ? <p className="text-center text-muted-foreground py-8">Belum ada voucher.</p> : vouchers.map((v) => (
                  <div key={v.code} data-testid={`admin-voucher-${v.code}`} className="bg-white rounded-2xl border p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0"><Ticket className="w-5 h-5 text-primary" /></div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm">{v.code}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{v.description || `${v.type} · min Rp${(v.min_purchase||0).toLocaleString("id-ID")}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant={v.active ? "default" : "outline"} className="h-8 text-xs" data-testid={`voucher-toggle-${v.code}`} onClick={() => toggleVoucher(v)}>{v.active ? "Aktif" : "Nonaktif"}</Button>
                      <button data-testid={`voucher-delete-${v.code}`} onClick={() => deleteVoucher(v.code)} className="text-muted-foreground hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
    </AdminShell>
  );
}
