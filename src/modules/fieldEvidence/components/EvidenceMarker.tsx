// src/modules/fieldEvidence/components/EvidenceMarker.tsx
import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Evidence } from '../types/evidence';

// Create a local, modern SVG-based pin icon that doesn't depend on external services
const getStatusIcon = (status: Evidence['verification_status']) => {
  const color =
    status === 'VERIFIED' ? '#10b981' : status === 'PENDING' ? '#f59e0b' : '#ef4444';

  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="#ffffff"/>
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-evidence-marker',
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -38],
  });
};

export const EvidenceMarker: React.FC<{ evidence: Evidence }> = ({ evidence }) => {
  const lat = Number(evidence.latitude);
  const lng = Number(evidence.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  const position: L.LatLngExpression = [lat, lng];

  return (
    <Marker position={position} icon={getStatusIcon(evidence.verification_status)}>
      <Popup>
        <div className="max-w-xs text-xs space-y-1.5 p-1">
          {evidence.photo && (
            <img
              src={evidence.photo}
              alt="Evidence"
              className="w-full max-h-40 object-cover mb-2 rounded border border-gray-200"
            />
          )}
          <p className="font-bold text-sm text-gray-900">{evidence.category || 'Field Evidence'}</p>
          {evidence.description && (
            <p className="text-gray-700 bg-gray-50 p-1.5 rounded">{evidence.description}</p>
          )}
          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-gray-200 text-gray-600">
            <div>
              <strong>Lat:</strong> {lat.toFixed(5)}°
            </div>
            <div>
              <strong>Lng:</strong> {lng.toFixed(5)}°
            </div>
          </div>
          <div className="text-gray-600">
            <strong>Accuracy:</strong> ±{Math.round(Number(evidence.gps_accuracy) || 0)}m
          </div>
          <div className="flex items-center gap-1 font-semibold">
            <span>Status:</span>
            <span
              className={
                evidence.verification_status === 'VERIFIED'
                  ? 'text-emerald-600'
                  : evidence.verification_status === 'PENDING'
                  ? 'text-amber-600'
                  : 'text-red-600'
              }
            >
              {evidence.verification_status}
            </span>
          </div>
          <div className="text-gray-500 text-[10px]">
            {evidence.timestamp ? new Date(evidence.timestamp).toLocaleString() : 'N/A'}
          </div>
          {evidence.verification_reason && (
            <p className="text-[11px] text-amber-700 italic bg-amber-50 p-1 rounded">
              {evidence.verification_reason}
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
};
