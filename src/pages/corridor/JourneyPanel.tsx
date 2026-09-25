// src/pages/corridor/JourneyPanel.tsx
// Controls for the journey simulation: truck playback + disruption injection.
import React from 'react';
import type { DisruptionSeverity, DisruptionType, SimulatedOutcome } from '../../services/corridorApi';

export interface DisruptionDraft {
  type: DisruptionType;
  severity: DisruptionSeverity;
  radius_km: number;
  outcome: SimulatedOutcome;
}

const OUTCOME_HELP: Record<SimulatedOutcome, string> = {
  auto: 'Searches for a real road detour around the spot you click.',
  force_reroute:
    'If there is no detour at your spot (a single-road stretch), the disruption is moved to the nearest spot ahead that has one.',
  force_hold: 'Treats every detour as closed too, so the truck has to wait. No search is done.',
};

interface JourneyPanelProps {
  canStart: boolean;
  routeLabel: string;
  journeyActive: boolean;
  onStart: () => void;
  onStop: () => void;
  onFinish: () => void;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  truckIndex: number;
  maxIndex: number;
  onSeek: (index: number) => void;
  truckKm: number;
  totalKm: number;
  draft: DisruptionDraft;
  onDraftChange: (draft: DisruptionDraft) => void;
  placing: boolean;
  onTogglePlacing: () => void;
  evaluating: boolean;
}

export const JourneyPanel: React.FC<JourneyPanelProps> = ({
  canStart,
  routeLabel,
  journeyActive,
  onStart,
  onStop,
  onFinish,
  playing,
  onPlay,
  onPause,
  truckIndex,
  maxIndex,
  onSeek,
  truckKm,
  totalKm,
  draft,
  onDraftChange,
  placing,
  onTogglePlacing,
  evaluating,
}) => {
  if (!journeyActive) {
    return (
      <section className="panel p-4 space-y-2">
        <h2 className="panel-title">Journey simulation</h2>
        <p className="text-[0.9rem] text-muted">
          Drive a simulated truck along {routeLabel}, report a disruption ahead of it and see whether it needs to be
          rerouted. There is no live vehicle GPS yet.
        </p>
        <button type="button" onClick={onStart} disabled={!canStart} className="btn w-full">
          Start journey on {routeLabel}
        </button>
      </section>
    );
  }

  const arrived = truckIndex >= maxIndex;

  return (
    <section className="panel p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="panel-title">Journey simulation</h2>
        <span className="text-[0.85rem] text-muted">Simulated vehicle</span>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={playing ? onPause : onPlay}
            disabled={evaluating || arrived}
            className="btn btn-route flex-1"
          >
            {arrived ? 'Arrived' : playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={onFinish} disabled={evaluating || arrived} className="btn btn-primary">
            End
          </button>
          <button type="button" onClick={onStop} className="btn">
            End journey
          </button>
        </div>
        <p className="text-[0.85rem] text-muted">
          "End" finishes the trip now and marks the delivery delivered. "End journey" stops without finishing.
        </p>
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={truckIndex}
          onChange={(e) => onSeek(Number(e.target.value))}
          disabled={evaluating}
          aria-label="Truck position along the route"
          className="w-full accent-route"
        />
        <p className="num text-[0.9rem] text-muted">
          km {truckKm.toFixed(0)} of {totalKm.toFixed(0)}
        </p>
      </div>

      <fieldset className="space-y-2 border-t border-line-soft pt-3">
        <legend className="font-medium pt-3">Report a disruption</legend>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="dis-type">Type</label>
            <select
              id="dis-type"
              className="input"
              value={draft.type}
              onChange={(e) => onDraftChange({ ...draft, type: e.target.value as DisruptionType })}
            >
              <option value="landslide">Landslide</option>
              <option value="flood">Flood</option>
              <option value="bridge_closure">Bridge closure</option>
              <option value="road_block">Road block</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dis-effect">Effect</label>
            <select
              id="dis-effect"
              className="input"
              value={draft.severity}
              onChange={(e) => onDraftChange({ ...draft, severity: e.target.value as DisruptionSeverity })}
            >
              <option value="blocked">Road blocked</option>
              <option value="caution">Slow down only</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dis-radius">Area</label>
            <select
              id="dis-radius"
              className="input"
              value={draft.radius_km}
              onChange={(e) => onDraftChange({ ...draft, radius_km: Number(e.target.value) })}
            >
              <option value={1}>1 km radius</option>
              <option value={2}>2 km radius</option>
              <option value={5}>5 km radius</option>
            </select>
          </div>
          {draft.severity === 'blocked' && (
            <div>
              <label className="label" htmlFor="dis-outcome">Outcome</label>
              <select
                id="dis-outcome"
                className="input"
                value={draft.outcome}
                onChange={(e) => onDraftChange({ ...draft, outcome: e.target.value as SimulatedOutcome })}
              >
                <option value="auto">Real check</option>
                <option value="force_reroute">Force a reroute</option>
                <option value="force_hold">Force a hold</option>
              </select>
            </div>
          )}
        </div>
        {draft.severity === 'blocked' && <p className="text-[0.85rem] text-muted">{OUTCOME_HELP[draft.outcome]}</p>}
        <button type="button" onClick={onTogglePlacing} disabled={evaluating} className="btn w-full">
          {placing ? 'Cancel placing' : 'Place on map'}
        </button>
      </fieldset>
    </section>
  );
};
