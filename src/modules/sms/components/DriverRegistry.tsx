// src/modules/sms/components/DriverRegistry.tsx
// Driver profile management: mirrors E:\sms POST/GET /api/v1/drivers

import React, { useState } from 'react';
import type { DriverProfile, SupportedLanguage } from '../types/sms';
import { LANGUAGE_NAMES } from '../types/sms';
import { smsStore } from '../services/smsStore';

interface DriverRegistryProps {
  drivers: DriverProfile[];
  onUpdate: (drivers: DriverProfile[]) => void;
}

const EMPTY_FORM: Omit<DriverProfile, 'id'> = {
  name: '',
  phone: '+91 ',
  language: 'en',
  vehicleId: '',
  fleetId: '',
};

export const DriverRegistry: React.FC<DriverRegistryProps> = ({ drivers, onUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<DriverProfile, 'id'>>(EMPTY_FORM);
  const [error, setError] = useState('');

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  };

  const openEdit = (d: DriverProfile) => {
    setEditingId(d.id);
    setForm({ name: d.name, phone: d.phone, language: d.language, vehicleId: d.vehicleId ?? '', fleetId: d.fleetId ?? '' });
    setError('');
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    const profile: DriverProfile = {
      id: editingId ?? `d_${Date.now()}`,
      name: form.name.trim(),
      phone: form.phone.trim(),
      language: form.language,
      vehicleId: form.vehicleId?.trim() || undefined,
      fleetId: form.fleetId?.trim() || undefined,
    };

    const updated = smsStore.upsertDriver(profile);
    onUpdate(updated);
    setShowForm(false);
    setError('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remove this driver profile?')) return;
    const updated = smsStore.deleteDriver(id);
    onUpdate(updated);
  };

  return (
    <div className="ner-card overflow-hidden">
      <div className="ner-card-header bg-[#f8faf8]">
        <div className="flex items-center gap-2">
          <span className="ner-heading text-xs">Driver Registry</span>
          <span className="text-[10px] bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-full">
            {drivers.length} Drivers
          </span>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-xs font-bold px-3 py-1.5 rounded transition"
        >
          + Register Driver
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="border-b border-gray-200 p-4 bg-[#f1f8f3] space-y-3">
          <h4 className="text-xs font-bold text-[#1b4332] uppercase">
            {editingId ? 'Edit Driver Profile' : 'Register New Driver'}
          </h4>

          {error && (
            <p className="text-xs text-[#c62828] bg-[#ffebee] border border-[#e57373] px-3 py-2 rounded">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Full Name *</label>
              <input
                className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f]"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Driver full name"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Phone *</label>
              <input
                className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f] font-mono"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="+91XXXXXXXXXX"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Language Preference</label>
              <select
                className="w-full text-xs p-2 border border-gray-300 rounded bg-white focus:outline-none focus:border-[#2d6a4f]"
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as SupportedLanguage }))}
              >
                {Object.entries(LANGUAGE_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Vehicle ID</label>
              <input
                className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f] font-mono"
                value={form.vehicleId}
                onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                placeholder="AS-01-AB-1234"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Fleet ID</label>
              <input
                className="w-full text-xs p-2 border border-gray-300 rounded focus:outline-none focus:border-[#2d6a4f] font-mono"
                value={form.fleetId}
                onChange={(e) => setForm((f) => ({ ...f, fleetId: e.target.value }))}
                placeholder="FLEET-NER-A"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              className="bg-[#1b4332] hover:bg-[#2d6a4f] text-white text-xs font-bold px-4 py-2 rounded transition"
            >
              {editingId ? 'Save Changes' : 'Register Driver'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold px-4 py-2 rounded border border-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Driver Table */}
      <div className="p-4">
        {drivers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No drivers registered yet. Click &ldquo;Register Driver&rdquo; to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] uppercase text-gray-500 font-bold">
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Phone</th>
                  <th className="text-left py-2 px-2">Language</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Vehicle</th>
                  <th className="text-left py-2 px-2 hidden sm:table-cell">Fleet</th>
                  <th className="text-left py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="py-2 px-2 font-semibold text-[#1b4332]">{d.name}</td>
                    <td className="py-2 px-2 font-mono text-gray-700">{d.phone}</td>
                    <td className="py-2 px-2">
                      <span className="bg-[#e8f5e9] text-[#1b5e20] border border-[#81c784] text-[10px] font-bold px-2 py-0.5 rounded">
                        {LANGUAGE_NAMES[d.language]}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-gray-500 text-[10px] hidden sm:table-cell">
                      {d.vehicleId ?? '—'}
                    </td>
                    <td className="py-2 px-2 font-mono text-gray-500 text-[10px] hidden sm:table-cell">
                      {d.fleetId ?? '—'}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          className="text-[#2d6a4f] hover:underline font-semibold text-[10px]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="text-[#c62828] hover:underline font-semibold text-[10px]"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
