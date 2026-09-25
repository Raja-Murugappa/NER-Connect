// src/modules/sms/components/AlertLedger.tsx
// History of sent alerts, newest first.

import React, { useState } from 'react';
import type { SMSRecord, AlertStatus } from '../types/sms';
import { ALERT_TYPE_LABELS, LANGUAGE_NAMES, SEVERITY_LABELS, STATUS_LABELS } from '../types/sms';

interface AlertLedgerProps {
  records: SMSRecord[];
  onClearAll: () => void;
}

const STATUS_FILTERS: (AlertStatus | 'all')[] = ['all', 'sent', 'delivered', 'failed', 'queued'];

const STATUS_CLASS: Record<AlertStatus, string> = {
  queued: 'text-muted',
  sent: '',
  delivered: 'text-risk-low',
  failed: 'text-risk-high',
};

export const AlertLedger: React.FC<AlertLedgerProps> = ({ records, onClearAll }) => {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = statusFilter === 'all' ? records : records.filter((r) => r.status === statusFilter);

  return (
    <section className="panel">
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-line">
        <label className="flex items-center gap-2">
          <span className="text-muted">Show</span>
          <select
            className="input w-auto"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'all')}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === 'all' ? `All (${records.length})` : `${STATUS_LABELS[f]} (${records.filter((r) => r.status === f).length})`}
              </option>
            ))}
          </select>
        </label>
        {records.length > 0 && (
          <button type="button" onClick={onClearAll} className="btn">
            Delete history
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-muted">
          {records.length === 0 ? 'No alerts sent yet.' : 'No alerts with this status.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>To</th>
                <th>Alert</th>
                <th>Severity</th>
                <th>Status</th>
                <th aria-label="Details" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec) => {
                const isExpanded = expanded === rec.id;
                return (
                  <React.Fragment key={rec.id}>
                    <tr className="cursor-pointer hover:bg-canvas" onClick={() => setExpanded(isExpanded ? null : rec.id)}>
                      <td className="num">
                        {new Date(rec.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td>
                        {rec.driverName ?? rec.phone}
                        {rec.driverName && <span className="block num text-[0.85rem] text-muted">{rec.phone}</span>}
                      </td>
                      <td>{ALERT_TYPE_LABELS[rec.alertType]}</td>
                      <td>{SEVERITY_LABELS[rec.severity]}</td>
                      <td className={STATUS_CLASS[rec.status]}>{STATUS_LABELS[rec.status]}</td>
                      <td className="text-muted text-[0.85rem]">{isExpanded ? 'Hide' : 'Details'}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-canvas">
                          <p className="whitespace-pre-wrap">{rec.message}</p>
                          <p className="text-[0.85rem] text-muted mt-1">
                            {rec.message.length} characters. Sent through {rec.provider}. Driver language:{' '}
                            {LANGUAGE_NAMES[rec.language]}.
                            {rec.deliveredAt && ` Confirmed ${new Date(rec.deliveredAt).toLocaleString()}.`}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
