import { useImperativeHandle, useRef, forwardRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import type { Evidence } from '../types/evidence';
import { STATUS_COLOR, STATUS_LABEL } from '../types/evidence';
import { getCurrentLocation } from '../services/locationService';
import { EvidenceMarker } from './EvidenceMarker';
import 'leaflet/dist/leaflet.css';

export interface EvidenceMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

interface EvidenceMapProps {
  evidence: Evidence[];
}

export const EvidenceMap = forwardRef<EvidenceMapHandle, EvidenceMapProps>(({ evidence }, ref) => {
  const mapRef = useRef<L.Map>(null);
  const latest = evidence[0];
  const initialCenter: L.LatLngExpression = latest
    ? [Number(latest.latitude), Number(latest.longitude)]
    : [26.1445, 91.7362];

  useImperativeHandle(ref, () => ({
    flyTo(lat: number, lng: number, zoom = 15) {
      mapRef.current?.flyTo([lat, lng], zoom);
    },
  }));

  const showMyLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      mapRef.current?.flyTo([loc.latitude, loc.longitude], 15);
    } catch (e) {
      console.warn('Could not get your location:', e);
    }
  };

  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-b border-line">
        <h2 className="panel-title">Map</h2>
        <button type="button" onClick={showMyLocation} className="btn">
          Go to my location
        </button>
      </div>
      <div className="map-muted relative h-95 lg:h-120">
        <MapContainer center={initialCenter} zoom={12} scrollWheelZoom style={{ height: '100%', width: '100%' }} ref={mapRef}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
          {evidence.map((ev) => (
            <EvidenceMarker key={ev.id} evidence={ev} />
          ))}
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-400 bg-panel/95 border border-line rounded px-2.5 py-1.5 text-[0.8rem] flex gap-3">
          {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[s] }} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
});
