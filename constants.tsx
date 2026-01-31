
import { Store, User, UserRole, Driver, DriverStatus } from './types';

export const INITIAL_STORES: Store[] = [
  { id: '1', name: 'Walmart Cristal', code: 'W_CRISTAL' },
  { id: '2', name: 'Bodega Aurrerá Casa Blanca', code: 'BA_CBLANCA' },
  { id: '3', name: 'Walmart Express', code: 'W_EXPRESS' },
];

export const INITIAL_USERS: User[] = [
  { 
    id: 'u0', 
    username: 'superadmin', 
    role: UserRole.SUPERADMIN, 
    assignedStoreIds: [],
    isTwoFactorEnabled: false 
  },
  { 
    id: 'u1', 
    username: 'adminanwar', 
    role: UserRole.ADMIN, 
    assignedStoreIds: ['1', '2'],
    isTwoFactorEnabled: false 
  },
  { 
    id: 'u2', 
    username: 'admincristian', 
    role: UserRole.ADMIN, 
    assignedStoreIds: ['3'],
    isTwoFactorEnabled: false 
  }
];

export const INITIAL_DRIVERS: Driver[] = [
  { 
    id: 'd1', fullName: 'Juan Perez', assignedStoreIds: ['1'], teamCode: 'W_SMARTGO_1', 
    baseSchedule: '06:30 A 16:30', status: DriverStatus.AVAILABLE, isActive: true, 
    curp: 'PERJ800101HDFLRS01', rfc: 'PERJ800101XX1', nss: '12345678901', 
    qrCodeKey: 'SG-DRV-101', dailyWage: 350, dailyGas: 200,
    storeFinances: {
      '1': { dailyWage: 350, dailyGas: 200 }
    }
  },
  { 
    id: 'd2', fullName: 'Maria Garcia', assignedStoreIds: ['1'], teamCode: 'W_SMARTGO_2', 
    baseSchedule: '07:00 A 17:00', status: DriverStatus.AVAILABLE, isActive: true, 
    curp: 'GARM850505MDFXSS02', rfc: 'GARM850505YY2', nss: '98765432109', 
    qrCodeKey: 'SG-DRV-102', dailyWage: 350, dailyGas: 200,
    storeFinances: {
      '1': { dailyWage: 350, dailyGas: 200 }
    }
  },
  { 
    id: 'd3', fullName: 'Pedro Lopez', assignedStoreIds: ['1', '2'], teamCode: 'W_SMARTGO_3', 
    baseSchedule: '08:00 A 18:00', status: DriverStatus.AVAILABLE, isActive: true, 
    curp: 'LOPP901212HDFLRS03', rfc: 'LOPP901212ZZ3', nss: '11223344556', 
    qrCodeKey: 'SG-DRV-103', dailyWage: 400, dailyGas: 180,
    storeFinances: {
      '1': { dailyWage: 350, dailyGas: 200 },
      '2': { dailyWage: 400, dailyGas: 180 }
    }
  },
  { 
    id: 'd4', fullName: 'Ana Martinez', assignedStoreIds: ['2'], teamCode: 'W_SMARTGO_4', 
    baseSchedule: '06:30 A 16:30', status: DriverStatus.AVAILABLE, isActive: true, 
    curp: 'MARA950303MDFXSS04', rfc: 'MARA950303WW4', nss: '66554433221', 
    qrCodeKey: 'SG-DRV-104', dailyWage: 400, dailyGas: 180,
    storeFinances: {
      '2': { dailyWage: 400, dailyGas: 180 }
    }
  },
];
