import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LeadCandidates from './pages/LeadCandidates';
import LeadCandidateDetail from './pages/LeadCandidateDetail';
import Concepts from './pages/Concepts';
import ConceptDetail from './pages/ConceptDetail';
import Offerte from './pages/Offerte';
import Analytics from './pages/Analytics';
import Anagrafiche from './pages/Anagrafiche';
import Team from './pages/Team';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <NotificationsProvider>
                  <Layout />
                </NotificationsProvider>
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/leads" element={<LeadCandidates />} />
            <Route path="/leads/:id" element={<LeadCandidateDetail />} />
            <Route path="/concepts" element={<Concepts />} />
            <Route path="/concepts/:id" element={<ConceptDetail />} />
            <Route path="/offerte" element={<Offerte />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/anagrafiche" element={<Anagrafiche />} />
            <Route path="/team" element={<Team />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
