// src/modules/sms/components/DriverRegistry.tsx
// Add, edit and remove the drivers alerts can be sent to.

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
    onUpdate(smsStore.upsertDriver(profile));
    setShowForm(false);
    setError('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remove this driver?')) return;
    onUpdate(smsStore.deleteDriver(id));
  };

  const field = (key: keyof typeof form, label: string, placeholder = '') => (
    <div>
      <label className="label" htmlFor={`driver-${key}`}>{label}</label>
      <input
        id={`driver-${key}`}
        className="input"
        value={(form[key] as string) ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <section className="panel">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-line">
        <h2 className="panel-title">Drivers</h2>
        {!showForm && (
          <button type="button" onClick={openAdd} className="btn btn-primary">
            Add driver
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="p-4 space-y-3 border-b border-line bg-canvas">
          <h3 className="font-medium">{editingId ? 'Edit driver' : 'New driver'}</h3>
          {error && <p className="notice notice-error">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {field('name', 'Name', 'Full name')}
            {field('phone', 'Phone', '+91 98765 43210')}
            <div>
              <label className="label" htmlFor="driver-language">Language</label>
              <select
                id="driver-language"
                className="input"
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as SupportedLanguage }))}
              >
                {Object.entries(LANGUAGE_NAMES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {field('vehicleId', 'Vehicle number', 'AS-01-AB-1234')}
            {field('fleetId', 'Fleet', 'Optional')}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">{editingId ? 'Save changes' : 'Add driver'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn">Cancel</button>
          </div>
        </form>
      )}

      {drivers.length === 0 ? (
        <p className="px-4 py-6 text-muted">No drivers yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Language</th>
                <th>Vehicle</th>
                <th>Fleet</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td>
                  <td className="num">{d.phone}</td>
                  <td>{LANGUAGE_NAMES[d.language]}</td>
                  <td className="num">{d.vehicleId ?? <span className="text-muted">None</span>}</td>
                  <td>{d.fleetId ?? <span className="text-muted">None</span>}</td>
                  <td className="whitespace-nowrap text-right">
                    <button type="button" onClick={() => openEdit(d)} className="underline mr-3">Edit</button>
                    <button type="button" onClick={() => handleDelete(d.id)} className="underline text-risk-high">Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
