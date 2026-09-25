// src/pages/corridor/JourneyTimeline.tsx
import React from 'react';

export interface JourneyEvent {
  time: string;
  text: string;
}

export const JourneyTimeline: React.FC<{ events: JourneyEvent[] }> = ({ events }) => {
  if (events.length === 0) return null;
  return (
    <section className="panel">
      <h2 className="panel-title px-4 pt-3 pb-2">Journey log</h2>
      <ol className="max-h-44 overflow-y-auto border-t border-line-soft">
        {[...events].reverse().map((ev, i) => (
          <li key={i} className="flex gap-3 px-4 py-1.5 text-[0.9rem] border-b border-line-soft last:border-b-0">
            <span className="num text-muted shrink-0">{ev.time}</span>
            <span>{ev.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};
