import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateCorridor, evaluateReroute, fetchRouteOptions } from '../services/corridorApi';
import type {
  CorridorEvaluation,
  Disruption,
  Location,
  RerouteResult,
  RouteAlternative,
  RouteLandmark,
  SectorCard,
} from '../services/corridorApi';
import { CorridorMap } from './corridor/CorridorMap';
import { PlanForm } from './corridor/PlanForm';
import { RouteOptionsList } from './corridor/RouteOptionsList';
import type { OptionsStatus, RouteOption } from './corridor/RouteOptionsList';
import { SectorTable } from './corridor/SectorTable';
import { cumulativeKm } from './corridor/routeMath';
import { useTruckPlayback } from './corridor/useTruckPlayback';
import { JourneyMapLayers } from './corridor/JourneyMapLayers';
import { JourneyPanel } from './corridor/JourneyPanel';
import type { DisruptionDraft } from './corridor/JourneyPanel';
import { RerouteCard } from './corridor/RerouteCard';
import { detourLabel } from './corridor/risk';
import { buildDisruptionAlert } from './corridor/smsAlert';
import { JourneyTimeline } from './corridor/JourneyTimeline';
import type { JourneyEvent } from './corridor/JourneyTimeline';
import { smsStore } from '../modules/sms/services/smsStore';

interface Preset {
  label: string;
  origin: Location;
  destination: Location;
}

