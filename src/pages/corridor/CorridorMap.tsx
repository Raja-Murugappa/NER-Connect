// src/pages/corridor/CorridorMap.tsx
import React, { memo, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, ScaleControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Location, RouteLandmark, SectorCard } from '../../services/corridorApi';
import type { RouteOption } from './RouteOptionsList';
import type { SectorCause } from './mapIcons';
import {
  boundaryIcon,
  bridgeIcon,
  distanceIcon,
  endIcon,
  junctionIcon,
  placeLabelIcon,
  sectorCauseIcon,
  startIcon,
} from './mapIcons';
import { distanceMarkers } from './routeMath';
import {
  OTHER_ROUTE_COLOR,
  RISK_COLOR,
  RISK_WORD,
  ROUTE_COLOR,
  sectorCause,
  segmentSplitReason,
  TRAVELLED_COLOR,
} from './risk';

interface CorridorMapProps {
  origin: Location;
  destination: Location;
  /** The route drawn in risk colours (selected option, or the journey's active route). */
  sectors: SectorCard[];
  line: [number, number][];
  junctions: RouteLandmark[];
  bridges: RouteLandmark[];
  /** Other route options, drawn grey and clickable (planning only). */
  otherOptions: RouteOption[];
  onSelectOption: (id: string) => void;
  dashed: boolean;
  /** Points the map should frame; changes re-frame the map. */
  fitPoints: [number, number][];
  journeyActive: boolean;
  placingDisruption: boolean;
  children?: React.ReactNode;
}

const FitToPoints: React.FC<{ points: [number, number][] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }, [map, points]);
  return null;
};

// Everything that doesn't change while the simulated truck moves; memoised so playback
// only re-renders the journey overlay.
const BaseLayers = memo(
  ({
    origin,
    destination,
    sectors,
    line,
    junctions,
    bridges,
    otherOptions,
    onSelectOption,
    dashed,
  }: Omit<CorridorMapProps, 'fitPoints' | 'journeyActive' | 'placingDisruption' | 'children'>) => {
    const routeLine = sectors.length > 0 ? sectors.flatMap((s) => s.polyline) : line;
    const marks = useMemo(() => distanceMarkers(routeLine), [routeLine]);
    const startPos: [number, number] = [origin.lat, origin.lon];
    const destPos: [number, number] = [destination.lat, destination.lon];

    return (
      <>
        {otherOptions.map((o) => (
          <Polyline
            key={o.id}
            positions={o.polyline}
            pathOptions={{ color: OTHER_ROUTE_COLOR, weight: 4, opacity: 0.8, dashArray: '6 6' }}
            eventHandlers={{ click: () => onSelectOption(o.id) }}
          >
            <Tooltip sticky>
              Route {o.id}: {o.distance_km.toFixed(0)} km, {o.eta}. Click to select.
            </Tooltip>
          </Polyline>
        ))}

        {/* A light casing under the selected route keeps it legible over busy map detail,
            the way a printed road map outlines its highways. */}
        {routeLine.length > 1 && (
          <Polyline positions={routeLine} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
        )}

        {sectors.length > 0
          ? sectors.map((sec, i) =>
              sec.polyline.length > 1 ? (
                <Polyline
                  key={`${sec.segment_id}-${i}`}
                  positions={sec.polyline}
                  pathOptions={{ color: RISK_COLOR[sec.risk_level], weight: 5, opacity: 0.95, dashArray: dashed ? '8 8' : undefined }}
                >
                  <Tooltip sticky>
                    Sector {i + 1}: {RISK_WORD[sec.risk_level].toLowerCase()} risk, {sec.distance_km} km, {sec.eta}
                  </Tooltip>
                </Polyline>
              ) : null
            )
          : line.length > 1 && (
              <Polyline positions={line} pathOptions={{ color: ROUTE_COLOR, weight: 5, dashArray: dashed ? '8 8' : undefined }} />
            )}

        {/* Sector markers: the number matches the "#" column of the sector table below the
            map, and the outline shape shows why that stretch is its own sector (see the
            legend). Click one for the full reason. */}
        {sectors.map((sec, i) => {
          const mid = sec.polyline[Math.floor(sec.polyline.length / 2)];
          return mid ? (
            <Marker
              key={`secnum-${sec.segment_id}-${i}`}
              position={mid}
              icon={sectorCauseIcon(i + 1, sectorCause(sectors, i))}
              zIndexOffset={300}
            >
              <Tooltip>Click for why this is a separate sector</Tooltip>
              <Popup>
                <div className="space-y-0.5">
                  <p className="font-medium">
                    Sector {i + 1}: {sec.segment_type}
                  </p>
                  <p>{segmentSplitReason(sectors, i)}</p>
                </div>
              </Popup>
            </Marker>
          ) : null;
        })}

        {/* Running distance along the route, like markers on a printed highway map. */}
        {marks.map((m) => (
          <Marker key={`dist-${m.km}`} position={m.point} icon={distanceIcon(m.km)} interactive={false} />
        ))}

        {/* Where and why each sector is cut - a checkpost, a junction that could be used to
            divert traffic, a bridge, or (if nothing was nearby) the planned distance. */}
        {sectors.map((sec, i) =>
          sec.boundary ? (
            <Marker
              key={`boundary-${sec.segment_id}-${i}`}
              position={sec.boundary.coords}
              icon={boundaryIcon}
              zIndexOffset={500}
            >
              <Popup>
                <div className="space-y-0.5">
                  <p className="font-medium">
                    Sector {i + 1} ends here: {sec.boundary.type}
                    {sec.boundary.name && ` — ${sec.boundary.name}`}
                  </p>
                  <p>{sec.boundary.reason}</p>
                </div>
              </Popup>
            </Marker>
          ) : null
        )}

        {junctions.map((j, i) => (
          <Marker key={`j-${i}`} position={j.coords} icon={junctionIcon}>
            <Popup>{j.name}</Popup>
          </Marker>
        ))}
        {bridges.map((b, i) => (
          <Marker key={`b-${i}`} position={b.coords} icon={bridgeIcon}>
            <Popup>Bridge: {b.name}</Popup>
          </Marker>
        ))}

        <Marker position={startPos} icon={startIcon}>
          <Popup>Start: {origin.display_name ?? origin.name}</Popup>
        </Marker>
        <Marker position={startPos} icon={placeLabelIcon(origin.name)} interactive={false} />
        <Marker position={destPos} icon={endIcon}>
          <Popup>Destination: {destination.display_name ?? destination.name}</Popup>
        </Marker>
        <Marker position={destPos} icon={placeLabelIcon(destination.name)} interactive={false} />
      </>
    );
  }
);

