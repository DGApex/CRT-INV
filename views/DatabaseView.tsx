
import React, { useState } from 'react';
import { useAppStore } from '../store';

export const DatabaseView: React.FC = () => {
  const { syncFromSheets, sessions, assignments } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  const handleSync = async () => {
    setLoading(true);
    const result = await syncFromSheets();
    setSyncStatus(result);
    setLoading(false);
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = [headers.join(','), ...data.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || '')).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-3xl font-bold text-white">Base de Datos Privada</h2>
        <p className="text-neutral-400">Configuración del puente seguro (Apps Script).</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* CONNECTION STATUS */}
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg text-white">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                Conexión Apps Script
            </h3>
            <div className="text-sm text-neutral-400 space-y-2">
                <p>Tu hoja de cálculo está <strong>Privada</strong>. La conexión se realiza mediante un Script seguro.</p>
                <div className="bg-neutral-950 p-3 rounded border border-neutral-800 mt-2">
                    <span className="block text-xs font-bold text-neutral-500 uppercase">API Key Interna</span>
                    <span className="font-mono text-white block">CRTIC_SECRET_2025</span>
                </div>
            </div>
        </div>

        {/* SYNC ACTIONS */}
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg flex flex-col justify-between text-white">
            <div>
                <h3 className="font-bold text-lg mb-4">Sincronización de Datos</h3>
                <p className="text-sm text-neutral-500 mb-6">
                    Descarga los últimos datos de "Inventario" y "Usuarios" desde la hoja privada.
                </p>
                
                {syncStatus && (
                    <div className={`mb-4 p-3 rounded text-sm ${syncStatus.includes('Error') ? 'bg-red-900/20 text-red-400 border border-red-900/30' : 'bg-green-900/20 text-green-400 border border-green-900/30'}`}>
                        {syncStatus}
                    </div>
                )}

                <button onClick={handleSync} disabled={loading} className="w-full bg-neutral-800 text-white border border-neutral-700 py-3 rounded-lg font-medium hover:bg-neutral-700 disabled:opacity-50 flex justify-center items-center gap-2">
                    {loading ? <>Conectando con Script...</> : <>Sincronizar Datos</>}
                </button>
            </div>
            
            <div className="mt-8 border-t border-neutral-800 pt-6">
                <h3 className="font-bold text-lg mb-2 text-sky-400">Exportar Historial</h3>
                <p className="text-sm text-neutral-400 mb-4">
                    Para respaldar los movimientos realizados en la App, descarga los CSV y pégalos en nuevas pestañas de tu Google Sheet.
                </p>
                <div className="flex gap-4">
                    <button onClick={() => downloadCSV(sessions, 'sesiones_log.csv')} className="flex-1 bg-sky-900/20 text-sky-400 border border-sky-500/30 py-3 rounded-lg text-sm hover:bg-sky-900/40 font-bold">Descargar Sesiones</button>
                    <button onClick={() => downloadCSV(assignments, 'asignaciones_log.csv')} className="flex-1 bg-indigo-900/20 text-indigo-400 border border-indigo-500/30 py-3 rounded-lg text-sm hover:bg-indigo-900/40 font-bold">Descargar Asignaciones</button>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};
