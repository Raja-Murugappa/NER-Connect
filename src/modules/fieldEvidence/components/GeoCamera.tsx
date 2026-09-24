// src/modules/fieldEvidence/components/GeoCamera.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

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

  const personName = 'Field Officer';

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
      lines.push(`📍 ${location.address}`);
      lines.push(`🌐 Lat: ${location.lat.toFixed(6)}°  |  Long: ${location.lon.toFixed(6)}°`);
      lines.push(`🎯 Accuracy: ±${Math.round(location.accuracy)}m`);
    } else {
      lines.push(`📍 GPS: ${locationStatus}`);
    }
    lines.push(`🕒 ${dateTime}`);
    lines.push(`👤 Surveyor: ${personName}`);

    const bannerHeight = lines.length * lineHeight + padding * 2;
    const bannerY = height - bannerHeight;

    // Semi-transparent dark background for legible overlay
    ctx.fillStyle = 'rgba(10, 15, 29, 0.82)';
    ctx.fillRect(0, bannerY, width, bannerHeight);

    // Subtle blue accent border on top of banner
    ctx.fillStyle = '#2563eb';
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

      ctx.fillStyle = index === 0 ? '#38bdf8' : '#ffffff';
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
        const previewUrl = URL.createObjectURL(blob);

        // Stop camera tracks
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }

        onCapture(file, previewUrl);
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
    <div
      style={{ zIndex: 99999 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-between p-3 sm:p-6"
    >
      {/* Top Header Bar */}
      <div className="w-full max-w-2xl flex items-center justify-between z-10 py-2 px-1 text-white">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-semibold text-sm tracking-wide uppercase">Live GPS Camera</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={switchCamera}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 active:scale-95 text-white text-xs font-medium rounded-lg border border-gray-600 transition"
            title="Switch front/back camera"
          >
            <span>🔄 Switch</span>
          </button>
          <button
            type="button"
            onClick={close}
            className="w-8 h-8 flex items-center justify-center bg-gray-800/80 hover:bg-red-600 active:scale-95 text-white rounded-full border border-gray-600 transition text-sm font-bold"
            title="Close camera"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Camera Viewport Container */}
      <div className="relative w-full max-w-2xl flex-1 flex items-center justify-center overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl my-2">
        {/* Loading Spinner */}
        {isInitializing && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20 text-white space-y-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Starting camera...</p>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 p-6 text-center text-white space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-900/40 border border-red-500 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-red-400">Camera Access Error</h3>
            <p className="text-sm text-gray-300 max-w-md">{cameraError}</p>
            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition"
              >
                Retry Camera
              </button>
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Video stream */}
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          autoPlay
          muted
        />

        {/* Live GPS Watermark Card (Overlay on Preview) */}
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md bg-black/75 backdrop-blur-md p-3 rounded-xl border border-white/10 text-white text-xs space-y-1 shadow-lg pointer-events-none z-10">
          <div className="flex items-center justify-between pb-1 border-b border-white/10">
            <span className="font-bold text-sky-400 truncate">
              {location ? location.address : locationStatus}
            </span>
          </div>
          {location ? (
            <>
              <div className="flex justify-between text-zinc-300">
                <span>Lat: {location.lat.toFixed(6)}°</span>
                <span>Long: {location.lon.toFixed(6)}°</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Accuracy: ±{Math.round(location.accuracy)}m</span>
                <span>{dateTime}</span>
              </div>
            </>
          ) : (
            <div className="text-amber-400">{locationStatus}</div>
          )}
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div className="w-full max-w-2xl flex flex-col items-center justify-center space-y-3 z-10 py-2">
        {/* Zoom Controls */}
        <div className="flex items-center space-x-3 bg-zinc-900/80 px-4 py-1.5 rounded-full border border-zinc-700 text-white text-xs">
          <button
            type="button"
            onClick={() => setZoom(1)}
            className={`px-2 py-0.5 rounded ${zoom === 1 ? 'bg-blue-600 font-bold' : 'text-gray-400'}`}
          >
            1x
          </button>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 sm:w-36 accent-blue-500 cursor-pointer"
          />
          <button
            type="button"
            onClick={() => setZoom(2)}
            className={`px-2 py-0.5 rounded ${zoom === 2 ? 'bg-blue-600 font-bold' : 'text-gray-400'}`}
          >
            2x
          </button>
        </div>

        {/* Shutter Button - Highly Visible & Prominent */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={capture}
            disabled={isInitializing || !!cameraError || isCapturing}
            className="group relative flex items-center justify-center w-20 h-20 rounded-full border-4 border-white bg-transparent p-1 shadow-2xl transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Take Photo"
          >
            <div className="w-full h-full rounded-full bg-red-600 group-hover:bg-red-500 transition flex items-center justify-center text-2xl shadow-inner">
              📸
            </div>
            <span className="sr-only">Capture Photo</span>
          </button>
        </div>
        <p className="text-zinc-400 text-xs font-medium">Tap button to capture photo with GPS stamp</p>
      </div>

      {/* Hidden Canvas for High-Resolution Capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};
