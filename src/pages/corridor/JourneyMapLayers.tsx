// src/pages/corridor/JourneyMapLayers.tsx
// Map overlays for the journey simulation. Rendered inside the corridor MapContainer.
import React, { useEffect } from 'react';
import { Circle, Marker, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { Disruption, RerouteResult } from '../../services/corridorApi';
import { disruptionIcon, divergenceIcon, holdIcon, reportedSpotIcon, truckIcon } from './mapIcons';
import { detourLabel, RISK_COLOR, ROUTE_COLOR, TRAVELLED_COLOR } from './risk';

interface JourneyMapLayersProps {
  routeLine: [number, number][];
  truckIndex: number;
  truckKm: number;
  /** Travelled parts of routes the truck followed before a reroute. */
  previousTrails: [number, number][][];
  /** Parts of earlier routes that were given up after a reroute. */
  abandoned: [number, number][][];
  disruption: Disruption | null;
  reroute: RerouteResult | null;
  selectedAltId: string | null;
  onSelectAlt: (id: string) => void;
  placing: boolean;
  onMapClick: (lat: number, lon: number) => void;
}

const ClickToPlace: React.FC<{ placing: boolean; onMapClick: (lat: number, lon: number) => void }> = ({
  placing,
  onMapClick,
}) => {
  const map = useMap();
  useEffect(() => {
    map.getContainer().style.cursor = placing ? 'crosshair' : '';
  }, [map, placing]);
  useMapEvents({
    click(e) {
      if (placing) onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

export const JourneyMapLayers: React.FC<JourneyMapLayersProps> = ({
  routeLine,
  truckIndex,
  truckKm,
  previousTrails,
  abandoned,
  disruption,
  reroute,
  selectedAltId,
  onSelectAlt,
  placing,
  onMapClick,
}) => {
  const travelled = routeLine.slice(0, truckIndex + 1);
  const truckPos = routeLine[truckIndex];
  const alternatives = reroute?.status === 'REROUTE_AVAILABLE' ? reroute.alternatives : [];
  const showHold = reroute?.status === 'NO_ALTERNATIVE' || reroute?.status === 'ROUTING_UNAVAILABLE';
  const selectedAlt = alternatives.find((a) => a.id === selectedAltId);

  return (
    <>
      <ClickToPlace placing={placing} onMapClick={onMapClick} />

      {abandoned.map((line, i) => (
        <Polyline key={`ab-${i}`} positions={line} pathOptions={{ color: TRAVELLED_COLOR, weight: 4, opacity: 0.6, dashArray: '6 8' }} />
      ))}
      {previousTrails.map((line, i) => (
        <Polyline key={`tr-${i}`} positions={line} pathOptions={{ color: TRAVELLED_COLOR, weight: 6 }} />
      ))}
      {travelled.length > 1 && <Polyline positions={travelled} pathOptions={{ color: TRAVELLED_COLOR, weight: 6 }} />}

      {/* Proposed detours: unselected first so the selected one draws on top */}
      {alternatives
        .filter((alt) => alt.id !== selectedAltId)
        .map((alt) => (
          <Polyline
            key={alt.id}
            positions={alt.polyline}
            pathOptions={{ color: ROUTE_COLOR, weight: 4, opacity: 0.55, dashArray: '8 6' }}
            eventHandlers={{ click: () => onSelectAlt(alt.id) }}
          >
            <Tooltip sticky>{detourLabel(alt.id)}. Click to select.</Tooltip>
          </Polyline>
        ))}
      {selectedAlt && (
        <>
          <Polyline positions={selectedAlt.polyline} pathOptions={{ color: ROUTE_COLOR, weight: 6, opacity: 0.95 }}>
            <Tooltip sticky>
              {detourLabel(selectedAlt.id)}: {selectedAlt.distance_km.toFixed(0)} km, {selectedAlt.eta}
            </Tooltip>
          </Polyline>
          <Marker position={selectedAlt.divergence_point} icon={divergenceIcon}>
            <Popup>{detourLabel(selectedAlt.id)} leaves the current road here.</Popup>
          </Marker>
        </>
      )}

      {disruption && (
        <>
          {reroute && reroute.affected_polyline.length > 1 && (
            <Polyline
              positions={reroute.affected_polyline}
              pathOptions={{ color: RISK_COLOR.danger, weight: 8, dashArray: disruption.severity === 'blocked' ? '4 6' : undefined }}
            />
          )}
          <Circle
            center={[disruption.lat, disruption.lon]}
            radius={disruption.radius_km * 1000}
            pathOptions={{
              color: disruption.severity === 'blocked' ? RISK_COLOR.danger : RISK_COLOR.caution,
              weight: 1.5,
              fillOpacity: 0.15,
            }}
          />
          <Marker position={[disruption.lat, disruption.lon]} icon={disruptionIcon}>
            <Popup>
              {reroute?.disruption.label ?? 'Disruption'}: {disruption.severity === 'blocked' ? 'road blocked' : 'slow down'}
              , {disruption.radius_km} km radius
              {reroute?.disruption_km !== undefined && `, route km ${reroute.disruption_km.toFixed(0)}`}
            </Popup>
          </Marker>
        </>
      )}

      {reroute?.relocated_from && (
        <Marker position={[reroute.relocated_from.lat, reroute.relocated_from.lon]} icon={reportedSpotIcon}>
          <Popup>
            Originally placed here (km {reroute.relocated_from.km.toFixed(0)}). No road detour exists at this spot, so
            the simulated disruption was moved to the nearest spot that has one.
          </Popup>
        </Marker>
      )}

      {showHold && reroute?.hold_point && (
        <Marker position={reroute.hold_point.coords} icon={holdIcon}>
          <Popup>
            Hold point: {reroute.hold_point.name} (km {reroute.hold_point.km.toFixed(0)})
          </Popup>
        </Marker>
      )}

      {truckPos && (
        <Marker position={truckPos} icon={truckIcon} zIndexOffset={1000}>
          <Popup>Simulated vehicle, route km {truckKm.toFixed(0)}</Popup>
        </Marker>
      )}
    </>
  );
};
