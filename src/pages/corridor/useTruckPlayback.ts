// src/pages/corridor/useTruckPlayback.ts
// Moves a simulated truck along a route's points. Stands in for live vehicle GPS.
import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 150;
const FULL_TRIP_SECONDS = 60; // a normal playthrough plays end-to-end in about a minute
const FAST_FORWARD_MS = 1500; // "End" finishes the trip in about 1.5s, still animated

export function useTruckPlayback(pointCount: number) {
  const [index, setIndexState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fast, setFast] = useState(false);
  const lastIndex = Math.max(0, pointCount - 1);

  useEffect(() => {
    if (!playing) return;
    const totalMs = fast ? FAST_FORWARD_MS : FULL_TRIP_SECONDS * 1000;
    const step = Math.max(1, Math.round(pointCount / (totalMs / TICK_MS)));
    const timer = setInterval(() => {
      setIndexState((i) => Math.min(i + step, lastIndex));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, fast, pointCount, lastIndex]);

  const current = Math.min(index, lastIndex);
  const arrived = playing && current >= lastIndex;

  // Any manual seek exits fast-forward mode, so a later "Play" runs at normal speed.
  const setIndex = useCallback(
    (i: number) => {
      setFast(false);
      setIndexState(Math.max(0, Math.min(i, lastIndex)));
    },
    [lastIndex]
  );
  // Playback reports "not playing" once the truck reaches the end of the route.
  const play = useCallback(() => {
    setFast(false);
    setPlaying(true);
  }, []);
  const pause = useCallback(() => setPlaying(false), []);
  // "End": finishes the trip quickly from wherever the truck is now, still an animated
  // playthrough (not a teleport), for a quick "mark this delivered" action.
  const finishNow = useCallback(() => {
    setFast(true);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (arrived) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
  }, [arrived]);

  // Distinct from the transient `arrived` pulse above (which only exists to trigger the
  // auto-pause effect): this stays true once the truck reaches the last point, regardless
  // of play/pause state, so callers can reliably detect "reached the destination" once.
  const atDestination = lastIndex > 0 && current >= lastIndex;

  return { index: current, setIndex, playing: playing && !arrived, play, pause, finishNow, atDestination };
}
