import { useEffect, useMemo, useState } from "react";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Search, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { OsmAddressMap } from "@/components/AddressMapOsm";
import { MAP_CENTER } from "@/config/brand";

const KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const PADANG = MAP_CENTER; // titik tengah kota layanan (brand.config.json > city.mapCenter)

const toResult = (r) => ({
  full: r.formatted_address,
  postal: r.address_components.find((c) => c.types.includes("postal_code"))?.long_name || "",
});

const Recenter = ({ pos }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo(pos);
    if ((map.getZoom() || 0) < 16) map.setZoom(17);
  }, [map, pos]);
  return null;
};

const MapInner = ({ lat, lng, onChange, hideSearch = false }) => {
  const geoLib = useMapsLibrary("geocoding");
  const geocoder = useMemo(() => geoLib && new geoLib.Geocoder(), [geoLib]);
  const [q, setQ] = useState("");
  const has = lat != null && lng != null;
  const pos = useMemo(() => (has ? { lat: Number(lat), lng: Number(lng) } : PADANG), [has, lat, lng]);

  const pick = async (la, ln) => {
    onChange({ lat: la, lng: ln });
    if (!geocoder) return;
    try {
      const { results } = await geocoder.geocode({ location: { lat: la, lng: ln }, language: "id" });
      if (results[0]) onChange({ lat: la, lng: ln, ...toResult(results[0]) });
    } catch (e) {
      console.warn("Reverse geocode failed", e);
      toast.info("Alamat otomatis tidak ditemukan, titik lokasi tetap tersimpan");
    }
  };

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim() || !geocoder) return;
    try {
      const { results } = await geocoder.geocode({ address: q, region: "id", language: "id", componentRestrictions: { country: "ID" },
        bounds: { north: -0.75, south: -1.15, east: 100.6, west: 100.25 } });
      const hit = results[0];
      if (!hit) { toast.error("Lokasi tidak ditemukan"); return; }
      const loc = hit.geometry.location;
      onChange({ lat: loc.lat(), lng: loc.lng(), ...toResult(hit) });
    } catch (err) {
      console.warn("Geocode failed", err);
      toast.error("Lokasi tidak ditemukan");
    }
  };

  const locate = () => {
    if (!navigator.geolocation) { toast.error("GPS tidak didukung"); return; }
    navigator.geolocation.getCurrentPosition((p) => pick(p.coords.latitude, p.coords.longitude), () => toast.error("Izin lokasi ditolak"),
      { enableHighAccuracy: true, timeout: 15000 });
  };

  return (
    <div className="space-y-2" data-testid="address-map">
      {!hideSearch && <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input data-testid="map-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari jalan / gedung / kelurahan..." className="w-full h-9 pl-9 pr-3 rounded-xl border text-sm outline-none focus:border-primary" />
        </div>
        <button type="submit" data-testid="map-search-btn" className="h-9 px-3 rounded-xl bg-primary text-white text-sm font-medium">Cari</button>
        <button type="button" data-testid="map-locate-btn" onClick={locate} className="h-9 w-9 rounded-xl border flex items-center justify-center hover:border-primary" title="Lokasi saya"><LocateFixed className="w-4 h-4 text-primary" /></button>
      </form>}
      {hideSearch && <button type="button" data-testid="map-locate-btn" onClick={locate} className="h-8 px-3 rounded-xl border text-xs flex items-center gap-1.5 hover:border-primary"><LocateFixed className="w-3.5 h-3.5 text-primary" /> Pakai lokasi saya sekarang</button>}
      <div className="h-56 rounded-xl overflow-hidden border relative z-0" data-testid="google-map">
        <Map defaultCenter={pos} defaultZoom={has ? 17 : 14} gestureHandling="greedy" disableDefaultUI zoomControl clickableIcons={false}
          onClick={(e) => e.detail.latLng && pick(e.detail.latLng.lat, e.detail.latLng.lng)}>
          <Recenter pos={pos} />
          {has && <Marker position={pos} draggable onDragEnd={(e) => e.latLng && pick(e.latLng.lat(), e.latLng.lng())} />}
        </Map>
      </div>
      <p className="text-[11px] text-muted-foreground">Ketuk peta atau geser pin untuk menandai lokasi dengan tepat (Google Maps).</p>
    </div>
  );
};

let googleFailed = !KEY;
const failListeners = new Set();
window.gm_authFailure = () => { googleFailed = true; failListeners.forEach((f) => f()); };

export const AddressMap = (props) => {
  const [failed, setFailed] = useState(googleFailed);
  useEffect(() => {
    const f = () => setFailed(true);
    failListeners.add(f);
    return () => failListeners.delete(f);
  }, []);
  if (failed) return <OsmAddressMap {...props} />;
  return (
    <APIProvider apiKey={KEY} language="id" region="ID" onError={() => setFailed(true)}>
      <MapInner {...props} />
    </APIProvider>
  );
};
