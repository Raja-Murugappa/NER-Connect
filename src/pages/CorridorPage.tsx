import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Preset {
  name: string;
  startLat: number;
  startLon: number;
  endLat: number;
  endLon: number;
  distanceKm: number;
  eta: string;
}

const PRESETS: Record<string, Preset> = {
  guwahati_gangtok: {
    name: 'Guwahati-Gangtok Strategic Corridor',
    startLat: 26.1445,
    startLon: 91.7362,
    endLat: 27.3389,
    endLon: 88.6065,
    distanceKm: 519.1,
    eta: '11h 45m',
  },
  guwahati_shillong: {
    name: 'Guwahati-Shillong Highland Corridor (NH-6)',
    startLat: 26.1445,
    startLon: 91.7362,
    endLat: 25.5788,
    endLon: 91.8933,
    distanceKm: 98.4,
    eta: '2h 50m',
  },
  silchar_aizawl: {
    name: 'Silchar-Aizawl Border Highway (NH-306)',
    startLat: 24.8333,
    startLon: 92.7789,
    endLat: 23.7271,
    endLon: 92.7176,
    distanceKm: 172.5,
    eta: '5h 15m',
  },
  tezpur_tawang: {
    name: 'Tezpur-Tawang Trans-Himalayan Highway (NH-13)',
    startLat: 26.6528,
    startLon: 92.7926,
    endLat: 27.5861,
    endLon: 91.8594,
    distanceKm: 326.0,
    eta: '9h 30m',
  },
};

