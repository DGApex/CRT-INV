
export enum EquipmentStatus {
  AVAILABLE = 'Disponible', // Maps to "Operativo" internally when not in a session
  IN_USE = 'En uso',
  ASSIGNED_INTERNAL = 'Asignado interno',
  MAINTENANCE = 'Mantención', // Maps to "En reparación" / "Dañado"
  UNAVAILABLE = 'No Disponible' // Fallback for generic occupied status
}

// Categorías oficiales
export const EQUIPMENT_CATEGORIES = [
  'Audio profesional',
  'Video',
  'Iluminación',
  'TI',
  'TA',
  'Accesorios'
] as const;

export type EquipmentCategory = typeof EQUIPMENT_CATEGORIES[number] | string;

export enum UserRole {
  PLANTA_CRTIC = 'Planta CRTIC',
  RESIDENT = 'Residente',
  DOCENTE = 'Docente',
  EXTERNAL = 'Externo',
}

export enum SessionType {
  EVENT = 'Evento',
  INTERNAL_PRODUCTION = 'Producción interna',
  WORKSHOP = 'Workshops/Clases',
  RESIDENCY = 'Residencia'
}

export enum SessionStatus {
  ACTIVE = 'Activa',
  CLOSED = 'Cerrada',
}

export enum AssignmentStatus {
  ACTIVE = 'Activa',
  RETURNED = 'Devuelto',
}

export interface User {
  id: string; // Maps to Usuario_ID
  name: string; // Maps to Nombre_Completo
  password?: string; // Maps to Password (New)
  role: UserRole; // Maps to Tipo_Usuario
  area?: string; // Maps to Área_o_Proyecto
  email?: string;
  active: boolean; // Maps to Activo
}

export interface Equipment {
  id: string; // Maps to Equipo_ID
  name: string; // Maps to Nombre_Equipo
  category: EquipmentCategory; // Maps to Categoría
  // Brand removed
  typeIT?: string; // Maps to Tipo_de_TI (Formerly Model)
  status: EquipmentStatus;
  condition: string; // Maps to Estado (Operativo, En reparación, Dañado) + Observaciones
}

export interface Session {
  id: string; // Maps to Sesion_ID
  userId: string; // Maps to Usuario_Responsable (ID)
  projectName: string; // Part of Observaciones or derived
  type: SessionType; // Maps to Tipo_Sesion
  startDate: string; // Maps to Fecha_Hora_Inicio
  endDate?: string; // Maps to Fecha_Hora_Termino
  status: SessionStatus;
  items: string[]; // Linked via Detalle_Sesion_Equipos
  totalHours?: number; // Maps to Horas_Totales
  observations?: string; // Maps to Observaciones
}

export interface InternalAssignment {
  id: string; // Maps to Asignacion_ID
  userId: string; // Maps to Usuario_Responsable
  equipmentId: string; // Maps to Equipo_ID
  assignedDate: string; // Maps to Fecha_Asignacion
  returnDate?: string;
  status: AssignmentStatus; // Derived from Asignacion_Activa
  initialCondition: string; // Maps to Estado_Entrega
  returnCondition?: string;
  observations?: string; // Maps to Observaciones
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  equipment: Equipment[];
  sessions: Session[]; // Active sessions
  history: Session[]; // Closed sessions (Historical)
  assignments: InternalAssignment[];
  googleSheetConfig: {
    sheetId: string;
    inventoryGid: string;
    usersGid: string;
  };
}
