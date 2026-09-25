// src/pages/corridor/RouteOptionsList.tsx
// The candidate routes for a trip, compared side by side. The operator picks one;
// nothing is pre-chosen for them beyond showing the main road first.
import React, { memo } from 'react';
import type { AlternativeRoute, RouteLandmark } from '../../services/corridorApi';
import { describeRisk, RISK_CLASS, RISK_RANK } from './risk';

export interface RouteOption extends AlternativeRoute {
  id: string; // "A", "B", "C"
  junctions: RouteLandmark[];
  bridges: RouteLandmark[];
}

export type OptionsStatus = 'idle' | 'loading' | 'done' | 'unavailable';

interface RouteOptionsListProps {
  options: RouteOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  status: OptionsStatus;
  message: string | null;
  disabled: boolean;
}

function tagsFor(options: RouteOption[]): Record<string, string[]> {
  const tags: Record<string, string[]> = Object.fromEntries(options.map((o) => [o.id, []]));
  if (options.length < 2) return tags;
  const best = (score: (o: RouteOption) => number) =>
    options.reduce((a, b) => (score(b) < score(a) ? b : a)).id;
  tags[best((o) => o.eta_mins)].push('Fastest');
  tags[best((o) => o.distance_km)].push('Shortest');
  tags[best((o) => RISK_RANK[o.risk.worst] * 100000 + o.risk.km_by_level.danger * 100 + o.risk.km_by_level.caution)].push(
    'Lowest risk'
  );
  return tags;
}

export const RouteOptionsList: React.FC<RouteOptionsListProps> = memo(
  ({ options, selectedId, onSelect, status, message, disabled }) => {
    if (options.length === 0) return null;
    const tags = tagsFor(options);

    return (
      <section className="panel">
        <h2 className="panel-title px-4 pt-3 pb-2">Routes</h2>
        <ul>
          {options.map((o) => {
            const selected = o.id === selectedId;
            return (
              <li key={o.id} className="border-t border-line-soft">
                <label
                  className={`row-interactive flex gap-3 px-4 py-2.5 cursor-pointer ${selected ? 'bg-accent-soft' : ''} ${
                    disabled ? 'cursor-not-allowed opacity-70' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="route-option"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onSelect(o.id)}
                    className="mt-1 accent-accent"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">Route {o.id}</span>
                      <span className="num text-muted">
                        {o.distance_km.toFixed(0)} km, {o.eta}
                      </span>
                    </span>
                    <span className={`risk ${RISK_CLASS[o.risk.worst]} text-[0.85rem]`}>{describeRisk(o.risk)}</span>
                    {tags[o.id].length > 0 && (
                      <span className="block text-[0.85rem] text-muted">{tags[o.id].join(', ')}</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="px-4 py-2.5 border-t border-line-soft text-[0.85rem] text-muted">
          {status === 'loading' && 'Looking for other roads between these places…'}
          {status === 'done' &&
            (options.length === 1
              ? 'No other road route found between these places.'
              : 'Compare the routes and pick one. Other routes are shown grey on the map.')}
          {status === 'unavailable' && (message ?? 'Other routes could not be checked.')}
          {disabled && status !== 'loading' && ' End the journey to change route.'}
        </p>
      </section>
    );
  }
);
