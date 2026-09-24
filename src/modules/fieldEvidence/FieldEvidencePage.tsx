// src/modules/fieldEvidence/FieldEvidencePage.tsx
import React, { useRef } from 'react';
import { EvidenceMap } from './components/EvidenceMap';
import type { EvidenceMapHandle } from './components/EvidenceMap';
import { EvidenceForm } from './components/EvidenceForm';
import { EvidenceList } from './components/EvidenceList';

export const FieldEvidencePage: React.FC = () => {
  const mapRef = useRef<EvidenceMapHandle | null>(null);

  return (
    <div className="flex-1 bg-[#f4f6f4] p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Overview Bar */}
      <div className="bg-white border border-[#d1d5db] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-[#1b4332] text-white text-xs font-bold px-2 py-0.5 rounded">
              FIELD NODE
            </span>
            <h2 className="text-lg font-bold text-[#1b4332]">
              Field Evidence &amp; Chain-of-Custody Verification
            </h2>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Tamper-Proof WebRTC Camera • Hardware GPS Pixel Burn-in • Offline SQLite WASM
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20] px-3.5 py-1.5 rounded text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cryptographic Geotagging Ready</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form on Left, GIS Map on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5">
          <EvidenceForm mapRef={mapRef} />
        </section>
        <section className="lg:col-span-7">
          <EvidenceMap ref={mapRef} />
        </section>
      </div>

      {/* Bottom Section: Evidence History Ledger */}
      <section>
        <EvidenceList mapRef={mapRef} />
      </section>
    </div>
  );
};

export default FieldEvidencePage;
