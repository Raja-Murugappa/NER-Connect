// src/pages/corridor/RerouteCard.tsx
// Outcome of a disruption check. When the road ahead is blocked, the operator compares the
// detours with the current route and decides. The system recommends; it never switches alone.
import React from 'react';
import type { RerouteResult } from '../../services/corridorApi';
import { describeRisk, detourLabel, RISK_CLASS } from './risk';

interface RerouteCardProps {
  evaluating: boolean;
  elapsedSec: number;
  error: string | null;
  reroute: RerouteResult | null;
  selectedAltId: string | null;
  onSelectAlt: (id: string) => void;
  onAccept: () => void;
  onKeep: () => void;
  onNotify: () => void;
  onDismiss: () => void;
}

const signed = (n: number, unit: string) => `${n >= 0 ? '+' : '−'}${Math.abs(n)} ${unit}`;

export const RerouteCard: React.FC<RerouteCardProps> = ({
  evaluating,
  elapsedSec,
  error,
  reroute,
  selectedAltId,
  onSelectAlt,
  onAccept,
  onKeep,
  onNotify,
  onDismiss,
}) => {
  if (evaluating) {
    return (
      <p className="notice notice-info">
        Checking the disruption against the journey… {elapsedSec} s
        <span className="block text-[0.9rem] text-muted">
          Looking for a road detour around it. The public routing server can take up to a minute, longer when there
          is no detour and a wider area is searched.
        </span>
      </p>
    );
  }

  if (error) {
    return (
      <div className="notice notice-error flex justify-between gap-3">
        <span>{error}</span>
        <button type="button" onClick={onDismiss} className="underline shrink-0">
          Dismiss
        </button>
      </div>
    );
  }

  if (!reroute) return null;

  // No impact, or slow down only: a single line.
  if (reroute.status === 'NOT_ON_ROUTE' || reroute.status === 'BEHIND' || reroute.status === 'ADVISORY') {
    return (
      <div className={`notice ${reroute.status === 'ADVISORY' ? 'notice-warn' : 'notice-ok'} flex justify-between gap-3`}>
        <span>{reroute.message}</span>
        <button type="button" onClick={onDismiss} className="underline shrink-0">
          Dismiss
        </button>
      </div>
    );
  }

  const current = reroute.current_remaining;
  const selected = reroute.alternatives.find((a) => a.id === selectedAltId) ?? null;

  return (
    <section className="panel border-risk-high">
      <div className="px-4 py-3 bg-risk-high-soft border-b border-line">
        <h2 className="panel-title">Road ahead is blocked</h2>
        <p className="text-[0.9rem] mt-0.5">{reroute.message}</p>
        {reroute.simulated && <p className="text-[0.85rem] text-muted mt-1">This outcome was set by the simulation.</p>}
      </div>

      <div className="p-4 space-y-3">
        {reroute.status === 'REROUTE_AVAILABLE' ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Risk</th>
                  <th>Remaining</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-muted">
                  <td>Current route</td>
                  <td>Blocked</td>
                  <td className="num">{current?.distance_km.toFixed(0)} km</td>
                  <td className="num">–</td>
                </tr>
                {reroute.alternatives.map((alt) => (
                  <tr
                    key={alt.id}
                    onClick={() => onSelectAlt(alt.id)}
                    className={`cursor-pointer ${alt.id === selectedAltId ? 'bg-route-soft' : 'hover:bg-canvas'}`}
                  >
                    <td>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="detour"
                          checked={alt.id === selectedAltId}
                          onChange={() => onSelectAlt(alt.id)}
                          className="mt-1 accent-route"
                        />
                        <span>
                          {detourLabel(alt.id)}
                          {alt.recommended && <span className="text-muted"> (recommended)</span>}
                          <span className="block text-[0.85rem] text-muted">
                            Leaves at km {alt.bypass.exit_km.toFixed(0)}, rejoins at km {alt.bypass.rejoin_km.toFixed(0)}
                          </span>
                        </span>
                      </label>
                    </td>
                    <td>
                      <span className={`risk ${RISK_CLASS[alt.worst_risk]} text-[0.9rem]`}>{describeRisk(alt.risk)}</span>
                    </td>
                    <td className="num">
                      {alt.distance_km.toFixed(0)} km
                      <span className="block text-[0.85rem] text-muted">{signed(Math.round(alt.extra_km), 'km')}</span>
                    </td>
                    <td className="num">
                      {alt.eta}
                      <span className="block text-[0.85rem] text-muted">{signed(alt.extra_mins, 'min')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {reroute.status === 'ROUTING_UNAVAILABLE'
              ? 'The routing server could not be reached, so no detour search was done. Place the disruption again to retry.'
              : reroute.simulated
                ? 'Simulated: every detour around this disruption is closed.'
                : 'No road detour avoids this disruption.'}
            {reroute.hold_point && (
              <span className="block mt-1">
                Hold the vehicle at <strong className="font-medium">{reroute.hold_point.name}</strong> (km{' '}
                {reroute.hold_point.km.toFixed(0)}) until the road is cleared.
              </span>
            )}
          </p>
        )}

        {reroute.search && (
          <p className="text-[0.85rem] text-muted">
            Checked {reroute.search.routes_checked} candidate roads; {reroute.search.rejected} rejected because they
            pass through the disruption, dead-end or are far too long
            {reroute.search.failed > 0 && `; ${reroute.search.failed} routing requests failed`}. Travel times come from
            the risk model, so a longer detour can be faster if it avoids high-risk sectors.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {reroute.status === 'REROUTE_AVAILABLE' && (
            <button type="button" onClick={onAccept} disabled={!selected} className="btn btn-route">
              Take {selected ? detourLabel(selected.id).toLowerCase() : 'detour'}
            </button>
          )}
          <button type="button" onClick={onKeep} className="btn">
            {reroute.status === 'REROUTE_AVAILABLE' ? 'Keep current route' : 'Acknowledge'}
          </button>
          <button type="button" onClick={onNotify} className="btn">
            Send SMS to driver
          </button>
        </div>
      </div>
    </section>
  );
};
