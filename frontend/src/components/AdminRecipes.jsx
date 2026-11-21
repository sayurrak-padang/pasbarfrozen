import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Sparkles, ChefHat, X, Link2 } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const EMPTY = { title: "", description: "", image: "", cook_minutes: 30, servings: 2, ingredients: [], steps: [""], published: true };

const ProductLink = ({ products, value, onChange, idx }) => {
  const [q, setQ] = useState("");
  const linked = products.find((p) => p.product_id === value);
  if (linked) return (
    <span className="text-[11px] bg-emerald-50 text-emerald-700 rounded-full pl-2 pr-1 py-0.5 flex items-center gap-1 min-w-0 max-w-full" data-testid={`ing-linked-${idx}`}>
      <Link2 className="w-3 h-3 shrink-0" /><span className="truncate">{linked.name}</span>
      <button type="button" onClick={() => onChange(null)} aria-label="Lepas produk"><X className="w-3 h-3" /></button>
    </span>
  );
  const hits = q.length >= 2 ? products.filter((p) => !p.archived && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div className="relative">
      <Input data-testid={`ing-product-search-${idx}`} placeholder="Tautkan produk (ketik nama)" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs" />
      {hits.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {hits.map((p) => (
            <button type="button" key={p.product_id} data-testid={`ing-product-option-${idx}-${p.product_id}`} onClick={() => { onChange(p.product_id); setQ(""); }}
              className="w-full text-left text-xs px-2 py-1.5 hover:bg-emerald-50 flex items-center gap-2"><img src={p.image} alt="" className="w-6 h-6 rounded object-cover" />{p.name.slice(0, 60)}</button>
          ))}
        </div>
      )}
    </div>
  );
};

const listEdit = (arr, i, v) => arr.map((x, j) => (j === i ? v : x));

