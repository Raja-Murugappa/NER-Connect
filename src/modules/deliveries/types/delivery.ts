// src/modules/deliveries/types/delivery.ts
// Delivery/vehicle-movement status, tied to the Routes page's journey simulation - the
// "vehicle/delivery movement" dashboard and "delayed deliveries" alerts the project brief
// asks for. There is no live GPS feed yet, so this tracks the simulated journey's lifecycle.

export type DeliveryStatus = 'planned' | 'in_transit' | 'delayed' | 'rerouted' | 'blocked' | 'delivered' | 'cancelled';

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  planned: 'Planned',
  in_transit: 'In transit',
  delayed: 'Delayed',
  rerouted: 'Rerouted',
  blocked: 'Blocked',
  delivered: 'Delivered',
  cancelled: 'Ended early',
};

// Reuses the app's existing risk colour vocabulary (green/amber/red), same as the
// connectivity dashboard, instead of inventing a third colour scheme.
export const DELIVERY_STATUS_CLASS: Record<DeliveryStatus, string> = {
  planned: 'risk-medium',
  in_transit: 'risk-low',
  delivered: 'risk-low',
  rerouted: 'risk-medium',
  delayed: 'risk-medium',
  blocked: 'risk-high',
  cancelled: 'risk-medium',
};

// What the delivery is carrying, asked alongside the origin/destination on the Routes page's
// planning form. "None" is a first-class option, not a placeholder - plenty of test searches
// aren't tied to a real shipment.
export type DeliveryProduct =
  | 'none'
  | 'general_cargo'
  | 'medicines'
  | 'perishables'
  | 'agricultural_produce'
  | 'construction_materials'
  | 'fuel_hazardous'
  | 'essential_commodities';

export const DELIVERY_PRODUCT_OPTIONS: DeliveryProduct[] = [
  'none',
  'general_cargo',
  'medicines',
  'perishables',
  'agricultural_produce',
  'construction_materials',
  'fuel_hazardous',
  'essential_commodities',
];

export const DELIVERY_PRODUCT_LABEL: Record<DeliveryProduct, string> = {
  none: 'None',
  general_cargo: 'General cargo',
  medicines: 'Medicines & medical supplies',
  perishables: 'Perishables (food)',
  agricultural_produce: 'Agricultural produce',
  construction_materials: 'Construction materials',
  fuel_hazardous: 'Fuel / hazardous goods',
  essential_commodities: 'Essential commodities',
};

export interface DeliveryRecord {
  id: string;
  corridorName: string;
  routeId: string;
  distanceKm: number;
  product: DeliveryProduct;
  status: DeliveryStatus;
  note: string;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
}
