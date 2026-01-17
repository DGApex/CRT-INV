
import React, { useState } from 'react';
import { BoxIcon, UsersIcon, PlusIcon, FileCheckIcon, BarChartIcon } from './Icons';
import { useAppStore } from '../store';
import { UserRole } from '../types';

// Hamburger Menu Icon
const MenuIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
);

const LogoutIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
);

type View = 'dashboard' | 'sessions' | 'assignments' | 'inventory' | 'my-reservations' | 'metrics';

interface LayoutProps {
  currentView: View;
  onNavigate: (view: View) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  const { currentUser, logout } = useAppStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter Nav Items based on Role
  const isInternal = currentUser?.role === UserRole.PLANTA_CRTIC;

  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: BoxIcon },
    { id: 'my-reservations', label: 'Mis Reservas', icon: FileCheckIcon },
    // Only Internal/Plant staff see Inventory and Metrics
    ...(isInternal ? [
        { id: 'metrics', label: 'Métricas', icon: BarChartIcon },
        { id: 'inventory', label: 'Inventario Total', icon: UsersIcon },
    ] : []),
  ];

  const handleNavigate = (view: View) => {
    onNavigate(view);
    setIsMobileMenuOpen(false); 
  };

  return (
    <div className="flex h-screen bg-neutral-950 font-sans text-neutral-200 selection:bg-sky-500/30 selection:text-sky-200 overflow-hidden">
      
      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4 z-50">
          <div className="font-bold text-white tracking-tight">CRTIC<span className="text-sky-400">Manager</span></div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-neutral-300 hover:text-white">
            <MenuIcon className="w-6 h-6" />
          </button>
      </div>

      {/* OVERLAY for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-neutral-900 flex flex-col shadow-2xl border-r border-neutral-800 transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-neutral-800 hidden lg:block">
          <h1 className="text-2xl font-bold tracking-tight text-white">CRTIC<span className="text-sky-400">Manager</span></h1>
          <p className="text-xs text-neutral-500 mt-1">Control de Inventario</p>
        </div>

        {/* Mobile Sidebar Header */}
        <div className="p-4 border-b border-neutral-800 lg:hidden flex justify-between items-center">
             <span className="font-bold text-neutral-400">Menú</span>
             <button onClick={() => setIsMobileMenuOpen(false)} className="text-neutral-500"><PlusIcon className="w-6 h-6 rotate-45" /></button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 border ${
                currentView === item.id 
                  ? 'bg-neutral-800 border-sky-500/50 text-sky-400 shadow-lg shadow-sky-900/10' 
                  : 'border-transparent hover:bg-neutral-800 hover:text-white text-neutral-400'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-800">
           <div className="flex items-center gap-3 mb-4">
             <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs ${isInternal ? 'bg-indigo-900/30 border-indigo-500/30 text-indigo-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400'}`}>
                {currentUser?.name.charAt(0)}
             </div>
             <div className="overflow-hidden">
               <p className="text-sm font-medium text-neutral-200 truncate">{currentUser?.name}</p>
               <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{isInternal ? 'Planta' : 'Usuario'}</p>
             </div>
           </div>
           
           <button onClick={logout} className="w-full flex items-center gap-2 justify-center px-4 py-2 bg-neutral-800 hover:bg-red-900/20 hover:text-red-400 text-neutral-400 rounded-lg text-sm transition-colors">
              <LogoutIcon className="w-4 h-4" />
              <span>Cerrar Sesión</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-neutral-950 pt-16 lg:pt-0 w-full">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
