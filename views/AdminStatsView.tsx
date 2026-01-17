import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { EquipmentStatus, UserRole } from '../types';
import { BarChartIcon, DatabaseIcon, SparklesIcon, CalendarIcon, XIcon, AlertTriangleIcon } from '../components/Icons'; 
import { generateUsageReport } from '../services/geminiService';

export const AdminStatsView: React.FC = () => {
  const { equipment, sessions, history, users } = useAppStore();
  
  // AI Report Modal State
  const [reportModal, setReportModal] = useState<{ isOpen: boolean, title: string, content: string, loading: boolean }>({
      isOpen: false, title: '', content: '', loading: false
  });

  // ==========================================
  // HELPERS
  // ==========================================
  
  const calculateTotalHours = (startStr: string, endStr?: string) => {
      if (!startStr) return 0;
      const start = new Date(startStr);
      const end = endStr ? new Date(endStr) : new Date();
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; 
      
      return diffDays * 24; // Simple calculation: Days * 24
  };

  const isOverdue = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      d.setHours(23, 59, 59, 999);
      return new Date() > d;
  };

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = '\uFEFF' + [headers.join(','), ...data.map(row => headers.map(fieldName => {
        let val = row[fieldName] || '';
        if (typeof val === 'string') {
            val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    }).join(','))].join('\n');

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

  const handleExportAndReport = async (type: 'CURRENT' | 'HISTORY') => {
      setReportModal({ isOpen: true, title: `Generando Reporte (${type === 'CURRENT' ? 'Actual' : 'Histórico'})...`, content: '', loading: true });
      
      const sourceData = type === 'CURRENT' ? sessions.filter(s => s.status === 'Activa') : history;

      const richData = sourceData.map(s => {
          const user = users.find(u => u.id === s.userId);
          const durationHours = calculateTotalHours(s.startDate, s.endDate);

          const itemNames = s.items.map(id => {
              const eq = equipment.find(e => e.id === id);
              return eq ? `${eq.name} (${eq.category})` : id;
          }).join('; ');

          return {
              ID_Sesion: s.id,
              Proyecto: s.projectName,
              Tipo_Sesion: s.type,
              Usuario_Nombre: user?.name || s.userId,
              Usuario_Rol: user?.role || 'Desconocido',
              Usuario_Area: user?.area || '-',
              Fecha_Inicio: s.startDate ? new Date(s.startDate).toLocaleDateString() : '',
              Fecha_Fin: s.endDate ? new Date(s.endDate).toLocaleDateString() : (type === 'CURRENT' ? 'En curso' : ''),
              Horas_Totales: durationHours,
              Cantidad_Items: s.items.length,
              Lista_Equipos: itemNames,
              Observaciones: s.observations || ''
          };
      });

      downloadCSV(richData, `crtic_reporte_${type.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);

      const aiPayload = richData.map(({ ID_Sesion, Lista_Equipos, ...rest }) => rest);

      const reportText = await generateUsageReport(aiPayload, type);
      setReportModal({ 
          isOpen: true, 
          title: `Reporte Inteligente: ${type === 'CURRENT' ? 'Estado Actual' : 'Análisis Histórico'}`, 
          content: reportText, 
          loading: false 
      });
  };

  // ==========================================
  // CURRENT METRICS (LIVE) CALCS
  // ==========================================
  
  const categoryUsage = useMemo(() => {
    const data: Record<string, { total: number, inUse: number }> = {};
    equipment.forEach(e => {
        const cat = e.category || 'Sin Categoría';
        if (!data[cat]) data[cat] = { total: 0, inUse: 0 };
        data[cat].total++;
        if (e.status === EquipmentStatus.IN_USE || e.status === EquipmentStatus.ASSIGNED_INTERNAL) {
            data[cat].inUse++;
        }
    });
    return Object.entries(data).sort((a, b) => (b[1].inUse / b[1].total) - (a[1].inUse / a[1].total)); // Sort by % used
  }, [equipment]);

  const utilizationRate = useMemo(() => {
      const total = equipment.length;
      const inUse = equipment.filter(e => e.status !== EquipmentStatus.AVAILABLE && e.status !== EquipmentStatus.MAINTENANCE).length;
      return total > 0 ? Math.round((inUse / total) * 100) : 0;
  }, [equipment]);

  // Active Loans List Data
  const activeLoans = useMemo(() => {
      // Use Set to prevent duplicates if data is dirty
      const uniqueSessionIds = new Set(sessions.filter(s => s.status === 'Activa').map(s => s.id));
      
      return sessions
        .filter(s => uniqueSessionIds.has(s.id) && s.status === 'Activa')
        .map(s => {
            const user = users.find(u => u.id === s.userId);
            // Deduplicate items just in case
            const uniqueItems = Array.from(new Set(s.items));
            return {
                ...s,
                items: uniqueItems,
                userName: user ? user.name : 'Usuario Desconocido',
                userRole: user ? user.role : 'Externo',
                itemsList: uniqueItems.map(id => equipment.find(e => e.id === id)).filter(e => !!e)
            };
        })
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [sessions, users, equipment]);

  // Overdue Loans
  const overdueLoans = useMemo(() => {
      return activeLoans.filter(loan => isOverdue(loan.endDate));
  }, [activeLoans]);

  // Critical Category Data
  const criticalCat = categoryUsage.length > 0 ? categoryUsage[0] : null;
  const criticalCatPercent = criticalCat ? Math.round((criticalCat[1].inUse / criticalCat[1].total) * 100) : 0;
  
  // Color Logic for Critical Category
  let criticalColor = 'bg-emerald-600';
  let criticalText = 'text-emerald-200';
  let statusText = 'Normal';
  
  if (criticalCatPercent > 75) {
      criticalColor = 'bg-red-600';
      criticalText = 'text-red-200';
      statusText = 'CRÍTICO';
  } else if (criticalCatPercent > 40) {
      criticalColor = 'bg-yellow-500';
      criticalText = 'text-yellow-900';
      statusText = 'ALERTA';
  }

  // ==========================================
  // HISTORICAL METRICS (ROBUST) CALCS
  // ==========================================

  const userStats = useMemo(() => {
      const stats: Record<string, { sessions: number, hours: number }> = {};
      
      history.forEach(s => {
          if (!s.userId) return;
          if (!stats[s.userId]) stats[s.userId] = { sessions: 0, hours: 0 };
          
          stats[s.userId].sessions++;
          const hrs = calculateTotalHours(s.startDate, s.endDate);
          if (hrs > 0) stats[s.userId].hours += hrs;
      });

      return Object.entries(stats)
          .map(([id, data]) => ({
              user: users.find(u => u.id === id),
              ...data
          }))
          .sort((a, b) => b.hours - a.hours) 
          .slice(0, 8);
  }, [history, users]);

  const equipmentStats = useMemo(() => {
      const eqStats: Record<string, number> = {};
      
      history.forEach(s => {
          const hrs = calculateTotalHours(s.startDate, s.endDate);
          if (hrs > 0) {
            // Dedupe items for stats too
            const uniqueItems = new Set(s.items);
            uniqueItems.forEach(itemId => {
                eqStats[itemId] = (eqStats[itemId] || 0) + hrs;
            });
          }
      });

      return Object.entries(eqStats)
          .map(([id, hours]) => ({
              item: equipment.find(e => e.id === id),
              hours: hours
          }))
          .filter(x => x.item)
          .sort((a, b) => b.hours - a.hours)
          .slice(0, 8);
  }, [history, equipment]);

  const monthlyStats = useMemo(() => {
      const months: Record<string, number> = {};
      history.forEach(s => {
          if(!s.startDate) return;
          const d = new Date(s.startDate);
          if (isNaN(d.getTime())) return;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          months[key] = (months[key] || 0) + 1;
      });

      return Object.entries(months)
          .sort((a, b) => a[0].localeCompare(b[0])) 
          .map(([key, count]) => {
              const [y, m] = key.split('-');
              const dateObj = new Date(parseInt(y), parseInt(m)-1);
              return {
                  label: dateObj.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
                  count
              };
          });
  }, [history]);

  const totalHistoryHours = useMemo(() => {
     return userStats.reduce((acc, curr) => acc + curr.hours, 0);
  }, [userStats]);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 pb-20">
      
      {/* HEADER */}
      <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <BarChartIcon className="w-8 h-8 text-indigo-400" />
                Métricas
            </h2>
            <p className="text-neutral-400 mt-2">Panel unificado de control actual e histórico (Horas Totales).</p>
      </div>
        
      {/* ======================= SECTION 1: LIVE MONITOR ======================= */}
      <section className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
             <h3 className="text-xl font-bold text-sky-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
                Monitor en Vivo
             </h3>
             <button 
                onClick={() => handleExportAndReport('CURRENT')}
                className="flex items-center gap-2 bg-sky-900/30 text-sky-400 border border-sky-500/30 hover:bg-sky-900/50 px-4 py-2 rounded-lg text-sm font-bold transition-all"
             >
                <SparklesIcon className="w-4 h-4" />
                Reporte IA + CSV
             </button>
        </div>

        {/* OVERDUE PANEL */}
        {overdueLoans.length > 0 && (
            <div className="bg-red-950/20 border-l-4 border-red-600 p-6 rounded-r-xl mb-6">
                <h3 className="text-red-400 font-bold flex items-center gap-2 mb-4">
                    <AlertTriangleIcon className="w-5 h-5" />
                    Devoluciones Pendientes / Vencidas
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-red-300/50 uppercase text-xs">
                            <tr><th>Usuario</th><th>Proyecto</th><th>Fecha Fin</th><th>Días de Retraso</th></tr>
                        </thead>
                        <tbody className="text-red-200">
                            {overdueLoans.map(loan => {
                                const daysOver = Math.ceil((new Date().getTime() - new Date(loan.endDate!).getTime()) / (1000 * 3600 * 24));
                                return (
                                <tr key={loan.id} className="border-b border-red-900/30 last:border-0">
                                    <td className="py-2 font-bold">{loan.userName}</td>
                                    <td className="py-2">{loan.projectName}</td>
                                    <td className="py-2">{new Date(loan.endDate!).toLocaleDateString()}</td>
                                    <td className="py-2 font-bold">+{daysOver} días</td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* KPI 1: Utilización */}
            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Utilización Total</h3>
                <div className="flex items-end gap-2">
                     <p className="text-4xl font-bold text-white">{utilizationRate}%</p>
                     <span className="text-xs text-neutral-500 mb-1">ocupación</span>
                </div>
                <div className="w-full bg-neutral-800 h-2 mt-4 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-1000" style={{ width: `${utilizationRate}%` }}></div>
                </div>
            </div>

            {/* KPI 2: Active */}
            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Reservas Activas</h3>
                <div className="flex items-end gap-2">
                     <p className="text-4xl font-bold text-white">{sessions.filter(s => s.status === 'Activa').length}</p>
                     <span className="text-xs text-neutral-500 mb-1">en curso</span>
                </div>
            </div>

            {/* KPI 3: CRITICAL CATEGORY (VISUAL) */}
            <div className={`md:col-span-2 rounded-xl border border-neutral-800 p-6 relative overflow-hidden flex flex-col justify-between ${criticalColor}`}>
                 <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none transform translate-x-10 -translate-y-10"></div>
                 
                 {criticalCat ? (
                     <>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <h3 className={`text-xs font-bold uppercase tracking-wider mb-1 opacity-80 ${criticalText}`}>Categoría Más Solicitada</h3>
                                <p className="text-3xl font-bold text-white">{criticalCat[0]}</p>
                            </div>
                            <div className="bg-white/20 px-3 py-1 rounded text-xs font-bold text-white backdrop-blur-sm">
                                {statusText}
                            </div>
                        </div>
                        
                        <div className="relative z-10 mt-4">
                            <div className="flex justify-between text-sm text-white/80 mb-1">
                                <span>{criticalCat[1].inUse} de {criticalCat[1].total} ocupados</span>
                                <span className="font-bold">{criticalCatPercent}%</span>
                            </div>
                            <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                                <div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: `${criticalCatPercent}%` }}></div>
                            </div>
                        </div>
                     </>
                 ) : (
                     <div className="flex items-center justify-center h-full text-white/50">Recopilando datos...</div>
                 )}
            </div>
        </div>

        {/* DETAILED ACTIVE LOANS TABLE */}
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
            <h3 className="font-bold text-white mb-6">Detalle de Préstamos Activos (Quién tiene Qué)</h3>
            {activeLoans.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 italic">No hay préstamos activos en este momento.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-950 text-neutral-500 text-xs uppercase border-b border-neutral-800">
                            <tr>
                                <th className="p-4">Usuario / Responsable</th>
                                <th className="p-4">Proyecto</th>
                                <th className="p-4">Inicio</th>
                                <th className="p-4 w-[40%]">Equipos en Poder</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {activeLoans.map(loan => (
                                <tr key={loan.id} className="hover:bg-neutral-800/30 transition-colors">
                                    <td className="p-4 align-top">
                                        <div className="font-bold text-white">{loan.userName}</div>
                                        <div className="text-[10px] text-neutral-500 uppercase tracking-wide">{loan.userRole}</div>
                                    </td>
                                    <td className="p-4 align-top text-neutral-300">
                                        {loan.projectName}
                                        <div className="text-xs text-neutral-500 mt-1">{loan.type}</div>
                                    </td>
                                    <td className="p-4 align-top text-neutral-400 font-mono text-xs">
                                        {new Date(loan.startDate).toLocaleDateString()}
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="flex flex-wrap gap-1">
                                            {loan.itemsList.map((item: any) => (
                                                <span key={item.id} className="inline-flex items-center px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs">
                                                    {item.name}
                                                </span>
                                            ))}
                                            {loan.items.length > loan.itemsList.length && (
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-500 text-xs">
                                                    + {loan.items.length - loan.itemsList.length} desconocidos
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </section>

      {/* ======================= SECTION 2: ROBUST HISTORY ======================= */}
      <section className="space-y-6 pt-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
             <h3 className="text-xl font-bold text-indigo-400 flex items-center gap-2">
                <DatabaseIcon className="w-5 h-5" />
                Histórico de Uso (Analítica)
             </h3>
             <button 
                onClick={() => handleExportAndReport('HISTORY')}
                className="flex items-center gap-2 bg-indigo-900/30 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-900/50 px-4 py-2 rounded-lg text-sm font-bold transition-all"
             >
                <SparklesIcon className="w-4 h-4" />
                Reporte IA + CSV
             </button>
        </div>

        {history.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900 rounded-xl border border-neutral-800">
                <DatabaseIcon className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">Sin historial disponible</h3>
                <p className="text-neutral-500 mt-2">Cierra reservas para generar datos o sincroniza con la nube.</p>
            </div>
        ) : (
            <>
                {/* 1. HISTORY KPIS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 flex flex-col justify-between">
                        <span className="text-xs font-bold text-neutral-500 uppercase">Reservas Totales</span>
                        <span className="text-2xl font-bold text-white">{history.length}</span>
                     </div>
                     <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 flex flex-col justify-between">
                        <span className="text-xs font-bold text-neutral-500 uppercase">Horas Totales</span>
                        <span className="text-2xl font-bold text-indigo-400">{totalHistoryHours}h</span>
                     </div>
                     <div className="bg-neutral-900 p-5 rounded-xl border border-neutral-800 flex flex-col justify-between">
                        <span className="text-xs font-bold text-neutral-500 uppercase">Promedio Duración</span>
                        <span className="text-2xl font-bold text-emerald-400">
                             {history.length > 0 ? Math.round((totalHistoryHours / history.length) * 10) / 10 : 0}h
                        </span>
                     </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* 2. TOP USERS TABLE */}
                    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg flex flex-col h-full">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                             <span className="bg-indigo-500 w-1 h-5 rounded-full"></span>
                             Usuarios Más Activos
                        </h3>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-950 text-neutral-500 text-xs uppercase">
                                    <tr>
                                        <th className="p-3 rounded-l-lg">Usuario</th>
                                        <th className="p-3 text-right">Reservas</th>
                                        <th className="p-3 text-right rounded-r-lg">Horas Uso</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {userStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-neutral-800/50 transition-colors">
                                            <td className="p-3 font-medium text-neutral-200">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-neutral-800 text-[10px] flex items-center justify-center text-neutral-500 border border-neutral-700">
                                                        {idx + 1}
                                                    </span>
                                                    {stat.user?.name || 'Desconocido'}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right text-neutral-400">{stat.sessions}</td>
                                            <td className="p-3 text-right font-bold text-indigo-400">{stat.hours}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3. TOP EQUIPMENT TABLE */}
                    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg flex flex-col h-full">
                         <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                             <span className="bg-emerald-500 w-1 h-5 rounded-full"></span>
                             Equipos Más Usados (Horas)
                        </h3>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-950 text-neutral-500 text-xs uppercase">
                                    <tr>
                                        <th className="p-3 rounded-l-lg">Equipo</th>
                                        <th className="p-3 rounded-r-lg text-right">Uso Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-800">
                                    {equipmentStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-neutral-800/50 transition-colors">
                                            <td className="p-3 font-medium text-neutral-200 truncate max-w-[200px]">
                                                 <div className="flex items-center gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-neutral-800 text-[10px] flex items-center justify-center text-neutral-500 border border-neutral-700">
                                                        {idx + 1}
                                                    </span>
                                                    {stat.item?.name}
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-bold text-emerald-400">{stat.hours}h</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 4. MONTHLY CHART */}
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
                    <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                        <CalendarIcon className="w-5 h-5 text-neutral-400" />
                        Tendencia Mensual de Reservas
                    </h3>
                    <div className="h-64 flex items-end gap-2 overflow-x-auto pb-4 px-2">
                        {monthlyStats.length === 0 ? (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600 italic">Datos insuficientes para gráfica</div>
                        ) : (
                            monthlyStats.map((month, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-2 group flex-1 min-w-[60px]">
                                    <div className="w-full relative bg-neutral-800 rounded-t-lg overflow-hidden h-48 flex items-end hover:bg-neutral-700 transition-colors">
                                         {/* Assuming max monthly sessions is around 50 for scaling visually, clamped at 100% */}
                                         <div 
                                            className="w-full bg-indigo-500/80 hover:bg-indigo-400 transition-all border-t border-indigo-300/30"
                                            style={{ height: `${Math.min((month.count / 20) * 100, 100)}%`, minHeight: '4px' }}
                                         ></div>
                                    </div>
                                    <span className="text-xs font-bold text-white bg-neutral-800 px-2 py-1 rounded border border-neutral-700">{month.count}</span>
                                    <span className="text-[10px] uppercase font-bold text-neutral-500">{month.label}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>
        )}
      </section>

      {/* AI REPORT MODAL */}
      {reportModal.isOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                  <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <SparklesIcon className="w-5 h-5 text-indigo-400" />
                          {reportModal.title}
                      </h3>
                      {!reportModal.loading && (
                        <button onClick={() => setReportModal({ ...reportModal, isOpen: false })} className="text-neutral-500 hover:text-white">
                            <XIcon className="w-6 h-6" />
                        </button>
                      )}
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                      {reportModal.loading ? (
                          <div className="flex flex-col items-center justify-center py-12 space-y-4">
                              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                              <p className="text-neutral-400 animate-pulse">Analizando datos con Gemini AI...</p>
                          </div>
                      ) : (
                          <div className="prose prose-invert max-w-none">
                              <div className="bg-neutral-950 p-6 rounded-xl border border-neutral-800 text-neutral-300 font-sans leading-relaxed whitespace-pre-line">
                                  {reportModal.content}
                              </div>
                              <div className="mt-6 p-4 bg-green-900/20 border border-green-900/30 rounded-lg text-sm text-green-300 flex items-center gap-2">
                                  <span className="font-bold text-lg">↓</span>
                                  El archivo CSV detallado (con datos de personas y horas) se ha descargado automáticamente.
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};