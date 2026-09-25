// src/pages/corridor/mapIcons.ts
// Plain geometric map markers (no emoji). Each is centred on its coordinate.
import L from 'leaflet';

type Shape = 'circle' | 'square' | 'diamond';

function shapeIcon(shape: Shape, size: number, fill: string, stroke: string, label = ''): L.DivIcon {
  const radius = shape === 'circle' ? '50%' : '2px';
  const rotate = shape === 'diamond' ? 'transform: rotate(45deg);' : '';
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${fill};border:2px solid ${stroke};
      border-radius:${radius};${rotate}box-sizing:border-box;display:flex;align-items:center;
      justify-content:center;color:#fff;font:600 10px/1 system-ui,sans-serif;">${label}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export const startIcon = shapeIcon('circle', 14, '#1d2327', '#ffffff');
export const endIcon = shapeIcon('square', 14, '#1d2327', '#ffffff');
export const junctionIcon = shapeIcon('circle', 9, '#ffffff', '#5b6570');
export const bridgeIcon = shapeIcon('square', 9, '#ffffff', '#5b6570');
export const truckIcon = shapeIcon('circle', 18, '#2563eb', '#ffffff');
export const disruptionIcon = shapeIcon('square', 18, '#c0392b', '#ffffff', '×');
export const holdIcon = shapeIcon('square', 14, '#ffffff', '#c0392b');
export const divergenceIcon = shapeIcon('diamond', 12, '#2563eb', '#ffffff');
export const reportedSpotIcon = shapeIcon('circle', 12, '#ffffff', '#8a94a0');
export const checkpostIcon = shapeIcon('square', 10, '#1d2327', '#ffffff');

// A flag on a pole, anchored at its base so it points exactly at the sector cut point -
// the same convention a printed survey or road map uses to mark a fixed point.
export const boundaryIcon = L.divIcon({
  html: `<div style="position:relative;width:14px;height:22px;">
    <div style="position:absolute;left:6px;top:2px;width:2px;height:18px;background:#1d2327;"></div>
    <div style="position:absolute;left:8px;top:2px;width:0;height:0;
      border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid #1d2327;"></div>
    <div style="position:absolute;left:1px;bottom:0;width:12px;height:3px;background:#1d2327;border-radius:1px;"></div>
  </div>`,
  className: '',
  iconSize: [14, 22],
  iconAnchor: [7, 20],
  popupAnchor: [2, -20],
});

// White halo around map text, as printed road maps do, so labels read over any background.
const HALO = 'text-shadow:0 0 2px #fff,0 0 2px #fff,0 0 3px #fff,0 0 3px #fff;';

/**
 * Why a sector is its own sector, boiled down to one category - used to pick its marker's
 * outline shape. Matches the shape meanings already used elsewhere on the map (square =
 * checkpost, diamond = junction), so the same shape always means the same thing.
 */
export type SectorCause = 'mountain' | 'checkpost' | 'junction' | 'bridge' | 'plain';

const CAUSE_SHAPE: Record<SectorCause, { body: string; textY: number }> = {
  plain: {
    body: '<circle cx="10" cy="10" r="9" fill="#fff" stroke="#1d2327" stroke-width="1.5"/>',
    textY: 14,
  },
  checkpost: {
    body: '<rect x="1.5" y="1.5" width="17" height="17" rx="2" fill="#fff" stroke="#1d2327" stroke-width="1.5"/>',
    textY: 14,
  },
  junction: {
    body: '<polygon points="10,1 19,10 10,19 1,10" fill="#fff" stroke="#1d2327" stroke-width="1.5" stroke-linejoin="round"/>',
    textY: 14,
  },
  bridge: {
    body: '<polygon points="6,1.5 14,1.5 19,10 14,18.5 6,18.5 1,10" fill="#fff" stroke="#1d2327" stroke-width="1.5" stroke-linejoin="round"/>',
    textY: 14,
  },
  mountain: {
    body: '<polygon points="10,1.5 19,18.5 1,18.5" fill="#fff" stroke="#1d2327" stroke-width="1.5" stroke-linejoin="round"/>',
    textY: 16.5,
  },
};

const causeIcons = new Map<string, L.DivIcon>();

/**
 * Sector marker whose outline shape shows why that stretch is its own sector (a checkpost,
 * a junction, a bridge, a steep climb, or - a circle - no landmark was close enough). The
 * sector number sits inside it, still matching the "#" column of the sector table below the
 * map. Click it to read the full reason.
 */
export function sectorCauseIcon(n: number, cause: SectorCause): L.DivIcon {
  const key = `${cause}:${n}`;
  let icon = causeIcons.get(key);
  if (!icon) {
    const shape = CAUSE_SHAPE[cause];
    const html = `<svg width="20" height="20" viewBox="0 0 20 20">${shape.body}
      <text x="10" y="${shape.textY}" text-anchor="middle" font="600 11px system-ui,sans-serif" fill="#1d2327">${n}</text>
    </svg>`;
    icon = L.divIcon({ html, className: '', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });
    causeIcons.set(key, icon);
  }
  return icon;
}

/** A dot on the route with its distance from the start, e.g. "100 km". */
export function distanceIcon(km: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="display:flex;align-items:center;gap:3px;white-space:nowrap;">
      <span style="width:5px;height:5px;border-radius:50%;background:#1d2327;border:1px solid #fff;flex:none;"></span>
      <span style="font:500 11px system-ui,sans-serif;color:#1d2327;${HALO}">${km} km</span></div>`,
    className: '',
    iconSize: [60, 14],
    iconAnchor: [3.5, 7],
  });
}

/** A place name written on the map next to the start or destination marker. */
export function placeLabelIcon(name: string): L.DivIcon {
  const safe = name.replace(/[<>&"]/g, '');
  return L.divIcon({
    html: `<div style="font:600 13px system-ui,sans-serif;color:#1d2327;white-space:nowrap;${HALO}">${safe}</div>`,
    className: '',
    iconSize: [160, 16],
    iconAnchor: [-10, 8],
  });
}
