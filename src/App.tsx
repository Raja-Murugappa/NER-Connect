import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { CorridorPage } from './pages/CorridorPage';
import FieldEvidencePage from './modules/fieldEvidence/FieldEvidencePage';
import SMSPage from './modules/sms/SMSPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#f4f6f4] text-[#111827]">
        <Navbar />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<CorridorPage />} />
            <Route path="/field-evidence" element={<FieldEvidencePage />} />
            <Route path="/sms" element={<SMSPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
