// src/modules/fieldEvidence/types/evidence.ts
export type VerificationStatus = "VERIFIED" | "PENDING" | "REJECTED";

export interface Evidence {
  id: string; // UUID
  photo: string; // base64 data URL of compressed image
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
