// src/modules/sms/components/AlertDispatcher.tsx
// Compose and send an SMS alert to one driver or several.

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { AlertType, AlertSeverity, SMSProvider, SupportedLanguage, DriverProfile } from '../types/sms';
import { ALERT_TYPES, ALERT_TYPE_LABELS, LANGUAGE_NAMES, SEVERITY_LABELS, generateMessageText } from '../types/sms';
import { smsStore, VERIFIED_NUMBERS, type DispatchInput } from '../services/smsStore';

interface AlertDispatcherProps {
  onDispatched: () => void;
}

const PROVIDER_LABELS: Record<SMSProvider, string> = {
  twilio: 'Twilio (real SMS)',
  mock: 'Test mode (not sent)',
  msg91: 'MSG91 (not set up)',
};

// Pre-approved message names the Twilio trial account accepts for Indian numbers.
const TWILIO_TRIAL_TEMPLATES = ['sms_internal_alerts', 'sms_customer_support', 'sms_delivery_updates'];

const smsParts = (text: string) => (text.length <= 160 ? 1 : Math.ceil(text.length / 153));

export const AlertDispatcher: React.FC<AlertDispatcherProps> = ({ onDispatched }) => {
  // Read once on mount; the driver list is managed on the Drivers tab.
  const [drivers] = useState<DriverProfile[]>(() => smsStore.listDrivers());
  const defaultDriver = drivers.find((d) => d.id === 'd-verified-1') ?? drivers[0];

  const [broadcastMode, setBroadcastMode] = useState<boolean>(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>(defaultDriver?.id ?? '');
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [manualPhone, setManualPhone] = useState<string>('');

  // The Routes page's "Send SMS to driver" button opens this page with the alert filled in
  // (?type=reroute&location=...&alternateRoute=...&checkpoint=...).
  const [searchParams] = useSearchParams();
  const prefillType = searchParams.get('type') as AlertType | null;

  const [alertType, setAlertType] = useState<AlertType>(
    prefillType && ALERT_TYPES.includes(prefillType) ? prefillType : 'road_block'
  );
  const [severity, setSeverity] = useState<AlertSeverity>(prefillType ? 'CRITICAL' : 'HIGH');
  const [language, setLanguage] = useState<SupportedLanguage>(defaultDriver?.language ?? 'en');
  const [provider, setProvider] = useState<SMSProvider>('twilio');
  const [locationVar, setLocationVar] = useState<string>(searchParams.get('location') || 'Guwahati to Gangtok');
  const [alternateRouteVar, setAlternateRouteVar] = useState<string>(
    searchParams.get('alternateRoute') || 'Use NH-27 via Shillong'
  );
  const [checkpointVar, setCheckpointVar] = useState<string>(searchParams.get('checkpoint') || 'Rangpo checkpost');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const previewMessage = useCustom
    ? customMessage
    : generateMessageText(alertType, {
        location: locationVar || 'the reported location',
        alternateRoute: alternateRouteVar || 'No alternative given',
        checkpointName: checkpointVar || 'the next checkpost',
        statusNote: 'All sectors assessed',
      });

  const toggleDriverSelect = (id: string) => {
    setSelectedDriverIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectVerifiedNumber = (phone: string) => {
    const matched = drivers.find((d) => d.phone.replace(/[\s-]/g, '') === phone);
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
      setNotification({ type: 'error', text: 'Choose a driver or enter a phone number.' });
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
        const ok = results.filter((r) => r.status === 'sent' || r.status === 'delivered').length;
        setNotification({
          type: ok === results.length ? 'ok' : 'error',
          text: `${ok} of ${results.length} messages sent. See History for details.`,
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
        setNotification(
          res.status === 'failed'
            ? { type: 'error', text: `Not sent: ${res.message.split('\n')[1] || 'unknown error'}` }
            : {
                type: 'ok',
                text:
                  provider === 'mock'
                    ? `Test alert recorded for ${driver?.name ?? phone} (no SMS was sent).`
                    : `SMS sent to ${driver?.name ?? phone}.`,
              }
        );
      }

      onDispatched();
    } catch (err: any) {
      setNotification({ type: 'error', text: `Could not send: ${err.message}` });
    } finally {
      setIsSending(false);
    }
  };

  const sendLabel = isSending
    ? 'Sending…'
    : provider === 'mock'
      ? 'Record test alert'
      : broadcastMode
        ? `Send to ${selectedDriverIds.length} driver${selectedDriverIds.length === 1 ? '' : 's'}`
        : 'Send SMS';

  return (
    <section className="panel p-4 space-y-4">
      {notification && (
        <p className={`notice ${notification.type === 'ok' ? 'notice-ok' : 'notice-error'}`}>{notification.text}</p>
      )}

      <fieldset className="space-y-2">
        <legend className="font-medium mb-1">Recipients</legend>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={!broadcastMode} onChange={() => setBroadcastMode(false)} className="accent-accent" />
            One driver
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={broadcastMode} onChange={() => setBroadcastMode(true)} className="accent-accent" />
            Several drivers
          </label>
        </div>

        {!broadcastMode ? (
          <>
            <select
              className="input"
              aria-label="Driver"
              value={selectedDriverId}
              onChange={(e) => {
                setSelectedDriverId(e.target.value);
                const d = drivers.find((x) => x.id === e.target.value);
                if (d) setLanguage(d.language);
                setManualPhone('');
              }}
            >
              <option value="">Enter a number instead…</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}, {d.phone}
                </option>
              ))}
            </select>
            {!selectedDriverId && (
              <input
                className="input num"
                aria-label="Phone number"
                placeholder="+91 98765 43210"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
              />
            )}
            <p className="text-[0.85rem] text-muted">
              Twilio trial numbers:{' '}
              {VERIFIED_NUMBERS.map((v, i) => (
                <React.Fragment key={v.phone}>
                  {i > 0 && ', '}
                  <button type="button" className="underline num" onClick={() => selectVerifiedNumber(v.phone)}>
                    {v.phone}
                  </button>
                </React.Fragment>
              ))}
            </p>
          </>
        ) : (
          <div className="border border-line rounded max-h-48 overflow-y-auto">
            {drivers.map((d) => (
              <label key={d.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-line-soft last:border-b-0 cursor-pointer hover:bg-canvas">
                <input
                  type="checkbox"
                  checked={selectedDriverIds.includes(d.id)}
                  onChange={() => toggleDriverSelect(d.id)}
                  className="accent-accent"
                />
                <span>{d.name}</span>
                <span className="num text-muted text-[0.85rem]">{d.phone}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="alert-type">Alert type</label>
          <select id="alert-type" className="input" value={alertType} onChange={(e) => setAlertType(e.target.value as AlertType)}>
            {ALERT_TYPES.map((t) => (
              <option key={t} value={t}>{ALERT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="alert-severity">Severity</label>
          <select id="alert-severity" className="input" value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)}>
            {(Object.keys(SEVERITY_LABELS) as AlertSeverity[]).map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="alert-language">Driver language</label>
          <select id="alert-language" className="input" value={language} onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}>
            {Object.entries(LANGUAGE_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <p className="text-[0.8rem] text-muted mt-1">Messages are in English for now.</p>
        </div>
        <div>
          <label className="label" htmlFor="alert-provider">Send through</label>
          <select id="alert-provider" className="input" value={provider} onChange={(e) => setProvider(e.target.value as SMSProvider)}>
            {(Object.keys(PROVIDER_LABELS) as SMSProvider[]).map((p) => (
              <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
            ))}
          </select>
        </div>
      </div>

      {!useCustom && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="var-location">Location</label>
            <input id="var-location" className="input" value={locationVar} onChange={(e) => setLocationVar(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="var-route">Alternative route</label>
            <input id="var-route" className="input" value={alternateRouteVar} onChange={(e) => setAlternateRouteVar(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="var-checkpoint">Checkpost</label>
            <input id="var-checkpoint" className="input" value={checkpointVar} onChange={(e) => setCheckpointVar(e.target.value)} />
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label mb-0">{useCustom ? 'Your message' : 'Message'}</span>
          <button type="button" onClick={() => setUseCustom(!useCustom)} className="underline text-[0.85rem]">
            {useCustom ? 'Use the template instead' : 'Write my own message'}
          </button>
        </div>
        {useCustom ? (
          <>
            <textarea
              rows={3}
              className="input"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Type the message, or pick a Twilio trial template below"
            />
            <p className="text-[0.85rem] text-muted">
              Twilio trial templates:{' '}
              {TWILIO_TRIAL_TEMPLATES.map((tpl, i) => (
                <React.Fragment key={tpl}>
                  {i > 0 && ', '}
                  <button type="button" onClick={() => setCustomMessage(tpl)} className="underline font-mono">
                    {tpl}
                  </button>
                </React.Fragment>
              ))}
            </p>
          </>
        ) : (
          <p className="border border-line rounded bg-canvas px-3 py-2 whitespace-pre-wrap">{previewMessage}</p>
        )}
        <p className="text-[0.85rem] text-muted num">
          {previewMessage.length} characters, {smsParts(previewMessage)} SMS part{smsParts(previewMessage) === 1 ? '' : 's'}
        </p>
      </div>

      <button type="button" onClick={handleSend} disabled={isSending} className="btn btn-primary">
        {sendLabel}
      </button>
    </section>
  );
};
