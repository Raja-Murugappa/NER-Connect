import React from 'react';
import type { Evidence } from '../types/evidence';
import { STATUS_COLOR, STATUS_LABEL } from '../types/evidence';

interface EvidenceListProps {
  evidence: Evidence[];
  loading: boolean;
  onShowOnMap: (ev: Evidence) => void;
}

export const EvidenceList: React.FC<EvidenceListProps> = ({ evidence, loading, onShowOnMap }) => (
  <section className="panel">
    <div className="px-4 pt-3 pb-2 flex items-baseline justify-between gap-3">
      <h2 className="panel-title">Saved reports ({evidence.length})</h2>
      {evidence.length > 0 && <span className="text-[0.85rem] text-muted">Click a report to show it on the map</span>}
    </div>

    {loading && evidence.length === 0 ? (
      <p className="px-4 pb-4 text-muted">Loading…</p>
    ) : evidence.length === 0 ? (
      <p className="px-4 pb-4 text-muted">No reports yet. Add a photo, a description, or both to create the first one.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Photo</th>
              <th>Category</th>
              <th>Notes</th>
              <th>Location check</th>
              <th>Recorded</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((ev) => (
              <tr key={ev.id} onClick={() => onShowOnMap(ev)} className="row-interactive cursor-pointer">
                <td>
                  {ev.photo ? (
                    <img src={ev.photo} alt="" className="w-14 h-14 object-cover rounded border border-line" />
                  ) : (
                    <span className="text-muted">None</span>
                  )}
                </td>
                <td>{ev.category}</td>
                <td className="max-w-[320px]">
                  <span className="line-clamp-2">{ev.description || <span className="text-muted">No notes</span>}</span>
                  <span className="block num text-[0.85rem] text-muted">
                    {Number(ev.latitude).toFixed(4)}, {Number(ev.longitude).toFixed(4)}
                  </span>
                </td>
                <td>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLOR[ev.verification_status] }} />
                    {STATUS_LABEL[ev.verification_status]}
                  </span>
                  {ev.verification_reason && (
                    <span className="block text-[0.85rem] text-muted">{ev.verification_reason}</span>
                  )}
                </td>
                <td className="num">{new Date(ev.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);
