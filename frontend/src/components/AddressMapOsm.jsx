import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Search, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { BRAND } from "@/config/brand";

L.Marker.prototype.options.icon = L.icon({ iconUrl, iconRetinaUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41] });

const PADANG = BRAND.city.mapCenter; // titik tengah kota layanan
const NOMINATIM = "https://nominatim.openstreetmap.org";

const reverse = async (lat, lng) => {
  const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`);
  return r.json();
};

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

function Recenter({ pos }) {
  const map = useMap();
  const [la, ln] = pos;
  useEffect(() => { map.setView([la, ln], Math.max(map.getZoom(), 16)); }, [map, la, ln]);
  return null;
}

export const OsmAddressMap = ({ lat, lng, onChange, hideSearch = false }) => {
  const pos = lat != null && lng != null ? [Number(lat), Number(lng)] : PADANG;
  const [q, setQ] = useState("");

  const pick = async (la, ln) => {
    onChange({ lat: la, lng: ln });
    try {
      const d = await reverse(la, ln);
      onChange({ lat: la, lng: ln, full: d.display_name, postal: d.address?.postcode || "" });
    } catch (e) {
      console.warn("Reverse geocode failed", e);
      toast.info("Alamat otomatis tidak ditemukan, titik lokasi tetap tersimpan");
    }
  };

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    const r = await fetch(`${NOMINATIM}/search?format=jsonv2&limit=1&countrycodes=id&accept-language=id&q=${encodeURIComponent(q)}`);
    const [hit] = await r.json();
    if (!hit) { toast.error("Lokasi tidak ditemukan"); return; }
    pick(Number(hit.lat), Number(hit.lon));
  };

  const locate = () => {
    if (!navigator.geolocation) { toast.error("GPS tidak didukung"); return; }
    navigator.geolocation.getCurrentPosition((p) => pick(p.coords.latitude, p.coords.longitude), () => toast.error("Izin lokasi ditolak"));
  };

  return (
    <div className="space-y-2" data-testid="address-map">
      {!hideSearch && <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input data-testid="map-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari jalan / kelurahan..." className="w-full h-9 pl-9 pr-3 rounded-xl border text-sm outline-none focus:border-primary" />
        </div>
        <button type="submit" data-testid="map-search-btn" className="h-9 px-3 rounded-xl bg-primary text-white text-sm font-medium">Cari</button>
        <button type="button" data-testid="map-locate-btn" onClick={locate} className="h-9 w-9 rounded-xl border flex items-center justify-center hover:border-primary" title="Lokasi saya"><LocateFixed className="w-4 h-4 text-primary" /></button>
      </form>}
      {hideSearch && <button type="button" data-testid="map-locate-btn" onClick={locate} className="h-8 px-3 rounded-xl border text-xs flex items-center gap-1.5 hover:border-primary"><LocateFixed className="w-3.5 h-3.5 text-primary" /> Pakai lokasi saya sekarang</button>}
      <div className="h-56 rounded-xl overflow-hidden border relative z-0" data-testid="osm-map">
        <MapContainer center={pos} zoom={14} className="h-full w-full">
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onPick={pick} />
          <Recenter pos={pos} />
          {lat != null && <Marker position={pos} draggable eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); pick(p.lat, p.lng); } }} />}
        </MapContainer>
      </div>
      <p className="text-[11px] text-muted-foreground">Ketuk peta atau geser pin untuk menandai lokasi pengiriman.</p>
    </div>
  );
};
