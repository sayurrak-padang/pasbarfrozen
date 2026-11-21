import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AddressForm } from "@/components/AddressForm";
import { IncompleteAddressBanner, isAddressIncomplete } from "@/components/ShippingHints";

export default function Addresses() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user]);

  const { data: list = [] } = useQuery({ queryKey: ["addresses"], queryFn: async () => (await api.get("/addresses")).data, enabled: !!user });
  const refresh = () => qc.invalidateQueries({ queryKey: ["addresses"] });
  const incomplete = list.filter(isAddressIncomplete);
  const editId = params.get("edit");
  useEffect(() => {
    const a = editId && list.find((x) => x.address_id === editId);
    if (a) { setEditing(a); setParams({}, { replace: true }); }
  }, [editId, list, setParams]);

  const remove = async (id) => { await api.delete(`/addresses/${id}`); refresh(); toast.success("Alamat dihapus"); };
  const makeDefault = async (a) => { await api.put(`/addresses/${a.address_id}`, { ...a, is_default: true }); refresh(); };

  return (
    <div className="min-h-screen">
      <div className="border-b sticky top-0 z-10 bg-white/70 backdrop-blur-xl border-white/70">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} data-testid="addresses-back" className="p-1"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold flex items-center gap-2 flex-1"><MapPin className="w-5 h-5 text-primary" /> Alamat Saya</h1>
          <button data-testid="add-address-btn" onClick={() => setEditing({})} className="inline-flex items-center gap-1 text-sm font-semibold text-primary"><Plus className="w-4 h-4" /> Tambah</button>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {incomplete.length > 0 && <IncompleteAddressBanner testid="addresses-incomplete-banner" count={incomplete.length} onFix={() => setEditing(incomplete[0])} />}
        {list.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto opacity-30 mb-3" />
            <p>Belum ada alamat tersimpan.</p>
          </div>
        )}
        {list.map((a) => (
          <div key={a.address_id} data-testid={`address-card-${a.address_id}`} className={`bg-white rounded-2xl border-2 p-4 ${a.is_default ? "border-primary" : "border-transparent"}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{a.label}</span>
              {a.is_default && <span className="text-[11px] text-primary font-semibold">Utama</span>}
              <div className="ml-auto flex gap-1">
                {!a.is_default && <button data-testid={`address-default-${a.address_id}`} onClick={() => makeDefault(a)} className="p-1 text-muted-foreground hover:text-amber-500" title="Jadikan utama"><Star className="w-4 h-4" /></button>}
                <button data-testid={`address-edit-${a.address_id}`} onClick={() => setEditing(a)} className="p-1 text-muted-foreground hover:text-primary"><Pencil className="w-4 h-4" /></button>
                <button data-testid={`address-delete-${a.address_id}`} onClick={() => remove(a.address_id)} className="p-1 text-muted-foreground hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="font-semibold text-sm mt-2">{a.name} · {a.phone}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{a.full}{a.detail ? ` (${a.detail})` : ""}</p>
            <p className="text-xs text-muted-foreground" data-testid={`address-region-${a.address_id}`}>{[a.district && `Kec. ${a.district}`, a.city, a.province, a.postal].filter(Boolean).join(", ") || <span className="text-amber-600">Lengkapi kecamatan & kode pos</span>}</p>
            {a.lat != null && <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Pin lokasi tersimpan</p>}
          </div>
        ))}
      </div>
      <AddressForm address={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
    </div>
  );
}
