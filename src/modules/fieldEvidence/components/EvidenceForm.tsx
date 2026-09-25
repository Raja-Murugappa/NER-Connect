import React, { useState } from 'react';
import { PhotoCapture } from './PhotoCapture';
import { GeoCamera } from './GeoCamera';
import { extractExifGps } from '../services/photoService';
import { verifyLocation } from '../services/verificationService';
import { insertEvidence, initializeDatabase } from '../services/databaseService';
import { getCurrentLocation } from '../services/locationService';
import { STATUS_LABEL } from '../types/evidence';

interface EvidenceFormProps {
  /** Called after a report is saved, with where it was recorded. */
  onSaved: (lat: number, lon: number) => void | Promise<void>;
}

const CATEGORIES = [
  'Road condition',
  'Landslide or blockage',
  'Damage',
  'Bridge or road inspection',
  'Cargo check',
  'Proof of delivery',
];

export const EvidenceForm: React.FC<EvidenceFormProps> = ({ onSaved }) => {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [description, setDescription] = useState<string>('');
  const [showCamera, setShowCamera] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'ok' | 'error'; message: string } | null>(null);

  const handleCapture = (file: File, preview: string) => {
    setPhotoFile(file);
    setPhotoPreview(preview);
    setShowCamera(false);
    setNotification(null);
  };

  const handleClear = () => {
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile && !description.trim()) {
      setNotification({ type: 'error', message: 'Add a photo, a description, or both.' });
      return;
    }

    setIsSaving(true);
    setNotification(null);

    try {
      await initializeDatabase();

      // Device location, with a fallback so a report can still be saved without GPS
      let deviceLoc = { latitude: 26.1445, longitude: 91.7362, accuracy: 25, timestamp: Date.now() };
      let usedFallback = false;
      try {
        deviceLoc = await getCurrentLocation();
      } catch (locErr: any) {
        usedFallback = true;
        console.warn('Could not get GPS position, using fallback:', locErr);
      }

      // GPS stored inside the photo file, if there is one
      let exif: { latitude?: number; longitude?: number } = {};
      if (photoFile) {
        try {
          exif = await extractExifGps(photoFile);
        } catch (exifErr) {
          console.warn('No readable photo location:', exifErr);
        }
      }

      const { status, reason } = verifyLocation(deviceLoc, exif);

      await insertEvidence({
        photo: photoPreview, // '' when no photo was attached
        category: category.trim() || 'General',
        description: description.trim(),
        latitude: deviceLoc.latitude,
        longitude: deviceLoc.longitude,
        gps_accuracy: deviceLoc.accuracy,
        verification_status: status,
        verification_reason: reason,
        exif_latitude: exif.latitude,
        exif_longitude: exif.longitude,
        timestamp: new Date().toISOString(),
      });

      setNotification({
        type: 'ok',
        message: `Report saved. Location check: ${STATUS_LABEL[status].toLowerCase()}.${
          usedFallback ? ' GPS was unavailable, so a default location was used.' : ''
        }`,
      });
      setCategory(CATEGORIES[0]);
      setDescription('');
      handleClear();
      await onSaved(deviceLoc.latitude, deviceLoc.longitude);
    } catch (err: any) {
      console.error('Failed to save report:', err);
      setNotification({ type: 'error', message: `Could not save the report: ${err.message || 'unknown error'}` });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="panel p-4 space-y-3">
      <h2 className="panel-title">New report</h2>
      <p className="text-[0.85rem] text-muted">Add a photo, a description, or both.</p>

      {notification && (
        <p className={`notice ${notification.type === 'ok' ? 'notice-ok' : 'notice-error'} text-[0.9rem]`}>
          {notification.message}
        </p>
      )}

      <button type="button" onClick={() => setShowCamera(true)} className="btn btn-primary w-full">
        Take photo with location stamp
      </button>

      <PhotoCapture onCapture={handleCapture} onClear={handleClear} existingPreview={photoPreview} />

      <div>
        <label className="label" htmlFor="report-category">Category</label>
        <select id="report-category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="report-notes">Notes</label>
        <textarea
          id="report-notes"
          rows={3}
          className="input"
          placeholder="What did you see? e.g. debris covering one lane, traffic passing slowly"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <button type="submit" disabled={isSaving || (!photoFile && !description.trim())} className="btn btn-primary w-full">
        {isSaving ? 'Saving…' : 'Save report'}
      </button>

      {showCamera && <GeoCamera onCapture={handleCapture} onClose={() => setShowCamera(false)} />}
    </form>
  );
};
