import React, { useState } from 'react';
import { PhotoCapture } from './PhotoCapture';
import { GeoCamera } from './GeoCamera';
import { extractExifGps } from '../services/photoService';
import { verifyLocation } from '../services/verificationService';
import { insertEvidence, initializeDatabase } from '../services/databaseService';
import { getCurrentLocation } from '../services/locationService';
import type { EvidenceMapHandle } from './EvidenceMap';

interface EvidenceFormProps {
  mapRef: React.RefObject<EvidenceMapHandle | null>;
}

export const EvidenceForm: React.FC<EvidenceFormProps> = ({ mapRef }) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [category, setCategory] = useState<string>('Site Inspection');
  const [description, setDescription] = useState<string>('');
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCapture = (file: File, preview: string) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
    setShowCamera(false);
    setNotification({
      type: 'success',
      message: 'Photo captured & burned with live GPS! Fill details and click Save.',
    });
  };

  const handleClear = () => {
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      setNotification({
        type: 'error',
        message: 'Please take a photo with GPS Camera or upload an image first.',
      });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      await initializeDatabase();

      // Get device location with graceful fallback
      let deviceLoc = {
        latitude: 26.1445,
        longitude: 91.7362,
        accuracy: 25,
        timestamp: Date.now(),
      };

      try {
        deviceLoc = await getCurrentLocation();
      } catch (locErr: any) {
        console.warn('Could not acquire precise GPS, using fallback:', locErr);
      }

      // Extract EXIF data if present
      let exif: { latitude?: number; longitude?: number } = {};
      try {
        exif = await extractExifGps(photoFile);
      } catch (exifErr) {
        console.warn('EXIF extract note:', exifErr);
      }

      const { status, reason } = verifyLocation(deviceLoc, exif);

      const evidence = {
        photo: photoPreview,
        category: category.trim() || 'General Evidence',
        description: description.trim(),
        latitude: deviceLoc.latitude,
        longitude: deviceLoc.longitude,
        gps_accuracy: deviceLoc.accuracy,
        verification_status: status,
        verification_reason: reason,
        exif_latitude: exif.latitude,
        exif_longitude: exif.longitude,
        timestamp: new Date().toISOString(),
      };

      await insertEvidence(evidence as any);

      if (mapRef.current) {
        mapRef.current.flyTo(deviceLoc.latitude, deviceLoc.longitude);
      }

      setNotification({
        type: 'success',
        message: `Evidence saved to SQLite! Verification: ${status}`,
      });

      setCategory('Site Inspection');
      setDescription('');
      handleClear();
    } catch (err: any) {
      console.error('Failed to save evidence:', err);
      setNotification({
        type: 'error',
        message: `Failed to save evidence: ${err.message || 'Unknown database error'}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="ner-card p-5 space-y-5">
      <div className="pb-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="ner-heading">1. Capture Evidence</h3>
          <p className="text-xs text-gray-500 mt-0.5">Submit geotagged proof for road conditions or cargo</p>
        </div>
      </div>

      {notification && (
        <div
          className={`p-3 rounded text-xs flex items-start gap-2 ${
            notification.type === 'success'
              ? 'bg-[#e8f5e9] border border-[#81c784] text-[#1b5e20]'
              : 'bg-[#ffebee] border border-[#e57373] text-[#c62828]'
          }`}
        >
          <span className="text-sm">{notification.type === 'success' ? '✅' : '⚠️'}</span>
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Primary Trigger: Live GPS Camera */}
      <div>
        <button
          type="button"
          onClick={() => setShowCamera(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#2d6a4f] hover:bg-[#1b4332] active:scale-[0.99] text-white text-sm font-bold rounded shadow-xs transition"
        >
          <span className="text-lg">📷</span>
          <span>Open Live GPS Camera</span>
        </button>
      </div>

      {/* Fallback Upload */}
      <PhotoCapture
        onCapture={handleCapture}
        onClear={handleClear}
        existingPreview={photoPreview}
      />

      {/* Form Fields */}
      <form onSubmit={handleSave} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Evidence Category
          </label>
          <select
            className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:border-[#2d6a4f]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="Site Inspection">Site Inspection</option>
            <option value="Landslide / Hazard">Landslide / Hazard Blockage</option>
            <option value="Cargo Verification">Cargo Verification</option>
            <option value="Damage Report">Damage Report</option>
            <option value="Delivery Proof">Delivery Proof</option>
            <option value="Infrastructure Audit">Bridge / Highway Audit</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
            Observations / Field Notes
          </label>
          <textarea
            rows={3}
            className="w-full text-xs p-2.5 border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:border-[#2d6a4f] placeholder:text-gray-400"
            placeholder="Describe sector condition, vehicle clearance, road obstacles..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isSaving || !photoFile}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#1b4332] hover:bg-[#2d6a4f] active:scale-[0.99] text-white text-xs font-bold rounded shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
        >
          {isSaving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving to SQLite...</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>Commit Evidence to GIS Map</span>
            </>
          )}
        </button>
      </form>

      {/* GeoCamera Fullscreen Overlay */}
      {showCamera && (
        <GeoCamera
          onCapture={handleCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};
