// src/modules/fieldEvidence/components/EvidenceMarker.tsx
import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Evidence } from '../types/evidence';
import { STATUS_COLOR, STATUS_LABEL } from '../types/evidence';

const iconCache = new Map<Evidence['verification_status'], L.DivIcon>();

// A plain filled dot in the status colour, created once per status.
const statusIcon = (status: Evidence['verification_status']) => {
  let icon = iconCache.get(status);
  if (!icon) {
    icon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${STATUS_COLOR[status]};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)"></div>`,
      className: '',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -8],
    });
    iconCache.set(status, icon);
  }
  return icon;
};

export const EvidenceMarker: React.FC<{ evidence: Evidence }> = ({ evidence }) => {
  const lat = Number(evidence.latitude);
  const lng = Number(evidence.longitude);
  if (isNaN(lat) || isNaN(lng)) return null;

  return (
    <Marker position={[lat, lng]} icon={statusIcon(evidence.verification_status)}>
      <Popup>
        <div className="max-w-xs space-y-1 text-[0.85rem]">
          {evidence.photo && (
            <img src={evidence.photo} alt="Report photo" className="w-full max-h-40 object-cover rounded mb-1" />
          )}
          <p className="font-medium">{evidence.category || 'Field report'}</p>
          {evidence.description && <p>{evidence.description}</p>}
          <p className="text-muted">
            {lat.toFixed(5)}, {lng.toFixed(5)} (±{Math.round(Number(evidence.gps_accuracy) || 0)} m)
          </p>
          <p>
            Location check: {STATUS_LABEL[evidence.verification_status]}
            {evidence.verification_reason && ` (${evidence.verification_reason})`}
          </p>
          <p className="text-muted">{evidence.timestamp ? new Date(evidence.timestamp).toLocaleString() : ''}</p>
        </div>
      </Popup>
    </Marker>
  );
};
