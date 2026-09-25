// src/pages/corridor/PlanForm.tsx
import React from 'react';
import type { DeliveryProduct } from '../../modules/deliveries/types/delivery';
import { DELIVERY_PRODUCT_LABEL, DELIVERY_PRODUCT_OPTIONS } from '../../modules/deliveries/types/delivery';

export interface PresetOption {
  key: string;
  label: string;
}

interface PlanFormProps {
  originQuery: string;
  destQuery: string;
  onOriginChange: (value: string) => void;
  onDestChange: (value: string) => void;
  presets: PresetOption[];
  presetKey: string;
  onPresetChange: (key: string) => void;
  product: DeliveryProduct;
  onProductChange: (value: DeliveryProduct) => void;
  scenario: '1' | '2';
  onScenarioChange: (value: '1' | '2') => void;
  onSubmit: () => void;
  busy: boolean;
  error: string | null;
}

export const PlanForm: React.FC<PlanFormProps> = ({
  originQuery,
  destQuery,
  onOriginChange,
  onDestChange,
  presets,
  presetKey,
  onPresetChange,
  product,
  onProductChange,
  scenario,
  onScenarioChange,
  onSubmit,
  busy,
  error,
}) => (
  <form
    className="panel p-4 space-y-3"
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit();
    }}
  >
    <h2 className="panel-title">Plan a route</h2>

    <div>
      <label className="label" htmlFor="plan-from">From</label>
      <input
        id="plan-from"
        className="input"
        value={originQuery}
        onChange={(e) => onOriginChange(e.target.value)}
        placeholder="Town or city, e.g. Dimapur"
        autoComplete="off"
      />
    </div>
    <div>
      <label className="label" htmlFor="plan-to">To</label>
      <input
        id="plan-to"
        className="input"
        value={destQuery}
        onChange={(e) => onDestChange(e.target.value)}
        placeholder="Town or city, e.g. Imphal"
        autoComplete="off"
      />
    </div>

    <div>
      <label className="label" htmlFor="plan-product">Delivery product</label>
      <select
        id="plan-product"
        className="input"
        value={product}
        onChange={(e) => onProductChange(e.target.value as DeliveryProduct)}
      >
        {DELIVERY_PRODUCT_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {DELIVERY_PRODUCT_LABEL[p]}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label className="label" htmlFor="plan-preset">Saved corridors</label>
      <select
        id="plan-preset"
        className="input"
        value={presetKey}
        onChange={(e) => onPresetChange(e.target.value)}
      >
        <option value="custom" disabled>
          Choose a saved corridor
        </option>
        {presets.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
    </div>

    <fieldset>
      <legend className="label">Conditions</legend>
      <label className="flex items-start gap-2 py-0.5 cursor-pointer">
        <input
          type="radio"
          name="scenario"
          checked={scenario === '1'}
          onChange={() => onScenarioChange('1')}
          className="mt-1 accent-accent"
        />
        <span>Normal</span>
      </label>
      <label className="flex items-start gap-2 py-0.5 cursor-pointer">
        <input
          type="radio"
          name="scenario"
          checked={scenario === '2'}
          onChange={() => onScenarioChange('2')}
          className="mt-1 accent-accent"
        />
        <span>
          Severe weather warning
          <span className="block text-muted text-[0.85rem]">
            Simulated. Adds a severe hazard warning on mountain sectors.
          </span>
        </span>
      </label>
    </fieldset>

    <button type="submit" className="btn btn-primary w-full" disabled={busy}>
      {busy ? 'Finding routes…' : 'Find routes'}
    </button>

    {error && <p className="notice notice-error text-[0.9rem]">{error}</p>}
  </form>
);
