// src/modules/fieldEvidence/components/PhotoCapture.tsx
import React, { useState, useEffect, useRef } from 'react';
import { compressImage } from '../utils/imageUtils';

interface PhotoCaptureProps {
  onCapture: (file: File, previewUrl: string) => void;
  onClear: () => void;
  existingPreview?: string;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onCapture, onClear, existingPreview }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(existingPreview || '');
  const [error, setError] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (selected: File) => {
    // Check if it's an image
    const isImage = selected.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|heic|heif)$/i.test(selected.name);
    if (!isImage) {
      setError('Please select an image file (JPEG, PNG, WebP).');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Try image compression
      const compressed = await compressImage(selected);
      setFile(selected);
      setPreview(compressed);
      onCapture(selected, compressed);
    } catch (compressErr) {
      console.warn('Image compression fallback to raw file reader:', compressErr);
      // Fallback: Read raw data URL if compression fails
      const reader = new FileReader();
      reader.onload = () => {
        const rawDataUrl = reader.result as string;
        setFile(selected);
        setPreview(rawDataUrl);
        onCapture(selected, rawDataUrl);
      };
      reader.onerror = () => {
        setError('Failed to read image file.');
      };
      reader.readAsDataURL(selected);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemove = () => {
    setFile(null);
    setPreview('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClear();
  };

  // Sync with external preview updates
  useEffect(() => {
    if (existingPreview) {
      setPreview(existingPreview);
    } else if (!existingPreview && preview) {
      setPreview('');
      setFile(null);
    }
  }, [existingPreview]);

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="border border-line rounded overflow-hidden">
          <img src={preview} alt="Photo for this report" className="w-full max-h-64 object-contain bg-canvas" />
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-line text-[0.85rem]">
            <span className="text-muted truncate">
              {file ? `${file.name} (${(file.size / 1024).toFixed(0)} KB)` : 'Photo ready'}
            </span>
            <button type="button" onClick={handleRemove} className="underline shrink-0">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-line rounded px-4 py-5 text-center cursor-pointer hover:bg-canvas"
        >
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
          <p>
            Or <span className="underline">upload a photo</span> (drag it here)
          </p>
          <p className="text-[0.85rem] text-muted">JPEG, PNG or WebP</p>
        </div>
      )}

      {isProcessing && <p className="text-[0.85rem] text-muted">Preparing photo…</p>}
      {error && <p className="notice notice-error text-[0.9rem]">{error}</p>}
    </div>
  );
};
