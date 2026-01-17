
import React, { useState } from 'react';
import { AppProvider, useAppStore } from './store';
import { Layout } from './components/Layout';
import { Dashboard } from './views/Dashboard';
import { SessionsView } from './views/SessionsView';
import { AssignmentsView } from './views/AssignmentsView';
import { InventoryView } from './views/InventoryView';
import { LoginView } from './views/LoginView';
import { MyReservationsView } from './views/MyReservationsView';
import { AdminStatsView } from './views/AdminStatsView';

const AppContent: React.FC = () => {
  const { currentUser } = useAppStore();
  const [currentView, setCurrentView] = useState<'dashboard' | 'sessions' | 'assignments' | 'inventory' | 'my-reservations' | 'metrics'>('dashboard');

  if (!currentUser) {
      return <LoginView />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'sessions': return <SessionsView />;
      case 'assignments': return <AssignmentsView />;
      case 'inventory': return <InventoryView />;
      case 'my-reservations': return <MyReservationsView />;
      case 'metrics': return <AdminStatsView />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderView()}
    </Layout>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
