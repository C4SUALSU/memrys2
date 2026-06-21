import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AppLayout } from '@/components/AppLayout';
import { AuthAndSettings } from '@/components/AuthAndSettings';
import LandingPage from '@/pages/LandingPage';
import CheckEmailPage from '@/pages/CheckEmailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthAndSettings />} />
        <Route path="/check-email" element={<CheckEmailPage />} />
        <Route path="/app" element={<AppLayout />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
