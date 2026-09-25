// src/modules/fieldEvidence/components/GeoCamera.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { compressImage } from '../utils/imageUtils';

interface GeoCameraProps {
  /**
   * Called with the captured image File and a preview URL (data URL).
   */
  onCapture: (file: File, previewUrl: string) => void;
  /**
   * Called when the camera UI should be closed.
   */
  onClose: () => void;
}

// Helper to reverse‑geocode via OpenStreetMap Nominatim
const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
      {
        headers: { 'User-Agent': 'GeoTagApp/1.0' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (!resp.ok) return '';
    const data = await resp.json();
    return data.display_name ?? '';
  } catch {
    return '';
  }
};

export const GeoCamera: React.FC<GeoCameraProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [zoom, setZoom] = useState<number>(1);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [location, setLocation] = useState<{
    lat: number;
    lon: number;
    accuracy: number;
    address: string;
  } | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Acquiring GPS...');
  const [dateTime, setDateTime] = useState<string>(new Date().toLocaleString());
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const personName = 'Field officer';

  // Function to initialize camera stream with robust fallbacks
  const startCamera = useCallback(async (desiredFacing: 'environment' | 'user') => {
    setIsInitializing(true);
    setCameraError(null);

    // Stop existing tracks first
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    let media: MediaStream | null = null;

    try {
      // 1. Try with ideal facingMode and high resolution
      media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: desiredFacing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
    } catch (err1) {
      console.warn('Initial camera constraints failed, attempting fallback to basic video...', err1);
      try {
        // 2. Fallback to basic video constraint (works on laptop webcams & single cameras)
        media = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err2: any) {
        console.error('All camera attempts failed:', err2);
        setCameraError(
          err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError'
            ? 'Camera access was denied. Please allow camera permissions in your browser.'
            : `Unable to open camera: ${err2.message || 'Device not found'}`
        );
        setIsInitializing(false);
        return;
      }
    }

    setStream(media);
    if (videoRef.current) {
      videoRef.current.srcObject = media;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((e) => console.warn('Video play error:', e));
        setIsInitializing(false);
      };
    }
  }, [stream]);

  // Request location
  const refreshLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser');
      return;
    }

    setLocationStatus('Acquiring high-accuracy GPS...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const accuracy = pos.coords.accuracy;

        setLocation({
          lat,
          lon,
          accuracy,
          address: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        });
        setLocationStatus('GPS Locked');

        // Reverse geocode asynchronously
        try {
          const addr = await reverseGeocode(lat, lon);
          if (addr) {
            setLocation((prev) => (prev ? { ...prev, address: addr } : null));
          }
        } catch {
          // Keep coordinate address
        }
      },
      (err) => {
        console.warn('GPS position error:', err);
        setLocationStatus(`GPS unavailable: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 10000,
      }
    );
  }, []);

  // Initial mount
  useEffect(() => {
    startCamera(facingMode);
    refreshLocation();

    const dtInterval = setInterval(() => {
      setDateTime(new Date().toLocaleString());
    }, 1000);

    return () => {
      clearInterval(dtInterval);
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Apply zoom if supported by the browser track
  useEffect(() => {
    if (!stream) return;
    const [videoTrack] = stream.getVideoTracks();
    if (!videoTrack) return;
    const applyZoom = async () => {
      try {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.zoom) {
          await (videoTrack as any).applyConstraints({ advanced: [{ zoom }] });
        }
      } catch {
        // Zoom constraint not supported by hardware/driver
      }
    };
    applyZoom();
  }, [zoom, stream]);

  // Switch between front and back camera
  const switchCamera = async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    await startCamera(newFacing);
  };

  // Capture photo with stamped metadata
  const capture = () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsCapturing(true);

    // Draw the raw camera frame
    ctx.drawImage(video, 0, 0, width, height);

    // --- Draw Professional GPS Stamp Banner ---
    const fontSize = Math.max(16, Math.round(width / 45));
    const lineHeight = fontSize * 1.35;
    const padding = Math.round(fontSize * 0.8);

    const lines: string[] = [];
    if (location) {
      lines.push(location.address);
      lines.push(`Lat ${location.lat.toFixed(6)}, Lon ${location.lon.toFixed(6)}`);
      lines.push(`Accuracy ±${Math.round(location.accuracy)} m`);
    } else {
      lines.push(`GPS: ${locationStatus}`);
    }
    lines.push(dateTime);
    lines.push(`Recorded by: ${personName}`);

    const bannerHeight = lines.length * lineHeight + padding * 2;
    const bannerY = height - bannerHeight;

    // Semi-transparent dark background for legible overlay
    ctx.fillStyle = 'rgba(10, 15, 29, 0.82)';
    ctx.fillRect(0, bannerY, width, bannerHeight);

    // Subtle blue accent border on top of banner
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, bannerY, width, 3);

    // Render metadata lines with crisp white text
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    lines.forEach((line, index) => {
      const y = bannerY + padding + index * lineHeight;

      // Text shadow for maximum contrast
      ctx.fillStyle = '#000000';
      ctx.fillText(line, padding + 1, y + 1);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(line, padding, y);
    });

    // Convert canvas to JPEG file
    canvas.toBlob(
      (blob) => {
        setIsCapturing(false);
        if (!blob) {
          alert('Failed to generate image file');
          return;
        }

        const file = new File([blob], `evidence_${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        // Stop camera tracks
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }

        // Store the image itself (compressed data URL), not a temporary blob: link
        // that stops working after a page reload.
        compressImage(file)
          .then((dataUrl) => onCapture(file, dataUrl))
          .catch(() => {
            const reader = new FileReader();
            reader.onload = () => onCapture(file, reader.result as string);
            reader.readAsDataURL(file);
          });
      },
      'image/jpeg',
      0.92
    );
  };

  const close = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black flex flex-col text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-medium">Camera</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={switchCamera}
            className="px-3 py-1.5 border border-white/40 rounded text-sm hover:bg-white/10"
          >
            Switch camera
          </button>
          <button
            type="button"
            onClick={close}
            className="px-3 py-1.5 border border-white/40 rounded text-sm hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-neutral-900">
        {isInitializing && !cameraError && <p className="absolute text-sm text-neutral-300">Starting camera…</p>}

        {cameraError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black">
            <p className="text-lg font-medium">Camera not available</p>
            <p className="text-sm text-neutral-300 max-w-md">{cameraError}</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-white text-black rounded text-sm font-medium"
              >
                Try again
              </button>
              <button type="button" onClick={close} className="px-4 py-2 border border-white/40 rounded text-sm">
                Close
              </button>
            </div>
          </div>
        )}

        <video ref={videoRef} className="w-full h-full object-contain" playsInline autoPlay muted />

        {/* Preview of the stamp that will be burned into the photo */}
        <div className="absolute bottom-0 inset-x-0 bg-black/70 px-4 py-2 text-sm pointer-events-none">
          {location ? (
            <>
              <p className="truncate">{location.address}</p>
              <p className="text-neutral-300 tabular-nums">
                Lat {location.lat.toFixed(6)}, Lon {location.lon.toFixed(6)}, accuracy ±{Math.round(location.accuracy)} m
              </p>
              <p className="text-neutral-300 tabular-nums">{dateTime}</p>
            </>
          ) : (
            <p className="text-amber-300">{locationStatus}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 px-4 py-4">
        <label className="flex items-center gap-3 text-sm text-neutral-300">
          Zoom
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-40 accent-white"
          />
          <span className="tabular-nums w-8">{zoom.toFixed(1)}×</span>
        </label>
        <button
          type="button"
          onClick={capture}
          disabled={isInitializing || !!cameraError || isCapturing}
          className="w-16 h-16 rounded-full border-4 border-white bg-white/90 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Take photo"
        />
        <p className="text-sm text-neutral-400">The photo is stamped with your location and the time.</p>
      </div>

      {/* Hidden canvas used to compose the stamped photo */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};
