import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReviewItem } from "@/components/Reviews";

const ReplyBox = ({ r, onSaved }) => {
  const [text, setText] = useState(r.reply || "");
  const save = async (patch) => {
    try { await api.patch(`/admin/reviews/${r.review_id}`, patch); toast.success("Ulasan diperbarui"); onSaved(); }
    catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };
  return (
    <div className="mt-2 flex flex-col sm:flex-row gap-2">
      <Textarea data-testid={`review-reply-input-${r.review_id}`} rows={1} placeholder="Tulis balasan untuk pembeli..." value={text} onChange={(e) => setText(e.target.value)} className="text-sm" />
      <div className="flex gap-2 shrink-0">
        <Button size="sm" onClick={() => save({ reply: text })} data-testid={`review-reply-save-${r.review_id}`}>Balas</Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => save({ hidden: !r.hidden })} data-testid={`review-toggle-${r.review_id}`}>
          {r.hidden ? <><Eye className="w-4 h-4" /> Tampilkan</> : <><EyeOff className="w-4 h-4" /> Sembunyikan</>}
        </Button>
      </div>
    </div>
  );
};

export const AdminReviews = () => {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const { data: reviews = [] } = useQuery({ queryKey: ["admin-reviews"], queryFn: async () => (await api.get("/admin/reviews")).data });
  const list = reviews.filter((r) => (filter === "all" ? true : filter === "hidden" ? r.hidden : filter === "noreply" ? !r.reply : r.rating <= 3));
  const FILTERS = [["all", "Semua"], ["noreply", "Belum dibalas"], ["low", "Rating ≤ 3"], ["hidden", "Disembunyikan"]];
  return (
    <div data-testid="admin-reviews">
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`review-filter-${k}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filter === k ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:border-slate-400"}`}>{l}</button>
        ))}
      </div>
      <div className="bg-white rounded-xl border px-4">
        {list.length === 0 ? <p className="text-sm text-muted-foreground py-10 text-center" data-testid="admin-reviews-empty">Belum ada ulasan.</p> : list.map((r) => (
          <div key={r.review_id} className={r.hidden ? "opacity-60" : ""}>
            <p className="text-[11px] text-slate-500 pt-3">{r.product_name} · {r.order_id}{r.hidden && <b className="text-red-600"> · disembunyikan</b>}</p>
            <ReviewItem r={r}><ReplyBox r={r} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-reviews"] })} /></ReviewItem>
          </div>
        ))}
      </div>
    </div>
  );
};
