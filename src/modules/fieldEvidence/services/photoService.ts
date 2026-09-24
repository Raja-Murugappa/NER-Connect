// src/modules/fieldEvidence/services/photoService.ts
import ExifReader from 'exifreader';

/**
 * Extract GPS coordinates from EXIF data of an image file.
 * Returns latitude and longitude in decimal degrees if present.
 */
export async function extractExifGps(file: File): Promise<{ latitude?: number; longitude?: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const tags = ExifReader.load(arrayBuffer);
  const latTag = tags['GPSLatitude'];
  const lonTag = tags['GPSLongitude'];
  if (!latTag || !lonTag) {
    return {};
  }
  // ExifReader returns values as [deg, min, sec]
  const toDecimal = (v: any) => {
    if (Array.isArray(v)) {
      const [deg, min, sec] = v.map((num: any) => Number(num.value || num));
      return deg + min / 60 + sec / 3600;
    }
    return Number(v);
  };
  const latitude = toDecimal(latTag.value);
  const longitude = toDecimal(lonTag.value);
  return { latitude, longitude };
}
