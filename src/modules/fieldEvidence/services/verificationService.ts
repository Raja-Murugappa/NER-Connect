// src/modules/fieldEvidence/services/verificationService.ts
import { haversineDistance } from '../utils/gpsUtils';
import type { VerificationStatus } from '../types/evidence';

/**
 * Determine verification status based on GPS accuracy and optional EXIF mismatch.
 */
export function verifyLocation(
  device: { latitude: number; longitude: number; accuracy: number },
  exif?: { latitude?: number; longitude?: number }
): { status: VerificationStatus; reason?: string } {
  const { accuracy, latitude, longitude } = device;
  let status: VerificationStatus = 'REJECTED';
  let reason = '';

  if (accuracy <= 50) {
    status = 'VERIFIED';
  } else if (accuracy > 50 && accuracy <= 100) {
    status = 'PENDING';
  } else {
    status = 'REJECTED';
  }

  if (exif?.latitude !== undefined && exif?.longitude !== undefined) {
    const distance = haversineDistance(latitude, longitude, exif.latitude, exif.longitude);
    if (distance > 100) {
      // Significant mismatch > 100m
      reason = `EXIF GPS differs by ${Math.round(distance)} m`;
      // Force review
      status = 'PENDING';
    }
  }

  return { status, reason: reason || undefined };
}
