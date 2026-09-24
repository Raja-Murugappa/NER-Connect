// src/modules/sms/types/sms.ts

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'queued' | 'sent' | 'delivered' | 'failed';
export type SMSProvider = 'mock' | 'twilio' | 'msg91';

export type AlertType =
  | 'route_risk'
  | 'reroute'
  | 'road_block'
  | 'landslide'
  | 'flood'
  | 'weather'
  | 'bridge_block'
  | 'traffic_disruption'
  | 'emergency'
  | 'system_test'
  | 'reroute_suggestion'
  | 'incident_reported'
  | 'road_reopened'
  | 'landslide_warning'
  | 'flood_warning'
  | 'weather_alert'
  | 'emergency_sos'
  | 'checkin_request'
  | 'deadzone_precache';

export type SupportedLanguage = 'en' | 'hi' | 'as' | 'bn' | 'mni' | 'lus' | 'kha' | 'grt';

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  as: 'Assamese',
  bn: 'Bengali',
  mni: 'Manipuri',
  lus: 'Mizo',
  kha: 'Khasi',
  grt: 'Garo',
};

export const ALERT_TYPES: AlertType[] = [
  'road_block',
  'landslide',
  'flood',
  'weather',
  'bridge_block',
  'reroute',
  'route_risk',
  'traffic_disruption',
  'emergency',
  'system_test',
  'deadzone_precache',
  'checkin_request',
  'emergency_sos',
];

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  route_risk: '⚠️ Route Accessibility Risk',
  reroute: '🔀 Corridor Reroute Instruction',
  road_block: '🚧 Road Blockage',
  landslide: '⛰️ Landslide Hazard',
  flood: '🌊 Flood / Waterlogging',
  weather: '🌧️ Severe Weather Warning',
  bridge_block: '🌉 Bridge Structural Caution',
  traffic_disruption: '🚗 Traffic Disruption',
  emergency: '🆘 CRITICAL EMERGENCY',
  system_test: '🔧 System Communication Test',
  reroute_suggestion: '🗺️ Reroute Suggestion',
  incident_reported: '📋 Incident Reported',
  road_reopened: '✅ Road Reopened',
  landslide_warning: '⛰️ Landslide Warning',
  flood_warning: '🌊 Flood Warning',
  weather_alert: '🌩️ Weather Alert',
  emergency_sos: '🚨 Emergency SOS',
  checkin_request: '✔️ Driver Check-In Request',
  deadzone_precache: '📵 Dead-Zone Pre-Cache Advisory',
};

export const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { label: string; badgeClass: string; dotClass: string }
> = {
  LOW: {
    label: 'LOW',
    badgeClass: 'bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20]',
    dotClass: 'bg-emerald-500',
  },
  MEDIUM: {
    label: 'MEDIUM',
    badgeClass: 'bg-[#fff8e1] border border-[#ffd54f] text-[#b78103]',
    dotClass: 'bg-amber-400',
  },
  HIGH: {
    label: 'HIGH',
    badgeClass: 'bg-orange-50 border border-orange-300 text-orange-800',
    dotClass: 'bg-orange-500',
  },
  CRITICAL: {
    label: 'CRITICAL',
    badgeClass: 'bg-[#ffebee] border border-[#e57373] text-[#c62828]',
    dotClass: 'bg-red-600',
  },
};

export const STATUS_CONFIG: Record<
  AlertStatus,
  { label: string; badgeClass: string }
> = {
  queued: {
    label: 'QUEUED',
    badgeClass: 'bg-gray-100 border border-gray-300 text-gray-700',
  },
  sent: {
    label: 'SENT',
    badgeClass: 'bg-blue-50 border border-blue-300 text-blue-800',
  },
  delivered: {
    label: 'DELIVERED',
    badgeClass: 'bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20]',
  },
  failed: {
    label: 'FAILED',
    badgeClass: 'bg-[#ffebee] border border-[#e57373] text-[#c62828]',
  },
};

// Template-based message generation for the UI dispatcher
const EN_TEMPLATES: Partial<Record<AlertType, string>> = {
  road_block:
    'NER-CONNECT ALERT: Road blockage detected at {location}. {alternateRoute}. Action: Avoid the affected route.',
  landslide:
    'NER-CONNECT ALERT: Active landslide reported at {location}. Corridor is hazardous. {alternateRoute}. Action: Halt immediately or divert.',
  flood:
    'NER-CONNECT ALERT: Flash flood or heavy waterlogging at {location}. Road impassable. {alternateRoute}. Action: Do not attempt to cross.',
  weather:
    'NER-CONNECT ALERT: Dense fog / heavy torrential rain at {location}. Visibility is severely degraded. Action: Reduce speed and maintain safe distance.',
  bridge_block:
    'NER-CONNECT ALERT: Bridge structural inspection or closure at {location}. {alternateRoute}. Action: Use designated detour.',
  reroute:
    'NER-CONNECT ALERT: Route adjustment advised for your journey. Proceed via {alternateRoute} to prevent delay at {location}.',
  route_risk:
    'NER-CONNECT ALERT: High transit risk detected on your segment near {location}. {alternateRoute}. Action: Exercise extreme caution.',
  traffic_disruption:
    'NER-CONNECT ALERT: Heavy traffic gridlock reported at {location}. Estimated delay exceeds 60 minutes. {alternateRoute}.',
  emergency:
    'NER-CONNECT EMERGENCY: Immediate safety protocol active near {location}. Pull over to safe designated zone and follow authority instructions.',
  system_test:
    'NER-CONNECT TEST: Communication channel verified. No action required.',
  deadzone_precache:
    'PRE-CACHE ADVISORY: Approaching low-connectivity corridor {location}. Next safe checkpoint: {checkpointName}. Route status: {statusNote} - NER-CONNECT.',
  checkin_request:
    'NER-CONNECT CHECK-IN: Please confirm your safe arrival by replying OK at checkpoint {checkpointName}.',
  emergency_sos:
    'NER-CONNECT EMERGENCY SOS: An emergency has been declared at {location}. Emergency services notified. Proceed to {checkpointName} immediately.',
};

export function generateMessageText(
  alertType: AlertType,
  variables: Record<string, string>
): string {
  const template = EN_TEMPLATES[alertType];
  if (!template) {
    return `NER-CONNECT ALERT: ${alertType.replace(/_/g, ' ').toUpperCase()} at ${variables.location || 'unknown location'}.`;
  }
  return template.replace(/\{(\w+)\}/g, (_, key) => variables[key] || `{${key}}`);
}

export interface SMSRecord {
  id: string;
  phone: string;
  driverName?: string;
  language: SupportedLanguage;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  provider: SMSProvider;
  timestamp: string;
  deliveredAt?: string;
}

export interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  language: SupportedLanguage;
  vehicleId?: string;
  fleetId?: string;
}
