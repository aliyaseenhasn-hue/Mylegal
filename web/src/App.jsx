import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider, Loader, ErrorBoundary } from './components/ui';
import Layout from './components/Layout';
import { Login, NoOffice } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import { ClientList, ClientDetail } from './pages/Clients';
import { CaseList, CaseDetail } from './pages/Cases';
import CalendarPage from './pages/Calendar';
import TasksPage from './pages/Tasks';
import FinancePage, { ReceiptPage } from './pages/Finance';
import PoaPage from './pages/Poa';
import { DocumentsPage } from './pages/Documents';
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';
import { NotificationsPage, ActivityPage, NotFound } from './pages/Misc';
import PlatformPage from './pages/Platform';

function Gate() {
  const { session, member, loading, signOut, can, isPlatformAdmin } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Loader label="جارٍ التحميل…" /></div>;
  if (!session) return <Login />;
  if (!member) return <NoOffice onSignOut={signOut} />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<ClientList />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="cases" element={<CaseList />} />
        <Route path="cases/:id" element={<CaseDetail />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="poa" element={<PoaPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        {can('viewFinance') && <Route path="finance" element={<FinancePage />} />}
        {can('viewFinance') && <Route path="receipt/:id" element={<ReceiptPage />} />}
        {can('viewReports') && <Route path="reports" element={<ReportsPage />} />}
        {can('viewActivity') && <Route path="activity" element={<ActivityPage />} />}
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {isPlatformAdmin && <Route path="platform" element={<PlatformPage />} />}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <ErrorBoundary>
            <Gate />
          </ErrorBoundary>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}
