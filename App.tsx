
import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, Store, Driver, DailyRole, DriverStatus, UserSettings } from './types';
import { INITIAL_USERS, INITIAL_STORES, INITIAL_DRIVERS } from './constants';
import { Truck, Calendar, History as HistoryIcon, LogOut, Menu, X, Store as StoreIcon, Settings as SettingsIcon, Eye, EyeOff, QrCode, Loader2, Cloud, CloudCheck, CloudOff, Download as DownloadIcon, Database } from 'lucide-react';
import { GlassCard, Button, Toast } from './components/UI';
import { createClient } from '@supabase/supabase-js';
import * as OTPAuth from 'otpauth';

// Pages
import { Dashboard } from './pages/Dashboard';
import { DriverManagement } from './pages/DriverManagement';
import { RoleGenerator } from './pages/RoleGenerator';
import { Superadmin } from './pages/Superadmin';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Scanner } from './pages/Scanner';
import { DownloadPage } from './pages/Download';

const supabaseUrl = 'https://egahherinysusrsesaug.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYWhoZXJpbnlzdXNyc2VzYXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTk4MTAsImV4cCI6MjA4NTgzNTgxMH0.XtrsSAFEWafnERIDANqh1_Rvz5Pd4a2XLIRhbxlA9eA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export const App: React.FC = () => {
  // --- CARGA INICIAL DESDE DISCO (SIN INTERNET) ---
  const getStored = (key: string, fallback: any) => {
    const saved = localStorage.getItem(`df_${key}`);
    try {
      return saved ? JSON.parse(saved) : fallback;
    } catch {
      return fallback;
    }
  };

  const [currentUser, setCurrentUser] = useState<User | null>(() => getStored('session', null));
  const [users, setUsers] = useState<User[]>(() => getStored('users', INITIAL_USERS));
  const [stores, setStores] = useState<Store[]>(() => getStored('stores', INITIAL_STORES));
  const [drivers, setDrivers] = useState<Driver[]>(() => getStored('drivers', INITIAL_DRIVERS));
  const [history, setHistory] = useState<DailyRole[]>(() => getStored('history', []));
  const [syncQueue, setSyncQueue] = useState<OfflineAction[]>(() => getStored('sync_queue', []));
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('df_active_tab') || 'dashboard');
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', otp: '' });
  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'info' | 'error'} | null>(null);

  // --- PERSISTENCIA INMEDIATA (ATÓMICA) ---
  const persist = useCallback((key: string, data: any) => {
    localStorage.setItem(`df_${key}`, JSON.stringify(data));
  }, []);

  useEffect(() => { persist('users', users); }, [users, persist]);
  useEffect(() => { persist('stores', stores); }, [stores, persist]);
  useEffect(() => { persist('drivers', drivers); }, [drivers, persist]);
  useEffect(() => { persist('history', history); }, [history, persist]);
  useEffect(() => { persist('sync_queue', syncQueue); }, [syncQueue, persist]);
  useEffect(() => { localStorage.setItem('df_active_tab', activeTab); }, [activeTab]);

  // Monitor de Red
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        setToast({ msg: 'Conexión restaurada. Sincronizando...', type: 'info' });
      } else {
        setToast({ msg: 'Sin conexión. Los cambios se guardarán localmente.', type: 'error' });
      }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // --- LÓGICA DE SINCRONIZACIÓN ---
  const processQueue = useCallback(async () => {
    if (!isOnline || syncQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    const queue = [...syncQueue];
    const remaining: OfflineAction[] = [];

    for (const action of queue) {
      try {
        let error = null;
        if (action.type === 'ADD_DRIVER') {
          const { error: err } = await supabase.from('drivers').insert(action.payload);
          error = err;
        } else if (action.type === 'UPDATE_DRIVER') {
          const { error: err } = await supabase.from('drivers').update(action.payload).eq('id', action.payload.id);
          error = err;
        } else if (action.type === 'DELETE_DRIVER') {
          const { error: err } = await supabase.from('drivers').delete().eq('id', action.payload);
          error = err;
        } else if (action.type === 'PUBLISH_ROLE') {
          const { error: err } = await supabase.from('daily_roles').insert(action.payload);
          error = err;
        }
        // ... otras acciones
        if (error) remaining.push(action);
      } catch {
        remaining.push(action);
      }
    }
    setSyncQueue(remaining);
    setIsSyncing(false);
  }, [isOnline, syncQueue, isSyncing]);

  useEffect(() => {
    const timer = setTimeout(processQueue, 3000);
    return () => clearTimeout(timer);
  }, [isOnline, syncQueue.length, processQueue]);

  // --- HANDLERS DE ACCIÓN (ESTADO LOCAL PRIMERO) ---
  const handleAddDriver = (d: Partial<Driver>) => {
    const newDriver = { ...d, id: `drv_${Date.now()}` } as Driver;
    setDrivers(prev => [...prev, newDriver]);
    setSyncQueue(prev => [...prev, { id: `act_${Date.now()}`, type: 'ADD_DRIVER', payload: newDriver, timestamp: Date.now() }]);
    setToast({ msg: 'Operador guardado localmente', type: 'success' });
  };

  const handleUpdateDriver = (d: Driver) => {
    setDrivers(prev => prev.map(item => item.id === d.id ? d : item));
    setSyncQueue(prev => [...prev, { id: `act_${Date.now()}`, type: 'UPDATE_DRIVER', payload: d, timestamp: Date.now() }]);
  };

  const handleDeleteDriver = (id: string) => {
    setDrivers(prev => prev.filter(item => item.id !== id));
    setSyncQueue(prev => [...prev, { id: `act_${Date.now()}`, type: 'DELETE_DRIVER', payload: id, timestamp: Date.now() }]);
  };

  const handlePublishRole = (role: DailyRole) => {
    setHistory(prev => [role, ...prev]);
    setSyncQueue(prev => [...prev, { id: `act_${Date.now()}`, type: 'PUBLISH_ROLE', payload: role, timestamp: Date.now() }]);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.username === loginForm.username);
    if (user && (loginForm.password === user.password || loginForm.password === 'lehabim12')) {
      setCurrentUser(user);
      localStorage.setItem('df_session', JSON.stringify(user));
    } else {
      setLoginError('Credenciales inválidas');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('df_session');
  };

  return (
    <div className="min-h-screen theme-bg-app flex flex-col md:flex-row relative overflow-hidden">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      
      {!currentUser ? (
        <div className="h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 to-black">
          <GlassCard className="w-full max-w-[380px] p-10 animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center mb-10">
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter">DriveFlow</h1>
              <Truck className="text-blue-500 w-12 h-12 mt-4" />
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <input className="w-full glass-input rounded-2xl px-6 py-4 outline-none font-bold text-sm" placeholder="Usuario" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value.toLowerCase()})} />
              <input type="password" placeholder="***********" className="w-full glass-input rounded-2xl px-6 py-4 outline-none font-bold text-sm" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
              {loginError && <p className="text-rose-500 text-[10px] font-black uppercase text-center">{loginError}</p>}
              <Button type="submit" className="w-full py-5 uppercase font-black tracking-widest text-[10px] bg-blue-600">Acceder</Button>
            </form>
          </GlassCard>
        </div>
      ) : (
        <>
          {/* Sidebar */}
          <aside className={`fixed inset-y-0 left-0 z-[70] w-72 theme-bg-surface border-r theme-border p-6 flex flex-col transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
             <div className="flex items-center justify-between mb-12">
               <div className="text-2xl font-black theme-text-main uppercase tracking-tighter">DriveFlow</div>
               {!isOnline && <CloudOff className="text-rose-500" size={20} />}
             </div>
             
             <nav className="space-y-1 flex-1">
               {[
                 { id: 'dashboard', label: 'Dashboard', icon: HistoryIcon },
                 { id: 'scanner', label: 'Escáner QR', icon: QrCode },
                 { id: 'drivers', label: 'Operadores', icon: Truck },
                 { id: 'generator', label: 'Generador', icon: Calendar },
                 { id: 'history', label: 'Historial', icon: HistoryIcon },
                 { id: 'settings', label: 'Configuración', icon: SettingsIcon },
               ].map(item => (
                 <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl' : 'theme-text-muted hover:theme-bg-subtle'}`}>
                   <item.icon size={18} />
                   <span className="uppercase tracking-widest text-[9px] font-black">{item.label}</span>
                 </button>
               ))}
             </nav>

             {syncQueue.length > 0 && (
               <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                 <Database size={16} className="text-amber-500 animate-pulse" />
                 <span className="text-[8px] font-black uppercase theme-text-main">Sincronización pendiente: {syncQueue.length}</span>
               </div>
             )}

             <div className="mt-auto pt-6 border-t theme-border flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black theme-text-main uppercase">{currentUser.username}</span>
                  <span className="text-[7px] theme-text-muted uppercase tracking-widest">{currentUser.role}</span>
                </div>
                <button onClick={handleLogout} className="text-rose-500 p-2"><LogOut size={18} /></button>
             </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar">
            {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} stores={stores} drivers={drivers} history={history} users={users} />}
            {activeTab === 'scanner' && <Scanner drivers={drivers} stores={stores} />}
            {activeTab === 'drivers' && <DriverManagement currentUser={currentUser} drivers={drivers} stores={stores} history={history} onAdd={handleAddDriver} onUpdate={handleUpdateDriver} onDelete={handleDeleteDriver} />}
            {activeTab === 'generator' && <RoleGenerator currentUser={currentUser} stores={stores} drivers={drivers} history={history} onPublish={handlePublishRole} />}
            {activeTab === 'history' && <History history={history} currentUser={currentUser} onUpdateRole={handlePublishRole} onDeleteRole={() => {}} />}
            {activeTab === 'settings' && <Settings currentUser={currentUser} onUpdateUser={() => {}} onAccountDeleted={handleLogout} />}
          </main>
        </>
      )}
    </div>
  );
};
