// src/modules/fieldEvidence/FieldEvidencePage.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EvidenceMap } from './components/EvidenceMap';
import type { EvidenceMapHandle } from './components/EvidenceMap';
import { EvidenceForm } from './components/EvidenceForm';
import { EvidenceList } from './components/EvidenceList';
import { getAllEvidence } from './services/databaseService';
import type { Evidence } from './types/evidence';

export const FieldEvidencePage: React.FC = () => {
  const mapRef = useRef<EvidenceMapHandle | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Records are read once and re-read only after a save (no polling).
  const reload = useCallback(async () => {
    try {
      setEvidence(await getAllEvidence());
    } catch (err) {
      console.warn('Failed to load field reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const showOnMap = (ev: Evidence) => {
    mapRef.current?.flyTo(Number(ev.latitude), Number(ev.longitude), 16);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rise-in">
        <h1 className="text-xl font-display font-bold tracking-tight">Field reports</h1>
        <p className="text-[0.85rem] text-muted">
          Reports are saved in this browser and work offline. They are not yet sent to a central server.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)] items-start rise-in rise-in-1">
        <EvidenceForm
          onSaved={async (lat, lon) => {
            await reload();
            mapRef.current?.flyTo(lat, lon);
          }}
        />
        <EvidenceMap ref={mapRef} evidence={evidence} />
      </div>

      <div className="rise-in rise-in-2">
        <EvidenceList evidence={evidence} loading={loading} onShowOnMap={showOnMap} />
      </div>
    </div>
  );
};

export default FieldEvidencePage;
