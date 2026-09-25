// src/modules/deliveries/services/deliveryStore.ts
// localStorage-persisted delivery records, same pattern as the SMS module's smsStore.
import type { DeliveryProduct, DeliveryRecord, DeliveryStatus } from '../types/delivery';

const STORAGE_KEY = 'ner_delivery_records';

function loadRecords(): DeliveryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeliveryRecord[];
    // Records saved before the product field existed default to 'none', not undefined.
    return parsed.map((r) => (r.product ? r : { ...r, product: 'none' as DeliveryProduct }));
  } catch {
    return [];
  }
}

function saveRecords(records: DeliveryRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

function uid(): string {
  return `delivery_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export const deliveryStore = {
  list(): DeliveryRecord[] {
    return loadRecords();
  },

  /** Created the moment a route search succeeds, before the journey simulation starts. */
  plan(input: { corridorName: string; routeId: string; distanceKm: number; product: DeliveryProduct }): DeliveryRecord {
    const now = new Date().toISOString();
    const record: DeliveryRecord = {
      id: uid(),
      corridorName: input.corridorName,
      routeId: input.routeId,
      distanceKm: input.distanceKm,
      product: input.product,
      status: 'planned',
      note: 'Route planned.',
      startedAt: now,
      updatedAt: now,
    };
    const records = loadRecords();
    records.unshift(record);
    saveRecords(records);
    return record;
  },

  updateStatus(id: string, status: DeliveryStatus, note: string): DeliveryRecord[] {
    const records = loadRecords();
    const idx = records.findIndex((r) => r.id === id);
    if (idx < 0) return records;
    const now = new Date().toISOString();
    const ended = status === 'delivered' || status === 'cancelled';
    records[idx] = { ...records[idx], status, note, updatedAt: now, endedAt: ended ? now : records[idx].endedAt };
    saveRecords(records);
    return records;
  },

  clearAll() {
    saveRecords([]);
  },
};
