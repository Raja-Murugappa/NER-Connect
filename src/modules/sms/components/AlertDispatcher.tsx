// src/modules/sms/components/AlertDispatcher.tsx
// Dispatch panel with Live Twilio Integration + Verified Numbers Quick Select

import React, { useState, useEffect } from 'react';
import type { AlertType, AlertSeverity, SMSProvider, SupportedLanguage, DriverProfile } from '../types/sms';
import {
  ALERT_TYPES,
  ALERT_TYPE_LABELS,
  LANGUAGE_NAMES,
  generateMessageText,
} from '../types/sms';
import { smsStore, type DispatchInput } from '../services/smsStore';

interface AlertDispatcherProps {
  onDispatched: () => void;
}

export const AlertDispatcher: React.FC<AlertDispatcherProps> = ({ onDispatched }) => {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [broadcastMode, setBroadcastMode] = useState<boolean>(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('d-verified-1');
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [manualPhone, setManualPhone] = useState<string>('');

  const [alertType, setAlertType] = useState<AlertType>('road_block');
  const [severity, setSeverity] = useState<AlertSeverity>('HIGH');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [provider, setProvider] = useState<SMSProvider>('twilio');
  const [locationVar, setLocationVar] = useState<string>('Guwahati-Gangtok Corridor');
  const [alternateRouteVar, setAlternateRouteVar] = useState<string>('NH-27 via Shillong');
  const [checkpointVar, setCheckpointVar] = useState<string>('Checkpoint Alpha');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const list = smsStore.listDrivers();
    setDrivers(list);
    const verifiedFirst = list.find((d) => d.id === 'd-verified-1') || list[0];
    if (verifiedFirst) {
      setSelectedDriverId(verifiedFirst.id);
      setLanguage(verifiedFirst.language);
    }
  }, []);

  // Generate message preview
  const previewMessage = useCustom
    ? customMessage
    : generateMessageText(alertType, {
        location: locationVar || 'Guwahati-Gangtok Corridor',
        alternateRoute: alternateRouteVar || 'NH-27 via Shillong',
        checkpointName: checkpointVar || 'Checkpoint Alpha',
        statusNote: 'All sectors assessed',
      });

  const toggleDriverSelect = (id: string) => {
    setSelectedDriverIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectVerifiedQuick = (phone: string) => {
    const matched = drivers.find((d) => d.phone.replace(/[\s-]/g, '') === phone.replace(/[\s-]/g, ''));
    if (matched) {
      setSelectedDriverId(matched.id);
      setLanguage(matched.language);
      setManualPhone('');
    } else {
      setSelectedDriverId('');
      setManualPhone(phone);
    }
  };

  const handleSend = async () => {
    const noDriverBroadcast = broadcastMode && selectedDriverIds.length === 0;
    const noDriverSingle = !broadcastMode && !selectedDriverId && !manualPhone.trim();
    if (noDriverBroadcast || noDriverSingle) {
      setNotification({ type: 'error', text: 'Please select a driver or enter a phone number.' });
      return;
    }

    setIsSending(true);
    setNotification(null);

    try {
      const baseInput: Omit<DispatchInput, 'phone' | 'driverName'> = {
        alertType,
        severity,
        language,
        provider,
        variables: {
          location: locationVar,
          alternateRoute: alternateRouteVar,
          checkpointName: checkpointVar,
          statusNote: 'All sectors assessed',
        },
        customMessage: useCustom ? customMessage : undefined,
      };

      if (broadcastMode) {
        const results = await smsStore.bulkDispatch(baseInput, selectedDriverIds);
        const delivered = results.filter((r) => r.status === 'sent' || r.status === 'delivered').length;
        setNotification({
          type: 'success',
          text: `Dispatched to ${results.length} driver(s). ${delivered} sent via ${provider.toUpperCase()}.`,
        });
        setSelectedDriverIds([]);
      } else {
        const driver = drivers.find((d) => d.id === selectedDriverId);
        const phone = driver?.phone ?? manualPhone.trim();
        const res = await smsStore.dispatch({
          ...baseInput,
          phone,
          driverName: driver?.name,
          language: driver?.language ?? language,
        });

        if (res.status === 'failed') {
          setNotification({
            type: 'error',
            text: `Dispatch failed: ${res.message.split('\n')[1] || 'Error'}`,
          });
        } else {
          setNotification({
            type: 'success',
            text: `SMS dispatched successfully to ${driver?.name ?? phone} via ${provider.toUpperCase()}!`,
          });
        }
      }

      onDispatched();
    } catch (err: any) {
      setNotification({ type: 'error', text: `Failed to dispatch: ${err.message}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="ner-card p-5 space-y-5">
      <div className="pb-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="ner-heading">Alert Dispatcher</h3>
          <span className="bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Twilio Gateway Active
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Dispatch live SMS alerts via Twilio (+1 737 258 3478) to verified field devices
        </p>
      </div>

      {/* Verified numbers quick-bar */}
      <div className="bg-[#f0f9f3] border border-[#a3d9b8] rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#1b4332] uppercase flex items-center gap-1.5">
            <span>✅</span> Verified Trial Recipients
          </span>
          <span className="text-[10px] text-gray-500">Twilio Console Verified</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => selectVerifiedQuick('+917305519021')}
            className={`text-xs px-2.5 py-1 rounded font-bold transition flex items-center gap-1.5 border ${
              (selectedDriverId === 'd-verified-1' || manualPhone === '+917305519021')
                ? 'bg-[#1b4332] text-white border-transparent'
                : 'bg-white text-[#1b4332] border-[#a3d9b8] hover:bg-[#e8f5e9]'
            }`}
          >
            <span>📱</span> +91 73055 19021
          </button>
          <button
            type="button"
            onClick={() => selectVerifiedQuick('+919994138347')}
            className={`text-xs px-2.5 py-1 rounded font-bold transition flex items-center gap-1.5 border ${
              (selectedDriverId === 'd-verified-2' || manualPhone === '+919994138347')
                ? 'bg-[#1b4332] text-white border-transparent'
                : 'bg-white text-[#1b4332] border-[#a3d9b8] hover:bg-[#e8f5e9]'
            }`}
          >
            <span>📱</span> +91 99941 38347
          </button>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded text-xs flex items-start gap-2 ${
            notification.type === 'success'
              ? 'bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20]'
              : 'bg-[#ffebee] border border-[#e57373] text-[#c62828]'
          }`}
        >
          <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="font-semibold">{notification.text}</span>
        </div>
      )}

      {/* Broadcast toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setBroadcastMode(false)}
          className={`flex-1 py-1.5 text-xs font-bold rounded border transition ${
            !broadcastMode ? 'bg-[#2d6a4f] text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          Single Recipient
        </button>
        <button
          type="button"
          onClick={() => setBroadcastMode(true)}
          className={`flex-1 py-1.5 text-xs font-bold rounded border transition ${
            broadcastMode ? 'bg-[#2d6a4f] text-white border-transparent' : 'bg-white text-gray-700 border-gray-300'
          }`}
        >
          Broadcast to Both / Fleet
        </button>
      </div>

      {/* Recipient Selection */}
      {!broadcastMode ? (
        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-700 uppercase">Recipient Driver</label>
          <select
            className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-[#2d6a4f]"
            value={selectedDriverId}
            onChange={(e) => {
              setSelectedDriverId(e.target.value);
              const d = drivers.find((x) => x.id === e.target.value);
              if (d) setLanguage(d.language);
              setManualPhone('');
            }}
          >
            <option value="">-- Select registered driver --</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} • {d.phone} [{LANGUAGE_NAMES[d.language]}]
              </option>
            ))}
          </select>
          {!selectedDriverId && (
            <input
              type="text"
              placeholder="Or enter phone manually (+91XXXXXXXXXX)"
              className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-[#2d6a4f] font-mono"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-gray-700 uppercase">
              Select Drivers ({selectedDriverIds.length} selected)
            </label>
            <button
              type="button"
              onClick={() => setSelectedDriverIds(drivers.map((d) => d.id))}
              className="text-[10px] text-[#2d6a4f] hover:underline font-bold"
            >
              Select All
            </button>
          </div>
          <div className="border border-gray-200 rounded divide-y divide-gray-100 max-h-40 overflow-y-auto">
            {drivers.map((d) => (
              <label
                key={d.id}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-xs transition ${
                  selectedDriverIds.includes(d.id) ? 'bg-[#e8f5e9] text-[#1b4332]' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedDriverIds.includes(d.id)}
                  onChange={() => toggleDriverSelect(d.id)}
                  className="accent-[#2d6a4f]"
                />
                <span className="font-semibold">{d.name}</span>
                <span className="text-gray-500 font-mono text-[11px]">{d.phone}</span>
                {d.id.startsWith('d-verified') && (
                  <span className="ml-auto text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    VERIFIED
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Alert Configuration Row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Alert Type</label>
          <select
            className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-[#2d6a4f]"
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as AlertType)}
          >
            {ALERT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ALERT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Severity</label>
          <select
            className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-[#2d6a4f]"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
          >
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as AlertSeverity[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Language</label>
          <select
            className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-[#2d6a4f]"
            value={language}
            onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
          >
            {Object.entries(LANGUAGE_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Provider</label>
          <select
            className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white focus:outline-none focus:border-[#2d6a4f] font-semibold text-[#1b4332]"
            value={provider}
            onChange={(e) => setProvider(e.target.value as SMSProvider)}
          >
            <option value="twilio">Twilio (Live Carrier Gateway)</option>
            <option value="mock">mock (Local Simulation)</option>
            <option value="msg91">MSG91 (India DLT)</option>
          </select>
        </div>
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-gray-700 uppercase">Message Variables</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="{location}"
            className="text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f]"
            value={locationVar}
            onChange={(e) => setLocationVar(e.target.value)}
          />
          <input
            type="text"
            placeholder="{alternateRoute}"
            className="text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f]"
            value={alternateRouteVar}
            onChange={(e) => setAlternateRouteVar(e.target.value)}
          />
          <input
            type="text"
            placeholder="{checkpoint}"
            className="text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f]"
            value={checkpointVar}
            onChange={(e) => setCheckpointVar(e.target.value)}
          />
        </div>
      </div>

      {/* Message Preview / Custom Toggle */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-gray-700 uppercase">Message Preview</label>
          <button
            type="button"
            onClick={() => setUseCustom(!useCustom)}
            className="text-xs text-[#2d6a4f] hover:underline font-semibold"
          >
            {useCustom ? '← Use Template' : '✏️ Override (Custom / Trial Template)'}
          </button>
        </div>

        {useCustom ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              className="w-full text-xs p-2.5 border-2 border-amber-400 rounded bg-amber-50 focus:outline-none focus:border-[#2d6a4f] font-mono"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="e.g. sms_customer_support, sms_delivery_updates, sms_internal_alerts, or custom text"
            />
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-500 font-bold">Trial Templates:</span>
              {['sms_customer_support', 'sms_internal_alerts', 'sms_delivery_updates'].map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setCustomMessage(tpl)}
                  className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono"
                >
                  {tpl}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-[#f8faf8] border border-[#d1d5db] rounded p-3 text-xs font-mono text-gray-800 leading-relaxed min-h-[56px] whitespace-pre-wrap">
            {previewMessage}
          </div>
        )}

        <div className="flex justify-between text-[10px] text-gray-400">
          <span>{previewMessage.length} characters</span>
          <span>
            {provider === 'twilio' ? 'Twilio Carrier Route (+17372583478)' : 'Local Route'}
          </span>
        </div>
      </div>

      {/* Send Button */}
      <button
        type="button"
        onClick={handleSend}
        disabled={isSending}
        className={`w-full flex items-center justify-center gap-2 py-3 text-white text-xs font-bold rounded shadow-xs uppercase tracking-wide transition disabled:opacity-50 ${
          severity === 'CRITICAL'
            ? 'bg-red-700 hover:bg-red-800'
            : 'bg-[#1b4332] hover:bg-[#2d6a4f]'
        }`}
      >
        {isSending ? (
          <>
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Dispatching via Twilio...
          </>
        ) : (
          <>
            <span>📡</span>
            <span>
              {broadcastMode
                ? `Dispatch via Twilio to ${selectedDriverIds.length || 'Selected'} Drivers`
                : `Dispatch SMS via Twilio`}
            </span>
          </>
        )}
      </button>
    </div>
  );
};
