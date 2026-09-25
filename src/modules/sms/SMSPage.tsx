// src/modules/sms/SMSPage.tsx
import React, { useState, useCallback } from 'react';
import { AlertDispatcher } from './components/AlertDispatcher';
import { AlertLedger } from './components/AlertLedger';
import { DriverRegistry } from './components/DriverRegistry';
import type { SMSRecord, DriverProfile } from './types/sms';
import { smsStore } from './services/smsStore';

type Tab = 'send' | 'history' | 'drivers';

export const SMSPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('send');
  // Initial values come straight from the local store; refreshed after changes.
  const [records, setRecords] = useState<SMSRecord[]>(() => smsStore.listAlerts());
  const [drivers, setDrivers] = useState<DriverProfile[]>(() => smsStore.listDrivers());

  const loadData = useCallback(() => {
    setRecords(smsStore.listAlerts());
    setDrivers(smsStore.listDrivers());
  }, []);

  const handleSent = () => {
    loadData();
    setTab('history');
  };

  const handleClearAll = () => {
    if (!confirm('Delete the whole SMS history in this browser?')) return;
    smsStore.clearAll();
    setRecords([]);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'send', label: 'Send an alert' },
    { key: 'history', label: `History (${records.length})` },
    { key: 'drivers', label: `Drivers (${drivers.length})` },
  ];

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rise-in">
        <h1 className="text-xl font-display font-bold tracking-tight">SMS alerts</h1>
        <p className="text-[0.85rem] text-muted">
          Sends real SMS through Twilio (trial account: verified numbers only). History and drivers are stored in
          this browser.
        </p>
      </div>

      <nav className="flex gap-1 border-b border-line rise-in rise-in-1" aria-label="SMS sections">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`relative px-3 py-2 -mb-px text-[0.95rem] transition-colors duration-150 after:content-[''] after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent after:origin-left after:transition-transform after:duration-200 ${
              tab === key
                ? 'text-ink font-semibold after:scale-x-100'
                : 'text-muted font-medium hover:text-ink after:scale-x-0'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div key={tab} className="fade-in">
        {tab === 'send' && <AlertDispatcher onDispatched={handleSent} />}
        {tab === 'history' && <AlertLedger records={records} onClearAll={handleClearAll} />}
        {tab === 'drivers' && <DriverRegistry drivers={drivers} onUpdate={setDrivers} />}
      </div>
    </div>
  );
};

export default SMSPage;
