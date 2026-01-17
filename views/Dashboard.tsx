
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { EquipmentStatus, SessionType, UserRole } from '../types';
import { BoxIcon, ClipboardIcon, XIcon, EyeIcon, SearchIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, TrashIcon, AlertTriangleIcon } from '../components/Icons';

// --- SUB-COMPONENT: RESERVATION MODAL ---
interface ReservationModalProps {
    isOpen: boolean;
    preSelectedDate?: Date;
    preSelectedItemId?: string;
    onClose: () => void;
}

const ReservationModal: React.FC<ReservationModalProps> = ({ isOpen, preSelectedDate, preSelectedItemId, onClose }) => {
    const { currentUser, users, equipment, addSession } = useAppStore();
    const isInternal = currentUser?.role === UserRole.PLANTA_CRTIC;

    // Determine fixed session type based on role
    const getFixedType = () => {
        if (!currentUser) return SessionType.EVENT;
        const role = String(currentUser.role).toLowerCase().trim();
        
        if (role.includes('residente')) return SessionType.RESIDENCY;
        if (role.includes('docente')) return SessionType.WORKSHOP;
        if (role.includes('planta') || role.includes('admin')) return SessionType.INTERNAL_PRODUCTION;
        
        return SessionType.EVENT; // Default for Externals
    };

    const fixedType = getFixedType();

    // LOCAL STATE
    const [form, setForm] = useState({
        userId: currentUser?.id || '',
        projectName: '',
        type: fixedType,
        startDate: preSelectedDate ? preSelectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        endDate: '',
    });
    
    // START WITH EMPTY OR PRE-SELECTED ITEM
    const [selectedItems, setSelectedItems] = useState<string[]>(preSelectedItemId ? [preSelectedItemId] : []);
    const [search, setSearch] = useState('');

    // FILTER LOGIC: EXCLUDE SELECTED ITEMS TO PREVENT DUPLICATES
    const availableEquipment = useMemo(() => {
        const q = search.toLowerCase();
        return equipment
            .filter(e => e.status === EquipmentStatus.AVAILABLE)
            .filter(e => !selectedItems.includes(e.id)) // Remove if already picked
            .filter(e => !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
            .slice(0, 500); 
    }, [equipment, search, selectedItems]);

    const toggleItem = (id: string) => {
        setSelectedItems(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            return [...prev, id];
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.userId || !form.projectName || !form.startDate || !form.endDate) {
            alert("Completa todos los campos obligatorios.");
            return;
        }
        addSession({ ...form, endDate: form.endDate || undefined, items: selectedItems });
        alert("Reserva creada exitosamente.");
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in">
            <div className="bg-neutral-900 rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg animate-in slide-in-from-bottom-4 md:zoom-in-95 border border-neutral-800 text-white flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-neutral-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold flex items-center gap-2">Crear Reserva</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-white"><XIcon className="w-6 h-6"/></button>
                </div>
                
                <div className="overflow-y-auto p-5 space-y-4">
                    <form id="resForm" onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-neutral-500 uppercase">Proyecto / Actividad</label>
                            <input type="text" required className="w-full mt-1 bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm focus:border-white outline-none text-white" 
                                placeholder="Nombre..." value={form.projectName} onChange={e => setForm({...form, projectName: e.target.value})} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-500 uppercase">Responsable</label>
                                {isInternal ? (
                                    <select required className="w-full mt-1 bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm text-white" value={form.userId} onChange={e => setForm({...form, userId: e.target.value})}>
                                        <option value="">Seleccionar...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                ) : (
                                    <div className="w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-sm text-neutral-300 truncate">{currentUser?.name}</div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-500 uppercase">Tipo Uso</label>
                                {/* Allow change if internal user, otherwise locked */}
                                {isInternal ? (
                                    <select className="w-full mt-1 bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm text-white" value={form.type} onChange={e => setForm({...form, type: e.target.value as SessionType})}>
                                        {Object.values(SessionType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                ) : (
                                    <div className="w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-sm text-neutral-300 truncate">
                                        {fixedType}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-neutral-500 uppercase">Desde</label>
                                <input type="date" required className="w-full mt-1 bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm text-white" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-neutral-500 uppercase">Hasta</label>
                                <input type="date" required className="w-full mt-1 bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-sm text-white" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
                            </div>
                        </div>
                    </form>

                    <div className="pt-4 border-t border-neutral-800">
                        <div className="flex justify-between items-center mb-2">
                             <label className="text-xs font-bold text-neutral-500 uppercase">Equipos Seleccionados ({selectedItems.length})</label>
                        </div>

                        {/* Selected Pills (Top List) */}
                        {selectedItems.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {selectedItems.map(id => {
                                    const item = equipment.find(e => e.id === id);
                                    return (
                                        <button key={id} onClick={() => toggleItem(id)} className="bg-sky-900/30 border border-sky-500/30 text-sky-200 text-xs pl-3 pr-2 py-1 rounded-full flex items-center gap-1 hover:bg-red-900/30 hover:border-red-500/30 hover:text-red-200 transition-all">
                                            {item?.name} <XIcon className="w-3 h-3" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Search */}
                        <div className="relative mb-2">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                            <input type="text" placeholder="Buscar equipo disponible..." className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-neutral-500"
                                value={search} onChange={e => setSearch(e.target.value)} />
                        </div>

                        {/* Available List (Bottom List) */}
                        <div className="max-h-40 overflow-y-auto border border-neutral-800 rounded-xl bg-neutral-950/50">
                            {availableEquipment.length === 0 ? (
                                <div className="p-4 text-center text-xs text-neutral-600">No se encontraron equipos disponibles con ese nombre.</div>
                            ) : (
                                availableEquipment.map(item => (
                                    <div key={item.id} onClick={() => toggleItem(item.id)} className="p-2 border-b border-neutral-800/50 flex justify-between items-center cursor-pointer hover:bg-neutral-800 transition-colors group">
                                        <div>
                                            <p className="text-sm text-neutral-300 font-medium group-hover:text-white">{item.name}</p>
                                            <p className="text-[10px] text-neutral-500">{item.id}</p>
                                        </div>
                                        <PlusIcon className="w-4 h-4 text-neutral-500 group-hover:text-sky-400" />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-neutral-800 bg-neutral-900 rounded-b-2xl mt-auto flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 bg-neutral-800 rounded-xl font-medium text-neutral-300 hover:bg-neutral-700">Cancelar</button>
                    <button type="submit" form="resForm" className="flex-1 py-3 bg-sky-600 text-white rounded-xl font-bold hover:bg-sky-500 shadow-lg shadow-sky-900/20">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---

type ModalConfig = {
    type: 'STATUS' | 'CATEGORY' | 'SEARCH';
    value: string; 
    title: string;
} | null;

export const Dashboard: React.FC = () => {
  const state = useAppStore();
  const { currentUser } = state;
  const isInternal = currentUser?.role === UserRole.PLANTA_CRTIC;

  const [modalConfig, setModalConfig] = useState<ModalConfig>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Overdue Alert
  const [overdueModalOpen, setOverdueModalOpen] = useState(false);

  // Reservation Modal State
  const [resModalOpen, setResModalOpen] = useState(false);
  const [resModalProps, setResModalProps] = useState<{date?: Date, itemId?: string}>({});

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // --- MONITORS DATA ---
  // Helper to check overdue
  const isOverdue = (dateStr: string | undefined) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      d.setHours(23, 59, 59, 999);
      return new Date() > d;
  };

  const externalSessions = useMemo(() => state.sessions.filter(s => s.status === 'Activa' && state.users.find(u => u.id === s.userId)?.role !== UserRole.PLANTA_CRTIC), [state.sessions, state.users]);
  const adminSessions = useMemo(() => state.sessions.filter(s => s.status === 'Activa' && state.users.find(u => u.id === s.userId)?.role === UserRole.PLANTA_CRTIC), [state.sessions, state.users]);
  const activeAssignments = useMemo(() => state.assignments.filter(a => a.status === 'Activa'), [state.assignments]);

  // --- OVERDUE CHECK ---
  useEffect(() => {
    if (currentUser) {
        const hasOverdue = state.sessions.some(s => s.userId === currentUser.id && s.status === 'Activa' && isOverdue(s.endDate));
        if (hasOverdue) setOverdueModalOpen(true);
    }
  }, [state.sessions, currentUser]);

  // --- STATS LOGIC ---
  const allStats = useMemo(() => {
    // Simply count by STATUS column from Store
    // Logic in Store already maps "Asignado planta" from sheets to EquipmentStatus.ASSIGNED_INTERNAL
    
    return [
        { 
            id: 'TOTAL', 
            label: 'Total Equipos', 
            value: state.equipment.length, 
            color: 'bg-emerald-600', 
            textColor: 'text-emerald-400', 
            borderColor: 'border-emerald-900', 
            hoverBorder: 'group-hover:border-emerald-500', 
            visible: true 
        },
        { 
            id: EquipmentStatus.AVAILABLE, 
            label: 'Disponibles', 
            value: state.equipment.filter(e => e.status === EquipmentStatus.AVAILABLE).length, 
            color: 'bg-orange-500', 
            textColor: 'text-orange-400', 
            borderColor: 'border-orange-900', 
            hoverBorder: 'group-hover:border-orange-500', 
            visible: true 
        },
        { 
            id: EquipmentStatus.IN_USE, 
            label: 'En Préstamo', 
            value: state.equipment.filter(e => e.status === EquipmentStatus.IN_USE).length, 
            color: 'bg-yellow-400', 
            textColor: 'text-yellow-400', 
            borderColor: 'border-yellow-900', 
            hoverBorder: 'group-hover:border-yellow-300', 
            visible: isInternal 
        },
        { 
            id: EquipmentStatus.ASSIGNED_INTERNAL, 
            label: 'Asignado Planta', 
            value: state.equipment.filter(e => e.status === EquipmentStatus.ASSIGNED_INTERNAL).length, 
            color: 'bg-cyan-400', 
            textColor: 'text-cyan-400', 
            borderColor: 'border-cyan-900', 
            hoverBorder: 'group-hover:border-cyan-400', 
            visible: isInternal 
        },
        { 
            id: EquipmentStatus.MAINTENANCE, 
            label: 'En Mantención', 
            value: state.equipment.filter(e => e.status === EquipmentStatus.MAINTENANCE).length, 
            color: 'bg-red-600', 
            textColor: 'text-red-400', 
            borderColor: 'border-red-900', 
            hoverBorder: 'group-hover:border-red-500', 
            visible: isInternal 
        },
    ];
  }, [state.equipment, isInternal]);

  const visibleStats = allStats.filter(s => s.visible);

  // --- SEARCH LOGIC ---
  const categoryCloud = useMemo(() => {
    const counts: Record<string, number> = {};
    state.equipment.forEach(e => { const cat = e.category || 'Otros'; counts[cat] = (counts[cat] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]); 
  }, [state.equipment]);

  const suggestions = useMemo(() => {
      if (!searchQuery.trim()) return { categories: [], items: [] };
      const q = searchQuery.toLowerCase();
      const matchedCategories = categoryCloud.filter(([cat]) => cat.toLowerCase().includes(q)).map(([cat]) => cat);
      const matchedItems = state.equipment.filter(e => e.name.toLowerCase().includes(q)).slice(0, 8);
      return { categories: matchedCategories, items: matchedItems };
  }, [searchQuery, categoryCloud, state.equipment]);

  const filteredEquipment = useMemo(() => {
    if (!modalConfig) return [];
    if (modalConfig.type === 'STATUS') return modalConfig.value === 'TOTAL' ? state.equipment : state.equipment.filter(e => e.status === modalConfig.value);
    if (modalConfig.type === 'CATEGORY') return state.equipment.filter(e => e.category === modalConfig.value);
    if (modalConfig.type === 'SEARCH') {
        const q = modalConfig.value.toLowerCase();
        return state.equipment.filter(e => e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
    }
    return [];
  }, [modalConfig, state.equipment]);

  // --- HANDLERS ---
  const openReservation = (date?: Date, itemId?: string) => {
      setResModalProps({ date, itemId });
      setResModalOpen(true);
  };
  
  const closeReservation = () => {
      setResModalOpen(false);
      setResModalProps({}); 
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setModalConfig({ type: 'SEARCH', value: searchQuery, title: `Resultados: "${searchQuery}"` });
      setShowSuggestions(false);
  };

  const handleForceCloseSession = (id: string, name: string) => { if (isInternal && confirm(`¿Eliminar reserva "${name}" y liberar equipos?`)) state.closeSession(id); };
  const handleForceReturnAssignment = (id: string) => { if (isInternal && confirm('¿Marcar como devuelto?')) state.returnAssignment(id, "Bueno"); };

  // --- CALENDAR HELPERS ---
  const calendarDays = useMemo(() => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); 
      const startSub = firstDay === 0 ? 6 : firstDay - 1;
      const startDate = new Date(year, month, 1 - startSub);
      
      let loopStart = startDate;
      if (viewMode === 'week') {
          const curDay = currentDate.getDay();
          const sub = curDay === 0 ? 6 : curDay - 1;
          const wStart = new Date(currentDate);
          wStart.setDate(currentDate.getDate() - sub);
          loopStart = wStart;
      }
      return Array.from({ length: viewMode === 'week' ? 7 : 42 }).map((_, i) => {
          const d = new Date(loopStart); d.setDate(loopStart.getDate() + i); return d;
      });
  }, [currentDate, viewMode]);

  const getDayEvents = (date: Date) => {
      const dateKey = date.toISOString().split('T')[0];
      const sEvents = state.sessions
        .filter(s => s.status === 'Activa' || (s.endDate && s.endDate >= dateKey))
        .filter(s => {
            const startKey = s.startDate.split('T')[0];
            const endKey = s.endDate ? s.endDate.split('T')[0] : '2099-12-31';
            return dateKey >= startKey && dateKey <= endKey;
        })
        .map(s => ({ 
            type: 'SESSION', 
            title: s.projectName,
            sessionType: s.type, 
            ...s, 
            userName: state.users.find(u => u.id === s.userId)?.name 
        }));
      
      const aEvents = isInternal ? state.assignments.filter(a => a.status === 'Activa' && a.assignedDate.split('T')[0] <= dateKey).map(a => ({ type: 'ASSIGNMENT', title: 'Asignación', ...a, userName: state.users.find(u => u.id === a.userId)?.name, equipName: state.equipment.find(e => e.id === a.equipmentId)?.name })) : [];
      return [...sEvents, ...aEvents];
  };

  const getEventColor = (type: string, sessionType?: SessionType) => {
      if (type === 'ASSIGNMENT') return 'bg-cyan-900/40 text-cyan-200 border-cyan-800 border-dashed';
      if (sessionType === SessionType.RESIDENCY) return 'bg-violet-900/50 text-violet-200 border-violet-700';
      if (sessionType === SessionType.EVENT) return 'bg-rose-900/50 text-rose-200 border-rose-700';
      if (sessionType === SessionType.WORKSHOP) return 'bg-amber-900/50 text-amber-200 border-amber-700';
      if (sessionType === SessionType.INTERNAL_PRODUCTION) return 'bg-emerald-900/50 text-emerald-200 border-emerald-700';
      return 'bg-neutral-800 text-neutral-300';
  }

  return (
    <div className="space-y-6 md:space-y-8 pb-20 md:pb-10">
      
      {resModalOpen && (
          <ReservationModal 
              isOpen={true} 
              onClose={closeReservation} 
              preSelectedDate={resModalProps.date} 
              preSelectedItemId={resModalProps.itemId} 
          />
      )}

      {/* OVERDUE ALERT */}
      {overdueModalOpen && (
          <div className="fixed inset-0 bg-red-950/90 z-[100] flex items-center justify-center p-4">
              <div className="bg-neutral-900 border-2 border-red-600 rounded-2xl p-8 max-w-md text-center">
                  <AlertTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">¡Préstamo Vencido!</h2>
                  <button onClick={() => setOverdueModalOpen(false)} className="mt-4 px-6 py-2 bg-red-600 text-white font-bold rounded-lg">Entendido</button>
              </div>
          </div>
      )}

      {/* HERO */}
      <div className="bg-neutral-900 rounded-3xl p-6 md:p-12 shadow-2xl border border-neutral-800 relative">
        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold text-white">Hola, {currentUser?.name.split(' ')[0]}</h2>
            <div ref={searchRef} className="relative max-w-2xl mx-auto z-50">
                <form onSubmit={handleSearchSubmit}>
                    <input type="text" placeholder="Buscar equipos..." className="w-full pl-6 pr-20 py-4 rounded-2xl bg-neutral-950 border-2 border-neutral-800 text-white focus:border-neutral-500 outline-none text-lg"
                        value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} />
                    <button type="submit" className="absolute right-2 top-2 bottom-2 bg-white text-black px-6 rounded-xl font-bold">Ir</button>
                </form>
                {showSuggestions && searchQuery.trim() && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 rounded-xl border border-neutral-700 shadow-2xl z-[100] text-left max-h-64 overflow-y-auto">
                         {suggestions.categories.map(cat => <button key={cat} onClick={() => { setModalConfig({ type: 'CATEGORY', value: cat, title: cat }); setShowSuggestions(false); }} className="w-full text-left px-4 py-3 border-b border-neutral-800 text-neutral-300 hover:bg-neutral-800">{cat}</button>)}
                         {suggestions.items.map(item => <button key={item.id} onClick={() => { setModalConfig({ type: 'SEARCH', value: item.name, title: item.name }); setShowSuggestions(false); }} className="w-full text-left px-4 py-3 border-b border-neutral-800 text-white hover:bg-neutral-800">{item.name}</button>)}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {visibleStats.map(stat => (
            <button key={stat.id} onClick={() => setModalConfig({ type: 'STATUS', value: stat.id, title: stat.label })} className={`bg-neutral-900 rounded-xl p-4 border ${stat.borderColor} text-left relative overflow-hidden group`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${stat.color}`}></div>
                <span className={`text-[10px] font-bold uppercase ${stat.textColor}`}>{stat.label}</span>
                <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
            </button>
        ))}
      </div>

      {/* CALENDAR */}
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center">
            <h3 className="font-bold text-white capitalize">{currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h3>
            <div className="flex gap-2">
                <button onClick={() => setViewMode('month')} className={`px-2 py-1 text-xs rounded ${viewMode==='month' ? 'bg-neutral-700 text-white':'text-neutral-500'}`}>Mes</button>
                <button onClick={() => setViewMode('week')} className={`px-2 py-1 text-xs rounded ${viewMode==='week' ? 'bg-neutral-700 text-white':'text-neutral-500'}`}>Sem</button>
                <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 text-xs border border-neutral-700 rounded text-neutral-300">Hoy</button>
            </div>
        </div>
        <div className="overflow-x-auto p-4 bg-neutral-950">
            <div className="grid grid-cols-7 gap-1 min-w-[600px]">
                {calendarDays.map((date, i) => {
                    const events = getDayEvents(date);
                    return (
                        <button key={i} onClick={() => openReservation(date)} className={`min-h-[80px] p-1 rounded border text-left flex flex-col gap-1 ${date.getMonth() === currentDate.getMonth() ? 'bg-neutral-900 border-neutral-800' : 'opacity-40 border-transparent'}`}>
                            <span className="text-xs text-neutral-500 font-bold">{date.getDate()}</span>
                            {events.slice(0, 2).map((ev: any, idx) => (
                                <div 
                                    key={idx} 
                                    className={`text-[8px] px-1 rounded truncate w-full border ${getEventColor(ev.type, ev.sessionType)}`}
                                    title={`Reservado por: ${ev.userName || 'Desconocido'}`}
                                >
                                    {ev.title || ev.equipName}
                                </div>
                            ))}
                            {events.length > 2 && <div className="text-[8px] text-neutral-600 pl-1">+{events.length - 2}</div>}
                        </button>
                    )
                })}
            </div>
        </div>
        
        <div className="p-4 bg-neutral-900 flex flex-wrap gap-4 justify-center border-t border-neutral-800">
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-violet-900/50 border border-violet-700"></div><span className="text-xs text-neutral-400">Residencia</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-rose-900/50 border border-rose-700"></div><span className="text-xs text-neutral-400">Evento</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-900/50 border border-amber-700"></div><span className="text-xs text-neutral-400">Taller</span></div>
             <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-900/50 border border-emerald-700"></div><span className="text-xs text-neutral-400">Prod. Interna</span></div>
        </div>
      </div>

      {/* MONITORS */}
      <div className={`grid grid-cols-1 ${isInternal ? 'lg:grid-cols-2' : ''} gap-6`}>
        {/* EXTERNAL SESSIONS */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 h-80 overflow-y-auto">
            <h3 className="font-bold text-white mb-4 sticky top-0 bg-neutral-900 pb-2 border-b border-neutral-800 flex items-center gap-2"><ClipboardIcon className="w-4 h-4"/> Reservas Externas</h3>
            {externalSessions.map(s => {
                const overdue = isOverdue(s.endDate);
                return (
                <div key={s.id} className="mb-2 p-3 bg-neutral-950 rounded border border-neutral-800 flex justify-between items-center group">
                    <div>
                        <p className="text-sm text-white font-bold">{s.projectName}</p>
                        <p className="text-xs text-neutral-500">
                            {new Date(s.startDate).toLocaleDateString()}
                            {overdue && <span className="ml-2 text-red-500 font-bold">VENCIDO</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs bg-neutral-900 px-2 py-1 rounded text-neutral-400">{s.items.length} items</span>
                        {isInternal && (
                             <button onClick={() => handleForceCloseSession(s.id, s.projectName)} className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all" title="Eliminar Reserva">
                                 <TrashIcon className="w-4 h-4" />
                             </button>
                        )}
                    </div>
                </div>
            )})}
            {externalSessions.length === 0 && <div className="text-xs text-neutral-500 text-center mt-10">Sin reservas externas.</div>}
        </div>
        
        {/* INTERNAL USE */}
        {isInternal && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-4 h-80 overflow-y-auto">
                <h3 className="font-bold text-white mb-4 sticky top-0 bg-neutral-900 pb-2 border-b border-neutral-800 flex items-center gap-2"><BoxIcon className="w-4 h-4"/> Uso Interno</h3>
                {adminSessions.map(s => {
                    const overdue = isOverdue(s.endDate);
                    return (
                    <div key={s.id} className="mb-2 p-3 bg-neutral-950 rounded border border-neutral-800 flex justify-between items-center group">
                        <div>
                             <p className="text-sm text-white font-bold">{s.projectName}</p>
                             <p className="text-xs text-neutral-500">
                                 Proyecto Interno • {s.items.length} items
                                 {overdue && <span className="ml-2 text-red-500 font-bold">VENCIDO</span>}
                             </p>
                        </div>
                        <button onClick={() => handleForceCloseSession(s.id, s.projectName)} className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all" title="Eliminar">
                             <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                )})}
                {activeAssignments.map(a => (
                    <div key={a.id} className="mb-2 p-3 bg-neutral-950 rounded border border-neutral-800 flex justify-between items-center group">
                        <div>
                            <p className="text-sm text-white font-bold">{state.equipment.find(e=>e.id===a.equipmentId)?.name}</p>
                            <p className="text-xs text-neutral-500">Asignado a: {state.users.find(u=>u.id===a.userId)?.name}</p>
                        </div>
                        <button onClick={() => handleForceReturnAssignment(a.id)} className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-all" title="Devolver">
                             <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* SEARCH RESULT MODAL */}
      {modalConfig && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
            <div className="bg-neutral-900 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-neutral-800">
                <div className="p-4 border-b border-neutral-800 flex justify-between"><h3 className="text-white font-bold">{modalConfig.title}</h3><button onClick={() => setModalConfig(null)}><XIcon className="w-6 h-6 text-neutral-500"/></button></div>
                <div className="overflow-y-auto p-4">
                    <table className="w-full text-left text-sm text-neutral-300">
                        <thead className="text-neutral-500 border-b border-neutral-800"><tr><th className="p-2">ID</th><th className="p-2">Nombre</th><th className="p-2">Estado</th><th className="p-2 text-right">Acción</th></tr></thead>
                        <tbody>
                            {filteredEquipment.map(item => (
                                <tr key={item.id} className="border-b border-neutral-800 last:border-0">
                                    <td className="p-3 font-mono text-xs text-neutral-500">{item.id}</td>
                                    <td className="p-3 font-bold text-white">{item.name} <span className="text-xs font-normal text-neutral-500 ml-2">{item.category}</span></td>
                                    <td className="p-3"><span className={`text-xs px-2 py-1 rounded ${item.status === EquipmentStatus.AVAILABLE ? 'bg-orange-900/30 text-orange-400' : 'bg-neutral-800 text-neutral-500'}`}>{item.status}</span></td>
                                    <td className="p-3 text-right">
                                        {/* Only show "Reservar" if Available */}
                                        {item.status === EquipmentStatus.AVAILABLE ? (
                                            <button onClick={() => openReservation(new Date(), item.id)} className="px-3 py-1 bg-white text-black text-xs font-bold rounded">Reservar</button>
                                        ) : (
                                            <span className="text-xs text-neutral-600 italic">No disponible</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
