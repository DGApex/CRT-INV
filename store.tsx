
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
    scriptUrl: "https://script.google.com/macros/s/AKfycbymzmDGh5ZBPUh7od_H3k26GakdFmC_36HzIk7dSOhi1T3pHPY5QIfsTUclkn1TGOQt7w/exec", 
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

  // INITIAL LOAD & AUTO-POLLING & OVERDUE CHECKER
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
      const response = await fetch(`${scriptUrl}?key=${apiKey}&_t=${timestamp}`, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      
      const text = await response.text();
      if (text.includes('<!DOCTYPE html')) throw new Error("ERROR HTML: Script no es público.");
      
      const data = JSON.parse(text);
      if (data.error) throw new Error(`API DENEGADA: ${data.error}`);

      const reconstructedSessions: Map<string, Session> = new Map();

      // STRICT FILTERING FOR GHOST ITEMS & CLONING FIX
      const newEquipment: Equipment[] = data.inventory
        .filter((row: any) => {
            const name = getVal(row, ['Nombre_Equipo', 'Nombre']);
            // Ignore items without names
            if (!name || String(name).trim() === '') return false;
            return true;
        })
        .map((row: any) => {
            const name = String(getVal(row, ['Nombre_Equipo', 'Nombre']) || 'Sin Nombre');
            const category = String(getVal(row, ['Categoría', 'Categoria']) || 'Accesorios');
            const rawStatus = getVal(row, ['Estado', 'Status', 'Estado Actual']) || 'Disponible';
            const rawObs = String(getVal(row, ['Observaciones', 'Observacion', 'Notas', 'Condición']) || ''); // CAST TO STRING
            
            // ANTI-CLONING ID GENERATOR
            // 1. Try to get ID from sheet
            let eqId = getVal(row, ['Equipo_ID', 'ID', 'Id', 'Codigo', 'Code']);
            // 2. If no ID in sheet, create a deterministic ID based on Name (so it doesn't change on refresh)
            if (!eqId) {
                // Remove spaces and special chars to make a "slug"
                const slug = `${name}-${category}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
                eqId = `GEN-${slug}`;
            }
            eqId = String(eqId);

            // --- DATABASE DRIVEN STATUS LOGIC ---
            // Priority 1: What does the 'Estado' column say?
            let internalStatus = EquipmentStatus.AVAILABLE;
            const normalizedStatus = String(rawStatus).toLowerCase().trim();

            if (normalizedStatus === 'en uso' || normalizedStatus.includes('vencido')) {
                internalStatus = EquipmentStatus.IN_USE;
            } else if (normalizedStatus.includes('asignado')) {
                internalStatus = EquipmentStatus.ASSIGNED_INTERNAL;
            } else if (normalizedStatus.includes('mantenci') || normalizedStatus.includes('repara') || normalizedStatus.includes('dañado')) {
                internalStatus = EquipmentStatus.MAINTENANCE;
            } else {
                // EXPLICIT: If the sheet says "Disponible" or anything else, we FORCE Available.
                internalStatus = EquipmentStatus.AVAILABLE;
            }

            // Only attempt to reconstruct a session if the item is ACTUALLY marked as IN_USE in the DB.
            if (internalStatus === EquipmentStatus.IN_USE && rawObs.startsWith('SESION|')) {
                try {
                    const parts = rawObs.split('|');
                    const sessId = parts[1];
                    if (sessId) {
                        if (!reconstructedSessions.has(sessId)) {
                            reconstructedSessions.set(sessId, {
                                id: sessId,
                                projectName: parts[2] || 'Sin Nombre',
                                startDate: parts[3] || new Date().toISOString(),
                                endDate: parts[4] || '',
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

            return {
              id: eqId,
              name: name,
              category: category,
              typeIT: String(getVal(row, ['Tipo_de_TI', 'Tipo']) || ''), 
              status: internalStatus,
              condition: rawObs 
            };
      });

      const newUsers: User[] = data.users.map((row: any) => {
        const roleStr = String(getVal(row, ['Tipo_Usuario', 'Rol']) || '').toLowerCase(); // CAST TO STRING
        let role = UserRole.EXTERNAL;
        if (roleStr.includes('planta') || roleStr.includes('admin')) role = UserRole.PLANTA_CRTIC;
        else if (roleStr.includes('residente')) role = UserRole.RESIDENT;
        else if (roleStr.includes('docente')) role = UserRole.DOCENTE;

        // STRICT ACTIVE PARSING
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

      const cloudHistory: Session[] = (data.logs || []).map((row: any) => ({
          id: String(getVal(row, ['ID', 'SessionID']) || crypto.randomUUID()),
          projectName: String(getVal(row, ['Proyecto', 'Project']) || 'Archivado'),
          userId: String(getVal(row, ['UsuarioID', 'UserID']) || ''),
          type: String(getVal(row, ['Tipo', 'Type']) || SessionType.RESIDENCY) as SessionType,
          startDate: String(getVal(row, ['Inicio', 'Start']) || ''),
          endDate: String(getVal(row, ['Fin', 'End']) || ''),
          status: SessionStatus.CLOSED,
          items: String(getVal(row, ['Equipos', 'Items']) || '').split(',').map((s:string) => s.trim()).filter((x:string) => x !== ''),
          observations: String(getVal(row, ['Observaciones', 'Observations']) || '')
      }));

      const activeSessionArray = Array.from(reconstructedSessions.values());

      setState(prev => {
        const mergedHistory = [...cloudHistory];
        if (prev.history.length > 0) {
            prev.history.forEach(localSession => {
                if (!mergedHistory.find(cloudSession => cloudSession.id === localSession.id)) {
                    if (localSession.endDate) mergedHistory.unshift(localSession);
                }
            });
        }
        mergedHistory.sort((a, b) => (b.endDate ? new Date(b.endDate).getTime() : 0) - (a.endDate ? new Date(a.endDate).getTime() : 0));

        return {
            ...prev,
            equipment: newEquipment.length > 0 ? newEquipment : prev.equipment,
            users: newUsers.length > 0 ? newUsers : prev.users,
            sessions: activeSessionArray,
            history: mergedHistory
        };
      });

      return `Sync OK: ${newEquipment.length} items, ${activeSessionArray.length} active sessions.`;

    } catch (e: any) {
      console.error(e);
      return `Error: ${e.message}`;
    }
  };

  const sendToCloud = async (action: string, payload: any) => {
      const scriptUrl = getCorrectUrl();
      const { apiKey } = HARDCODED_CONFIG;
      if (!scriptUrl) return;

      try {
          const bodyPayload = JSON.stringify({
              key: apiKey,
              action: action,
              ...payload
          });
          
          await fetch(scriptUrl, {
              method: 'POST',
              redirect: 'follow',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: bodyPayload
          });
          console.log(`Cloud Action [${action}] sent successfully.`);
      } catch (e) {
          console.error(`Error sending [${action}] to cloud:`, e);
          alert(`Error de conexión: No se pudo guardar en la nube.`);
      }
  };

  const addEquipment = (item: Omit<Equipment, 'id'>) => {
    // Generate deterministic ID if possible, else random
    const id = item.name ? `GEN-${item.name.replace(/[^A-Z0-9]/gi, '')}` : crypto.randomUUID();
    const newItem: Equipment = { ...item, id };
    setState(prev => ({ ...prev, equipment: [...prev.equipment, newItem] }));
  };

  const addSession = async (sessionData: Omit<Session, 'id' | 'status' | 'items'> & { id?: string, items?: string[] }) => {
    let updates: any[] = [];
    const newSessionId = sessionData.id || crypto.randomUUID();
    const metaTag = `SESION|${newSessionId}|${sessionData.projectName}|${sessionData.startDate}|${sessionData.endDate || ''}|${sessionData.userId}|${sessionData.type}`;

    setState(prev => {
        const uniqueItems = Array.from(new Set(sessionData.items || []));
        
        updates = uniqueItems.map(id => ({ equipmentId: id, status: 'En uso', condition: metaTag }));
        const newSession: Session = { ...sessionData, id: newSessionId, status: SessionStatus.ACTIVE, items: uniqueItems };
        const updatedEquipment = prev.equipment.map(e => uniqueItems.includes(e.id) ? { ...e, status: EquipmentStatus.IN_USE, condition: metaTag } : e);
        return { ...prev, equipment: updatedEquipment, sessions: [newSession, ...prev.sessions] };
    });

    if (updates.length > 0) await sendToCloud('UPDATE_STATUS', { updates });
  };

  const addItemToSession = async (sessionId: string, equipmentId: string) => {
    let success = false;
    let metaTag = '';
    
    setState(prev => {
      const session = prev.sessions.find(s => s.id === sessionId);
      if (!session) return prev;
      
      if (session.items.includes(equipmentId)) {
          return prev;
      }

      metaTag = `SESION|${session.id}|${session.projectName}|${session.startDate}|${session.endDate || ''}|${session.userId}|${session.type}`;
      const equipment = prev.equipment.find(e => e.id === equipmentId);
      if (!equipment || equipment.status !== EquipmentStatus.AVAILABLE) { alert("No disponible"); return prev; }
      success = true;
      const updatedEquipment = prev.equipment.map(e => e.id === equipmentId ? { ...e, status: EquipmentStatus.IN_USE, condition: metaTag } : e);
      const updatedSessions = prev.sessions.map(s => s.id === sessionId ? { ...s, items: [...s.items, equipmentId] } : s);
      return { ...prev, equipment: updatedEquipment, sessions: updatedSessions };
    });

    if (success) await sendToCloud('UPDATE_STATUS', { updates: [{ equipmentId, status: 'En uso', condition: metaTag }] });
  };

  const removeItemFromSession = async (sessionId: string, equipmentId: string) => {
      const cleanCondition = 'Devuelto';
      setState(prev => {
        const updatedEquipment = prev.equipment.map(e => e.id === equipmentId ? { ...e, status: EquipmentStatus.AVAILABLE, condition: cleanCondition } : e);
        const updatedSessions = prev.sessions.map(s => s.id === sessionId ? { ...s, items: s.items.filter(id => id !== equipmentId)} : s);
        return { ...prev, equipment: updatedEquipment, sessions: updatedSessions };
      });
      await sendToCloud('UPDATE_STATUS', { updates: [{ equipmentId, status: 'Disponible', condition: cleanCondition }] });
  };

  const closeSession = async (sessionId: string, returnComment?: string) => {
    let itemsToReturn: string[] = [];
    let closedSessionData: Session | undefined = undefined;
    const finalComment = returnComment || 'Devuelto Ok';
    const closeDate = new Date();

    setState(prev => {
      const session = prev.sessions.find(s => s.id === sessionId);
      if (!session) return prev;
      itemsToReturn = session.items;
      closedSessionData = { ...session, status: SessionStatus.CLOSED, endDate: closeDate.toISOString(), observations: finalComment };
      
      const updatedEquipment = prev.equipment.map(e => session.items.includes(e.id) ? { ...e, status: EquipmentStatus.AVAILABLE, condition: finalComment } : e);
      const updatedSessions = prev.sessions.filter(s => s.id !== sessionId); 
      return { ...prev, equipment: updatedEquipment, sessions: updatedSessions, history: [closedSessionData, ...prev.history] };
    });

    if (closedSessionData) {
        if (itemsToReturn.length > 0) {
            const updates = itemsToReturn.map(id => ({ equipmentId: id, status: 'Disponible', condition: finalComment }));
            await sendToCloud('UPDATE_STATUS', { updates });
        }

        const responsibleUser = state.users.find(u => u.id === (closedSessionData as Session).userId);
        const itemNames = (closedSessionData as Session).items.map(id => {
            const eq = state.equipment.find(e => e.id === id);
            return eq ? eq.name : id;
        }).join(', '); 

        const simpleDate = (iso: string) => {
            if (!iso) return "N/A";
            const d = new Date(iso);
            if (isNaN(d.getTime())) return "N/A";
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }

        const logPayload = {
            SessionID: (closedSessionData as Session).id,
            Project: (closedSessionData as Session).projectName,
            UserID: (closedSessionData as Session).userId,
            UserName: responsibleUser ? responsibleUser.name : (closedSessionData as Session).userId,
            Start: simpleDate((closedSessionData as Session).startDate),
            End: simpleDate((closedSessionData as Session).endDate || new Date().toISOString()),
            Items: itemNames,
            Type: (closedSessionData as Session).type,
            Observations: finalComment
        };

        try {
            await sendToCloud('LOG_SESSION', { logData: logPayload });
        } catch(e) {
            console.error("Critical: Failed to save log.", e);
        }
    }
  };

  const addAssignment = async (data: Omit<InternalAssignment, 'id' | 'status'>) => {
    let success = false;
    setState(prev => {
       const equipment = prev.equipment.find(e => e.id === data.equipmentId);
       if(!equipment || equipment.status !== EquipmentStatus.AVAILABLE) { alert("No disponible"); return prev; }
       success = true;
       const newAssignment: InternalAssignment = { ...data, id: crypto.randomUUID(), status: AssignmentStatus.ACTIVE };
       const updatedEquipment = prev.equipment.map(e => e.id === data.equipmentId ? { ...e, status: EquipmentStatus.ASSIGNED_INTERNAL } : e);
       return { ...prev, equipment: updatedEquipment, assignments: [newAssignment, ...prev.assignments] };
    });
    // WRITE EXACT STRING 'Asignado interno' TO DATABASE
    if (success) await sendToCloud('UPDATE_STATUS', { updates: [{ equipmentId: data.equipmentId, status: 'Asignado interno' }] });
  };

  const returnAssignment = async (assignmentId: string, returnCondition: string) => {
      let eqId = '';
      setState(prev => {
          const assignment = prev.assignments.find(a => a.id === assignmentId);
          if(!assignment) return prev;
          eqId = assignment.equipmentId;
          const updatedEquipment = prev.equipment.map(e => e.id === assignment.equipmentId ? { ...e, status: EquipmentStatus.AVAILABLE, condition: returnCondition } : e);
          const updatedAssignments = prev.assignments.map(a => a.id === assignmentId ? { ...a, status: AssignmentStatus.RETURNED, returnDate: new Date().toISOString(), returnCondition } : a);
          return { ...prev, equipment: updatedEquipment, assignments: updatedAssignments };
      });
      if (eqId) await sendToCloud('UPDATE_STATUS', { updates: [{ equipmentId: eqId, status: 'Disponible', condition: returnCondition }] });
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