const RecipeForm = ({ initial, products, onClose, onSaved }) => {
  const [f, setF] = useState({ ...EMPTY, ...initial, steps: initial?.steps?.length ? initial.steps : [""] });
  const [busy, setBusy] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const payload = () => ({ ...f, steps: f.steps.map((s) => s.trim()).filter(Boolean), ingredients: f.ingredients.filter((i) => i.name.trim()) });

  const save = async () => {
    if (f.title.trim().length < 3) { toast.error("Judul resep minimal 3 huruf"); return null; }
    setBusy("save");
    try {
      const { data } = f.recipe_id ? await api.put(`/admin/recipes/${f.recipe_id}`, payload()) : await api.post("/admin/recipes", payload());
      setF((p) => ({ ...p, recipe_id: data.recipe_id }));
      toast.success("Resep disimpan");
      onSaved();
      return data;
    } catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Periksa isian resep"); return null; }
    finally { setBusy(""); }
  };
  const genImage = async () => {
    const saved = await save();
    if (!saved) return;
    setBusy("ai");
    try {
      const { data } = await api.post(`/admin/recipes/${saved.recipe_id}/generate-image`);
      set("image", data.image); toast.success("Foto AI dibuat"); onSaved();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal membuat foto AI"); }
    finally { setBusy(""); }
  };
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try { set("image", (await api.post("/admin/upload", fd)).data.url); } catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
    e.target.value = "";
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto overflow-x-hidden" aria-describedby={undefined} data-testid="recipe-form">
        <DialogHeader><DialogTitle>{f.recipe_id ? "Edit Resep" : "Resep Baru"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-[180px_1fr] gap-4">
          <div className="space-y-2">
            <div className="aspect-square rounded-xl bg-emerald-50 overflow-hidden flex items-center justify-center">
              {f.image ? <img src={fileUrl(f.image)} alt="" className="w-full h-full object-cover" data-testid="recipe-form-image" /> : <ChefHat className="w-10 h-10 text-emerald-300" />}
            </div>
            <Button type="button" size="sm" className="w-full gap-1" disabled={!!busy} onClick={genImage} data-testid="recipe-ai-image-btn"><Sparkles className="w-4 h-4" /> {busy === "ai" ? "Membuat foto..." : "Foto AI"}</Button>
            <label className="block text-center text-xs border rounded-md py-1.5 cursor-pointer hover:bg-slate-50" data-testid="recipe-upload-label">Unggah foto<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} data-testid="recipe-upload-input" /></label>
          </div>
          <div className="space-y-2">
            <Input data-testid="recipe-title-input" placeholder="Judul resep (cth: Nugget Ayam Saus Asam Manis)" value={f.title} onChange={(e) => set("title", e.target.value)} />
            <Textarea data-testid="recipe-desc-input" placeholder="Deskripsi singkat" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
            <div className="flex gap-2 items-center text-xs">
              <label className="flex items-center gap-1">Waktu (mnt)<Input data-testid="recipe-minutes-input" type="number" className="h-8 w-20" value={f.cook_minutes} onChange={(e) => set("cook_minutes", Number(e.target.value))} /></label>
              <label className="flex items-center gap-1">Porsi<Input data-testid="recipe-servings-input" type="number" className="h-8 w-16" value={f.servings} onChange={(e) => set("servings", Number(e.target.value))} /></label>
              <label className="flex items-center gap-1.5 ml-auto">Tampilkan<Switch data-testid="recipe-published-switch" checked={f.published} onCheckedChange={(v) => set("published", v)} /></label>
            </div>
          </div>
        </div>
        <section className="space-y-2">
          <div className="flex items-center justify-between"><h4 className="font-semibold text-sm">Bahan</h4>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1" data-testid="recipe-add-ingredient" onClick={() => set("ingredients", [...f.ingredients, { name: "", qty: "", product_id: null }])}><Plus className="w-3.5 h-3.5" /> Bahan</Button></div>
          {f.ingredients.map((ing, i) => (
            <div key={`ing-${i}`} className="grid grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)_28px] gap-2 items-start" data-testid={`recipe-ingredient-row-${i}`}>
              <Input data-testid={`ing-name-${i}`} placeholder="Nama bahan" className="h-8 text-sm" value={ing.name} onChange={(e) => set("ingredients", listEdit(f.ingredients, i, { ...ing, name: e.target.value }))} />
              <Input data-testid={`ing-qty-${i}`} placeholder="Takaran" className="h-8 text-sm" value={ing.qty} onChange={(e) => set("ingredients", listEdit(f.ingredients, i, { ...ing, qty: e.target.value }))} />
              <ProductLink idx={i} products={products} value={ing.product_id} onChange={(pid) => set("ingredients", listEdit(f.ingredients, i, { ...ing, product_id: pid }))} />
              <button type="button" data-testid={`ing-remove-${i}`} onClick={() => set("ingredients", f.ingredients.filter((_, j) => j !== i))} className="h-8 text-muted-foreground hover:text-red-500" aria-label="Hapus bahan"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
        <section className="space-y-2">
          <div className="flex items-center justify-between"><h4 className="font-semibold text-sm">Langkah</h4>
            <Button type="button" size="sm" variant="outline" className="h-7 gap-1" data-testid="recipe-add-step" onClick={() => set("steps", [...f.steps, ""])}><Plus className="w-3.5 h-3.5" /> Langkah</Button></div>
          {f.steps.map((s, i) => (
            <div key={`step-${i}`} className="flex gap-2 items-start">
              <span className="w-6 h-6 mt-1 shrink-0 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              <Textarea data-testid={`step-${i}`} rows={2} className="text-sm" value={s} onChange={(e) => set("steps", listEdit(f.steps, i, e.target.value))} />
              <button type="button" data-testid={`step-remove-${i}`} onClick={() => set("steps", f.steps.filter((_, j) => j !== i))} className="mt-2 text-muted-foreground hover:text-red-500" aria-label="Hapus langkah"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
        <div className="flex gap-2 flex-wrap">
          {!f.published && f.recipe_id && (
            <Button onClick={async () => { set("published", true); f.published = true; if (await save()) onClose(); }} disabled={!!busy}
              data-testid="recipe-approve-btn" className="rounded-full bg-emerald-600 hover:bg-emerald-700">Setujui & Tayangkan</Button>
          )}
          <Button onClick={async () => { if (await save()) onClose(); }} disabled={!!busy} data-testid="recipe-save-btn" variant={!f.published && f.recipe_id ? "outline" : "default"} className="rounded-full">{busy === "save" ? "Menyimpan..." : f.published ? "Simpan & Tutup" : "Simpan Draf"}</Button>
          <Button variant="outline" onClick={onClose} className="rounded-full" data-testid="recipe-cancel-btn">Batal</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AiDraftDialog = ({ products, onClose, onDone }) => {
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const hits = q.length >= 2 ? products.filter((p) => !p.archived && p.name.toLowerCase().includes(q.toLowerCase()) && !picked.some((x) => x.product_id === p.product_id)).slice(0, 8) : [];
  const run = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/recipes/ai-draft", { product_ids: picked.map((p) => p.product_id) });
      toast.success("Draf resep AI siap, silakan periksa");
      onDone(data);
    } catch (e) { toast.error(e.response?.data?.detail || "AI gagal membuat draf"); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined} data-testid="ai-draft-dialog">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> Draf Resep dengan AI</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Pilih 2–6 produk yang wajib dipakai, atau kosongkan agar AI memilih sendiri dari katalog. Hasil tersimpan sebagai Draf.</p>
        <div className="flex flex-wrap gap-1.5">
          {picked.map((p) => (
            <span key={p.product_id} className="text-[11px] bg-emerald-50 border border-emerald-200 rounded-full pl-2 pr-1 py-0.5 flex items-center gap-1" data-testid={`ai-picked-${p.product_id}`}>
              {p.name.slice(0, 30)}<button type="button" onClick={() => setPicked(picked.filter((x) => x !== p))} aria-label="Hapus"><X className="w-3 h-3" /></button></span>
          ))}
        </div>
        <div className="relative">
          <Input data-testid="ai-product-search" placeholder="Cari produk (mis. ikan, cabe)..." value={q} onChange={(e) => setQ(e.target.value)} disabled={picked.length >= 6} />
          {hits.length > 0 && (
            <div className="absolute z-20 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {hits.map((p) => (
                <button type="button" key={p.product_id} data-testid={`ai-product-option-${p.product_id}`} onClick={() => { setPicked([...picked, p]); setQ(""); }}
                  className="w-full text-left text-xs px-2 py-1.5 hover:bg-emerald-50 flex items-center gap-2"><img src={p.image} alt="" className="w-6 h-6 rounded object-cover" />{p.name.slice(0, 60)}</button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={run} disabled={busy || picked.length === 1} className="rounded-full gap-1" data-testid="ai-draft-generate-btn">
          <Sparkles className="w-4 h-4" /> {busy ? "AI sedang menulis resep..." : picked.length ? `Buat dari ${picked.length} produk` : "Biarkan AI memilih bahan"}
        </Button>
        {picked.length === 1 && <p className="text-[11px] text-amber-600">Pilih minimal 2 produk, atau kosongkan.</p>}
      </DialogContent>
    </Dialog>
  );
};

const PromoControl = ({ r, promo, onChanged }) => {
  const [pct, setPct] = useState(promo?.recipe_id === r.recipe_id ? promo.discount_pct : 10);
  const active = promo?.recipe_id === r.recipe_id;
  const setPromo = async () => {
    try { await api.put("/admin/recipe-promo", { recipe_id: r.recipe_id, discount_pct: Number(pct) }); toast.success("Jadi Resep Pilihan Minggu Ini"); onChanged(); }
    catch (e) { toast.error(typeof e.response?.data?.detail === "string" ? e.response.data.detail : "Diskon 1–50%"); }
  };
  const clear = async () => { await api.delete("/admin/recipe-promo"); toast.success("Promo dihentikan"); onChanged(); };
  if (!r.published) return null;
  return (
    <div className={`px-3 pb-3 flex items-center gap-2 text-xs ${active ? "text-red-700" : ""}`} data-testid={`recipe-promo-control-${r.recipe_id}`}>
      {active ? <><b className="flex-1">Promo minggu ini · {promo.discount_pct}%</b><button onClick={clear} className="underline" data-testid={`recipe-promo-clear-${r.recipe_id}`}>Hentikan</button></> : <>
        <Input type="number" min={1} max={50} value={pct} onChange={(e) => setPct(e.target.value)} className="h-7 w-16 text-xs" data-testid={`recipe-promo-pct-${r.recipe_id}`} />%
        <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={setPromo} data-testid={`recipe-promo-set-${r.recipe_id}`}>Jadikan Promo Minggu Ini</Button></>}
    </div>
  );
};

export const AdminRecipes = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const { data: recipes = [] } = useQuery({ queryKey: ["admin-recipes"], queryFn: async () => (await api.get("/admin/recipes")).data });
  const { data: products = [] } = useQuery({ queryKey: ["admin-products"], queryFn: async () => (await api.get("/admin/products")).data });
  const { data: promo } = useQuery({ queryKey: ["recipe-promo"], queryFn: async () => (await api.get("/recipe-promo")).data });
  const refresh = () => { ["admin-recipes", "recipes", "recipe-promo"].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); };
  const remove = async (r) => {
    if (!window.confirm(`Hapus resep "${r.title}"?`)) return;
    await api.delete(`/admin/recipes/${r.recipe_id}`); toast.success("Resep dihapus"); refresh();
  };
  return (
    <div data-testid="admin-recipes">
      <div className="flex items-center justify-between mb-4 gap-2">
        <p className="text-sm text-slate-500">{recipes.length} resep · {recipes.filter((r) => !r.published).length} draf</p>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1 rounded-full" onClick={() => setAiOpen(true)} data-testid="recipe-ai-draft-btn"><Sparkles className="w-4 h-4 text-primary" /> Draf dengan AI</Button>
          <Button className="gap-1 rounded-full" onClick={() => setEditing({})} data-testid="recipe-new-btn"><Plus className="w-4 h-4" /> Resep Baru</Button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((r) => (
          <div key={r.recipe_id} className="bg-white rounded-xl border overflow-hidden" data-testid={`admin-recipe-${r.recipe_id}`}>
            <div className="aspect-[16/9] bg-emerald-50">{r.image ? <img src={fileUrl(r.image)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ChefHat className="w-10 h-10 text-emerald-300" /></div>}</div>
            <div className="p-3 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{r.title}</p>
                <p className="text-xs text-slate-500">{r.ingredients.length} bahan · {r.published ? "Tampil" : <b className="text-amber-600" data-testid={`recipe-draft-badge-${r.recipe_id}`}>{r.ai_draft ? "Draf AI · perlu disetujui" : "Draf"}</b>}</p>
              </div>
              <button onClick={() => setEditing(r)} data-testid={`recipe-edit-${r.recipe_id}`} className="p-2 rounded-lg hover:bg-emerald-50" aria-label="Edit"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(r)} data-testid={`recipe-delete-${r.recipe_id}`} className="p-2 rounded-lg hover:bg-red-50 text-red-500" aria-label="Hapus"><Trash2 className="w-4 h-4" /></button>
            </div>
            <PromoControl key={`${r.recipe_id}-${promo?.recipe_id}`} r={r} promo={promo} onChanged={refresh} />
          </div>
        ))}
      </div>
      {aiOpen && <AiDraftDialog products={products} onClose={() => setAiOpen(false)} onDone={(d) => { setAiOpen(false); refresh(); setEditing(d); }} />}
      {editing && <RecipeForm initial={editing} products={products} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
};
