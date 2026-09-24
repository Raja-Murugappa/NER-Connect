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
    <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Photo Evidence
        </label>
        {file && (
          <span className="text-xs text-zinc-500 font-mono">
            {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </span>
        )}
      </div>

      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-950 flex flex-col items-center">
          <img
            src={preview}
            alt="Evidence preview"
            className="w-full max-h-72 object-contain bg-zinc-900"
          />
          <div className="w-full p-2 bg-zinc-900/90 border-t border-zinc-800 flex justify-between items-center px-4">
            <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              ✓ Photo ready
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="px-3 py-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded text-xs font-semibold transition"
            >
              Remove / Retake
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition bg-zinc-50 dark:bg-zinc-800/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
          <div className="flex flex-col items-center space-y-2">
            <span className="text-3xl">📁</span>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <span className="text-blue-600 dark:text-blue-400 underline">Browse file</span> or drag & drop photo here
            </div>
            <p className="text-xs text-zinc-500">Supports JPEG, PNG, WebP</p>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="text-xs text-blue-600 dark:text-blue-400 animate-pulse font-medium">
          Processing image...
        </div>
      )}

      {error && (
        <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
};
