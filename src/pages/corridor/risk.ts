// src/pages/corridor/risk.ts
// One place for how risk is worded and coloured across the Routes page.
import type { RiskSummary, SectorBoundary, SectorCard } from '../../services/corridorApi';
import type { SectorCause } from './mapIcons';

export type RiskLevel = SectorCard['risk_level'];

export const RISK_WORD: Record<RiskLevel, string> = { safe: 'Low', caution: 'Medium', danger: 'High' };
export const RISK_CLASS: Record<RiskLevel, string> = { safe: 'risk-low', caution: 'risk-medium', danger: 'risk-high' };
export const RISK_RANK: Record<RiskLevel, number> = { safe: 0, caution: 1, danger: 2 };

// Map line colours (Leaflet needs literal values; these match the CSS tokens in index.css).
export const RISK_COLOR: Record<RiskLevel, string> = { safe: '#2f7d4f', caution: '#b7791f', danger: '#c0392b' };
export const ROUTE_COLOR = '#2563eb';
export const OTHER_ROUTE_COLOR = '#8a94a0';
export const TRAVELLED_COLOR = '#8a94a0';

/** Backend detour ids to display names: "ALT-2" -> "Detour 2" */
export const detourLabel = (id: string) => `Detour ${id.replace(/^ALT-/, '')}`;

/**
 * The cut that actually separates this sector from its neighbour: prefer where this sector
 * ends; for the last sector (which has no end cut) use where it began instead.
 */
function sectorCut(sectors: SectorCard[], i: number): SectorBoundary | null {
  return sectors[i].boundary ?? (i > 0 ? sectors[i - 1].boundary : null);
}

/** One-word category for a sector's cut, used to pick its marker shape (see mapIcons.ts). */
export function sectorCause(sectors: SectorCard[], i: number): SectorCause {
  if (sectors[i].segment_type === 'Mountain climb') return 'mountain';
  switch (sectorCut(sectors, i)?.type) {
    case 'Checkpost':
      return 'checkpost';
    case 'Junction':
      return 'junction';
    case 'Bridge':
      return 'bridge';
    default:
      return 'plain';
  }
}

/** e.g. "It is split off at a junction: {reason}" or, named, "at a checkpost — Rangpo Entry Checkpost:" */
function cutSentence(b: SectorBoundary): string {
  if (b.type === 'Distance cut') {
    // The reason text already explains the "why" in full; no landmark name to lead with.
    return b.reason;
  }
  const place = b.name ? `${b.type.toLowerCase()} — ${b.name}` : b.type.toLowerCase();
  return `It is split off at a ${place}: ${b.reason}`;
}

/**
 * Why a given sector is its own sector, in plain language, for the map popup shown when
 * its marker is clicked. Combines the terrain (a steep climb is tracked separately) with
 * the landmark or distance cut that actually drew the line between sectors.
 */
export function segmentSplitReason(sectors: SectorCard[], i: number): string {
  const sec = sectors[i];
  const sentences: string[] = [];

  if (sec.segment_type === 'Mountain climb') {
    sentences.push(
      `This stretch climbs steeply, from ${sec.elevation_start_m} m to ${sec.elevation_end_m} m ` +
        `(slope ${sec.slope_percent}%), so it's tracked as its own sector.`
    );
  }

  const cut = sectorCut(sectors, i);
  if (cut) {
    sentences.push(cutSentence(cut));
  } else if (sentences.length === 0) {
    sentences.push(
      "This is the only sector on the route — it wasn't split further, since the whole trip is " +
        'within the minimum sector length.'
    );
  }

  return sentences.join(' ');
}

/** e.g. "High risk on 3 of 6 sectors (212 km)" */
export function describeRisk(risk: RiskSummary): string {
  const total = risk.sector_counts.safe + risk.sector_counts.caution + risk.sector_counts.danger;
  if (risk.worst === 'danger') {
    return `High risk on ${risk.sector_counts.danger} of ${total} sectors (${Math.round(risk.km_by_level.danger)} km)`;
  }
  if (risk.worst === 'caution') {
    return `Medium risk on ${risk.sector_counts.caution} of ${total} sectors (${Math.round(risk.km_by_level.caution)} km)`;
  }
  return total === 1 ? 'Low risk' : `Low risk on all ${total} sectors`;
}
