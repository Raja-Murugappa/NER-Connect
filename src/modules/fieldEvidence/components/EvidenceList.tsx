import React from 'react';
import { getAllEvidence } from '../services/databaseService';
import type { Evidence } from '../types/evidence';
import type { EvidenceMapHandle } from './EvidenceMap';

interface EvidenceListProps {
  mapRef: React.RefObject<EvidenceMapHandle | null>;
}

export const EvidenceList: React.FC<EvidenceListProps> = ({ mapRef }) => {
  const [evidence, setEvidence] = React.useState<Evidence[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getAllEvidence();
      setEvidence(data);
    } catch (err) {
      console.warn('Failed to load evidence records:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
    // Poll or re-check periodically
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClick = (ev: Evidence) => {
    if (mapRef.current) {
      mapRef.current.flyTo(ev.latitude, ev.longitude, 16);
      window.scrollTo({ top: 150, behavior: 'smooth' });
    }
  };

  return (
    <div className="ner-card overflow-hidden">
      <div className="ner-card-header bg-[#f8faf8]">
        <div className="flex items-center gap-2">
          <span className="ner-heading text-xs">
            3. Field Evidence Audit Ledger (SQLite WASM)
          </span>
          <span className="text-[10px] bg-gray-200 text-gray-800 font-bold px-2 py-0.5 rounded-full">
            {evidence.length} Records Logged
          </span>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="text-xs text-[#2d6a4f] hover:underline font-semibold"
        >
          🔄 Refresh Ledger
        </button>
      </div>

      <div className="p-4">
        {loading && evidence.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            Loading SQLite records...
          </div>
        ) : evidence.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs space-y-1">
            <p className="font-semibold text-gray-700">No field evidence submitted yet.</p>
            <p>Use the camera or upload form above to capture your first tamper-proof record.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {evidence.map((ev) => {
              const statusClass =
                ev.verification_status === 'VERIFIED'
                  ? 'badge-safe'
                  : ev.verification_status === 'PENDING'
                  ? 'badge-caution'
                  : 'badge-danger';

              return (
                <div
                  key={ev.id}
                  onClick={() => handleClick(ev)}
                  className="bg-white border border-[#d1d5db] hover:border-[#2d6a4f] p-3 rounded-lg shadow-2xs hover:shadow-sm cursor-pointer transition flex flex-col justify-between space-y-2 group"
                >
                  <div className="flex gap-3">
                    {ev.photo ? (
                      <img
                        src={ev.photo}
                        alt="Evidence thumbnail"
                        className="w-16 h-16 object-cover rounded border border-gray-200 shrink-0 bg-gray-100"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-lg shrink-0">
                        📷
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs text-[#1b4332] truncate">
                          {ev.category}
                        </span>
                        <span className={statusClass}>{ev.verification_status}</span>
                      </div>

                      {ev.description && (
                        <p className="text-[11px] text-gray-600 line-clamp-2 mt-0.5">
                          {ev.description}
                        </p>
                      )}

                      <div className="text-[10px] text-gray-500 font-mono mt-1">
                        Lat: {Number(ev.latitude).toFixed(4)}°, Lon: {Number(ev.longitude).toFixed(4)}°
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                    <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-[#2d6a4f] group-hover:underline font-semibold flex items-center gap-0.5">
                      <span>Fly to map</span>
                      <span>➔</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
