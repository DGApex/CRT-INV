
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { AssignmentStatus, EquipmentStatus, InternalAssignment, UserRole } from '../types';
import { PlusIcon } from '../components/Icons';

export const AssignmentsView: React.FC = () => {
  const { assignments, users, equipment, addAssignment, returnAssignment } = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ userId: '', equipmentId: '', initialCondition: 'Good' });
  const activeAssignments = assignments.filter(a => a.status === AssignmentStatus.ACTIVE);
  const staffUsers = users.filter(u => u.role === UserRole.PLANTA_CRTIC);
  const availableEquipment = equipment.filter(e => e.status === EquipmentStatus.AVAILABLE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.userId || !formData.equipmentId) return;
    
    setIsSubmitting(true);
    try {
        await addAssignment({ userId: formData.userId, equipmentId: formData.equipmentId, initialCondition: formData.initialCondition, assignedDate: new Date().toISOString() });
        setIsAdding(false);
        setFormData({ userId: '', equipmentId: '', initialCondition: 'Good' });
    } catch(e) {
        alert("Error al sincronizar asignación.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleReturn = (id: string) => {
      const condition = prompt("Condición de retorno (ej: Bueno, Rayado):", "Bueno");
      if (condition) returnAssignment(id, condition);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white">Asignaciones Internas (Flow B)</h2>
          <p className="text-slate-400">Equipos asignados a staff de planta (largo plazo).</p>
        </div>
        <button onClick={() => setIsAdding(true)} disabled={isSubmitting} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"><PlusIcon className="w-4 h-4" /> Nueva Asignación</button>
      </div>

      {isAdding && (
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg animate-in fade-in zoom-in-95 text-white">
              <h3 className="font-bold text-lg mb-4">Asignar Equipo a Planta</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Funcionario</label>
                      <select required disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white disabled:opacity-50" value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})}>
                          <option value="">Seleccionar...</option>
                          {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                  </div>
                  <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Equipo (Disponible)</label>
                      <select required disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white disabled:opacity-50" value={formData.equipmentId} onChange={e => setFormData({...formData, equipmentId: e.target.value})}>
                          <option value="">Seleccionar...</option>
                          {availableEquipment.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                  </div>
                   <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Estado Inicial</label>
                      <input type="text" required disabled={isSubmitting} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white disabled:opacity-50" value={formData.initialCondition} onChange={e => setFormData({...formData, initialCondition: e.target.value})}/>
                  </div>
                  <div className="md:col-span-3 flex justify-end gap-2 mt-2">
                      <button type="button" disabled={isSubmitting} onClick={() => setIsAdding(false)} className="px-4 py-2 text-slate-400 text-sm hover:text-white disabled:opacity-50">Cancelar</button>
                      <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-2">
                         {isSubmitting ? 'Guardando...' : 'Confirmar'}
                      </button>
                  </div>
              </form>
          </div>
      )}

      <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
         <table className="w-full text-left text-sm text-slate-300">
             <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                 <tr><th className="p-4 font-semibold">Equipo</th><th className="p-4 font-semibold">Asignado A</th><th className="p-4 font-semibold">Fecha Inicio</th><th className="p-4 font-semibold">Condición</th><th className="p-4 font-semibold text-right">Acciones</th></tr>
             </thead>
             <tbody className="divide-y divide-slate-800">
                 {activeAssignments.length === 0 ? <tr><td colSpan={5} className="p-6 text-center text-slate-600">No hay asignaciones internas activas.</td></tr> : (
                    activeAssignments.map(assignment => {
                        const equip = equipment.find(e => e.id === assignment.equipmentId);
                        const user = users.find(u => u.id === assignment.userId);
                        return (
                            <tr key={assignment.id} className="hover:bg-slate-800 transition-colors">
                                <td className="p-4 font-medium text-white">{equip?.name}</td>
                                <td className="p-4 text-slate-400">{user?.name}</td>
                                <td className="p-4 text-slate-500">{new Date(assignment.assignedDate).toLocaleDateString()}</td>
                                <td className="p-4 text-slate-500">{assignment.initialCondition}</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => handleReturn(assignment.id)} className="text-xs border border-slate-700 text-slate-400 px-3 py-1.5 rounded hover:bg-slate-700 hover:text-white transition-colors">Devolver</button>
                                </td>
                            </tr>
                        )
                    })
                 )}
             </tbody>
         </table>
      </div>
    </div>
  );
};
