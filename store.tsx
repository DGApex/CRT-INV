
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppState,
  Equipment,
  EquipmentStatus,
  Session,
  SessionStatus,
  InternalAssignment,
  AssignmentStatus,
  User,
  UserRole,
  SessionType
} from './types';

// --- CONFIGURACIÓN SEGURA ---
const HARDCODED_CONFIG = {
    scriptUrl: "https://script.google.com/macros/s/AKfycbzeXFd7PZpm8iXScC2iQ9n99zToVB3hE_pmvWWC6sc0WIqLuicZsGYtogcXChULoY39/exec", 
    apiKey: "CRTIC_SECRET_2025" 
};

// --- MOCK DATA ---
const MOCK_USERS: User[] = [
    { id: 'user-001', name: 'Admin Planta', role: UserRole.PLANTA_CRTIC, active: true, password: '123', area: 'Operaciones' },
];

const MOCK_EQUIPMENT: Equipment[] = [
    { id: 'eq-001', name: 'Cámara Demo', category: 'Video', typeIT: 'Mirrorless', status: EquipmentStatus.AVAILABLE, condition: 'Ok' }
];

const INITIAL_STATE: AppState = {
  currentUser: null,
  users: [],
  equipment: [],
  sessions: [],
  history: [], 
  assignments: [],
  googleSheetConfig: {
      sheetId: '', 
      inventoryGid: '',
      usersGid: '',
      ...HARDCODED_CONFIG 
  } as any
};

// --- HELPER: ROBUST DATE PARSER ---
const parseSheetDate = (dateStr: any): string => {
    if (!dateStr) return new Date().toISOString();
    
    let str = String(dateStr).trim();
    if (str.startsWith("'")) str = str.substring(1);

    if (str.includes('T') && str.includes('Z')) return str;

    if (str.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/)) {
        const parts = str.split(/[/-]/);
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            let year = parts[2];
            if (year.length === 2) year = `20${year}`; 
            return `${year}-${month}-${day}T12:00:00.000Z`; 
        }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString();
    }

    return new Date().toISOString(); 
};

// Helper for Duration Calculation
const calculateHoursFromDates = (startStr: string, endStr: string) => {
    const sPart = startStr.includes('T') ? startStr.split('T')[0] : startStr;
    const ePart = endStr.includes('T') ? endStr.split('T')[0] : endStr;
    
    const start = new Date(sPart);
    const end = new Date(ePart);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    if (end < start) return 0;

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return (diffDays + 1) * 24;
};


