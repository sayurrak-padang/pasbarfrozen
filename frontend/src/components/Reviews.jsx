import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, ImagePlus, X, MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BRAND } from "@/config/brand";

export const Stars = ({ value, onChange, size = "w-4 h-4", testid }) => (
  <div className="flex items-center gap-0.5" data-testid={testid}>
    {[1, 2, 3, 4, 5].map((n) => {
      const cls = `${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`;
      return onChange ? (
        <button key={n} type="button" aria-label={`${n} bintang`} data-testid={`${testid}-${n}`} onClick={() => onChange(n)}
          className="transition-transform duration-150 hover:scale-110 active:scale-95"><Star className={cls} /></button>
      ) : <Star key={n} className={cls} />;
    })}
  </div>
);

const PhotoPicker = ({ photos, setPhotos }) => {
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try { const { data } = await api.post("/reviews/upload", fd); setPhotos([...photos, data.url].slice(0, 4)); }
    catch (err) { toast.error(err.response?.data?.detail || "Gagal mengunggah"); }
    e.target.value = "";
  };
  return (
    <div className="flex gap-2 flex-wrap">
      {photos.map((p) => (
        <span key={p} className="relative"><img src={fileUrl(p)} alt="" className="w-16 h-16 rounded-lg object-cover" />
          <button type="button" onClick={() => setPhotos(photos.filter((x) => x !== p))} className="absolute -top-1 -right-1 bg-white rounded-full shadow" aria-label="Hapus foto"><X className="w-3 h-3" /></button></span>
      ))}
      {photos.length < 4 && (
        <label className="w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer hover:border-primary" data-testid="review-photo-label">
          <ImagePlus className="w-5 h-5 text-muted-foreground" /><input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={upload} data-testid="review-photo-input" />
        </label>
      )}
    </div>
  );
};

const ItemReviewForm = ({ order, item, onDone }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${order.order_id}/reviews`, { product_id: item.product_id, rating, comment, images: photos });
      toast.success("Terima kasih atas ulasannya!");
      onDone();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal mengirim ulasan"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2" data-testid={`review-form-${item.product_id}`}>
      <Stars value={rating} onChange={setRating} size="w-7 h-7" testid={`review-stars-${item.product_id}`} />
      <Textarea data-testid={`review-comment-${item.product_id}`} placeholder="Bagaimana kualitas & kesegaran produknya?" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
      <PhotoPicker photos={photos} setPhotos={setPhotos} />
      <Button size="sm" className="rounded-full" disabled={busy} onClick={submit} data-testid={`review-submit-${item.product_id}`}>Kirim Ulasan</Button>
    </div>
  );
};

export const ReviewDialog = ({ order, open, onClose }) => {
  const qc = useQueryClient();
  const key = ["order-reviews", order.order_id];
  const { data: mine = [] } = useQuery({ queryKey: key, queryFn: async () => (await api.get(`/orders/${order.order_id}/reviews`)).data, enabled: open });
  const [active, setActive] = useState(null);
  const done = new Set(mine.map((r) => r.product_id));
  const items = order.items.filter((i, idx, arr) => arr.findIndex((x) => x.product_id === i.product_id) === idx);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" aria-describedby={undefined} data-testid="review-dialog">
        <DialogHeader><DialogTitle>Ulas Produk Pesanan {order.order_id}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.product_id} className="rounded-xl border p-3">
              <div className="flex items-center gap-3">
                <img src={i.image} alt="" className="w-12 h-12 rounded-lg object-cover" />
                <p className="text-sm font-medium flex-1 line-clamp-2">{i.name}</p>
                {done.has(i.product_id) ? <span className="text-xs text-emerald-700 font-semibold" data-testid={`reviewed-${i.product_id}`}>Sudah diulas</span> : active !== i.product_id && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setActive(i.product_id)} data-testid={`review-open-${i.product_id}`}>Ulas</Button>
                )}
              </div>
              {active === i.product_id && !done.has(i.product_id) && (
                <div className="mt-3"><ItemReviewForm order={order} item={i} onDone={() => { setActive(null); qc.invalidateQueries({ queryKey: key }); }} /></div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const ReviewItem = ({ r, children }) => (
  <div className="py-3 border-b last:border-0" data-testid={`review-${r.review_id}`}>
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">{r.user_name?.[0]?.toUpperCase()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{r.user_name}{r.variant_name ? <span className="font-normal text-muted-foreground"> · {r.variant_name}</span> : null}</p>
        <Stars value={r.rating} size="w-3 h-3" />
      </div>
      <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
    </div>
    {r.comment && <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-wrap">{r.comment}</p>}
    {r.images?.length > 0 && (
      <div className="flex gap-1.5 mt-2">{r.images.map((u) => <a key={u} href={fileUrl(u)} target="_blank" rel="noreferrer"><img src={fileUrl(u)} alt="" className="w-14 h-14 rounded-lg object-cover" /></a>)}</div>
    )}
    {r.reply && (
      <div className="mt-2 ml-4 rounded-lg bg-emerald-50 border border-emerald-100 p-2 text-xs" data-testid={`review-reply-${r.review_id}`}>
        <p className="font-semibold text-emerald-800 flex items-center gap-1"><MessageSquareReply className="w-3 h-3" /> Balasan {BRAND.name}</p>
        <p className="text-slate-700 mt-0.5">{r.reply}</p>
      </div>
    )}
    {children}
  </div>
);

export const ProductReviews = ({ productId }) => {
  const { data } = useQuery({ queryKey: ["product-reviews", productId], queryFn: async () => (await api.get(`/products/${productId}/reviews`)).data, enabled: !!productId });
  if (!data) return null;
  return (
    <section className="px-5 pb-5 border-t pt-4" data-testid="product-reviews">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-bold text-sm">Ulasan Pembeli</h3>
        {data.count > 0 && <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid="product-reviews-summary"><Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {data.avg} · {data.count} ulasan</span>}
      </div>
      {data.count === 0 ? <p className="text-xs text-muted-foreground" data-testid="product-reviews-empty">Belum ada ulasan untuk produk ini.</p>
        : data.items.slice(0, 10).map((r) => <ReviewItem key={r.review_id} r={r} />)}
    </section>
  );
};
