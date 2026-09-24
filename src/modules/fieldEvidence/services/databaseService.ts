// src/modules/fieldEvidence/services/databaseService.ts
import { execute } from '../database/sqlite';
import type { Evidence } from '../types/evidence';
import { v4 as uuidv4 } from 'uuid';

/** Initialize the database (ensures schema is loaded) */
export async function initializeDatabase() {
  // The sqlite wrapper automatically loads schema on first use.
  await execute('SELECT 1');
}

/** Insert a new evidence record */
export async function insertEvidence(evidence: Omit<Evidence, 'id'>): Promise<string> {
  const id = uuidv4();
  const sql = `INSERT INTO evidence (id, photo, category, description, latitude, longitude, gps_accuracy, verification_status, verification_reason, exif_latitude, exif_longitude, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const params = [
    id,
    evidence.photo,
    evidence.category,
    evidence.description || null,
    evidence.latitude,
    evidence.longitude,
    evidence.gps_accuracy,
    evidence.verification_status,
    evidence.verification_reason || null,
    evidence.exif_latitude ?? null,
    evidence.exif_longitude ?? null,
    evidence.timestamp,
  ];
  await execute(sql, params);
  return id;
}

/** Retrieve all evidence records */
export async function getAllEvidence(): Promise<Evidence[]> {
  const rows = await execute('SELECT * FROM evidence ORDER BY timestamp DESC');
  // Cast rows to Evidence (SQL types already match)
  return rows as Evidence[];
}

/** Delete a specific evidence entry */
export async function deleteEvidence(id: string): Promise<void> {
  await execute('DELETE FROM evidence WHERE id = ?', [id]);
}

/** Clear the whole table */
export async function clearEvidence(): Promise<void> {
  await execute('DELETE FROM evidence');
}