const LegendLine: React.FC<{ color: string; dashed?: boolean; label: string }> = ({ color, dashed, label }) => (
  <span className="flex items-center gap-1.5">
    <svg width="18" height="6" aria-hidden="true">
      <line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth="4" strokeDasharray={dashed ? '4 3' : undefined} />
    </svg>
    {label}
  </span>
);

const LegendFlag: React.FC<{ label: string }> = ({ label }) => (
  <span className="flex items-center gap-1.5">
    <svg width="10" height="12" aria-hidden="true">
      <line x1="1.5" y1="1" x2="1.5" y2="11" stroke="#1d2327" strokeWidth="1.5" />
      <polygon points="1.5,1 9,4 1.5,7" fill="#1d2327" />
    </svg>
    {label}
  </span>
);

// Small outline versions of the sectorCauseIcon shapes (see mapIcons.ts), so the legend
// explains at a glance what each sector marker's outline means.
const CAUSE_LEGEND: { cause: SectorCause; label: string }[] = [
  { cause: 'checkpost', label: 'Checkpost' },
  { cause: 'junction', label: 'Junction' },
  { cause: 'bridge', label: 'Bridge' },
  { cause: 'mountain', label: 'Mountain climb' },
  { cause: 'plain', label: 'No landmark nearby' },
];

const LegendShape: React.FC<{ cause: SectorCause; label: string }> = ({ cause, label }) => (
  <span className="flex items-center gap-1.5">
    <svg width="13" height="13" viewBox="0 0 20 20" aria-hidden="true">
      {cause === 'plain' && <circle cx="10" cy="10" r="8.5" fill="none" stroke="#1d2327" strokeWidth="1.8" />}
      {cause === 'checkpost' && (
        <rect x="2" y="2" width="16" height="16" rx="2" fill="none" stroke="#1d2327" strokeWidth="1.8" />
      )}
      {cause === 'junction' && (
        <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" fill="none" stroke="#1d2327" strokeWidth="1.8" />
      )}
      {cause === 'bridge' && (
        <polygon points="6,2 14,2 18.5,10 14,18 6,18 1.5,10" fill="none" stroke="#1d2327" strokeWidth="1.8" />
      )}
      {cause === 'mountain' && (
        <polygon points="10,1.5 18.5,18 1.5,18" fill="none" stroke="#1d2327" strokeWidth="1.8" strokeLinejoin="round" />
      )}
    </svg>
    {label}
  </span>
);

export const CorridorMap: React.FC<CorridorMapProps> = ({
  fitPoints,
  journeyActive,
  placingDisruption,
  children,
  ...base
}) => (
  <div className="panel overflow-hidden">
    <div className="map-soft relative h-95 lg:h-130">
      <MapContainer
        center={[(base.origin.lat + base.destination.lat) / 2, (base.origin.lon + base.destination.lon) / 2]}
        zoom={7}
        preferCanvas
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitToPoints points={fitPoints} />
        <BaseLayers {...base} />
        {children}
        <ScaleControl position="bottomright" imperial={false} />
      </MapContainer>

      {placingDisruption && (
        <p className="absolute top-2 left-1/2 -translate-x-1/2 z-400 bg-ink text-white text-[0.9rem] px-3 py-1.5 rounded">
          Click on the map to place the disruption
        </p>
      )}

      <div className="absolute bottom-2 left-2 z-400 bg-panel/95 border border-line rounded px-2.5 py-1.5 text-[0.8rem] flex flex-wrap gap-x-3 gap-y-1 max-w-[calc(100%-1rem)]">
        <LegendLine color={RISK_COLOR.safe} label="Low risk" />
        <LegendLine color={RISK_COLOR.caution} label="Medium" />
        <LegendLine color={RISK_COLOR.danger} label="High" />
        <LegendFlag label="Sector cut (click for why)" />
        {!journeyActive && base.otherOptions.length > 0 && (
          <LegendLine color={OTHER_ROUTE_COLOR} dashed label="Other route" />
        )}
        {journeyActive && (
          <>
            <LegendLine color={TRAVELLED_COLOR} label="Travelled" />
            <LegendLine color={ROUTE_COLOR} label="Proposed detour" />
          </>
        )}
        <span className="basis-full text-muted">Sector shape:</span>
        {CAUSE_LEGEND.map((c) => (
          <LegendShape key={c.cause} cause={c.cause} label={c.label} />
        ))}
      </div>
    </div>
  </div>
);
