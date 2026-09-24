// src/modules/fieldEvidence/utils/imageUtils.ts
/**
 * Compress an image file to a maximum width while preserving aspect ratio.
 * Returns a base64 data URL of the compressed image.
 */
export function compressImage(file: File, maxWidth = 1600, quality = 0.78): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Compression failed'));
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        mime,
        quality
      );
      URL.revokeObjectURL(url);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e as any);
    };
    img.src = url;
  });
}
