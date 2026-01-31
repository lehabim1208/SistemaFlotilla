
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
}

export interface User {
  id: string;
  username: string;
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
  evidenceUrl?: string; // Base64 o URL
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
  baseSchedule: string;
  status: DriverStatus;
  curp?: string;
  rfc?: string;
  nss?: string;
  photoUrl?: string;
  isActive: boolean;
  qrCodeKey?: string;
  // Mapa de finanzas: storeId -> { wage, gas }
  storeFinances: Record<string, DriverStoreFinance>;
  // Fallbacks para compatibilidad
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

export interface RoleVersion {
  assignments: Assignment[];
  updatedAt: string;
  adminId: string;
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
  versions?: RoleVersion[];
}
