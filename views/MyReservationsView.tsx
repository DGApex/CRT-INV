
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { Session, SessionStatus } from '../types';
import { FileCheckIcon, ClipboardIcon } from '../components/Icons';

export const MyReservationsView: React.FC = () => {
  const { sessions, equipment, currentUser, closeSession } = useAppStore();
  
  // Modal State
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState('');

  // Filter Active Sessions for Current User
  const myActiveSessions = useMemo(() => {
    if (!currentUser) return [];
    return sessions.filter(s => s.userId === currentUser.id && s.status === SessionStatus.ACTIVE);
  }, [sessions, currentUser]);

  const openReturnModal = (sessionId: string) => {
      setSelectedSessionId(sessionId);
      setReturnComment('');
      setReturnModalOpen(true);
  };

  const confirmReturn = () => {
      if (selectedSessionId) {
          const finalComment = returnComment.trim() || 'Devuelto Ok';
          closeSession(selectedSessionId, finalComment);
          setReturnModalOpen(false);
          setSelectedSessionId(null);
      }
  };

  // --- DATE HELPER (Fixes -1 Day Bug) ---
  const displayDate = (dateStr: string) => {
      if (!dateStr) return '';
      // Take first part (YYYY-MM-DD) to avoid timezone shifts
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
          // Return DD/MM/YYYY
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <FileCheckIcon className="w-8 h-8 text-sky-400" />
            Mis Reservas
        </h2>
        <p className="text-neutral-400 mt-2">Gestiona tus préstamos activos y realiza devoluciones.</p>
      </div>

      {/* ACTIVE SESSIONS LIST */}
      <div className="grid grid-cols-1 gap-6">
        {myActiveSessions.length === 0 ? (
            <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-12 text-center">
                <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardIcon className="w-8 h-8 text-neutral-600" />
                </div>
                <h3 className="text-lg font-bold text-white">No tienes reservas activas</h3>
                <p className="text-neutral-500 mt-1">Cuando solicites equipos, aparecerán aquí.</p>
            </div>
        ) : (
            myActiveSessions.map(session => (
                <div key={session.id} className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden shadow-lg flex flex-col md:flex-row">
                    {/* Session Info */}
                    <div className="p-6 flex-1">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="bg-sky-900/30 text-sky-400 border border-sky-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Activa</span>
                            <span className="text-neutral-500 text-sm font-mono">
                                Inicio: <span className="text-white">{displayDate(session.startDate)}</span>
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">{session.projectName}</h3>
                        <p className="text-sm text-neutral-400">Tipo: {session.type}</p>
                        
                        <div className="mt-6">
                            <h4 className="text-xs font-bold text-neutral-500 uppercase mb-2">Equipos en tu poder:</h4>
                            <div className="flex flex-wrap gap-2">
                                {session.items.map(itemId => {
                                    const item = equipment.find(e => e.id === itemId);
                                    return (
                                        <span key={itemId} className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
                                            {item?.name || 'Item Desconocido'}
                                            {/* Hide ID Suffix */}
                                            <span className="text-[10px] text-neutral-600">{itemId.split('_DUPE_')[0]}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Action Panel */}
                    <div className="bg-neutral-950 p-6 flex flex-col justify-center items-start md:items-end border-t md:border-t-0 md:border-l border-neutral-800 w-full md:w-64">
                         <p className="text-neutral-500 text-xs mb-4 text-center md:text-right">
                             Al terminar tu sesión, devuelve los equipos para que otros puedan usarlos.
                         </p>
                         <button 
                            onClick={() => openReturnModal(session.id)}
                            className="w-full py-3 bg-neutral-100 hover:bg-white text-neutral-900 font-bold rounded-xl shadow-lg transition-all transform active:scale-95"
                         >
                             Devolver Equipos
                         </button>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* RETURN MODAL */}
      {returnModalOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl w-full max-w-lg animate-in zoom-in-95">
                <div className="p-6 border-b border-neutral-800">
                    <h3 className="text-xl font-bold text-white">Confirmar Devolución</h3>
                    <p className="text-neutral-400 text-sm mt-1">Vas a cerrar la sesión y liberar los equipos.</p>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="bg-yellow-900/10 border border-yellow-900/30 p-4 rounded-xl">
                        <label className="block text-xs font-bold text-yellow-500 uppercase mb-2">¿Alguna novedad o daño?</label>
                        <textarea 
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-white text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none resize-none"
                            rows={3}
                            placeholder="Ej: Todo ok, o 'La cámara tiene un rayón en la lente'..."
                            value={returnComment}
                            onChange={(e) => setReturnComment(e.target.value)}
                        />
                        <p className="text-[10px] text-neutral-500 mt-2">
                            Si dejas esto vacío, se asumirá que todo está "Ok".
                        </p>
                    </div>
                </div>

                <div className="p-6 border-t border-neutral-800 flex gap-3 bg-neutral-950 rounded-b-2xl">
                    <button 
                        onClick={() => setReturnModalOpen(false)} 
                        className="flex-1 py-3 bg-neutral-800 text-neutral-300 font-medium rounded-xl hover:bg-neutral-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmReturn} 
                        className="flex-1 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-500 shadow-lg shadow-sky-900/20 transition-colors"
                    >
                        Confirmar y Devolver
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
