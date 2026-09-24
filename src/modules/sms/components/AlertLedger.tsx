// src/modules/sms/components/AlertLedger.tsx
// Delivery audit table: mirrors E:\sms GET /api/v1/alerts

import React, { useState } from 'react';
import type { SMSRecord, AlertStatus, AlertSeverity } from '../types/sms';
import {
  ALERT_TYPE_LABELS,
  LANGUAGE_NAMES,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
} from '../types/sms';

interface AlertLedgerProps {
  records: SMSRecord[];
  onClearAll: () => void;
}

const STATUS_FILTERS: (AlertStatus | 'all')[] = ['all', 'queued', 'sent', 'delivered', 'failed'];

export const AlertLedger: React.FC<AlertLedgerProps> = ({ records, onClearAll }) => {
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'all'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered =
    statusFilter === 'all' ? records : records.filter((r) => r.status === statusFilter);

  const counts = {
    total: records.length,
    delivered: records.filter((r) => r.status === 'delivered').length,
    failed: records.filter((r) => r.status === 'failed').length,
    queued: records.filter((r) => r.status === 'queued').length,
  };

  return (
    <div className="ner-card overflow-hidden">
      <div className="ner-card-header bg-[#f8faf8] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="ner-heading text-xs">Alert Dispatch Ledger</span>
          <span className="text-[10px] bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-full">
            {records.length} Records
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Summary pills */}
          <span className="text-[10px] badge-safe px-2 py-0.5 rounded-full font-bold">
            ✓ {counts.delivered} Delivered
          </span>
          <span className="text-[10px] badge-danger px-2 py-0.5 rounded-full font-bold">
            ✗ {counts.failed} Failed
          </span>
          {records.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-[10px] text-red-600 hover:underline font-semibold"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Status Filters */}
      <div className="px-4 pt-3 flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={`text-xs font-bold px-3 py-1 rounded border transition capitalize ${
              statusFilter === f
                ? 'bg-[#2d6a4f] text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-300 hover:border-[#2d6a4f]'
            }`}
          >
            {f === 'all' ? `All (${counts.total})` : STATUS_CONFIG[f as AlertStatus]?.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs space-y-1">
            <p className="font-semibold text-gray-700">No alerts dispatched yet.</p>
            <p>Use the dispatcher above to send an SMS alert to a driver.</p>
          </div>
        ) : (
          <div className="space-y-2 mt-2">
            {filtered.map((rec) => {
              const severityConf = SEVERITY_CONFIG[rec.severity as AlertSeverity];
              const statusConf = STATUS_CONFIG[rec.status];
              const isExpanded = expanded === rec.id;

              return (
                <div
                  key={rec.id}
                  className="border border-[#d1d5db] rounded-lg overflow-hidden bg-white"
                >
                  {/* Row Header */}
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition gap-3"
                    onClick={() => setExpanded(isExpanded ? null : rec.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${severityConf.dotClass}`} />
                      <span className="font-bold text-xs text-[#1b4332] truncate">
                        {rec.driverName ?? rec.phone}
                      </span>
                      <span className="text-[10px] text-gray-500 truncate hidden sm:block">
                        {ALERT_TYPE_LABELS[rec.alertType]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${severityConf.badgeClass}`}
                      >
                        {rec.severity}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusConf.badgeClass}`}
                      >
                        {statusConf.label}
                      </span>
                      <span className="text-[10px] text-gray-500 hidden sm:block">
                        {new Date(rec.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-[#f8faf8] text-xs">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-500 block">Phone</span>
                          <span className="font-mono text-gray-800">{rec.phone}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-500 block">Language</span>
                          <span className="text-gray-800">{LANGUAGE_NAMES[rec.language]}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-500 block">Provider</span>
                          <span className="text-gray-800 uppercase font-mono">{rec.provider}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-gray-500 block">Alert ID</span>
                          <span className="font-mono text-gray-500 truncate text-[10px]">{rec.id}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">
                          Message Payload
                        </span>
                        <div className="bg-white border border-[#d1d5db] rounded p-2.5 font-mono text-gray-800 whitespace-pre-wrap leading-relaxed text-[11px]">
                          {rec.message}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1 text-right">
                          {rec.message.length} chars •{' '}
                          {rec.message.length <= 160 ? '1 segment' : `${Math.ceil(rec.message.length / 153)} segments`}
                        </div>
                      </div>

                      {rec.deliveredAt && (
                        <div className="text-[10px] text-[#1b5e20] font-semibold">
                          ✓ Delivered at {new Date(rec.deliveredAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
