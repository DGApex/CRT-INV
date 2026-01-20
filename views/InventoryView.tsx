
import React from 'react';
import { useAppStore } from '../store';
import { EquipmentStatus } from '../types';

const StatusBadge: React.FC<{ status: EquipmentStatus }> = ({ status }) => {
    const colors = {
        [EquipmentStatus.AVAILABLE]: 'bg-orange-900/30 text-orange-400 ring-orange-500/20', 
        [EquipmentStatus.IN_USE]: 'bg-yellow-900/30 text-yellow-400 ring-yellow-500/20', 
        [EquipmentStatus.ASSIGNED_INTERNAL]: 'bg-cyan-900/30 text-cyan-400 ring-cyan-500/20',
        [EquipmentStatus.MAINTENANCE]: 'bg-red-900/30 text-red-400 ring-red-500/20',
    };
    return (
        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${colors[status]}`}>
            {status}
        </span>
    );
};

export const InventoryView: React.FC = () => {
  const { equipment } = useAppStore();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-white">Inventario Maestro</h2>
          <p className="text-neutral-400">Vista completa de todos los activos y su estado actual.</p>
        </div>
        <div className="text-sm text-neutral-400 bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-lg">
           Total Activos: <span className="font-bold text-white">{equipment.length}</span>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-xl shadow-lg border border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="bg-neutral-950 text-neutral-400 border-b border-neutral-800">
              <tr>
                <th className="p-4 font-semibold w-24">ID</th>
                <th className="p-4 font-semibold">Nombre</th>
                <th className="p-4 font-semibold">Categoría</th>
                <th className="p-4 font-semibold">Tipo de TI</th>
                <th className="p-4 font-semibold">Estado Actual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {equipment.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-800 transition-colors">
                  {/* HIDE SUFFIX VISUALLY */}
                  <td className="p-4 font-mono text-xs text-neutral-500">{item.id.split('_DUPE_')[0]}</td>
                  <td className="p-4 font-medium text-white">{item.name}</td>
                  <td className="p-4 text-neutral-400">{item.category}</td>
                  <td className="p-4 text-neutral-500">{item.typeIT || '-'}</td>
                  <td className="p-4"><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
