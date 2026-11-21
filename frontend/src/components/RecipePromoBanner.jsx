import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, Clock, ArrowRight, BadgePercent } from "lucide-react";
import { api, fileUrl } from "@/lib/api";

export const RecipePromoBanner = () => {
  const { data: promo } = useQuery({ queryKey: ["recipe-promo"], queryFn: async () => (await api.get("/recipe-promo")).data });
  if (!promo) return null;
  const r = promo.recipe;
  return (
    <Link to={`/resep/${r.recipe_id}`} data-testid="recipe-promo-banner"
      className="group mt-6 grid rounded-2xl overflow-hidden bg-slate-900 text-white shadow-sm hover:shadow-lg transition-shadow duration-200">
      <div className="aspect-[16/9] bg-emerald-900 overflow-hidden">
        {r.image ? <img src={fileUrl(r.image)} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          : <div className="w-full h-full flex items-center justify-center"><ChefHat className="w-12 h-12 text-emerald-400" /></div>}
      </div>
      <div className="p-5 flex flex-col justify-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5"><ChefHat className="w-4 h-4" /> Resep Pilihan Minggu Ini</p>
        <h2 className="text-xl font-extrabold tracking-tight mt-1" data-testid="recipe-promo-title">{r.title}</h2>
        <p className="text-sm text-slate-300 mt-1 line-clamp-2">{r.description}</p>
        <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
          <span className="inline-flex items-center gap-1 bg-red-500 text-white font-bold rounded-full px-2.5 py-1" data-testid="recipe-promo-discount"><BadgePercent className="w-3.5 h-3.5" /> Bahan diskon {promo.discount_pct}%</span>
          <span className="inline-flex items-center gap-1 text-slate-300"><Clock className="w-3.5 h-3.5" /> s/d {new Date(promo.ends_on).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-300 group-hover:translate-x-1 transition-transform">Masak sekarang <ArrowRight className="w-4 h-4" /></span>
        </div>
      </div>
    </Link>
  );
};
