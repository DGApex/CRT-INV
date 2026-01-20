
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { EquipmentStatus, Equipment, Session } from '../types';
import { BarChartIcon, DatabaseIcon, SparklesIcon, CalendarIcon, AlertTriangleIcon, XIcon, SearchIcon, ClipboardIcon } from '../components/Icons'; 

export const AdminStatsView: React.FC = () => {
  const { equipment, sessions, history, users } = useAppStore();
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // ==========================================
  // 1. SIMPLE DATE HELPERS
  // ==========================================
  
  const simpleDate = (dateStr: string | undefined): Date | null => {
      if (!dateStr) return null;
      const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      const parts = clean.split(/[-/]/);
      if (parts.length < 3) return null;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; 
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
  };

  const displayDate = (dateStr: string | undefined) => {
      const d = simpleDate(dateStr);
      if (!d) return '-';
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const calculateHoursSimple = (startStr: string, endStr?: string) => {
      const start = simpleDate(startStr);
      // STRICT LOGIC: If endStr exists (Scheduled End), use it. Defaults to Today only if open.
      const end = endStr ? simpleDate(endStr) : new Date(); 

      if (!start || !end) return 0;
      
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);

      if (end < start) return 0; 

      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return (diffDays + 1) * 24; 
  };

  const isOverdue = (dateStr: string | undefined) => {
      const end = simpleDate(dateStr);
      if (!end) return false;
      const now = new Date();
      now.setHours(0,0,0,0);
      return now > end;
  };

  // ==========================================
  // 2. DATA FILTERING
  // ==========================================

  const filteredHistory = useMemo(() => {
      if (!dateFilter.start && !dateFilter.end) return history;

      const filterStart = simpleDate(dateFilter.start)?.getTime() || 0;
      const filterEnd = simpleDate(dateFilter.end)?.getTime() || Infinity;

      return history.filter(session => {
          const sDate = simpleDate(session.startDate)?.getTime() || 0;
          return sDate >= filterStart && sDate <= filterEnd;
      });
  }, [history, dateFilter]);

  // ==========================================
  // 3. MASTER DATASET GENERATION
  // ==========================================

  const masterEquipmentData = useMemo(() => {
      // Map structure: count, hours, lastUser, lastDateTimestamp, lastStartDateStr, lastEndDateStr
      const usageMap = new Map<string, { count: number, hours: number, lastUser: string, lastDate: number, lastStart: string, lastEnd: string }>();

      const processSession = (s: Session) => {
          const hrs = calculateHoursSimple(s.startDate, s.endDate);
          const sTime = simpleDate(s.startDate)?.getTime() || 0;
          const userName = users.find(u => u.id === s.userId)?.name || s.userId;

          s.items.forEach(itemId => {
              const current = usageMap.get(itemId) || { count: 0, hours: 0, lastUser: '', lastDate: 0, lastStart: '', lastEnd: '' };
              
              const isNewer = sTime > current.lastDate;

              usageMap.set(itemId, {
                  count: current.count + 1,
                  hours: current.hours + hrs,
                  lastDate: Math.max(current.lastDate, sTime),
                  // Update "Last" fields only if this session is newer than what we have stored
                  lastUser: isNewer ? userName : current.lastUser,
                  lastStart: isNewer ? s.startDate : current.lastStart,
                  lastEnd: isNewer ? (s.endDate || '') : current.lastEnd
              });
          });
      };

      // Process History
      filteredHistory.forEach(processSession);

      // Process Active Sessions (Usually newer, so they will overwrite 'last' fields naturally)
      sessions.filter(s => s.status === 'Activa').forEach(processSession);

      return equipment.map(eq => {
          const stats = usageMap.get(eq.id) || { count: 0, hours: 0, lastUser: '-', lastDate: 0, lastStart: '', lastEnd: '' };
          return { ...eq, stats };
      }).sort((a, b) => b.stats.hours - a.stats.hours);

  }, [equipment, filteredHistory, sessions, users]);

  const filteredMasterData = useMemo(() => {
      if(!searchTerm) return masterEquipmentData;
      const q = searchTerm.toLowerCase();
      return masterEquipmentData.filter(e => 
          e.name.toLowerCase().includes(q) || 
          e.category.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q)
      );
  }, [masterEquipmentData, searchTerm]);

  // ==========================================
  // 4. EXPORT FUNCTIONS
  // ==========================================

  const downloadCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csvContent = '\uFEFF' + [headers.join(','), ...data.map(row => headers.map(fieldName => {
        let val = row[fieldName];
        if (val === undefined || val === null) val = '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
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

  const handleExportMaster = () => {
      const cleanData = masterEquipmentData.map(e => ({
          ID_Equipo: e.id.split('_DUPE_')[0], 
          Nombre: e.name,
          Categoria: e.category,
          Estado_Actual: e.status,
          Veces_Prestado: e.stats.count,
          Horas_Totales_Uso: e.stats.hours,
          Ultimo_Usuario: e.stats.lastUser,
          Ref_Ultimo_Inicio: displayDate(e.stats.lastStart), // Added
          Ref_Ultimo_Fin: displayDate(e.stats.lastEnd), // Added
          Fecha_Reporte: new Date().toLocaleDateString('es-ES')
      }));
      downloadCSV(cleanData, `CRTIC_Dataset_Maestro_Equipos_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // ==========================================
  // 5. VIEW HELPERS
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
    return Object.entries(data).sort((a, b) => (b[1].inUse / b[1].total) - (a[1].inUse / a[1].total)); 
  }, [equipment]);

  const utilizationRate = useMemo(() => {
      const total = equipment.length;
      const inUse = equipment.filter(e => e.status !== EquipmentStatus.AVAILABLE && e.status !== EquipmentStatus.MAINTENANCE).length;
      return total > 0 ? Math.round((inUse / total) * 100) : 0;
  }, [equipment]);

  const activeLoans = useMemo(() => {
      const uniqueSessionIds = new Set(sessions.filter(s => s.status === 'Activa').map(s => s.id));
      return sessions
        .filter(s => uniqueSessionIds.has(s.id) && s.status === 'Activa')
        .map(s => {
            const user = users.find(u => u.id === s.userId);
            const uniqueItems = Array.from(new Set(s.items));
            return {
                ...s,
                items: uniqueItems,
                userName: user ? user.name : 'Usuario Desconocido',
                userRole: user ? user.role : 'Externo',
                itemsList: uniqueItems.map(id => equipment.find(e => e.id === id)).filter((e): e is Equipment => !!e)
            };
        })
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [sessions, users, equipment]);

  const overdueLoans = useMemo(() => activeLoans.filter(loan => isOverdue(loan.endDate)), [activeLoans]);
  const criticalCat = categoryUsage.length > 0 ? categoryUsage[0] : null;
  const criticalCatPercent = criticalCat && criticalCat[1].total > 0 ? Math.round((criticalCat[1].inUse / criticalCat[1].total) * 100) : 0;
  
  let criticalColor = 'bg-emerald-600';
  if (criticalCatPercent > 75) criticalColor = 'bg-red-600';
  else if (criticalCatPercent > 40) criticalColor = 'bg-yellow-500';

  const userStats = useMemo(() => {
      const stats = new Map<string, number>();
      filteredHistory.forEach(s => {
          const h = calculateHoursSimple(s.startDate, s.endDate);
          stats.set(s.userId, (stats.get(s.userId) || 0) + h);
      });
      return Array.from(stats.entries())
        .map(([id, hours]) => ({ id, user: users.find(u => u.id === id), hours }))
        .sort((a,b) => b.hours - a.hours)
        .slice(0, 50);
  }, [filteredHistory, users]);

  const monthlyStats = useMemo(() => {
      const stats = new Map<string, number>();
      const sorted = [...filteredHistory].sort((a, b) => {
          const da = simpleDate(a.startDate)?.getTime() || 0;
          const db = simpleDate(b.startDate)?.getTime() || 0;
          return da - db;
      });
      sorted.forEach(s => {
          const d = simpleDate(s.startDate);
          if (!d) return;
          const k = d.toLocaleDateString('es-ES', { month: 'short' });
          stats.set(k, (stats.get(k) || 0) + 1);
      });
      return Array.from(stats.entries()).map(([label, count]) => ({ label, count }));
  }, [filteredHistory]);

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 pb-20">
      
      {/* HEADER */}
      <div>
            <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                <BarChartIcon className="w-8 h-8 text-indigo-400" />
                Métricas y Reportes
            </h2>
            <p className="text-neutral-400 mt-2">Sistema integral de análisis de datos e inventario.</p>
      </div>
        
      {/* ======================= SECTION 1: LIVE MONITOR ======================= */}
      <section className="space-y-6">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
             <h3 className="text-xl font-bold text-sky-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-sky-500 rounded-full animate-pulse"></div>
                Monitor en Vivo
             </h3>
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
                            <tr><th>Usuario</th><th>Proyecto</th><th>Fecha Fin</th><th>Estado</th></tr>
                        </thead>
                        <tbody className="text-red-200">
                            {overdueLoans.map(loan => (
                                <tr key={loan.id} className="border-b border-red-900/30 last:border-0">
                                    <td className="py-2 font-bold">{loan.userName}</td>
                                    <td className="py-2">{loan.projectName}</td>
                                    <td className="py-2">{displayDate(loan.endDate)}</td>
                                    <td className="py-2 font-bold bg-red-900/40 px-2 rounded text-center inline-block mt-1">Vencido</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Reservas Activas</h3>
                <div className="flex items-end gap-2">
                     <p className="text-4xl font-bold text-white">{sessions.filter(s => s.status === 'Activa').length}</p>
                     <span className="text-xs text-neutral-500 mb-1">en curso</span>
                </div>
            </div>

            <div className={`md:col-span-2 rounded-xl border border-neutral-800 p-6 relative overflow-hidden flex flex-col justify-between ${criticalColor}`}>
                 <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none transform translate-x-10 -translate-y-10"></div>
                 {criticalCat && (
                     <>
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider mb-1 opacity-80 text-white">Categoría Más Solicitada</h3>
                                <p className="text-3xl font-bold text-white">{criticalCat[0]}</p>
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
                 )}
            </div>
        </div>

        {/* DETAILED ACTIVE LOANS TABLE */}
        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg">
            <h3 className="font-bold text-white mb-6">Detalle de Préstamos Activos</h3>
            {activeLoans.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 italic">No hay préstamos activos en este momento.</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-neutral-950 text-neutral-500 text-xs uppercase border-b border-neutral-800">
                            <tr>
                                <th className="p-4">Usuario</th>
                                <th className="p-4">Proyecto</th>
                                <th className="p-4">Inicio</th>
                                <th className="p-4 w-[40%]">Equipos</th>
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
                                        {displayDate(loan.startDate)}
                                    </td>
                                    <td className="p-4 align-top">
                                        <div className="flex flex-wrap gap-1">
                                            {loan.itemsList.map((item) => (
                                                <span key={item.id} className="inline-flex items-center px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs">
                                                    {item.name}
                                                </span>
                                            ))}
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

      {/* ======================= SECTION 2: NEW MASTER DASHBOARD ======================= */}
      <section className="space-y-6 pt-6 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                  <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                      <ClipboardIcon className="w-5 h-5" />
                      Dashboard Maestro de Equipos
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1">
                      Vista consolidada de todos los activos, independientemente de si han sido usados o no.
                      { (dateFilter.start || dateFilter.end) && <span className="text-emerald-500 ml-1 font-bold">(Filtrado por fecha)</span> }
                  </p>
              </div>
              
              <div className="flex gap-2 w-full md:w-auto">
                 <div className="relative flex-1 md:flex-initial">
                     <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                     <input 
                        type="text" 
                        placeholder="Filtrar tabla..." 
                        className="bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white w-full outline-none focus:border-emerald-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                     />
                 </div>
                 <button 
                    onClick={handleExportMaster}
                    className="flex items-center gap-2 bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/50 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap"
                 >
                    <DatabaseIcon className="w-4 h-4" />
                    Dataset Maestro (CSV)
                 </button>
              </div>
          </div>

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 shadow-lg overflow-hidden flex flex-col max-h-[500px]">
              <div className="overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-sm relative">
                      <thead className="bg-neutral-950 text-neutral-500 text-xs uppercase sticky top-0 z-10 shadow-sm">
                          <tr>
                              <th className="p-3 bg-neutral-950">ID Activo</th>
                              <th className="p-3 bg-neutral-950">Equipo</th>
                              <th className="p-3 bg-neutral-950">Categoría</th>
                              <th className="p-3 bg-neutral-950 text-center">Estado Actual</th>
                              <th className="p-3 bg-neutral-950 text-right">Cant. Préstamos</th>
                              <th className="p-3 bg-neutral-950 text-right">Horas Uso</th>
                              <th className="p-3 bg-neutral-950">Último Usuario</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
                          {filteredMasterData.map(eq => (
                              <tr key={eq.id} className="hover:bg-neutral-800/50 transition-colors group">
                                  <td className="p-3 font-mono text-xs text-neutral-500">{eq.id.split('_DUPE_')[0]}</td>
                                  <td className="p-3 font-medium text-white group-hover:text-emerald-300 transition-colors">{eq.name}</td>
                                  <td className="p-3 text-neutral-400">{eq.category}</td>
                                  <td className="p-3 text-center">
                                      <span className={`text-[10px] px-2 py-0.5 rounded border ${
                                          eq.status === EquipmentStatus.AVAILABLE ? 'bg-neutral-800 border-neutral-700 text-neutral-400' :
                                          eq.status === EquipmentStatus.IN_USE ? 'bg-yellow-900/20 border-yellow-700/50 text-yellow-500' :
                                          eq.status === EquipmentStatus.ASSIGNED_INTERNAL ? 'bg-cyan-900/20 border-cyan-700/50 text-cyan-400' :
                                          'bg-red-900/20 border-red-700/50 text-red-500'
                                      }`}>
                                          {eq.status}
                                      </span>
                                  </td>
                                  <td className="p-3 text-right font-mono text-neutral-300">{eq.stats.count}</td>
                                  <td className="p-3 text-right font-mono font-bold text-emerald-400">{eq.stats.hours}h</td>
                                  <td className="p-3 text-neutral-400 truncate max-w-[150px]" title={eq.stats.lastUser}>{eq.stats.lastUser}</td>
                              </tr>
                          ))}
                          {filteredMasterData.length === 0 && (
                              <tr><td colSpan={7} className="p-8 text-center text-neutral-500 italic">No se encontraron equipos</td></tr>
                          )}
                      </tbody>
                  </table>
              </div>
          </div>
      </section>

      {/* ======================= SECTION 3: ROBUST HISTORY ======================= */}
      <section className="space-y-6 pt-6 border-t border-neutral-800">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center pb-4 gap-4">
             <div className="flex flex-col">
                 <h3 className="text-xl font-bold text-indigo-400 flex items-center gap-2">
                    <DatabaseIcon className="w-5 h-5" />
                    Histórico Filtrable
                 </h3>
                 <p className="text-xs text-neutral-500 mt-1">Exploración de sesiones pasadas.</p>
             </div>

             {/* DATE FILTERS */}
             <div className="flex flex-wrap items-center gap-3 bg-neutral-900 p-2 rounded-xl border border-neutral-800">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500 px-1">Desde:</span>
                    <input 
                        type="date" 
                        className="bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                        value={dateFilter.start}
                        onChange={(e) => setDateFilter({...dateFilter, start: e.target.value})}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-500 px-1">Hasta:</span>
                    <input 
                        type="date" 
                        className="bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none"
                        value={dateFilter.end}
                        onChange={(e) => setDateFilter({...dateFilter, end: e.target.value})}
                    />
                </div>
                {(dateFilter.start || dateFilter.end) && (
                    <button 
                        onClick={() => setDateFilter({ start: '', end: '' })}
                        className="p-1.5 text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors"
                        title="Limpiar Filtros"
                    >
                        <XIcon className="w-4 h-4" />
                    </button>
                )}
             </div>
        </div>

        {filteredHistory.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900 rounded-xl border border-neutral-800">
                <DatabaseIcon className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white">Sin historial disponible</h3>
                <p className="text-neutral-500 mt-2">No se encontraron registros para el rango de fechas seleccionado.</p>
            </div>
        ) : (
             <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg h-80 overflow-auto">
                        <h4 className="font-bold text-white mb-4 sticky top-0 bg-neutral-900 pb-2">Top Usuarios</h4>
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase text-neutral-500 border-b border-neutral-800"><tr><th className="pb-2">Usuario</th><th className="pb-2 text-right">Horas</th></tr></thead>
                            <tbody className="text-neutral-300 divide-y divide-neutral-800">
                                {userStats.map(u => (
                                    <tr key={u.id}>
                                        <td className="py-2">{u.user?.name || u.id}</td>
                                        <td className="py-2 text-right font-mono text-indigo-400">{u.hours}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                     </div>
                     <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg h-80 overflow-auto">
                        <h4 className="font-bold text-white mb-4 sticky top-0 bg-neutral-900 pb-2">Uso Mensual</h4>
                        <div className="space-y-3">
                             {monthlyStats.map((m, i) => (
                                 <div key={i} className="flex items-center gap-3">
                                     <span className="text-xs font-bold text-neutral-500 w-16">{m.label}</span>
                                     <div className="flex-1 bg-neutral-800 rounded-full h-2 overflow-hidden">
                                         <div className="bg-indigo-500 h-full" style={{ width: `${Math.min((m.count/20)*100, 100)}%` }}></div>
                                     </div>
                                     <span className="text-xs text-white font-mono">{m.count}</span>
                                 </div>
                             ))}
                        </div>
                     </div>
                 </div>

                 {/* NEW DETAILED HISTORY TABLE */}
                 <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-lg max-h-96 overflow-auto">
                    <h4 className="font-bold text-white mb-4 sticky top-0 bg-neutral-900 pb-2">Registro Histórico Detallado</h4>
                    <table className="w-full text-sm text-left text-neutral-300">
                        <thead className="text-xs uppercase text-neutral-500 border-b border-neutral-800 bg-neutral-900">
                            <tr>
                                <th className="pb-3">Proyecto / Usuario</th>
                                <th className="pb-3">Fechas (Inicio - Fin Programado)</th>
                                <th className="pb-3 text-right">Horas Calc.</th>
                                <th className="pb-3 text-right">Cant. Equipos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800">
                            {filteredHistory.map((h, i) => {
                                const userName = users.find(u => u.id === h.userId)?.name || h.userId;
                                const calculatedHours = calculateHoursSimple(h.startDate, h.endDate);
                                return (
                                    <tr key={h.id + i} className="hover:bg-neutral-800/30">
                                        <td className="py-3">
                                            <div className="font-bold text-white">{h.projectName}</div>
                                            <div className="text-xs text-neutral-500">{userName}</div>
                                        </td>
                                        <td className="py-3 font-mono text-xs">
                                            <span className="text-emerald-400">{displayDate(h.startDate)}</span>
                                            <span className="mx-2 text-neutral-600">→</span>
                                            <span className="text-indigo-400">{displayDate(h.endDate)}</span>
                                        </td>
                                        <td className="py-3 text-right font-mono font-bold text-white">
                                            {calculatedHours}h
                                        </td>
                                        <td className="py-3 text-right text-xs text-neutral-500">
                                            {h.items.length} items
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                 </div>
             </div>
        )}
      </section>
    </div>
  );
};
