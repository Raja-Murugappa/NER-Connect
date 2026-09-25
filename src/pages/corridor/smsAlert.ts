// src/pages/corridor/smsAlert.ts
// Builds the SMS alert content for a blocking disruption, shared by the automatic dispatch
// in CorridorPage.tsx and the "Send SMS to driver" button's compose-page handoff.
import type { RerouteResult, RouteAlternative } from '../../services/corridorApi';
import type { AlertSeverity, AlertType } from '../../modules/sms/types/sms';
import { detourLabel } from './risk';

export interface DisruptionAlert {
  alertType: AlertType;
  severity: AlertSeverity;
  /** Matches generateMessageText's {location}, {alternateRoute}, {checkpointName} placeholders. */
  location: string;
  alternateRoute: string;
  checkpointName: string;
}

/**
 * The message content for a blocking disruption: only call this for a REROUTE_AVAILABLE,
 * NO_ALTERNATIVE or ROUTING_UNAVAILABLE result - other statuses don't need to reach a driver.
 */
export function buildDisruptionAlert(
  reroute: RerouteResult,
  corridorName: string,
  selectedAlt: RouteAlternative | null | undefined
): DisruptionAlert {
  const where = `${reroute.disruption.label} at km ${reroute.disruption_km?.toFixed(0) ?? '?'} on ${corridorName}`;

  if (selectedAlt) {
    return {
      alertType: 'reroute',
      severity: 'CRITICAL',
      location: where,
      alternateRoute:
        `${detourLabel(selectedAlt.id)} (${selectedAlt.extra_km >= 0 ? '+' : ''}${selectedAlt.extra_km.toFixed(0)} km, ` +
        `${selectedAlt.eta} to go), leaving the road at ${selectedAlt.divergence_point[0].toFixed(4)}, ${selectedAlt.divergence_point[1].toFixed(4)}`,
      checkpointName: '',
    };
  }

  return {
    alertType: 'road_block',
    severity: 'CRITICAL',
    location: where,
    alternateRoute: `No detour available. Hold at ${reroute.hold_point?.name ?? 'the nearest safe stop'}`,
    checkpointName: reroute.hold_point?.name ?? '',
  };
}
