
import { Store, User, UserRole, Driver, DriverStatus } from './types';

export const INITIAL_STORES: Store[] = [
  { id: 's1', name: 'Bodega Aurrera Altotonga', code: 'BA_ALTO' },
  { id: 's2', name: 'Bodega Aurrera Naranjos', code: 'BA_NARANJOS' },
  { id: 's3', name: 'Walmart Cristal', code: 'W_CRISTAL' },
  { id: 's4', name: 'Bodega Aurrerá Casa Blanca', code: 'BA_CBLANCA' },
  { id: 's5', name: 'Walmart Express', code: 'W_EXPRESS' },
];

export const INITIAL_USERS: User[] = [
  { 
    id: 'u0', 
    username: 'superadmin', 
    password: 'lehabim12',
    role: UserRole.SUPERADMIN, 
    assignedStoreIds: [],
    isTwoFactorEnabled: false 
  },
  { 
    id: 'u1', 
    username: 'adminanwar', 
    password: 'adminanwar',
    role: UserRole.ADMIN, 
    assignedStoreIds: ['s1', 's2', 's3', 's4'],
    isTwoFactorEnabled: false 
  },
  { 
    id: 'u2', 
    username: 'admincristian', 
    password: 'admincristian',
    role: UserRole.ADMIN, 
    assignedStoreIds: ['s5'],
    isTwoFactorEnabled: false 
  }
];

export const STORE_SCHEDULES: Record<string, string[]> = {
  's1': ['09:00 a 19:00'],
  's2': ['09:00 a 19:00'],
  's3': [
    '06:30 a 16:30', 
    '07:00 a 17:00', 
    '08:00 a 18:00', 
    '09:00 a 19:00', 
    '10:00 a 20:00', 
    '11:00 a 21:00', 
    '12:00 a 22:00'
  ],
  's4': [
    '07:30 a 17:30', 
    '08:00 a 16:00', 
    '10:00 a 20:00', 
    '10:30 a 20:30'
  ],
  's5': ['07:30 a 17:30', '10:00 a 20:00', '12:00 a 22:00'],
};

export const INITIAL_DRIVERS: Driver[] = [
  { id: 'd1', fullName: 'YUNNIOR DANNY COLORADO BRUNO', assignedStoreIds: ['s5', 's3'], teamCode: 'W_SMARTGO_1', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 200, storeFinances: {} },
  { id: 'd2', fullName: 'ALEXANDRO BARON PEREZ', assignedStoreIds: ['s5', 's3'], teamCode: 'W_SMARTGO_2', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 200, storeFinances: {} },
  { id: 'd3', fullName: 'RAFAEL HERNANDEZ HERNZNDEZ', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_3', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd4', fullName: 'RENE MARTIN MORA MARTINEZ', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_4', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd5', fullName: 'JORGE SANCHEZ BUSTAMANTE', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_5', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd6', fullName: 'JOSE ANTONIO BARRADAS RODRIGUEZ', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_6', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd7', fullName: 'RICARDO ANTONIO DIAZ GARCIA', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_7', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd8', fullName: 'LEHABIM ALEXIS CRUZ CAMARENA', assignedStoreIds: ['s3', 's4'], teamCode: 'W_SMARTGO_8', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd9', fullName: 'GEOVANNI FIDEL AGUILAR OREA', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_9', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd10', fullName: 'MIGUEL ANGEL HUERTA LOPEZ', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_10', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd11', fullName: 'PEDRO GERARDO CASTRO RONZO', assignedStoreIds: ['s3'], teamCode: 'W_SMARTGO_11', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 350, dailyGas: 200, storeFinances: {} },
  { id: 'd12', fullName: 'JOSE RAMON PEREZ GALLEGOS', assignedStoreIds: ['s4'], teamCode: 'W_SMARTGO_12', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd13', fullName: 'GUSTAVO ALFREDO MENDOZA AQUINO', assignedStoreIds: ['s4'], teamCode: 'W_SMARTGO_13', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd14', fullName: 'OLGA ISABEL PARRA GONZALEZ', assignedStoreIds: ['s4'], teamCode: 'W_SMARTGO_14', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd15', fullName: 'EDGAR RODRIGO VALENCIA LIMON', assignedStoreIds: ['s4'], teamCode: 'W_SMARTGO_15', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd16', fullName: 'YESENIA ASCANIO REYES', assignedStoreIds: ['s4'], teamCode: 'W_SMARTGO_16', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd17', fullName: 'ALEJANDRO FLORES GUTIERREZ', assignedStoreIds: ['s2'], teamCode: 'W_SMARTGO_17', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd18', fullName: 'EVA CECILIA MEDINA AMARO', assignedStoreIds: ['s2'], teamCode: 'W_SMARTGO_18', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd19', fullName: 'ALAN OMAR MARIN HERNANDEZ', assignedStoreIds: ['s1'], teamCode: 'W_SMARTGO_19', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
  { id: 'd20', fullName: 'OSCAR VEGA SANCHEZ', assignedStoreIds: ['s1'], teamCode: 'W_SMARTGO_20', status: DriverStatus.AVAILABLE, isActive: true, dailyWage: 400, dailyGas: 180, storeFinances: {} },
];

export const INCIDENT_CATEGORIES = [
  'Accidente Vehicular',
  'Falla Mecánica',
  'Demora en Sede',
  'Ausencia Injustificada',
  'Extravío de Mercancía',
  'Problema de Salud',
  'Conducta Inapropiada',
  'Otro'
];
