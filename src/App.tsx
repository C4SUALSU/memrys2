import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Layout } from '@/components/Layout';
import { AuthAndSettings } from '@/components/AuthAndSettings';
import LandingPage from '@/pages/LandingPage';
import CalendarPage from '@/pages/CalendarPage';
import ChatPage from '@/pages/ChatPage';
import FriendsPage from '@/pages/FriendsPage';
import SettingsPage from '@/pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthAndSettings />} />
        <Route element={<Layout />}>
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="chat/:spaceId" element={<ChatPage />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
