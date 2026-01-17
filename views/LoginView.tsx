
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { UserRole } from '../types';

export const LoginView: React.FC = () => {
  const { users, login, syncFromSheets } = useAppStore();
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Initial Sync Check
  useEffect(() => {
    if (users.length === 0) {
        handleSync();
    }
  }, []);

  const handleSync = async () => {
      setLoading(true);
      setStatusMessage('Contactando Apps Script...');
      const result = await syncFromSheets();
      setStatusMessage(result);
      setLoading(false);
  };

  const handleHardReset = () => {
      if(confirm("¿Estás seguro? Esto borrará los datos guardados en este dispositivo y recargará la página para descargar todo de nuevo desde el Excel.")) {
          localStorage.removeItem('crtic_app_state');
          window.location.reload();
      }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUser) {
        setError('Por favor selecciona un usuario.');
        return;
    }

    const user = users.find(u => u.id === selectedUser);
    
    // Check password if the user has one defined in the sheet
    if (user?.password) {
        if (user.password !== password) {
            setError('Contraseña incorrecta.');
            return;
        }
    }

    login(selectedUser);
  };

  // Filter users: STRICTLY checks for true.
  const activeUsers = users.filter(u => u.active === true);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95">
        <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">CRTIC<span className="text-sky-400">Manager</span></h1>
            <p className="text-neutral-400">Sistema de Control de Inventario</p>
        </div>

        {users.length === 0 ? (
            <div className="text-center space-y-4">
                <div className="p-4 bg-sky-900/20 border border-sky-900/40 rounded-xl text-sky-200 text-sm text-left">
                    <p className="font-bold mb-2 text-center">Estado de Conexión</p>
                    
                    {statusMessage ? (
                        <div className={`text-xs p-2 rounded mb-2 font-mono ${statusMessage.includes('Error') ? 'bg-red-900/30 text-red-300 border border-red-800' : 'bg-green-900/30 text-green-300 border border-green-800'}`}>
                            {statusMessage}
                        </div>
                    ) : (
                         <p className="text-xs opacity-80 mb-2 text-center">Conectando...</p>
                    )}

                    {statusMessage.includes('Error') && (
                        <div className="mt-3 text-[10px] text-neutral-400 space-y-2 border-t border-sky-800/50 pt-2">
                            <p><strong>Posibles Soluciones:</strong></p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>
                                    <strong>¿Cambió la URL?</strong> Si re-implementaste el script, copia la NUEVA URL en <code>store.tsx</code>.
                                </li>
                                <li>
                                    <strong>¿Permisos?</strong> Revisa que el Script tenga acceso: "Cualquier usuario (Anyone)".
                                </li>
                                <li>
                                    <strong>¿API Key?</strong> Verifica que <code>CRTIC_SECRET_2025</code> esté en ambos lados.
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
                
                <button 
                    onClick={handleSync} 
                    disabled={loading}
                    className="w-full py-3 bg-neutral-800 text-white rounded-xl font-bold hover:bg-neutral-700 border border-neutral-700 flex justify-center items-center gap-2"
                >
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Reintentar Conexión'}
                </button>
            </div>
        ) : (
            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-2">Usuario</label>
                    <div className="relative">
                        <select 
                            required
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-white appearance-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                            value={selectedUser}
                            onChange={(e) => { setSelectedUser(e.target.value); setError(''); }}
                        >
                            <option value="">Seleccionar...</option>
                            {activeUsers.map(u => (
                                <option key={u.id} value={u.id}>
                                    {u.name} — {u.role === UserRole.PLANTA_CRTIC ? 'PLANTA' : 'RESIDENTE'}
                                </option>
                            ))}
                        </select>
                        {activeUsers.length === 0 && users.length > 0 && (
                            <p className="text-xs text-red-400 mt-2">
                                Advertencia: Usuarios detectados pero todos marcados como inactivos ("No").
                            </p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-neutral-400 mb-2">Contraseña</label>
                    <input 
                        type="password"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none transition-all"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {error && <div className="text-red-400 text-sm text-center bg-red-900/10 p-2 rounded-lg border border-red-900/20">{error}</div>}

                <button 
                    type="submit" 
                    disabled={!selectedUser}
                    className="w-full py-4 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 shadow-lg shadow-sky-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Ingresar al Sistema
                </button>
                
                <div className="flex justify-between items-center pt-4 border-t border-neutral-800/50">
                    <button type="button" onClick={handleSync} className="text-xs text-neutral-600 hover:text-neutral-400 flex items-center gap-1">
                        🔄 Sincronizar
                    </button>
                    <button type="button" onClick={handleHardReset} className="text-xs text-red-900 hover:text-red-500 transition-colors">
                        ⚠️ Resetear Datos Locales
                    </button>
                </div>
            </form>
        )}

        <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
            <p className="text-xs text-neutral-600">
                Seguridad: Conexión cifrada vía Google Apps Script.
            </p>
        </div>
      </div>
    </div>
  );
};
