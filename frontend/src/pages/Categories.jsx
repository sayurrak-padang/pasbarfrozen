import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sprout, LayoutGrid } from "lucide-react";
import { api, fileUrl } from "@/lib/api";
import { CATEGORY_ICONS as ICONS } from "@/lib/categoryIcons";

export default function CategoriesPage() {
  const navigate = useNavigate();
  const { data: categories = [], isLoading } = useQuery({ queryKey: ["categories"], queryFn: async () => (await api.get("/categories")).data });
  return (
    <div className="min-h-screen" data-testid="categories-page">
      <div className="sticky top-0 z-10 bg-emerald-700 text-white rounded-b-[28px] px-4 py-4 shadow-md">
        <h1 className="text-lg font-extrabold flex items-center gap-2"><LayoutGrid className="w-5 h-5" /> Kategori</h1>
        <p className="text-[13px] text-emerald-50">Pilih kategori untuk melihat produknya</p>
      </div>
      <div className="px-4 py-5">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 9 }, (_, i) => <div key={`sk-${i}`} className="aspect-square rounded-2xl bg-slate-200 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {categories.map((c) => {
              const Icon = ICONS[c.icon] || Sprout;
              return (
                <button key={c.slug} onClick={() => navigate(`/?c=${encodeURIComponent(c.slug)}`)} data-testid={`categories-item-${c.slug}`}
                  className="glass rounded-2xl p-2.5 flex flex-col items-center gap-2 text-center hover:border-emerald-200 active:scale-[0.97] transition">
                  <span className="w-full aspect-square rounded-xl overflow-hidden bg-emerald-50 flex items-center justify-center">
                    {c.image ? <img src={fileUrl(c.image)} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Icon className="w-8 h-8 text-primary" />}
                  </span>
                  <span className="text-xs font-semibold leading-tight line-clamp-2 min-h-[2rem]">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