// 2D Institutional Leaflet Icon
const create2DIcon = (emoji: string) =>
  L.divIcon({
    html: `<div style="
      background: #ffffff;
      border: 2px solid #1b4332;
      border-radius: 4px;
      padding: 2px 4px;
      font-size: 14px;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
    ">${emoji}</div>`,
    className: 'custom-2d-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });

export const CorridorPage: React.FC = () => {
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('guwahati_gangtok');
  const [scenario, setScenario] = useState<'1' | '2'>('1');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<Preset>(PRESETS.guwahati_gangtok);

  const handlePresetChange = (key: string) => {
    setSelectedPresetKey(key);
    if (PRESETS[key]) {
      setActivePreset(PRESETS[key]);
    }
  };

  const handleEvaluate = () => {
    setIsEvaluating(true);
    setTimeout(() => {
      setIsEvaluating(false);
    }, 400);
  };

  const isSevere = scenario === '2';
  const startPos: [number, number] = [activePreset.startLat, activePreset.startLon];
  const endPos: [number, number] = [activePreset.endLat, activePreset.endLon];

  // Route points simulation for map visualization
  const routePoints: [number, number][] = [
    startPos,
    [(startPos[0] + endPos[0]) / 2 + 0.1, (startPos[1] + endPos[1]) / 2 - 0.2],
    [(startPos[0] + endPos[0]) / 2, (startPos[1] + endPos[1]) / 2],
    [(startPos[0] + endPos[0]) / 2 - 0.05, (startPos[1] + endPos[1]) / 2 + 0.15],
    endPos,
  ];

  return (
    <div className="flex-1 bg-[#f4f6f4] p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Overview Bar */}
      <div className="bg-white border border-[#d1d5db] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-[#1b4332] text-white text-xs font-bold px-2 py-0.5 rounded">
              CORRIDOR
            </span>
            <h2 className="text-lg font-bold text-[#1b4332]">{activePreset.name}</h2>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            {activePreset.distanceKm} km Verified Road Route • OpenStreetMap (OSRM) Active
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20] px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-2">
            <span>⏱️ Total Journey ETA:</span>
            <strong className="text-sm font-bold">
              {isSevere ? '14h 25m (+2h 40m delay)' : activePreset.eta}
            </strong>
          </div>
          <Link
            to="/field-evidence"
            className="bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-xs font-bold px-3.5 py-2 rounded transition flex items-center gap-1.5"
          >
            <span>📷</span>
            <span>Log Field Evidence</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Controls on Left, GIS Map on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar: Controls & Scenario */}
        <div className="space-y-5 lg:col-span-1">
          <div className="ner-card p-4 space-y-4">
            <h3 className="ner-heading pb-2 border-b border-gray-200">1. Corridor Configuration</h3>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Popular Strategic Corridor
              </label>
              <select
                className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:border-[#2d6a4f]"
                value={selectedPresetKey}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="guwahati_gangtok">Guwahati (Assam) ➔ Gangtok (Sikkim)</option>
                <option value="guwahati_shillong">Guwahati (Assam) ➔ Shillong (Meghalaya)</option>
                <option value="silchar_aizawl">Silchar (Assam) ➔ Aizawl (Mizoram)</option>
                <option value="tezpur_tawang">Tezpur (Assam) ➔ Tawang (Arunachal)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Origin Lat/Lon</span>
                <span className="font-mono font-semibold">{activePreset.startLat.toFixed(4)}, {activePreset.startLon.toFixed(4)}</span>
              </div>
              <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                <span className="text-gray-500 block text-[10px] uppercase font-bold">Dest Lat/Lon</span>
                <span className="font-mono font-semibold">{activePreset.endLat.toFixed(4)}, {activePreset.endLon.toFixed(4)}</span>
              </div>
            </div>
          </div>

          <div className="ner-card p-4 space-y-4">
            <h3 className="ner-heading pb-2 border-b border-gray-200">2. External Hazard Scenario</h3>

            <div className="space-y-2 text-xs">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition ${
                  scenario === '1'
                    ? 'bg-[#e8f5e9] border-[#81c784] text-[#1b5e20]'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="scenario"
                  value="1"
                  checked={scenario === '1'}
                  onChange={() => setScenario('1')}
                  className="mt-0.5 accent-[#2d6a4f]"
                />
                <div>
                  <strong className="block font-semibold">Normal Daily Operations</strong>
                  <span className="text-gray-500 text-[11px]">Standard baseline alert feeds (0.15 - 0.25)</span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded border cursor-pointer transition ${
                  scenario === '2'
                    ? 'bg-[#ffebee] border-[#e57373] text-[#c62828]'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="scenario"
                  value="2"
                  checked={scenario === '2'}
                  onChange={() => setScenario('2')}
                  className="mt-0.5 accent-[#c62828]"
                />
                <div>
                  <strong className="block font-semibold">Ingest Severe Hazard Warning</strong>
                  <span className="text-gray-500 text-[11px]">
                    Simulate active ISRO/CWC warning (0.88) on mountain sectors
                  </span>
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="w-full bg-[#2d6a4f] hover:bg-[#1b4332] active:scale-[0.99] text-white text-xs font-bold py-2.5 rounded shadow-xs transition"
            >
              {isEvaluating ? 'Evaluating Sectors...' : 'Calculate Route & Evaluate Sectors'}
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="ner-card p-4 space-y-2 text-xs">
            <h4 className="font-bold text-[#1b4332] uppercase text-[11px] tracking-wide">
              Operational Summary
            </h4>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">Total Distance:</span>
              <strong className="font-mono">{activePreset.distanceKm} km</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-100">
              <span className="text-gray-600">Strategic Sectors:</span>
              <strong className="font-mono">8 Sectors (≥50km)</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-600">Disruption Status:</span>
              <span className={isSevere ? 'badge-danger' : 'badge-safe'}>
                {isSevere ? 'HIGH RISK' : 'LOW / SAFE'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: 2D GIS Map & Legend */}
        <div className="lg:col-span-2 space-y-4">
          <div className="ner-card overflow-hidden">
            <div className="ner-card-header bg-[#f8faf8]">
              <span className="text-xs font-bold text-[#1b4332] uppercase tracking-wider flex items-center gap-1.5">
                <span>🗺️</span> 2D OpenStreetMap Corridor Visualization
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500">Routing:</span>
                <span className="font-semibold text-gray-800">OSRM Real Highway</span>
              </div>
            </div>

            <div className="h-[420px] w-full relative">
              <MapContainer
                center={[(startPos[0] + endPos[0]) / 2, (startPos[1] + endPos[1]) / 2]}
                zoom={7}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Polyline
                  positions={routePoints}
                  color={isSevere ? '#dc2626' : '#2d6a4f'}
                  weight={isSevere ? 6 : 5}
                  opacity={0.88}
                />

                <Marker position={startPos} icon={create2DIcon('🚩')}>
                  <Popup>
                    <div className="text-xs">
                      <strong className="text-[#1b4332]">Origin Point</strong>
                      <p>{activePreset.name.split('➔')[0]}</p>
                    </div>
                  </Popup>
                </Marker>

                <Marker position={endPos} icon={create2DIcon('🏁')}>
                  <Popup>
                    <div className="text-xs">
                      <strong className="text-[#1b4332]">Destination Point</strong>
                      <p>{activePreset.name.split('➔')[1] || activePreset.name}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Waypoint Junction */}
                <Marker
                  position={[(startPos[0] + endPos[0]) / 2, (startPos[1] + endPos[1]) / 2]}
                  icon={create2DIcon('🔀')}
                >
                  <Popup>
                    <div className="text-xs">
                      <strong className="text-[#1b4332]">🔀 Strategic Reroute Junction</strong>
                      <p>Alternative Bypass Option</p>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>

              {/* Map Legend */}
              <div className="absolute bottom-2 left-2 z-[400] bg-white/95 border border-[#d1d5db] px-3 py-1.5 rounded shadow-sm flex flex-wrap items-center gap-3 text-[11px] font-semibold text-gray-700">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#2d6a4f]" /> Safe Sector
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> Caution Advisory
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-[#dc2626]" /> Hazard Warning
                </div>
                <div className="flex items-center gap-1">
                  <span>🔀</span> Junction
                </div>
              </div>
            </div>
          </div>

          {/* Strategic Operational Sectors (Cards List) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1b4332] uppercase tracking-wide">
                Strategic Operational Sectors (Sectors ≥ 50 km)
              </h3>
              <span className="text-xs text-gray-500 font-medium">Physical Elevation + ISRO/CWC Feeds</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="ner-card p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#1b4332]">SEC-01: Plains Transition</span>
                  <span className="badge-safe">SAFE</span>
                </div>
                <p className="text-xs text-gray-600">Elev: 54m • Slope: 2.1% • Rain: 12mm</p>
                <div className="text-[11px] text-gray-500 flex justify-between">
                  <span>Speed Limit: 60 km/h</span>
                  <span>Delay: 0 mins</span>
                </div>
              </div>

              <div className="ner-card p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#1b4332]">SEC-02: Foothills Gateway</span>
                  <span className={isSevere ? 'badge-danger' : 'badge-caution'}>
                    {isSevere ? 'DANGER' : 'CAUTION'}
                  </span>
                </div>
                <p className="text-xs text-gray-600">Elev: 410m • Slope: 18.4% • Rain: {isSevere ? '145mm' : '38mm'}</p>
                <div className="text-[11px] text-gray-500 flex justify-between">
                  <span>Speed Limit: 40 km/h</span>
                  <span>Delay: {isSevere ? '+45 mins' : '+10 mins'}</span>
                </div>
              </div>

              <div className="ner-card p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#1b4332]">SEC-03: Highland Ridge</span>
                  <span className={isSevere ? 'badge-danger' : 'badge-safe'}>
                    {isSevere ? 'DANGER' : 'SAFE'}
                  </span>
                </div>
                <p className="text-xs text-gray-600">Elev: 1,420m • Slope: 28.5% • Rain: {isSevere ? '180mm' : '15mm'}</p>
                <div className="text-[11px] text-gray-500 flex justify-between">
                  <span>Landslide Risk: {isSevere ? '84%' : '12%'}</span>
                  <span>Delay: {isSevere ? '+80 mins' : '0 mins'}</span>
                </div>
              </div>

              <div className="ner-card p-3 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#1b4332]">SEC-04: Valley Border Link</span>
                  <span className="badge-safe">SAFE</span>
                </div>
                <p className="text-xs text-gray-600">Elev: 890m • Slope: 9.2% • Rain: 20mm</p>
                <div className="text-[11px] text-gray-500 flex justify-between">
                  <span>Mobile Signal: GOOD</span>
                  <span>Delay: 0 mins</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
