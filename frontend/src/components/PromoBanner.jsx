import { useEffect, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { api, fileUrl } from "@/lib/api";

const go = (link) => {
  if (!link) return;
  if (link.startsWith("#")) document.getElementById(link.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  else window.open(link, "_blank");
};

export const PromoBanner = () => {
  const { data: banners = [], isLoading } = useQuery({ queryKey: ["banners"], queryFn: async () => (await api.get("/banners")).data });
  const [ref, embla] = useEmblaCarousel({ loop: true });
  const [idx, setIdx] = useState(0);

  const onSelect = useCallback(() => embla && setIdx(embla.selectedScrollSnap()), [embla]);
  useEffect(() => {
    if (!embla) return;
    embla.on("select", onSelect);
    const t = setInterval(() => embla.scrollNext(), 5000);
    return () => { clearInterval(t); embla.off("select", onSelect); };
  }, [embla, onSelect]);

  if (isLoading) return <div className="aspect-[16/7] rounded-3xl bg-slate-200 animate-pulse" data-testid="promo-banner-skeleton" aria-hidden />;
  if (!banners.length) return null;

  return (
    <section className="relative group" data-testid="promo-banner-carousel">
      <div ref={ref} className="overflow-hidden rounded-3xl">
        <div className="flex">
          {banners.map((b) => {
            const light = b.theme === "light";
            return (
              <div key={b.banner_id} className="relative min-w-0 shrink-0 grow-0 basis-full aspect-[16/7]" data-testid={`promo-banner-${b.banner_id}`}>
                <img src={fileUrl(b.image_url)} alt={b.title} className="absolute inset-0 w-full h-full object-cover" />
                <div className={`absolute inset-0 ${light ? "bg-gradient-to-r from-amber-50/90 via-amber-50/40 to-transparent" : "bg-gradient-to-r from-emerald-950/70 via-emerald-900/30 to-transparent"}`} />
                <div className={`relative h-full flex flex-col justify-center px-6 max-w-[70%] ${light ? "text-slate-900" : "text-white"}`}>
                  {b.title && <h3 className="text-xl font-extrabold tracking-tight leading-tight">{b.title}</h3>}
                  {b.subtitle && <p className={`mt-1.5 text-xs ${light ? "text-slate-700" : "text-emerald-50"}`}>{b.subtitle}</p>}
                  {b.cta_label && (
                    <button data-testid={`promo-banner-cta-${b.banner_id}`} onClick={() => go(b.link)}
                      className={`mt-3 self-start inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-transform hover:translate-x-0.5 ${light ? "bg-slate-900 text-white" : "bg-white text-emerald-700"}`}>
                      {b.cta_label} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {banners.length > 1 && (
        <>
          <button data-testid="promo-banner-prev" onClick={() => embla?.scrollPrev()} className="hidden absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft className="w-5 h-5" /></button>
          <button data-testid="promo-banner-next" onClick={() => embla?.scrollNext()} className="hidden absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight className="w-5 h-5" /></button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {banners.map((b, i) => (
              <button key={b.banner_id} data-testid={`promo-banner-dot-${i}`} onClick={() => embla?.scrollTo(i)}
                className={`h-1.5 rounded-full transition-[width,background-color] ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};
