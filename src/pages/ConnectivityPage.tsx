// src/pages/ConnectivityPage.tsx
// District connectivity: for each district, how many roads connect it and how many are
// currently available. Simulated, not real OSRM work - random each time a district is
// checked, standing in for a live feed this project doesn't have. The district list itself
// (state, name) is real.
import React, { useEffect, useMemo, useState } from 'react';
import { fetchDistricts, simulateDistrictConnectivity } from '../services/connectivityApi';
import type { ConnectivityLevel, DistrictConnectivityCheck, DistrictInfo } from '../services/connectivityApi';

const LEVEL_CLASS: Record<ConnectivityLevel, string> = {
  isolated: 'risk-high',
  critical: 'risk-high',
  limited: 'risk-medium',
  good: 'risk-low',
};

const key = (d: DistrictInfo) => `${d.state}|${d.district}`;

export const ConnectivityPage: React.FC = () => {
  const [districts, setDistricts] = useState<DistrictInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [checks, setChecks] = useState<Record<string, DistrictConnectivityCheck>>({});

  useEffect(() => {
    let cancelled = false;
    fetchDistricts()
      .then((list) => {
        if (!cancelled) setDistricts(list);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const checkOne = (d: DistrictInfo) => {
    setChecks((prev) => ({ ...prev, [key(d)]: simulateDistrictConnectivity() }));
  };

  const checkAll = () => {
    setChecks(Object.fromEntries(districts.map((d) => [key(d), simulateDistrictConnectivity()])));
  };

  const states = useMemo(() => Array.from(new Set(districts.map((d) => d.state))).sort(), [districts]);
  const shown = stateFilter === 'all' ? districts : districts.filter((d) => d.state === stateFilter);
  const checkedResults = Object.values(checks);
  const isolatedOrCritical = checkedResults.filter((c) => c.level === 'isolated' || c.level === 'critical').length;

  return (
    <div className="max-w-5xl mx-auto w-full px-4 py-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rise-in">
        <h1 className="text-xl font-display font-bold tracking-tight">District connectivity</h1>
        <p className="text-[0.85rem] text-muted">
          Simulated: a random check each time, not a live feed. District names are real.
        </p>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      {loading && !error && (
        <div className="panel p-4 space-y-2.5" aria-label="Loading districts">
          <div className="skeleton h-4 w-2/5" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
        </div>
      )}

      {!loading && !error && (
        <section className="panel rise-in rise-in-1">
          <div className="px-4 pt-3 pb-2 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="panel-title">
              {districts.length} districts
              {checkedResults.length > 0 && `, ${checkedResults.length} checked, ${isolatedOrCritical} isolated or critical`}
            </h2>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[0.85rem]">
                <span className="text-muted">State</span>
                <select className="input w-auto" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
                  <option value="all">All states</option>
                  {states.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn" onClick={checkAll}>
                Check all districts
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>District</th>
                  <th>Connectivity</th>
                  <th>Routes available</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const check = checks[key(d)];
                  return (
                    <tr key={key(d)}>
                      <td>{d.state}</td>
                      <td>{d.district}</td>
                      <td>
                        {check ? (
                          <span className={`risk ${LEVEL_CLASS[check.level]}`}>{check.label}</span>
                        ) : (
                          <span className="text-muted">Not checked yet</span>
                        )}
                      </td>
                      <td className="num">{check ? `${check.availableRoutes} of ${check.totalRoutes}` : '—'}</td>
                      <td>
                        <button type="button" className="btn text-[0.85rem] px-2.5 py-1" onClick={() => checkOne(d)}>
                          {check ? 'Recheck' : 'Check connectivity'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 border-t border-line-soft text-[0.85rem] text-muted">
            Isolated: no route currently available. Critical: only one route available. Limited: one backup route.
            Well connected: several routes available. Rechecking gives a different result - this is a simulation,
            not a measurement.
          </p>
        </section>
      )}
    </div>
  );
};

export default ConnectivityPage;