interface AppContextType extends AppState {
  login: (userId: string) => void;
  logout: () => void;
  addSession: (session: Omit<Session, 'id' | 'status' | 'items'> & { id?: string, items?: string[] }) => Promise<void>;
  addItemToSession: (sessionId: string, equipmentId: string) => Promise<void>;
  removeItemFromSession: (sessionId: string, equipmentId: string) => Promise<void>;
  closeSession: (sessionId: string, returnComment?: string) => Promise<void>;
  addAssignment: (assignment: Omit<InternalAssignment, 'id' | 'status'>) => Promise<void>;
  returnAssignment: (assignmentId: string, returnCondition: string) => Promise<void>;
  addEquipment: (item: Omit<Equipment, 'id'>) => void;
  syncFromSheets: () => Promise<string>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('crtic_app_state');
    return saved ? JSON.parse(saved) : INITIAL_STATE;
  });

  useEffect(() => {
    localStorage.setItem('crtic_app_state', JSON.stringify(state));
  }, [state]);

  // INITIAL LOAD & AUTO-POLLING
  useEffect(() => {
      const initSync = async () => {
          if (HARDCODED_CONFIG.scriptUrl.includes('PLACEHOLDER')) {
              if (state.users.length === 0) {
                  setState(prev => ({ ...prev, users: MOCK_USERS, equipment: MOCK_EQUIPMENT }));
              }
          } else {
             await syncFromSheets();
          }
      };
      initSync();

      const interval = setInterval(() => {
          console.log("Auto-Syncing...");
          syncFromSheets();
      }, 60000);

      return () => clearInterval(interval);
  }, []);

  const getCorrectUrl = () => {
      let { scriptUrl } = HARDCODED_CONFIG;
      if (!scriptUrl) return '';
      if (scriptUrl.includes('/a/macros/')) {
        scriptUrl = scriptUrl.replace(/\/a\/macros\/[^/]+\/s\//, '/macros/s/');
      }
      return scriptUrl;
  };

  const getVal = (row: any, candidates: string[]) => {
      for (const key of candidates) {
          if (row[key] !== undefined && row[key] !== null) return row[key];
      }
      const rowKeys = Object.keys(row);
      for (const candidate of candidates) {
          const cleanCandidate = candidate.toLowerCase().replace(/_/g, '').replace(/ /g, '');
          const match = rowKeys.find(k => k.toLowerCase().replace(/_/g, '').replace(/ /g, '') === cleanCandidate);
          if (match) return row[match];
      }
      return undefined;
  };

  // --- CRITICAL HELPER: ID SANITIZATION ---
  // Removes _DUPE_ suffixes and trims spaces to ensure matches in Google Sheets
  const getRawId = (id: string | undefined | null) => {
      if (!id) return '';
      return String(id).split('_DUPE_')[0].trim();
  };

  // --- ACTIONS ---

  const login = (userId: string) => {
    const user = state.users.find(u => String(u.id) === String(userId));
    if (user) {
        setState(prev => ({ ...prev, currentUser: user }));
    } else {
        console.error("User not found during login:", userId, state.users);
    }
  };

  const logout = () => {
      setState(prev => ({ ...prev, currentUser: null }));
  };

  // --- SYNC (READ) ---
  const syncFromSheets = async (): Promise<string> => {
    const scriptUrl = getCorrectUrl();
    const { apiKey } = HARDCODED_CONFIG;
    if (!scriptUrl) return "Error: URL del Script no configurada";

    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${scriptUrl}?key=${apiKey}&action=READ&_t=${timestamp}`, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      
      const text = await response.text();
      if (text.includes('<!DOCTYPE html')) throw new Error("ERROR HTML: Script no es público.");
      
      const data = JSON.parse(text);
      if (data.error) throw new Error(`API DENEGADA: ${data.error}`);

      const reconstructedSessions: Map<string, Session> = new Map();
      const equipmentMap: Map<string, Equipment> = new Map();
      
      // --- STRICT INVENTORY PARSING ---
      (data.inventory || []).forEach((row: any, index: number) => {
            const rawId = getVal(row, ['Equipo_ID', 'ID', 'Id', 'Codigo', 'Code', 'Inventario', 'Activo_Fijo']);
            if (!rawId || String(rawId).trim() === '') return;

            let eqId = String(rawId).trim();
            const name = String(getVal(row, ['Nombre_Equipo', 'Nombre', 'Modelo', 'Descripcion']) || 'Sin Nombre');
            const category = String(getVal(row, ['Categoría', 'Categoria', 'Tipo']) || 'Accesorios');
            const rawStatus = getVal(row, ['Estado', 'Status', 'Estado Actual']) || 'Disponible';
            const rawObs = String(getVal(row, ['Observaciones', 'Observacion', 'Notas', 'Condición']) || '');
            
            // DUPE HANDLING FOR FRONTEND UNIQUE KEYS
            if (equipmentMap.has(eqId)) {
                const existing = equipmentMap.get(eqId);
                if (existing?.name === name) return; 
                eqId = `${eqId}_DUPE_${index}`;
            }

            let internalStatus = EquipmentStatus.AVAILABLE;
            const normalizedStatus = String(rawStatus).toLowerCase().trim();

            if (['en uso', 'ocupado', 'prestado', 'vencido', 'no disponible'].some(k => normalizedStatus.includes(k))) {
                internalStatus = EquipmentStatus.IN_USE;
            } else if (normalizedStatus.includes('asignado')) {
                internalStatus = EquipmentStatus.ASSIGNED_INTERNAL;
            } else if (['mantenci', 'repara', 'dañado', 'malo'].some(k => normalizedStatus.includes(k))) {
                internalStatus = EquipmentStatus.MAINTENANCE;
            } else {
                internalStatus = EquipmentStatus.AVAILABLE;
            }

            if (internalStatus !== EquipmentStatus.AVAILABLE && rawObs.startsWith('SESION|')) {
                try {
                    const parts = rawObs.split('|');
                    const sessId = parts[1];
                    if (sessId) {
                        if (!reconstructedSessions.has(sessId)) {
                            reconstructedSessions.set(sessId, {
                                id: sessId,
                                projectName: parts[2] || 'Sin Nombre',
                                startDate: parseSheetDate(parts[3]), 
                                endDate: parts[4] ? parseSheetDate(parts[4]) : '',
                                userId: parts[5] || '',
                                type: (parts[6] as SessionType) || SessionType.RESIDENCY,
                                status: SessionStatus.ACTIVE,
                                items: []
                            });
                        }
                        const s = reconstructedSessions.get(sessId);
                        if (s && !s.items.includes(eqId)) {
                             s.items.push(eqId);
                        }
                    }
                } catch (err) { console.warn("Error parsing session metadata"); }
            }

            equipmentMap.set(eqId, {
              id: eqId,
              name: name,
              category: category,
              typeIT: String(getVal(row, ['Tipo_de_TI', 'Tipo']) || ''), 
              status: internalStatus,
              condition: rawObs 
            });
      });

      const newEquipment = Array.from(equipmentMap.values());

      const newUsers: User[] = (data.users || []).map((row: any) => {
        const roleStr = String(getVal(row, ['Tipo_Usuario', 'Rol']) || '').toLowerCase();
        let role = UserRole.EXTERNAL;
        if (roleStr.includes('planta') || roleStr.includes('admin')) role = UserRole.PLANTA_CRTIC;
        else if (roleStr.includes('residente')) role = UserRole.RESIDENT;
        else if (roleStr.includes('docente')) role = UserRole.DOCENTE;

        const activeVal = getVal(row, ['Activo', 'Active']);
        let isActive = true; 
        if (activeVal !== undefined && activeVal !== null && activeVal !== '') {
            const s = String(activeVal).trim().toLowerCase();
            if (s === 'no' || s === 'false' || s === '0') isActive = false;
        }

        return {
          id: String(getVal(row, ['Usuario_ID', 'ID']) || crypto.randomUUID()),
          name: String(getVal(row, ['Nombre_Completo', 'Nombre']) || 'Desconocido'),
          password: String(getVal(row, ['Password', 'Contraseña']) || ''), 
          role: role,
          area: String(getVal(row, ['Área_o_Proyecto', 'Area']) || ''),
          active: isActive
        };
      });

      const cloudHistory: Session[] = (data.logs || []).map((row: any) => {
          const rawItems = getVal(row, ['Equipos_IDs', 'Items', 'Lista_Equipos', 'Equipos']);
          let itemsList: string[] = [];
          if (rawItems) {
              itemsList = String(rawItems).split(/[,;]/).map(s => s.trim()).filter(x => x !== '');
          }

          const startVal = parseSheetDate(getVal(row, ['Fecha_Inicio', 'Inicio', 'Start']));
          const endVal = parseSheetDate(getVal(row, ['Fecha_Fin', 'Fin', 'End', 'Fecha_Termino']));

          const calculatedHours = calculateHoursFromDates(startVal, endVal);

          return {
              id: String(getVal(row, ['Sesion_ID', 'ID', 'SessionID', 'Log_ID']) || crypto.randomUUID()),
              projectName: String(getVal(row, ['Proyecto', 'Project', 'Nombre_Proyecto']) || 'Archivado'),
              userId: String(getVal(row, ['Usuario_ID', 'UsuarioID', 'UserID', 'Responsable']) || ''),
              type: String(getVal(row, ['Tipo_Sesion', 'Tipo', 'Type']) || SessionType.RESIDENCY) as SessionType,
              startDate: startVal,
              endDate: endVal,
              status: SessionStatus.CLOSED,
              items: itemsList,
              totalHours: calculatedHours, 
              observations: String(getVal(row, ['Observaciones', 'Observations', 'Notas']) || '')
          };
      });

      const cloudActiveSessions = Array.from(reconstructedSessions.values());

      setState(prev => {
        const cloudSessionIds = new Set(cloudActiveSessions.map(s => s.id));
        const pendingLocalSessions = prev.sessions.filter(localS => !cloudSessionIds.has(localS.id));
        const mergedSessions = [...cloudActiveSessions, ...pendingLocalSessions];

        const mergedEquipment = [...newEquipment];
        if (pendingLocalSessions.length > 0) {
            const pendingItemIds = new Set<string>();
            pendingLocalSessions.forEach(s => s.items.forEach(id => pendingItemIds.add(id)));
            
            mergedEquipment.forEach((e, idx) => {
                if (pendingItemIds.has(e.id)) {
                    const isInternal = pendingLocalSessions.some(s => s.items.includes(e.id) && prev.users.find(u => u.id === s.userId)?.role === UserRole.PLANTA_CRTIC);
                    mergedEquipment[idx] = {
                        ...e,
                        status: isInternal ? EquipmentStatus.ASSIGNED_INTERNAL : EquipmentStatus.IN_USE
                    };
                }
            });
        }

        let mergedHistory: Session[] = [];
        if (data.logs) {
            mergedHistory = cloudHistory;
        } else {
            mergedHistory = prev.history; 
        }
        
        mergedHistory.sort((a, b) => {
             const timeA = a.endDate ? new Date(a.endDate).getTime() : 0;
             const timeB = b.endDate ? new Date(b.endDate).getTime() : 0;
             return timeB - timeA;
        });

        return {
            ...prev,
            equipment: mergedEquipment.length > 0 ? mergedEquipment : prev.equipment,
            users: newUsers.length > 0 ? newUsers : prev.users,
            sessions: mergedSessions,
            history: mergedHistory
        };
      });

      return `Sync OK: ${newEquipment.length} items, ${cloudActiveSessions.length} active, ${cloudHistory.length} logs.`;

    } catch (e: any) {
      console.error(e);
      return `Error: ${e.message}`;
    }
  };

  // --- WRITE TO CLOUD ---
  const sendToCloud = async (action: string, payload: any) => {
      const scriptUrl = getCorrectUrl();
      const { apiKey } = HARDCODED_CONFIG;
      if (!scriptUrl) return;

      const bodyPayload = JSON.stringify({
          key: apiKey,
          action: action,
          ...payload
      });

      try {
          console.log(`Sending [${action}] to Sheets via no-cors...`);
          
          await fetch(scriptUrl, {
              method: 'POST',
              mode: 'no-cors', 
              cache: 'no-cache',
              credentials: 'omit', 
              redirect: 'follow', // Ensures we follow GAS redirects
              keepalive: true, 
              headers: { 
                  'Content-Type': 'text/plain;charset=utf-8' 
              },
              body: bodyPayload
          });
          
          // Increased timeout to 4000ms for GAS latency
          console.log("Waiting 4s for Sheets propagation...");
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          console.log("Re-syncing...");
          await syncFromSheets();

      } catch (e) {
          console.error(`Network Error sending [${action}]:`, e);
      }
  };

  const addEquipment = (item: Omit<Equipment, 'id'>) => {
    const id = item.name ? `GEN-${item.name.replace(/[^A-Z0-9]/gi, '')}` : crypto.randomUUID();
    const newItem: Equipment = { ...item, id };
    setState(prev => ({ ...prev, equipment: [...prev.equipment, newItem] }));
  };

  const addSession = async (sessionData: Omit<Session, 'id' | 'status' | 'items'> & { id?: string, items?: string[] }) => {
    const newSessionId = sessionData.id || crypto.randomUUID();
    
    // PREPARE CLOUD UPDATE FIRST (Synchronously)
    const isInternalUser = state.currentUser?.role === UserRole.PLANTA_CRTIC;
    // FIXED: Use Title Case to match typical Google Sheet Data Validation (Drop-downs are case-sensitive)
    const statusForSheet = isInternalUser ? 'Asignado Planta' : 'En Uso'; 
    const statusForApp = isInternalUser ? EquipmentStatus.ASSIGNED_INTERNAL : EquipmentStatus.IN_USE;

    const cleanProject = sessionData.projectName.replace(/\|/g, '-');
    const cleanStart = sessionData.startDate.includes('T') ? sessionData.startDate.split('T')[0] : sessionData.startDate;
    const cleanEnd = sessionData.endDate ? (sessionData.endDate.includes('T') ? sessionData.endDate.split('T')[0] : sessionData.endDate) : '';

    const metaTag = `SESION|${newSessionId}|${cleanProject}|${cleanStart}|${cleanEnd}|${sessionData.userId}|${sessionData.type}`;
    const uniqueItems = Array.from(new Set(sessionData.items || []));

    const cloudUpdates = uniqueItems.map(id => ({ 
        equipmentId: getRawId(id), 
        status: statusForSheet, 
        condition: metaTag 
    }));

    // OPTIMISTIC UPDATE
    setState(prev => {
        const newSession: Session = { ...sessionData, id: newSessionId, status: SessionStatus.ACTIVE, items: uniqueItems };
        const updatedEquipment = prev.equipment.map(e => uniqueItems.includes(e.id) ? { ...e, status: statusForApp, condition: metaTag } : e);
        return { ...prev, equipment: updatedEquipment, sessions: [newSession, ...prev.sessions] };
    });

    // SEND TO CLOUD
    if (cloudUpdates.length > 0) {
        await sendToCloud('UPDATE_STATUS', { updates: cloudUpdates });
    }
  };

  const addItemToSession = async (sessionId: string, equipmentId: string) => {
    const session = state.sessions.find(s => s.id === sessionId);
    const equipment = state.equipment.find(e => e.id === equipmentId);

    if (!session || !equipment || equipment.status !== EquipmentStatus.AVAILABLE || session.items.includes(equipmentId)) {
        alert("Equipo no disponible o ya agregado.");
        return;
    }

    // PREPARE CLOUD PAYLOAD
    const isInternalUser = state.currentUser?.role === UserRole.PLANTA_CRTIC;
    // FIXED: Title Case
    const statusForSheet = isInternalUser ? 'Asignado Planta' : 'En Uso';
    const statusForApp = isInternalUser ? EquipmentStatus.ASSIGNED_INTERNAL : EquipmentStatus.IN_USE;

    const cleanProject = session.projectName.replace(/\|/g, '-');
    const cleanStart = session.startDate.includes('T') ? session.startDate.split('T')[0] : session.startDate;
    const cleanEnd = session.endDate ? (session.endDate.includes('T') ? session.endDate.split('T')[0] : session.endDate) : '';

    const metaTag = `SESION|${session.id}|${cleanProject}|${cleanStart}|${cleanEnd}|${session.userId}|${session.type}`;
    
    const cloudUpdates = [{ 
        equipmentId: getRawId(equipmentId), 
        status: statusForSheet, 
        condition: metaTag 
    }];

    // OPTIMISTIC UI
    setState(prev => {
      const updatedEquipment = prev.equipment.map(e => e.id === equipmentId ? { ...e, status: statusForApp, condition: metaTag } : e);
      const updatedSessions = prev.sessions.map(s => s.id === sessionId ? { ...s, items: [...s.items, equipmentId] } : s);
      return { ...prev, equipment: updatedEquipment, sessions: updatedSessions };
    });

    await sendToCloud('UPDATE_STATUS', { updates: cloudUpdates });
  };

  const removeItemFromSession = async (sessionId: string, equipmentId: string) => {
      const cleanCondition = 'Devuelto';
      
      // PREPARE CLOUD PAYLOAD
      const cloudUpdates = [{ 
          equipmentId: getRawId(equipmentId), 
          status: 'Disponible', // "Disponible" is usually correct, but matching case
          condition: cleanCondition 
      }];

      setState(prev => {
        const updatedEquipment = prev.equipment.map(e => e.id === equipmentId ? { ...e, status: EquipmentStatus.AVAILABLE, condition: cleanCondition } : e);
        const updatedSessions = prev.sessions.map(s => s.id === sessionId ? { ...s, items: s.items.filter(id => id !== equipmentId)} : s);
        return { ...prev, equipment: updatedEquipment, sessions: updatedSessions };
      });
      
      await sendToCloud('UPDATE_STATUS', { updates: cloudUpdates });
  };

  const closeSession = async (sessionId: string, returnComment?: string) => {
    const session = state.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const finalComment = returnComment || 'Devuelto Ok';
    const now = new Date();
    const todayYMD = now.toLocaleDateString('en-CA'); 
    const closingDate = session.endDate || now.toISOString();

    // 1. PREPARE ITEM UPDATES FOR CLOUD
    const itemsToReturn = session.items;
    const cloudUpdates = itemsToReturn.map(id => ({ 
        equipmentId: getRawId(id), 
        status: 'Disponible', 
        condition: finalComment 
    }));

    // 2. PREPARE LOG PAYLOAD
    const responsibleUser = state.users.find(u => u.id === session.userId);
    const itemIdsStr = session.items.map(id => getRawId(id)).join(',');
    const itemNamesStr = session.items.map(id => {
        const eq = state.equipment.find(e => e.id === id);
        return eq ? eq.name : 'Desconocido';
    }).join(', ');

    const toLocalYMD = (dateStr: string) => {
        if (!dateStr) return todayYMD; 
        if (!dateStr.includes('T')) return dateStr;
        return dateStr.split('T')[0];
    };

    const logPayload = {
        SessionID: session.id,
        Project: session.projectName,
        UserID: session.userId,
        UserName: responsibleUser ? responsibleUser.name : session.userId,
        Start: toLocalYMD(session.startDate),
        End: toLocalYMD(closingDate), 
        Items: itemIdsStr,      
        ItemNames: itemNamesStr, 
        Type: session.type,
        Observations: finalComment
    };

    // 3. OPTIMISTIC UPDATE
    setState(prev => {
      const closedSessionData = { ...session, status: SessionStatus.CLOSED, endDate: closingDate, observations: finalComment };
      const updatedEquipment = prev.equipment.map(e => session.items.includes(e.id) ? { ...e, status: EquipmentStatus.AVAILABLE, condition: finalComment } : e);
      const updatedSessions = prev.sessions.filter(s => s.id !== sessionId); 
      return { ...prev, equipment: updatedEquipment, sessions: updatedSessions, history: [closedSessionData, ...prev.history] };
    });

    // 4. SEND TO CLOUD
    if (cloudUpdates.length > 0) {
        await sendToCloud('UPDATE_STATUS', { updates: cloudUpdates });
    }
    await sendToCloud('LOG_SESSION', { logData: logPayload });
  };

  const addAssignment = async (data: Omit<InternalAssignment, 'id' | 'status'>) => {
    const equipment = state.equipment.find(e => e.id === data.equipmentId);
    if(!equipment || equipment.status !== EquipmentStatus.AVAILABLE) { 
        alert("Equipo no disponible."); 
        return; 
    }

    // PREPARE CLOUD
    // FIXED: Title Case
    const cloudUpdates = [{ 
        equipmentId: getRawId(data.equipmentId), 
        status: 'Asignado Planta' 
    }];

    // OPTIMISTIC
    setState(prev => {
       const newAssignment: InternalAssignment = { ...data, id: crypto.randomUUID(), status: AssignmentStatus.ACTIVE };
       const updatedEquipment = prev.equipment.map(e => e.id === data.equipmentId ? { ...e, status: EquipmentStatus.ASSIGNED_INTERNAL } : e);
       return { ...prev, equipment: updatedEquipment, assignments: [newAssignment, ...prev.assignments] };
    });
    
    await sendToCloud('UPDATE_STATUS', { updates: cloudUpdates });
  };

  const returnAssignment = async (assignmentId: string, returnCondition: string) => {
      const assignment = state.assignments.find(a => a.id === assignmentId);
      if(!assignment) return;
      
      // PREPARE CLOUD
      const cloudUpdates = [{ 
          equipmentId: getRawId(assignment.equipmentId), 
          status: 'Disponible', 
          condition: returnCondition 
      }];

      setState(prev => {
          const updatedEquipment = prev.equipment.map(e => e.id === assignment.equipmentId ? { ...e, status: EquipmentStatus.AVAILABLE, condition: returnCondition } : e);
          const updatedAssignments = prev.assignments.map(a => a.id === assignmentId ? { ...a, status: AssignmentStatus.RETURNED, returnDate: new Date().toISOString(), returnCondition } : a);
          return { ...prev, equipment: updatedEquipment, assignments: updatedAssignments };
      });
      
      await sendToCloud('UPDATE_STATUS', { updates: cloudUpdates });
  };

  return (
    <AppContext.Provider value={{ ...state, login, logout, addSession, addItemToSession, removeItemFromSession, closeSession, addAssignment, returnAssignment, addEquipment, syncFromSheets }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppStore must be used within AppProvider');
  return context;
};
