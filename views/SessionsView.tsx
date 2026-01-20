
import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { SessionStatus, SessionType, UserRole, EquipmentStatus } from '../types';
import { PlusIcon, ArrowRightIcon, TrashIcon } from '../components/Icons';

export const SessionsView: React.FC = () => {
  const { sessions, users, equipment, addSession, closeSession, addItemToSession, removeItemFromSession, currentUser } = useAppStore();
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  const isInternal = currentUser?.role === UserRole.PLANTA_CRTIC;

  // Determine default session type based on role, but allow change
  const getDefaultType = () => {
        if (!currentUser) return SessionType.EVENT;
        const role = String(currentUser.role).toLowerCase().trim();
        
        if (role.includes('residente')) return SessionType.RESIDENCY;
        if (role.includes('docente')) return SessionType.WORKSHOP;
        if (role.includes('planta') || role.includes('admin')) return SessionType.INTERNAL_PRODUCTION;
        
        return SessionType.EVENT;
  };

  const availableSessionTypes = useMemo(() => {
        return Object.values(SessionType).filter(t => {
            if (t === SessionType.INTERNAL_PRODUCTION && !isInternal) return false;
            return true;
        });
  }, [isInternal]);

  // New Session Form State
  const [newSessionData, setNewSessionData] = useState({
    userId: '',
    projectName: '',
    type: getDefaultType(),
    startDate: new Date().toISOString().split('T')[0],
    endDate: ''
  });

  // Derived State
  const activeSessions = sessions.filter(s => s.status === SessionStatus.ACTIVE);
  const selectedSession = sessions.find(s => s.id === selectedSessionId);
  const availableEquipment = equipment.filter(e => e.status === EquipmentStatus.AVAILABLE);
  const flowAUsers = users.filter(u => u.role !== UserRole.PLANTA_CRTIC);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionData.userId || !newSessionData.projectName || !newSessionData.startDate) return;
    
    setIsSubmitting(true);
    try {
        await addSession({ 
            userId: newSessionData.userId, 
            projectName: newSessionData.projectName, 
            type: newSessionData.type, 
            startDate: newSessionData.startDate,
            endDate: newSessionData.endDate || undefined
        });
        setIsCreating(false);
        setNewSessionData({ userId: '', projectName: '', type: getDefaultType(), startDate: new Date().toISOString().split('T')[0], endDate: '' });
    } catch (e) {
        alert("Error al crear la reserva y sincronizar.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCloseSession = (id: string) => {
    if (confirm('¿Cerrar reserva y devolver todos los equipos a Disponible?')) {
      closeSession(id);
      setSelectedSessionId(null);
    }
  };

  if (selectedSessionId && selectedSession) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4">
        {/* Detail / Cart View */}
        <div className="flex items-center justify-between">
           <button onClick={() => setSelectedSessionId(null)} className="text-slate-400 hover:text-white flex items-center gap-2">← Volver a Reservas</button>
           <button onClick={() => handleCloseSession(selectedSession.id)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-700 border border-slate-700">Finalizar Reserva</button>
        </div>

        <div className="bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-800 text-white">
           <div className="flex justify-between items-start mb-6">
              <div>
                  <h2 className="text-2xl font-bold">{selectedSession.projectName}</h2>
                  <div className="flex gap-4 mt-2 text-sm text-slate-400">
                    <span className="flex items-center gap-1"><span className="font-semibold text-slate-300">Responsable:</span> {users.find(u => u.id === selectedSession.userId)?.name}</span>
                    <span className="flex items-center gap-1"><span className="font-semibold text-slate-300">Tipo:</span> {selectedSession.type}</span>
                  </div>
              </div>
              <div className="bg-sky-900/30 text-sky-400 border border-sky-500/30 px-3 py-1 rounded-full text-xs font-bold">ACTIVA</div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* CURRENT CART */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <h3 className="font-bold text-slate-300 mb-4 flex items-center justify-between">
                      Equipos en Reserva <span className="bg-slate-800 px-2 rounded-full text-xs text-white">{selectedSession.items.length}</span>
                  </h3>
                  {selectedSession.items.length === 0 ? <p className="text-sm text-slate-600 italic">No hay equipos agregados.</p> : (
                      <ul className="space-y-2">
                          {selectedSession.items.map(itemId => {
                              const item = equipment.find(e => e.id === itemId);
                              return (
                                  <li key={itemId} className="flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800 shadow-sm">
                                      <span className="text-sm font-medium text-slate-200">{item?.name}</span>
                                      <button onClick={() => removeItemFromSession(selectedSession.id, itemId)} className="text-slate-500 hover:text-red-400 p-1"><TrashIcon className="w-4 h-4"/></button>
                                  </li>
                              )
                          })}
                      </ul>
                  )}
              </div>

              {/* AVAILABLE INVENTORY */}
              <div>
                  <h3 className="font-bold text-slate-300 mb-4">Agregar Equipos Disponibles</h3>
                  <div className="h-96 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950">
                      {availableEquipment.length === 0 ? <div className="p-8 text-center text-slate-600">No hay equipos disponibles.</div> : (
                          <table className="w-full text-sm text-left">
                              <thead className="bg-slate-900 text-slate-400 sticky top-0">
                                  <tr><th className="p-3">Nombre</th><th className="p-3">Categoría</th><th className="p-3 w-16">Acción</th></tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800 text-slate-300">
                                  {availableEquipment.map(item => (
                                      <tr key={item.id} className="hover:bg-slate-900">
                                          <td className="p-3 font-medium">{item.name}</td>
                                          <td className="p-3 text-slate-500">{item.category}</td>
                                          <td className="p-3">
                                              <button onClick={() => addItemToSession(selectedSession.id, item.id)} className="p-1.5 bg-sky-900/30 text-sky-400 rounded hover:bg-sky-900/50 transition-colors border border-sky-500/20"><PlusIcon className="w-4 h-4"/></button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // MAIN LIST VIEW
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white">Reservas y Uso (Flow A)</h2>
          <p className="text-slate-400">Gestión de residentes, estudiantes y eventos temporales.</p>
        </div>
        <button onClick={() => setIsCreating(true)} disabled={isSubmitting} className="flex items-center gap-2 bg-slate-100 hover:bg-white text-slate-900 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"><PlusIcon className="w-4 h-4" /> Nueva Reserva</button>
      </div>

      {isCreating && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg animate-in fade-in zoom-in-95 text-white">
            <h3 className="font-bold text-lg mb-4">Crear Nueva Reserva</h3>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Nombre Proyecto</label>
                    <input type="text" required disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-white disabled:opacity-50" value={newSessionData.projectName} onChange={e => setNewSessionData({...newSessionData, projectName: e.target.value})} placeholder="Ej: Residencia Artística Vol. 2"/>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Responsable</label>
                    <select required disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-white disabled:opacity-50" value={newSessionData.userId} onChange={e => setNewSessionData({...newSessionData, userId: e.target.value})}>
                        <option value="">Seleccionar Usuario...</option>
                        {flowAUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Uso</label>
                    <select required disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-white disabled:opacity-50" value={newSessionData.type} onChange={e => setNewSessionData({...newSessionData, type: e.target.value as SessionType})}>
                        {availableSessionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha Inicio</label>
                    <input type="date" required disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-white disabled:opacity-50" value={newSessionData.startDate} onChange={e => setNewSessionData({...newSessionData, startDate: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Fecha Término (Opcional)</label>
                    <input type="date" disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-sky-500 outline-none text-white disabled:opacity-50" value={newSessionData.endDate} onChange={e => setNewSessionData({...newSessionData, endDate: e.target.value})} />
                </div>
                <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                    <button type="button" disabled={isSubmitting} onClick={() => setIsCreating(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white disabled:opacity-50">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-500 disabled:opacity-50 flex items-center gap-2">
                        {isSubmitting ? 'Guardando...' : 'Crear Reserva'}
                    </button>
                </div>
            </form>
        </div>
      )}

      {/* Active Sessions List */}
      <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
         <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 font-semibold text-slate-300 flex justify-between items-center">
             <span>Reservas Activas</span>
             <span className="bg-sky-900/30 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded text-xs">{activeSessions.length}</span>
         </div>
         <div className="divide-y divide-slate-800">
            {activeSessions.length === 0 ? <div className="p-8 text-center text-slate-600">No hay reservas activas.</div> : (
                activeSessions.map(session => (
                    <div key={session.id} className="p-4 flex items-center justify-between hover:bg-slate-800 transition-colors group">
                        <div>
                            <h4 className="font-bold text-slate-200 group-hover:text-white">{session.projectName}</h4>
                            <div className="flex gap-4 text-xs text-slate-500 mt-1">
                                <span>{users.find(u => u.id === session.userId)?.name}</span><span>•</span><span>{session.type}</span><span>•</span><span>{new Date(session.startDate).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <span className="block font-bold text-white">{session.items.length}</span>
                                <span className="text-[10px] text-slate-500 uppercase">Equipos</span>
                            </div>
                            <button onClick={() => setSelectedSessionId(session.id)} className="p-2 bg-slate-950 border border-slate-700 rounded-lg hover:border-sky-500 hover:text-sky-400 transition-all shadow-sm group">
                                <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    </div>
                ))
            )}
         </div>
      </div>
    </div>
  );
};
