// src/modules/fieldEvidence/types/evidence.ts
export type VerificationStatus = "VERIFIED" | "PENDING" | "REJECTED";

/** How each location-check result is shown to people. */
export const STATUS_LABEL: Record<VerificationStatus, string> = {
  VERIFIED: "Verified",
  PENDING: "Needs review",
  REJECTED: "Rejected",
};

/** Matches the risk colours used across the site (index.css). */
export const STATUS_COLOR: Record<VerificationStatus, string> = {
  VERIFIED: "#2f7d4f",
  PENDING: "#b7791f",
  REJECTED: "#c0392b",
};

export interface Evidence {
  id: string; // UUID
  photo: string; // base64 data URL of compressed image, or '' when no photo was attached
  category: string;
  description?: string;
  latitude: number;
  longitude: number;
  gps_accuracy: number;
  verification_status: VerificationStatus;
  verification_reason?: string;
  exif_latitude?: number;
  exif_longitude?: number;
  timestamp: string; // ISO string when evidence recorded
}
