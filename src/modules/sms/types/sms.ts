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
  route_risk: 'Route risk',
  reroute: 'Reroute',
  road_block: 'Road blocked',
  landslide: 'Landslide',
  flood: 'Flood',
  weather: 'Severe weather',
  bridge_block: 'Bridge closed',
  traffic_disruption: 'Traffic',
  emergency: 'Emergency',
  system_test: 'Test message',
  reroute_suggestion: 'Reroute suggestion',
  incident_reported: 'Incident reported',
  road_reopened: 'Road reopened',
  landslide_warning: 'Landslide warning',
  flood_warning: 'Flood warning',
  weather_alert: 'Weather alert',
  emergency_sos: 'Emergency SOS',
  checkin_request: 'Check-in request',
  deadzone_precache: 'No-signal area ahead',
};

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const STATUS_LABELS: Record<AlertStatus, string> = {
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
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