const PRESETS: Record<string, Preset> = {
  guwahati_gangtok: {
    label: 'Guwahati to Gangtok',
    origin: { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
    destination: { name: 'Gangtok', lat: 27.3389, lon: 88.6065 },
  },
  guwahati_shillong: {
    label: 'Guwahati to Shillong',
    origin: { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
    destination: { name: 'Shillong', lat: 25.5788, lon: 91.8933 },
  },
  silchar_aizawl: {
    label: 'Silchar to Aizawl',
    origin: { name: 'Silchar', lat: 24.8333, lon: 92.7789 },
    destination: { name: 'Aizawl', lat: 23.7271, lon: 92.7176 },
  },
  tezpur_tawang: {
    label: 'Tezpur to Tawang',
    origin: { name: 'Tezpur', lat: 26.6528, lon: 92.7926 },
    destination: { name: 'Tawang', lat: 27.5861, lon: 91.8594 },
  },
};
const PRESET_OPTIONS = Object.entries(PRESETS).map(([key, p]) => ({ key, label: p.label }));
const DEFAULT_KEY = 'guwahati_gangtok';
const DEFAULT_PRESET = PRESETS[DEFAULT_KEY];

/** The route the simulated truck is currently following. */
interface ActiveRoute {
  polyline: [number, number][];
  sectors: SectorCard[];
  junctions: RouteLandmark[];
  bridges: RouteLandmark[];
}

interface Journey {
  routeId: string;
  route: ActiveRoute;
  /** Travelled parts of routes followed before a reroute. */
  trails: [number, number][][];
  /** Parts of earlier routes given up after a reroute. */
  abandoned: [number, number][][];
}

const DISRUPTION_NAMES: Record<Disruption['type'], string> = {
  landslide: 'Landslide',
  flood: 'Flood',
  bridge_closure: 'Bridge closure',
  road_block: 'Road block',
};

const clockTime = () =>
  new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const optionFromEvaluation = (r: CorridorEvaluation): RouteOption => ({
  id: 'A',
  polyline: r.full_polyline,
  distance_km: r.total_distance_km,
  eta: r.total_journey_eta,
  eta_mins: r.total_journey_mins,
  risk: r.risk,
  sectors: r.sectors,
  junctions: r.junctions,
  bridges: r.bridges,
});

export const CorridorPage: React.FC = () => {
  // ─── Planning ───────────────────────────────────────────────────────────────
  const [presetKey, setPresetKey] = useState<string>(DEFAULT_KEY);
  const [scenario, setScenario] = useState<'1' | '2'>('1');
  const [corridorName, setCorridorName] = useState<string>(DEFAULT_PRESET.label);
  const [originQuery, setOriginQuery] = useState<string>(DEFAULT_PRESET.origin.name);
  const [destQuery, setDestQuery] = useState<string>(DEFAULT_PRESET.destination.name);
  // Last resolved endpoints; reused as coordinates while the input text still matches.
  const [origin, setOrigin] = useState<Location>(DEFAULT_PRESET.origin);
  const [destination, setDestination] = useState<Location>(DEFAULT_PRESET.destination);
  const [result, setResult] = useState<CorridorEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [optionsStatus, setOptionsStatus] = useState<OptionsStatus>('idle');
  const [optionsMessage, setOptionsMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('A');
  const [focusPoints, setFocusPoints] = useState<[number, number][] | null>(null);
  const requestId = useRef(0);

  const runEvaluation = useCallback(
    async (roadName: string, from: string | Location, to: string | Location, scenarioValue: '1' | '2') => {
      const id = ++requestId.current;
      setIsEvaluating(true);
      setError(null);
      setOptionsStatus('idle');
      setOptionsMessage(null);
      try {
        const data = await evaluateCorridor({ road_name: roadName, origin: from, destination: to, scenario: scenarioValue });
        if (id !== requestId.current) return; // a newer request superseded this one
        setResult(data);
        setOrigin(data.origin);
        setDestination(data.destination);
        setOptions([optionFromEvaluation(data)]);
        setSelectedId('A');
        setFocusPoints(null);
        setIsEvaluating(false);
        if (data.routing_status !== 'SUCCESS') return;

        // Other roads between the same places can take longer; show the main route first.
        setOptionsStatus('loading');
        try {
          const more = await fetchRouteOptions({
            road_name: roadName,
            origin: data.origin,
            destination: data.destination,
            scenario: scenarioValue,
          });
          if (id !== requestId.current) return;
          setOptions((prev) => [
            ...prev.slice(0, 1),
            ...more.alternatives.map((a, i) => ({ ...a, id: String.fromCharCode(66 + i) })), // B, C
          ]);
          setOptionsStatus(more.searched ? 'done' : 'unavailable');
          setOptionsMessage(more.message ?? null);
        } catch (err: any) {
          if (id !== requestId.current) return;
          setOptionsStatus('unavailable');
          setOptionsMessage(err.message);
        }
      } catch (err: any) {
        if (id === requestId.current) setError(err.message);
      } finally {
        if (id === requestId.current) setIsEvaluating(false);
      }
    },
    []
  );

  useEffect(() => {
    runEvaluation(DEFAULT_PRESET.label, DEFAULT_PRESET.origin, DEFAULT_PRESET.destination, '1');
  }, [runEvaluation]);

  // Send known coordinates when the text is unchanged, otherwise let the backend look up the name.
  const currentEndpoints = (): [string | Location, string | Location] => [
    originQuery.trim() === origin.name ? origin : originQuery.trim(),
    destQuery.trim() === destination.name ? destination : destQuery.trim(),
  ];

  const selectedOption = options.find((o) => o.id === selectedId) ?? options[0];

  const selectRoute = useCallback((id: string) => {
    setSelectedId(id);
    setFocusPoints(null);
  }, []);

  // ─── Journey simulation & dynamic rerouting ─────────────────────────────────
  const [journey, setJourney] = useState<Journey | null>(null);
  const playback = useTruckPlayback(journey?.route.polyline.length ?? 0);
  const [draft, setDraft] = useState<DisruptionDraft>({
    type: 'landslide',
    severity: 'blocked',
    radius_km: 2,
    outcome: 'auto',
  });
  const [placing, setPlacing] = useState<boolean>(false);
  const [disruption, setDisruption] = useState<Disruption | null>(null);
  const [reroute, setReroute] = useState<RerouteResult | null>(null);
  const [rerouteError, setRerouteError] = useState<string | null>(null);
  const [rerouteLoading, setRerouteLoading] = useState<boolean>(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [selectedAltId, setSelectedAltId] = useState<string | null>(null);
  const [events, setEvents] = useState<JourneyEvent[]>([]);
  const rerouteRequestId = useRef(0);

  const routeKm = useMemo(() => cumulativeKm(journey?.route.polyline ?? []), [journey]);
  const truckKm = routeKm[playback.index] ?? 0;
  const routeTotalKm = routeKm[routeKm.length - 1] ?? 0;

  useEffect(() => {
    if (!rerouteLoading) return;
    const timer = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [rerouteLoading]);

  const logEvent = (text: string) => setEvents((prev) => [...prev, { time: clockTime(), text }]);

  const clearDisruptionState = () => {
    rerouteRequestId.current++; // ignore any in-flight check
    setPlacing(false);
    setDisruption(null);
    setReroute(null);
    setRerouteError(null);
    setRerouteLoading(false);
    setSelectedAltId(null);
  };

  const stopJourney = () => {
    playback.pause();
    playback.setIndex(0);
    clearDisruptionState();
    setJourney(null);
    setEvents([]);
  };

  const startJourney = () => {
    if (!selectedOption) return;
    clearDisruptionState();
    setFocusPoints(null);
    setJourney({
      routeId: selectedOption.id,
      route: {
        polyline: selectedOption.polyline,
        sectors: selectedOption.sectors,
        junctions: selectedOption.junctions,
        bridges: selectedOption.bridges,
      },
      trails: [],
      abandoned: [],
    });
    playback.setIndex(0);
    setEvents([
      {
        time: clockTime(),
        text: `Journey started on route ${selectedOption.id}: ${corridorName}, ${selectedOption.distance_km.toFixed(0)} km.`,
      },
    ]);
    playback.play();
  };

  const placeDisruption = async (lat: number, lon: number) => {
    if (!journey) return;
    const { outcome, ...disruptionFields } = draft;
    const d: Disruption = { lat, lon, ...disruptionFields };
    const wasPlaying = playback.playing;
    const truckPosition = journey.route.polyline[playback.index];
    const id = ++rerouteRequestId.current;

    playback.pause();
    setPlacing(false);
    setDisruption(d);
    setReroute(null);
    setRerouteError(null);
    setSelectedAltId(null);
    setElapsedSec(0);
    setRerouteLoading(true);
    logEvent(
      `${DISRUPTION_NAMES[d.type]} reported (${d.severity === 'blocked' ? 'road blocked' : 'slow down'}) while the truck was at km ${truckKm.toFixed(0)}.`
    );

    try {
      const res = await evaluateReroute({
        current_route: journey.route.polyline,
        truck_position: truckPosition,
        disruption: d,
        road_name: corridorName,
        scenario,
        outcome: d.severity === 'blocked' ? outcome : 'auto',
      });
      if (id !== rerouteRequestId.current) return;
      if (res.relocated_from) {
        // force_reroute moved the simulated disruption to a spot with a real detour
        setDisruption({ ...d, lat: res.disruption.lat, lon: res.disruption.lon });
      }
      const recommendedAlt = res.alternatives.find((a) => a.recommended);
      setReroute(res);
      setSelectedAltId(recommendedAlt?.id ?? null);
      logEvent(res.message);
      // Only a blocking disruption needs an operator decision; otherwise keep driving.
      const needsDecision = ['REROUTE_AVAILABLE', 'NO_ALTERNATIVE', 'ROUTING_UNAVAILABLE'].includes(res.status);
      if (needsDecision) {
        autoNotifyVerifiedDrivers(res, recommendedAlt); // runs in the background, doesn't block the UI
      } else if (wasPlaying) {
        playback.play();
      }
    } catch (err: any) {
      if (id !== rerouteRequestId.current) return;
      setRerouteError(err.message);
      logEvent(`Disruption check failed: ${err.message}`);
    } finally {
      if (id === rerouteRequestId.current) setRerouteLoading(false);
    }
  };

  const acceptReroute = () => {
    const alt = reroute?.alternatives.find((a) => a.id === selectedAltId);
    if (!journey || !alt) return;
    const idx = playback.index;
    setJourney({
      ...journey,
      route: { polyline: alt.polyline, sectors: alt.sectors, junctions: alt.junctions, bridges: alt.bridges },
      trails: [...journey.trails, journey.route.polyline.slice(0, idx + 1)],
      abandoned: [...journey.abandoned, journey.route.polyline.slice(idx)],
    });
    playback.setIndex(0);
    setReroute(null);
    setSelectedAltId(null);
    logEvent(
      `Operator took ${detourLabel(alt.id).toLowerCase()}: ${alt.distance_km.toFixed(0)} km to go (${alt.extra_km >= 0 ? '+' : ''}${alt.extra_km.toFixed(0)} km, ${alt.extra_mins >= 0 ? '+' : ''}${alt.extra_mins} min).`
    );
    playback.play();
  };

  const keepRoute = () => {
    if (!reroute) return;
    if (reroute.status === 'REROUTE_AVAILABLE') {
      logEvent('Operator kept the current route despite the blockage.');
      playback.play();
    } else if (reroute.hold_point) {
      logEvent(`Operator acknowledged: vehicle to hold at ${reroute.hold_point.name}.`);
    }
    setReroute(null);
    setSelectedAltId(null);
  };

  const dismissRerouteMessage = () => {
    setReroute(null);
    setRerouteError(null);
  };

  // Sends a real SMS to every Twilio-verified driver as soon as a disruption actually blocks
  // the truck's route - automatic, no manual step. "Verified" drivers are the ones already
  // approved to receive SMS on the Twilio trial account (smsStore.VERIFIED_NUMBERS / the
  // 'd-verified-*' driver ids).
  const autoNotifyVerifiedDrivers = async (res: RerouteResult, alt: RouteAlternative | null | undefined) => {
    const verified = smsStore.listDrivers().filter((d) => d.id.startsWith('d-verified'));
    if (verified.length === 0) {
      logEvent('No verified drivers registered, so no automatic SMS was sent.');
      return;
    }
    const alertContent = buildDisruptionAlert(res, corridorName, alt);
    try {
      const results = await smsStore.bulkDispatch(
        {
          alertType: alertContent.alertType,
          severity: alertContent.severity,
          language: 'en',
          provider: 'twilio',
          variables: {
            location: alertContent.location,
            alternateRoute: alertContent.alternateRoute,
            checkpointName: alertContent.checkpointName,
            statusNote: 'Automatic alert from a simulated disruption',
          },
        },
        verified.map((d) => d.id)
      );
      const ok = results.filter((r) => r.status === 'sent' || r.status === 'delivered').length;
      logEvent(
        `SMS sent automatically to ${verified.length} verified driver(s): ${ok} sent, ${results.length - ok} failed.`
      );
    } catch (err: any) {
      logEvent(`Automatic SMS to verified drivers failed: ${err.message}`);
    }
  };

  // Opens the SMS alerts page in a new tab (so the journey keeps running) to compose or
  // resend the alert - e.g. after switching to a different detour.
  const notifyDriver = () => {
    if (!reroute) return;
    const alt = reroute.alternatives.find((a) => a.id === selectedAltId);
    const alertContent = buildDisruptionAlert(reroute, corridorName, alt);
    const params = new URLSearchParams({
      type: alertContent.alertType,
      location: alertContent.location,
      alternateRoute: alertContent.alternateRoute,
      ...(alertContent.checkpointName ? { checkpoint: alertContent.checkpointName } : {}),
    });
    window.open(`/sms?${params.toString()}`, '_blank', 'noopener');
    logEvent('SMS composer opened in a new tab.');
  };

  // ─── Planning form handlers ─────────────────────────────────────────────────
  const handlePresetChange = (key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    stopJourney();
    setPresetKey(key);
    setCorridorName(preset.label);
    setOriginQuery(preset.origin.name);
    setDestQuery(preset.destination.name);
    runEvaluation(preset.label, preset.origin, preset.destination, scenario);
  };

  const handleSubmit = () => {
    const from = originQuery.trim();
    const to = destQuery.trim();
    if (!from || !to) {
      setError('Enter where the trip starts and ends.');
      return;
    }
    stopJourney();
    const preset = PRESETS[presetKey];
    let roadName = corridorName;
    if (!preset || from !== preset.origin.name || to !== preset.destination.name) {
      roadName = `${from} to ${to}`;
      setPresetKey('custom');
      setCorridorName(roadName);
    }
    const [f, t] = currentEndpoints();
    runEvaluation(roadName, f, t, scenario);
  };

  const handleScenarioChange = (value: '1' | '2') => {
    stopJourney();
    setScenario(value);
    const [f, t] = currentEndpoints();
    runEvaluation(corridorName, f, t, value);
  };

  // ─── What the map and table show ────────────────────────────────────────────
  // While a journey runs they follow the truck's active route (which changes after a reroute);
  // otherwise the selected route option.
  const shown: ActiveRoute | null = journey ? journey.route : (selectedOption ?? null);
  const otherOptions = useMemo(
    () => (journey ? [] : options.filter((o) => o.id !== selectedId)),
    [journey, options, selectedId]
  );
  const rerouted = (journey?.trails.length ?? 0) > 0;
  const isFallback = result?.routing_status === 'FALLBACK';
  const tableTitle = journey
    ? rerouted
      ? 'Sectors on the rerouted journey'
      : `Sectors on route ${journey.routeId}`
    : `Sectors on route ${selectedOption?.id ?? 'A'}`;

  const showSectorOnMap = useCallback((s: SectorCard) => setFocusPoints(s.polyline), []);
  const emptyLine = useMemo<[number, number][]>(() => [], []);
  const emptyLandmarks = useMemo<RouteLandmark[]>(() => [], []);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rise-in">
        <h1 className="text-xl font-display font-bold tracking-tight">{corridorName}</h1>
        <p className="text-[0.85rem] text-muted">
          Roads from OpenStreetMap. Risk is a model estimate from sample hazard data, not a live feed.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
        <aside className="space-y-4 min-w-0 rise-in rise-in-1">
          <PlanForm
            originQuery={originQuery}
            destQuery={destQuery}
            onOriginChange={setOriginQuery}
            onDestChange={setDestQuery}
            presets={PRESET_OPTIONS}
            presetKey={presetKey}
            onPresetChange={handlePresetChange}
            scenario={scenario}
            onScenarioChange={handleScenarioChange}
            onSubmit={handleSubmit}
            busy={isEvaluating}
            error={error}
          />
          <RouteOptionsList
            options={options}
            selectedId={selectedId}
            onSelect={selectRoute}
            status={optionsStatus}
            message={optionsMessage}
            disabled={!!journey}
          />
          {selectedOption && (
            <JourneyPanel
              canStart={!!result && !isEvaluating && !isFallback}
              routeLabel={`route ${selectedOption.id}`}
              journeyActive={!!journey}
              onStart={startJourney}
              onStop={stopJourney}
              playing={playback.playing}
              onPlay={playback.play}
              onPause={playback.pause}
              truckIndex={playback.index}
              maxIndex={Math.max(0, (journey?.route.polyline.length ?? 1) - 1)}
              onSeek={playback.setIndex}
              truckKm={truckKm}
              totalKm={routeTotalKm}
              draft={draft}
              onDraftChange={setDraft}
              placing={placing}
              onTogglePlacing={() => setPlacing((p) => !p)}
              evaluating={rerouteLoading}
            />
          )}
        </aside>

        <section className="space-y-4 min-w-0 rise-in rise-in-2">
          {isFallback && result?.routing_warning && <p className="notice notice-warn">{result.routing_warning}</p>}
          {journey && (
            <RerouteCard
              evaluating={rerouteLoading}
              elapsedSec={elapsedSec}
              error={rerouteError}
              reroute={reroute}
              selectedAltId={selectedAltId}
              onSelectAlt={setSelectedAltId}
              onAccept={acceptReroute}
              onKeep={keepRoute}
              onNotify={notifyDriver}
              onDismiss={dismissRerouteMessage}
            />
          )}

          <CorridorMap
            origin={origin}
            destination={destination}
            sectors={shown?.sectors ?? []}
            line={shown?.polyline ?? emptyLine}
            junctions={shown?.junctions ?? emptyLandmarks}
            bridges={shown?.bridges ?? emptyLandmarks}
            otherOptions={otherOptions}
            onSelectOption={selectRoute}
            dashed={isFallback}
            fitPoints={focusPoints ?? shown?.polyline ?? emptyLine}
            journeyActive={!!journey}
            placingDisruption={placing}
          >
            {journey && (
              <JourneyMapLayers
                routeLine={journey.route.polyline}
                truckIndex={playback.index}
                truckKm={truckKm}
                previousTrails={journey.trails}
                abandoned={journey.abandoned}
                disruption={disruption}
                reroute={reroute}
                selectedAltId={selectedAltId}
                onSelectAlt={setSelectedAltId}
                placing={placing}
                onMapClick={placeDisruption}
              />
            )}
          </CorridorMap>

          <JourneyTimeline events={events} />

          {!result && !error && (
            <div className="panel p-4 space-y-2.5" aria-label="Calculating the route">
              <div className="skeleton h-4 w-2/5" />
              <div className="skeleton h-3 w-full" />
              <div className="skeleton h-3 w-4/5" />
              <div className="skeleton h-3 w-3/5" />
            </div>
          )}
          <SectorTable title={tableTitle} sectors={shown?.sectors ?? []} onShowOnMap={showSectorOnMap} />
        </section>
      </div>
    </div>
  );
};
