// src/modules/sms/services/smsStore.ts
// In-memory store + localStorage persistence + Live Twilio API dispatch.

import type { SMSRecord, DriverProfile, AlertType, AlertSeverity, SMSProvider, SupportedLanguage, AlertStatus } from '../types/sms';
import { generateMessageText } from '../types/sms';

const STORAGE_KEY = 'ner_sms_records';
const DRIVERS_KEY = 'ner_sms_drivers';

// ─── Verified trial numbers provided by user ─────────────────────────────────
export const VERIFIED_NUMBERS = [
  { phone: '+917305519021', name: 'Primary Driver (+91 7305519021)' },
  { phone: '+919994138347', name: 'Secondary Driver (+91 9994138347)' },
];

function getDefaultDrivers(): DriverProfile[] {
  return [
    {
      id: 'd-verified-1',
      name: 'Primary Driver (Twilio Verified)',
      phone: '+91 7305519021',
      language: 'en',
      vehicleId: 'MZ-01-A-7890',
      fleetId: 'MIZORAM-CARRIERS-01',
    },
    {
      id: 'd-verified-2',
      name: 'Secondary Driver (Twilio Verified)',
      phone: '+91 9994138347',
      language: 'en',
      vehicleId: 'AS-01-EC-4210',
      fleetId: 'ASSAM-LOGISTICS-02',
    },
    {
      id: 'd3',
      name: 'Bijoy Das',
      phone: '+91 94350 10002',
      language: 'as',
      vehicleId: 'AS-01-AB-5678',
      fleetId: 'FLEET-NER-A',
    },
    {
      id: 'd4',
      name: 'Lalremruata',
      phone: '+91 94350 10003',
      language: 'lus',
      vehicleId: 'MZ-01-AC-9012',
      fleetId: 'FLEET-NER-B',
    },
  ];
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

function loadRecords(): SMSRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SMSRecord[]) : [];
  } catch {
    return [];
  }
}

function saveRecords(records: SMSRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

function loadDrivers(): DriverProfile[] {
  try {
    const raw = localStorage.getItem(DRIVERS_KEY);
    if (!raw) return getDefaultDrivers();
    const parsed = JSON.parse(raw) as DriverProfile[];
    // Ensure verified numbers are included if missing
    const has730 = parsed.some((d) => d.phone.replace(/\s+/g, '') === '+917305519021');
    const has999 = parsed.some((d) => d.phone.replace(/\s+/g, '') === '+919994138347');
    if (!has730 || !has999) {
      const defaults = getDefaultDrivers();
      const merged = [
        ...defaults.filter((d) => d.id.startsWith('d-verified')),
        ...parsed.filter((p) => !defaults.some((def) => def.phone.replace(/\s+/g, '') === p.phone.replace(/\s+/g, ''))),
      ];
      saveDrivers(merged);
      return merged;
    }
    return parsed;
  } catch {
    return getDefaultDrivers();
  }
}

function saveDrivers(drivers: DriverProfile[]) {
  try {
    localStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
  } catch {}
}

// ─── Unique ID generator ──────────────────────────────────────────────────────

function uid(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface DispatchInput {
  phone: string;
  driverName?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  language: SupportedLanguage;
  provider: SMSProvider;
  variables: Record<string, string>;
  customMessage?: string;
}

export const smsStore = {
  listDrivers(): DriverProfile[] {
    return loadDrivers();
  },

  upsertDriver(profile: DriverProfile): DriverProfile[] {
    const drivers = loadDrivers();
    const idx = drivers.findIndex((d) => d.id === profile.id);
    if (idx >= 0) {
      drivers[idx] = profile;
    } else {
      drivers.unshift(profile);
    }
    saveDrivers(drivers);
    return drivers;
  },

  deleteDriver(id: string): DriverProfile[] {
    const drivers = loadDrivers().filter((d) => d.id !== id);
    saveDrivers(drivers);
    return drivers;
  },

  getDriverById(id: string): DriverProfile | undefined {
    return loadDrivers().find((d) => d.id === id);
  },

  listAlerts(): SMSRecord[] {
    return loadRecords();
  },

  async dispatch(input: DispatchInput): Promise<SMSRecord> {
    const message =
      input.customMessage?.trim() ||
      generateMessageText(input.alertType, input.variables);

    let status: AlertStatus = 'queued';
    let deliveredAt: string | undefined = undefined;
    let actualMessage = message;

    if (input.provider === 'mock') {
      status = 'delivered';
      deliveredAt = new Date().toISOString();
    } else if (input.provider === 'twilio') {
      try {
        const normalizedPhone = input.phone.replace(/[\s-]/g, '');
        const response = await fetch('/api/sms/twilio-dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: normalizedPhone,
            message,
          }),
        });

        const resData = await response.json();
        if (response.ok && resData.success) {
          status = 'sent';
          deliveredAt = new Date().toISOString();
          if (resData.body) {
            actualMessage = `${message}\n[Twilio SID: ${resData.sid}]`;
          }
        } else {
          status = 'failed';
          actualMessage = `${message}\n[Twilio Error: ${resData.error || 'Failed'}]`;
        }
      } catch (err: any) {
        status = 'failed';
        actualMessage = `${message}\n[Dispatch Error: ${err.message}]`;
      }
    }

    const record: SMSRecord = {
      id: uid(),
      phone: input.phone,
      driverName: input.driverName,
      language: input.language,
      alertType: input.alertType,
      severity: input.severity,
      message: actualMessage,
      status,
      provider: input.provider,
      timestamp: new Date().toISOString(),
      deliveredAt,
    };

    const existing = loadRecords();
    existing.unshift(record);
    saveRecords(existing);
    return record;
  },

  async bulkDispatch(input: Omit<DispatchInput, 'phone' | 'driverName'>, driverIds: string[]): Promise<SMSRecord[]> {
    const drivers = loadDrivers();
    const results: SMSRecord[] = [];
    for (const dId of driverIds) {
      const driver = drivers.find((d) => d.id === dId);
      if (!driver) continue;
      const rec = await smsStore.dispatch({
        ...input,
        language: driver.language,
        phone: driver.phone,
        driverName: driver.name,
      });
      results.push(rec);
    }
    return results;
  },

  clearAll() {
    saveRecords([]);
  },
};
