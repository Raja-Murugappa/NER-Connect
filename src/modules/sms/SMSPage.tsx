// src/modules/sms/SMSPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { AlertDispatcher } from './components/AlertDispatcher';
import { AlertLedger } from './components/AlertLedger';
import { DriverRegistry } from './components/DriverRegistry';
import { LocalPushPanel } from '../notifications/LocalPushPanel';
import type { SMSRecord, DriverProfile } from './types/sms';
import { smsStore } from './services/smsStore';

type Tab = 'dispatch' | 'push' | 'ledger' | 'drivers';

export const SMSPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dispatch');
  const [records, setRecords] = useState<SMSRecord[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);

  const loadData = useCallback(() => {
    setRecords(smsStore.listAlerts());
    setDrivers(smsStore.listDrivers());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDispatched = () => {
    loadData();
    setTab('ledger');
  };

  const handleClearAll = () => {
    if (!confirm('Clear all SMS records from this session?')) return;
    smsStore.clearAll();
    setRecords([]);
  };

  const delivered = records.filter((r) => r.status === 'delivered').length;
  const failed = records.filter((r) => r.status === 'failed').length;

  return (
    <div className="flex-1 bg-[#f4f6f4] p-4 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Overview Bar */}
      <div className="bg-white border border-[#d1d5db] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="bg-[#1b4332] text-white text-xs font-bold px-2 py-0.5 rounded">
              COMMS
            </span>
            <h2 className="text-lg font-bold text-[#1b4332]">
              NER-Connect SMS Alert &amp; Driver Communication System
            </h2>
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Multilingual hazard alerts • Twilio / MSG91 DLT • 8 NE Languages • Offline queue support
          </p>
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-3 text-xs">
          <div className="bg-gray-100 border border-gray-200 text-gray-700 px-3 py-1.5 rounded font-semibold">
            📡 {records.length} Dispatched
          </div>
          <div className="bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20] px-3 py-1.5 rounded font-semibold">
            ✓ {delivered} Delivered
          </div>
          {failed > 0 && (
            <div className="bg-[#ffebee] border border-[#e57373] text-[#c62828] px-3 py-1.5 rounded font-semibold">
              ✗ {failed} Failed
            </div>
          )}
          <div className="bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20] px-3 py-1.5 rounded font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {drivers.length} Drivers Registered
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 pb-0 flex-wrap">
        {(
          [
            { key: 'dispatch', label: '📡 SMS Alert Dispatcher', count: null },
            { key: 'push', label: '💻 Local Wi-Fi Push (Port 8080)', count: null },
            { key: 'ledger', label: '📋 Delivery Ledger', count: records.length },
            { key: 'drivers', label: '👤 Driver Registry', count: drivers.length },
          ] as const
        ).map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t border-b-2 transition -mb-px ${
              tab === key
                ? 'border-[#2d6a4f] text-[#1b4332] bg-white'
                : 'border-transparent text-gray-600 hover:text-[#1b4332] hover:bg-[#f8faf8]'
            }`}
          >
            {label}
            {count !== null && (
              <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'dispatch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <AlertDispatcher onDispatched={handleDispatched} />
          </div>

          {/* Sidebar: Reference Panel */}
          <div className="lg:col-span-7 space-y-4">
            <div className="ner-card p-5 space-y-4">
              <h3 className="ner-heading pb-2 border-b border-gray-200">
                SMS Alert Template Reference
              </h3>
              <div className="space-y-2">
                {[
                  {
                    type: '🚧 Road Block',
                    vars: '{location}, {alternateRoute}',
                    example:
                      'NER-CONNECT ALERT: Road blockage detected at Dimapur Flyover. NH-29 via Kohima available. Action: Avoid the affected route.',
                  },
                  {
                    type: '⛰️ Landslide',
                    vars: '{location}, {alternateRoute}',
                    example:
                      'NER-CONNECT ALERT: Active landslide reported at Zuluk Pass. Corridor is hazardous. NH-310 via Aritar available. Action: Halt immediately or divert.',
                  },
                  {
                    type: '🆘 Emergency',
                    vars: '{location}',
                    example:
                      'NER-CONNECT EMERGENCY: Immediate safety protocol active near Jalpaiguri. Pull over to safe designated zone.',
                  },
                  {
                    type: '📵 Dead-Zone Pre-Cache',
                    vars: '{location}, {checkpointName}',
                    example:
                      'PRE-CACHE ADVISORY: Approaching low-connectivity corridor Tawang-Bomdila. Next safe checkpoint: Checkpoint Bravo. Route status: All sectors assessed - NER-CONNECT.',
                  },
                ].map(({ type, vars, example }) => (
                  <div key={type} className="bg-[#f8faf8] border border-[#d1d5db] rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1b4332]">{type}</span>
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-mono">
                        {vars}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-mono leading-relaxed">{example}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Language Matrix */}
            <div className="ner-card p-4">
              <h3 className="ner-heading pb-2 border-b border-gray-200 mb-3">
                Supported Languages (NE Regional Coverage)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { code: 'en', name: 'English', region: 'All NE States', status: 'verified' },
                  { code: 'hi', name: 'Hindi', region: 'Assam, Nagaland', status: 'verified' },
                  { code: 'as', name: 'Assamese', region: 'Assam', status: 'verified' },
                  { code: 'bn', name: 'Bengali', region: 'Tripura, Assam', status: 'verified' },
                  { code: 'mni', name: 'Manipuri', region: 'Manipur', status: 'unverified' },
                  { code: 'lus', name: 'Mizo', region: 'Mizoram', status: 'unverified' },
                  { code: 'kha', name: 'Khasi', region: 'Meghalaya', status: 'unverified' },
                  { code: 'grt', name: 'Garo', region: 'Meghalaya', status: 'unverified' },
                ].map(({ code, name, region, status }) => (
                  <div
                    key={code}
                    className="bg-white border border-[#d1d5db] rounded p-2 space-y-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1b4332] uppercase">{code}</span>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                          status === 'verified'
                            ? 'bg-[#e8f5e9] text-[#1b5e20]'
                            : 'bg-[#fff8e1] text-[#b78103]'
                        }`}
                      >
                        {status === 'verified' ? '✓' : '~'}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-800">{name}</p>
                    <p className="text-[10px] text-gray-500">{region}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'push' && <LocalPushPanel />}

      {tab === 'ledger' && (
        <AlertLedger records={records} onClearAll={handleClearAll} />
      )}

      {tab === 'drivers' && (
        <DriverRegistry
          drivers={drivers}
          onUpdate={(updated) => setDrivers(updated)}
        />
      )}
    </div>
  );
};

export default SMSPage;
