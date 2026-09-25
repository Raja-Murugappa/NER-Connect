// src/pages/corridor/SectorTable.tsx
import React, { memo } from 'react';
import type { SectorBoundary, SectorCard } from '../../services/corridorApi';
import { RISK_CLASS, RISK_WORD } from './risk';

interface SectorTableProps {
  title: string;
  sectors: SectorCard[];
  onShowOnMap: (sector: SectorCard) => void;
}

const fmtElevation = (s: SectorCard) =>
  s.elevation_known === false
    ? 'Not available'
    : `${s.elevation_start_m.toLocaleString('en-IN')} to ${s.elevation_end_m.toLocaleString('en-IN')} m`;

// Unnamed junctions ("Junction") add noise; named checkposts, bridges and junctions are useful.
const namedLandmarks = (s: SectorCard) => s.embedded_milestones.filter((m) => m.name !== 'Junction');

/** e.g. "Cut here: Checkpost — Rangpo Entry Checkpost." or "Cut here: Distance cut." */
const boundaryLabel = (b: SectorBoundary) => `Cut here: ${b.type}${b.name ? ` — ${b.name}` : ''}.`;

export const SectorTable: React.FC<SectorTableProps> = memo(({ title, sectors, onShowOnMap }) => {
  if (sectors.length === 0) return null;
  return (
    <section className="panel">
      <div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-3">
        <h2 className="panel-title">{title}</h2>
        <span className="text-[0.85rem] text-muted">Click a row to show it on the map</span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Section</th>
              <th>Length</th>
              <th>Time</th>
              <th>Elevation</th>
              <th title="Model estimate of landslide chance">Landslide</th>
              <th title="Model estimate of flood chance">Flood</th>
              <th>Mobile signal</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((s, i) => (
              <tr key={`${s.segment_id}-${i}`} onClick={() => onShowOnMap(s)} className="row-interactive cursor-pointer">
                <td className="num text-muted">{i + 1}</td>
                <td className="min-w-45">
                  {s.segment_type}
                  {s.boundary && (
                    <span className="block text-[0.85rem] text-muted" title={s.boundary.reason}>
                      {boundaryLabel(s.boundary)} {s.boundary.reason}
                    </span>
                  )}
                  {namedLandmarks(s).length > 0 && (
                    <span className="block text-[0.85rem] text-muted">
                      Passes {namedLandmarks(s).map((m) => `${m.name} (${m.km_marker})`).join(', ')}
                    </span>
                  )}
                </td>
                <td className="num">{s.distance_km} km</td>
                <td className="num">{s.eta}</td>
                <td className="num">{fmtElevation(s)}</td>
                <td className="num">{s.landslide_pct}%</td>
                <td className="num">{s.flood_pct}%</td>
                <td>{s.network}</td>
                <td>
                  <span className={`risk ${RISK_CLASS[s.risk_level]}`}>{RISK_WORD[s.risk_level]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 border-t border-line-soft text-[0.85rem] text-muted">
        High: disruption likely, consider delaying the trip or using another route. Medium: some risk, drive slowly
        and check for updates. Landslide and flood figures are model estimates.
      </p>
    </section>
  );
});
