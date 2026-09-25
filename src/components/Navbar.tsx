import React from 'react';
import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Routes', end: true },
  { to: '/field-evidence', label: 'Field reports', end: false },
  { to: '/sms', label: 'SMS alerts', end: false },
];

export const Navbar: React.FC = () => (
  <header className="bg-panel border-b border-line sticky top-0 z-[1000] shadow-[0_1px_3px_rgba(24,36,32,0.05)]">
    <div className="max-w-7xl mx-auto px-4 h-13 flex items-center gap-6">
      <span className="font-display font-bold text-[1.1rem] tracking-tight text-ink flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-[3px] bg-accent inline-block" aria-hidden="true" />
        NER-Connect
      </span>
      <nav className="flex items-center gap-1 h-full">
        {LINKS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `relative h-full flex items-center px-3 text-[0.95rem] transition-colors duration-150 after:content-[''] after:absolute after:left-3 after:right-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent after:origin-left after:transition-transform after:duration-200 ${
                isActive
                  ? 'text-ink font-semibold after:scale-x-100'
                  : 'text-muted font-medium hover:text-ink after:scale-x-0'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  </header>
);
