import { useEffect, useState } from "react";
import { MapPinned, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";

const fromArea = (a) => ({
  area_id: a.id, district: a.administrative_division_level_3_name || "", city: a.administrative_division_level_2_name || "",
  province: a.administrative_division_level_1_name || "", postal: a.postal_code ? String(a.postal_code) : "",
});

const AreaSearch = ({ onPick, testid }) => {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  useEffect(() => {
    if (q.trim().length < 3) { setHits([]); return undefined; }
    const t = setTimeout(() => {
      api.get("/shipping/areas", { params: { q } }).then(({ data }) => setHits(data.slice(0, 8))).catch((e) => console.warn("Area search failed", e));
    }, 400);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input data-testid={`${testid}-search`} className="pl-9" placeholder="Cari kecamatan / kelurahan (mis. Pasaman, Pasaman Barat)" value={q} onChange={(e) => setQ(e.target.value)} />
      {hits.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-xl shadow-lg max-h-56 overflow-y-auto" data-testid={`${testid}-results`}>
          {hits.map((a) => (
            <button type="button" key={a.id} data-testid={`${testid}-option-${a.id}`} onClick={() => { onPick(fromArea(a)); setQ(""); setHits([]); }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-emerald-50 flex items-start gap-2 border-b last:border-0">
              <MapPinned className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" /><span>{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const geocodeArea = async (a) => {
  const q = [a.district, a.city, a.province].filter(Boolean).join(", ");
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(q)}`);
  const [hit] = await r.json();
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
};

export const RegionFields = ({ value, onChange, testid = "region", required = false, locate = false }) => {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value, ...(k !== "detail" ? { area_id: "" } : {}) });
  const pickArea = async (a) => {
    onChange({ ...value, ...a });
    if (!locate) return;
    try {
      const pos = await geocodeArea(a);
      if (pos) onChange({ ...value, ...a, ...pos });
    } catch (e) { console.warn("Geocode wilayah gagal", e); }
  };
  return (
    <div className="space-y-2 rounded-xl border border-dashed p-3 bg-slate-50/60" data-testid={testid}>
      <p className="text-[11px] font-semibold text-slate-600">1. Cari wilayah {required && <span className="text-red-500">* wajib</span>}</p>
      <AreaSearch testid={testid} onPick={pickArea} />
      {locate && <p className="text-[10px] text-muted-foreground">Kecamatan, kota, provinsi & kode pos terisi otomatis, lalu peta pindah ke wilayah tersebut.</p>}
      <div className="grid grid-cols-2 gap-2">
        <Input data-testid={`${testid}-district`} placeholder="Kecamatan" value={value.district || ""} onChange={set("district")} />
        <Input data-testid={`${testid}-city`} placeholder="Kota / Kabupaten" value={value.city || ""} onChange={set("city")} />
        <Input data-testid={`${testid}-province`} placeholder="Provinsi" value={value.province || ""} onChange={set("province")} />
        <Input data-testid={`${testid}-postal`} placeholder="Kode pos" maxLength={5} value={value.postal || ""} onChange={set("postal")} />
      </div>
      <Input data-testid={`${testid}-detail`} placeholder="Detail: RT/RW, no. rumah, patokan" value={value.detail || ""} onChange={set("detail")} />
      {value.area_id && <p className="text-[10px] text-emerald-700" data-testid={`${testid}-area-ok`}>✓ Wilayah terverifikasi Biteship</p>}
    </div>
  );
};
