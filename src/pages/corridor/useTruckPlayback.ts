// src/pages/corridor/useTruckPlayback.ts
// Moves a simulated truck along a route's points. Stands in for live vehicle GPS.
import { useCallback, useEffect, useState } from 'react';

const TICK_MS = 150;
const FULL_TRIP_SECONDS = 60; // any route plays end-to-end in about a minute

export function useTruckPlayback(pointCount: number) {
  const [index, setIndexState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastIndex = Math.max(0, pointCount - 1);

  useEffect(() => {
    if (!playing) return;
    const step = Math.max(1, Math.round(pointCount / ((FULL_TRIP_SECONDS * 1000) / TICK_MS)));
    const timer = setInterval(() => {
      setIndexState((i) => Math.min(i + step, lastIndex));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, pointCount, lastIndex]);

  const current = Math.min(index, lastIndex);
  const arrived = playing && current >= lastIndex;

  const setIndex = useCallback(
    (i: number) => setIndexState(Math.max(0, Math.min(i, lastIndex))),
    [lastIndex]
  );
  // Playback reports "not playing" once the truck reaches the end of the route.
  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  useEffect(() => {
    if (arrived) {
      const t = setTimeout(() => setPlaying(false), 0);
      return () => clearTimeout(t);
    }
  }, [arrived]);

  return { index: current, setIndex, playing: playing && !arrived, play, pause };
}
