import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';

// Each page loads on first visit, so e.g. the SQLite engine for field reports
// isn't downloaded when someone only plans routes.
const CorridorPage = lazy(() => import('./pages/CorridorPage').then((m) => ({ default: m.CorridorPage })));
const FieldEvidencePage = lazy(() => import('./modules/fieldEvidence/FieldEvidencePage'));
const SMSPage = lazy(() => import('./modules/sms/SMSPage'));

function App() {
  return (
    <Router>
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Suspense fallback={<p className="p-6 text-muted">Loading…</p>}>
          <Routes>
            <Route path="/" element={<CorridorPage />} />
            <Route path="/field-evidence" element={<FieldEvidencePage />} />
            <Route path="/sms" element={<SMSPage />} />
          </Routes>
        </Suspense>
      </main>
    </Router>
  );
}

export default App;
