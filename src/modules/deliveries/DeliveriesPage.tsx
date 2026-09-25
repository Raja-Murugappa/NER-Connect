// src/modules/deliveries/DeliveriesPage.tsx
// History of simulated deliveries (journeys), newest first - same layout as the SMS
// alerts page's History tab.
import React, { useState } from 'react';
import { deliveryStore } from './services/deliveryStore';
import type { DeliveryRecord, DeliveryStatus } from './types/delivery';
import { DELIVERY_PRODUCT_LABEL, DELIVERY_STATUS_CLASS, DELIVERY_STATUS_LABEL } from './types/delivery';

const STATUS_FILTERS: (DeliveryStatus | 'all')[] = [
  'all', 'planned', 'in_transit', 'delayed', 'rerouted', 'blocked', 'delivered', 'cancelled',
];

const durationText = (rec: DeliveryRecord) => {
  const end = rec.endedAt ? new Date(rec.endedAt).getTime() : Date.now();
  const mins = Math.max(0, Math.round((end - new Date(rec.startedAt).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export const DeliveriesPage: React.FC = () => {
  const [records, setRecords] = useState<DeliveryRecord[]>(() => deliveryStore.list());
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');

  const handleClearAll = () => {
    if (!confirm('Delete the whole delivery history in this browser?')) return;
    deliveryStore.clearAll();
    setRecords([]);
  };

  const filtered = statusFilter === 'all' ? records : records.filter((r) => r.status === statusFilter);
  const active = records.filter((r) => !r.endedAt).length;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rise-in">
        <h1 className="text-xl font-display font-bold tracking-tight">Delivery status</h1>
        <p className="text-[0.85rem] text-muted">
          Tracks the simulated journey on the Routes page. There is no live vehicle GPS yet, so this reflects
          what the journey simulation reports, not a real fleet feed.
        </p>
      </div>

      <section className="panel rise-in rise-in-1">
        <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-line">
          <label className="flex items-center gap-2">
            <span className="text-muted">Show</span>
            <select
              className="input w-auto"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | 'all')}
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f} value={f}>
                  {f === 'all'
                    ? `All (${records.length})`
                    : `${DELIVERY_STATUS_LABEL[f]} (${records.filter((r) => r.status === f).length})`}
                </option>
              ))}
            </select>
          </label>
          <span className="text-[0.85rem] text-muted">{active} in progress</span>
          {records.length > 0 && (
            <button type="button" onClick={handleClearAll} className="btn">
              Delete history
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-muted">
            {records.length === 0
              ? 'No deliveries yet. Search for a route on the Routes page to create one.'
              : 'No deliveries with this status.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Corridor</th>
                  <th>Route</th>
                  <th>Product</th>
                  <th>Distance</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec) => (
                  <tr key={rec.id}>
                    <td className="num">{new Date(rec.startedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{rec.corridorName}</td>
                    <td>Route {rec.routeId}</td>
                    <td>{DELIVERY_PRODUCT_LABEL[rec.product]}</td>
                    <td className="num">{rec.distanceKm.toFixed(0)} km</td>
                    <td className="num">{durationText(rec)}</td>
                    <td>
                      <span className={`risk ${DELIVERY_STATUS_CLASS[rec.status]}`}>{DELIVERY_STATUS_LABEL[rec.status]}</span>
                    </td>
                    <td className="text-[0.9rem] text-muted max-w-[280px]">{rec.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default DeliveriesPage;
