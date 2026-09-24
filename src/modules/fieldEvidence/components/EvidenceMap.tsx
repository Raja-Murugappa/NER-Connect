import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import type { Evidence } from '../types/evidence';
import { getAllEvidence } from '../services/databaseService';
import { getCurrentLocation } from '../services/locationService';
import { EvidenceMarker } from './EvidenceMarker';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon path
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export interface EvidenceMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

export const EvidenceMap = forwardRef<EvidenceMapHandle>((_, ref) => {
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [center, setCenter] = useState<L.LatLngExpression>([26.1445, 91.7362]);
  const mapRef = useRef<L.Map>(null);

  const loadEvidence = async () => {
    try {
      const data = await getAllEvidence();
      setEvidence(data);
      if (data.length > 0) {
        const latest = data[0];
        setCenter([latest.latitude, latest.longitude]);
      }
    } catch (e) {
      console.warn('Failed to load evidence:', e);
    }
  };

  useEffect(() => {
    loadEvidence();
  }, []);

  const handleMyLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      const pos: L.LatLngExpression = [loc.latitude, loc.longitude];
      setCenter(pos);
      if (mapRef.current) {
        mapRef.current.flyTo(pos, 15);
      }
    } catch (e) {
      console.warn('Could not locate user:', e);
    }
  };

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lng: number, zoom = 15) {
      if (mapRef.current) {
        mapRef.current.flyTo([lat, lng], zoom);
      }
      loadEvidence();
    },
  }));

  return (
    <div className="ner-card overflow-hidden flex flex-col h-full">
      <div className="ner-card-header bg-[#f8faf8]">
        <div>
          <span className="ner-heading flex items-center gap-1.5 text-xs">
            <span>🗺️</span> 2. Geospatial Evidence GIS Map
          </span>
          <p className="text-[11px] text-gray-500">Live Pins Placed on Exact Coordinates</p>
        </div>
        <button
          type="button"
          onClick={handleMyLocation}
          className="bg-white hover:bg-gray-100 text-[#1b4332] border border-[#d1d5db] px-2.5 py-1 rounded text-xs font-semibold shadow-2xs transition flex items-center gap-1"
        >
          <span>🎯</span>
          <span>My GPS Location</span>
        </button>
      </div>

      <div className="h-[480px] w-full relative">
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {evidence.map((ev) => (
            <EvidenceMarker key={ev.id} evidence={ev} />
          ))}
        </MapContainer>

        {/* Legend Overlay */}
        <div className="absolute bottom-2 left-2 z-[400] bg-white/95 border border-[#d1d5db] px-3 py-1.5 rounded shadow-sm flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-700">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> VERIFIED
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> PENDING
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> FLAGGED
          </div>
        </div>
      </div>
    </div>
  );
});
