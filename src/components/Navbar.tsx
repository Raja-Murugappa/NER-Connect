import React from 'react';
import { NavLink } from 'react-router-dom';

export const Navbar: React.FC = () => {
  return (
    <header className="bg-white border-b-2 border-[#2d6a4f] px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-xs">
      {/* Brand Section */}
      <div className="flex items-center gap-3">
        <div className="bg-[#1b4332] text-white font-bold text-sm px-2.5 py-1.5 rounded tracking-wide shadow-xs">
          NER
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#1b4332] tracking-tight leading-none">
              NER-Connect
            </h1>
            <span className="text-[10px] bg-[#e8f5e9] text-[#1b5e20] border border-[#81c784] font-bold px-1.5 py-0.5 rounded uppercase">
              SIH 2024
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium hidden sm:block mt-0.5">
            Smart Logistics &amp; Accessibility Intelligence Platform (North Eastern Region)
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded transition ${
              isActive
                ? 'bg-[#2d6a4f] text-white shadow-xs'
                : 'text-gray-700 hover:bg-[#e8f5e9] hover:text-[#1b4332]'
            }`
          }
        >
          <span>🗺️</span>
          <span>Corridor Intelligence</span>
        </NavLink>

        <NavLink
          to="/field-evidence"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded transition ${
              isActive
                ? 'bg-[#2d6a4f] text-white shadow-xs'
                : 'text-gray-700 hover:bg-[#e8f5e9] hover:text-[#1b4332]'
            }`
          }
        >
          <span>📷</span>
          <span>Field Evidence</span>
        </NavLink>

        <NavLink
          to="/sms"
          className={({ isActive }) =>
            `flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded transition ${
              isActive
                ? 'bg-[#2d6a4f] text-white shadow-xs'
                : 'text-gray-700 hover:bg-[#e8f5e9] hover:text-[#1b4332]'
            }`
          }
        >
          <span>📡</span>
          <span>SMS &amp; Push</span>
        </NavLink>

        <a
          href="/receiver.html"
          target="_blank"
          rel="noreferrer"
          title="Open Wi-Fi Desktop Push Receiver in a separate window"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded bg-[#f0f9f3] text-[#1b4332] border border-[#a3d9b8] hover:bg-[#e8f5e9] transition"
        >
          <span>🔔</span>
          <span className="hidden md:inline">Wi-Fi Push Receiver</span>
          <span className="text-[10px] text-gray-500 font-mono">:8080</span>
        </a>
      </nav>

      {/* Operational System Indicator */}
      <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-gray-600 bg-[#f8faf8] border border-[#d1d5db] px-3 py-1.5 rounded">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <span>OpenStreetMap &amp; Wi-Fi Push Active</span>
      </div>
    </header>
  );
};
