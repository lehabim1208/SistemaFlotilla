
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN'
}

export enum DriverStatus {
  AVAILABLE = 'Disponible',
  ABSENT = 'Ausente',
  RESTING = 'Descansando'
}

export enum AttendanceStatus {
  PRESENT = 'Asistió',
  DELAYED = 'Asistió con demora',
  ABSENT = 'No asistió'
}

export enum IncidenceLevel {
  LOW = 'Baja',
  MEDIUM = 'Media',
  HIGH = 'Alta/Crítica'
}

export interface Store {
  id: string;
  name: string;
  code: string;
}

export interface UserSettings {
  themeColor: 'indigo' | 'emerald' | 'rose' | 'amber' | 'violet';
  darkMode: boolean;
  timezone: 'auto' | 'manual';
  manualTimezone?: string;
  autoDateTime: boolean;
  manualDateTimeValue?: string;
  fontFamily: 'Inter' | 'Roboto' | 'Outfit' | 'Montserrat';
  biometricsEnabled?: boolean;
  pinCode?: string;
  notificationsEnabled?: boolean;
}

export interface User {
  id: string;
  username: string;
  name?: string;
  password?: string;
  role: UserRole;
  assignedStoreIds: string[];
  settings?: UserSettings;
  twoFactorSecret?: string;
  isTwoFactorEnabled: boolean;
  isDeleted?: boolean;
}

export interface AttendanceRecord {
  status: AttendanceStatus;
  reason?: string;
  evidenceUrl?: string; 
  evidenceType?: 'image' | 'pdf';
  updatedAt: string;
}

export interface DriverStoreFinance {
  dailyWage: number;
  dailyGas: number;
}

export interface Driver {
  id: string;
  fullName: string;
  assignedStoreIds: string[];
  teamCode: string;
  status: DriverStatus;
  curp?: string;
  rfc?: string;
  nss?: string;
  photoUrl?: string;
  isActive: boolean;
  qrCodeKey?: string;
  cofepris_expiration?: string;
  cofepris_status?: string;
  storeFinances: Record<string, DriverStoreFinance>;
  dailyWage: number;
  dailyGas: number;
}

export interface Assignment {
  driverId: string;
  driverName: string;
  schedule: string;
  teamCode?: string;
  attendance?: AttendanceRecord;
}

export interface DailyRole {
  id: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  date: string;
  assignments: Assignment[];
  adminId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Incident {
  id: string;
  type: string;
  level: IncidenceLevel;
  description: string;
  driverId?: string;
  storeId?: string;
  reporterId: string;
  date: string;
  location?: { lat: number; lng: number };
  address?: string;
  evidenceUrl?: string;
  resolved: boolean;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  description: string;
  color?: string;
  is_pinned?: boolean;
  created_at: string;
}
