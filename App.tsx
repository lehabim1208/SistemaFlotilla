
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Store, Driver, DailyRole, DriverStatus, UserSettings } from './types';
import { INITIAL_USERS, INITIAL_STORES, INITIAL_DRIVERS } from './constants';
import { Truck, Calendar, History as HistoryIcon, LogOut, Menu, X, Store as StoreIcon, Settings as SettingsIcon, Eye, EyeOff, QrCode, Loader2, Cloud, CloudCheck, CloudOff, Download as DownloadIcon } from 'lucide-react';
import { GlassCard, Button } from './components/UI';
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

// --- CONFIGURACIÓN SUPABASE ---
const supabaseUrl = 'https://egahherinysusrsesaug.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYWhoZXJpbnlzdXNyc2VzYXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTk4MTAsImV4cCI6MjA4NTgzNTgxMH0.XtrsSAFEWafnERIDANqh1_Rvz5Pd4a2XLIRhbxlA9eA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface OfflineAction {
  id: string;
  type: 'UPDATE_USER' | 'ADD_DRIVER' | 'UPDATE_DRIVER' | 'DELETE_DRIVER' | 'PUBLISH_ROLE' | 'UPDATE_ROLE' | 'DELETE_ROLE' | 'ADD_STORE' | 'UPDATE_STORE' | 'DELETE_STORE' | 'CLEAR_ROLES';
  payload: any;
  timestamp: number;
}

const TransitionPreloader = ({ type }: { type: 'login' | 'logout' }) => (
  <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center theme-bg-app animate-in fade-in duration-500 transition-colors duration-500">
    <div className="logo-fallback flex w-24 h-24 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[2.5rem] items-center justify-center mb-10 shadow-2xl animate-pulse">
      <Truck className="text-white w-12 h-12" />
    </div>
    <p className="text-blue-500 font-black uppercase tracking-[0.5em] text-[10px] animate-pulse">
      {type === 'login' ? 'Iniciando Sistema' : 'Finalizando Sesión'}
    </p>
  </div>
);

export const App: React.FC = () => {
  const defaultSettings: UserSettings = {
    themeColor: 'indigo',
    darkMode: true,
    timezone: 'auto',
    autoDateTime: true,
    fontFamily: 'Inter'
  };

  // --- ESTADO INICIAL DESDE LOCALSTORAGE (UNIFICADO) ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('df_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [globalSettings, setGlobalSettings] = useState<UserSettings>(() => {
    const savedGlobal = localStorage.getItem('df_global_config');
    return savedGlobal ? JSON.parse(savedGlobal) : defaultSettings;
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<OfflineAction[]>(() => {
    const saved = localStorage.getItem('df_sync_queue');
    return saved ? JSON.parse(saved) : [];
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('df_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });
  const [stores, setStores] = useState<Store[]>(() => {
    const saved = localStorage.getItem('df_stores');
    return saved ? JSON.parse(saved) : INITIAL_STORES;
  });
  const [drivers, setDrivers] = useState<Driver[]>(() => {
    const saved = localStorage.getItem('df_drivers');
    return saved ? JSON.parse(saved) : INITIAL_DRIVERS;
  });
  const [history, setHistory] = useState<DailyRole[]>(() => {
    const saved = localStorage.getItem('df_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('df_active_tab') || 'dashboard';
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'login' | 'logout'>('login');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', otp: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- PERSISTENCIA AUTOMÁTICA ---
  useEffect(() => {
    localStorage.setItem('df_users', JSON.stringify(users));
    localStorage.setItem('df_stores', JSON.stringify(stores));
    localStorage.setItem('df_drivers', JSON.stringify(drivers));
    localStorage.setItem('df_history', JSON.stringify(history));
    localStorage.setItem('df_sync_queue', JSON.stringify(syncQueue));
    localStorage.setItem('df_active_tab', activeTab);
  }, [users, stores, drivers, history, syncQueue, activeTab]);

  // Monitor de Conexión
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Procesamiento de Cola al Reconectar
  useEffect(() => {
    if (isOnline && syncQueue.length > 0 && !isSyncing) {
      processSyncQueue();
    }
  }, [isOnline, syncQueue.length]);

  const processSyncQueue = async () => {
    if (syncQueue.length === 0) return;
    setIsSyncing(true);
    const queue = [...syncQueue];
    const failedActions: OfflineAction[] = [];

    for (const action of queue) {
      try {
        switch (action.type) {
          case 'UPDATE_USER': await supabase.from('app_users').update(action.payload).eq('id', action.payload.id); break;
          case 'ADD_DRIVER': await supabase.from('drivers').insert(action.payload); break;
          case 'UPDATE_DRIVER': await supabase.from('drivers').update(action.payload).eq('id', action.payload.id); break;
          case 'DELETE_DRIVER': await supabase.from('drivers').delete().eq('id', action.payload); break;
          case 'PUBLISH_ROLE': await supabase.from('daily_roles').insert(action.payload); break;
          case 'UPDATE_ROLE': await supabase.from('daily_roles').update(action.payload).eq('id', action.payload.id); break;
          case 'DELETE_ROLE': await supabase.from('daily_roles').delete().eq('id', action.payload); break;
          case 'CLEAR_ROLES': await supabase.from('daily_roles').delete().neq('id', '0'); break;
          case 'ADD_STORE': await supabase.from('stores').insert(action.payload); break;
          case 'UPDATE_STORE': await supabase.from('stores').update(action.payload).eq('id', action.payload.id); break;
          case 'DELETE_STORE': await supabase.from('stores').delete().eq('id', action.payload); break;
        }
      } catch (err) {
        console.error("Fallo al sincronizar acción:", action.type, err);
        failedActions.push(action);
      }
    }

    setSyncQueue(failedActions);
    setIsSyncing(false);
    if (failedActions.length === 0) {
      fetchAllDataSilent(); // Solo descargamos si la cola está vacía
    }
  };

  const enqueueAction = (type: OfflineAction['type'], payload: any) => {
    const newAction: OfflineAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type, payload, timestamp: Date.now()
    };
    setSyncQueue(prev => [...prev, newAction]);
  };

  const fetchAllDataSilent = async () => {
    if (!navigator.onLine || syncQueue.length > 0) return; // PROHIBIDO descargar si hay cola pendiente
    setIsSyncing(true);
    try {
      const [uRes, sRes, dRes, hRes] = await Promise.all([
        supabase.from('app_users').select('*'),
        supabase.from('stores').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('daily_roles').select('*').order('date', { ascending: false })
      ]);
      if (uRes.data) setUsers(uRes.data);
      if (sRes.data) setStores(sRes.data);
      if (dRes.data) setDrivers(dRes.data);
      if (hRes.data) setHistory(hRes.data);
    } catch (error) {
      console.error("DriveFlow Cloud Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchAllDataSilent();
    const interval = setInterval(fetchAllDataSilent, 300000);
    return () => clearInterval(interval);
  }, []);

  // --- APLICACIÓN DE ESTILOS ---
  useEffect(() => {
    if (globalSettings.darkMode) document.documentElement.classList.remove('light-mode');
    else document.documentElement.classList.add('light-mode');
  }, [globalSettings]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStep === 'credentials') {
      const user = users.find(u => u.username === loginForm.username);
      if (user && user.isDeleted) { setLoginError('Cuenta deshabilitada.'); return; }
      if (user && loginForm.password === user.password) {
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
          setPendingUser(user); setLoginStep('2fa'); setLoginError('');
        } else {
          setTransitionType('login'); setIsTransitioning(true);
          setTimeout(() => {
            setCurrentUser(user); localStorage.setItem('df_session', JSON.stringify(user));
            setLoginForm({ username: '', password: '', otp: '' }); setLoginError(''); setIsTransitioning(false);
          }, 1500);
        }
      } else { setLoginError('Credenciales incorrectas'); }
    } else {
      if (!pendingUser?.twoFactorSecret) return;
      const totp = new OTPAuth.TOTP({ secret: pendingUser.twoFactorSecret, algorithm: 'SHA1', digits: 6, period: 30 });
      if (totp.validate({ token: loginForm.otp }) !== null) {
        setTransitionType('login'); setIsTransitioning(true);
        setTimeout(() => {
          setCurrentUser(pendingUser); localStorage.setItem('df_session', JSON.stringify(pendingUser));
          setLoginForm({ username: '', password: '', otp: '' }); setLoginStep('credentials'); setLoginError(''); setIsTransitioning(false);
        }, 1500);
      } else { setLoginError('Token inválido'); }
    }
  };

  const handleLogout = () => {
    setTransitionType('logout'); setIsTransitioning(true);
    setTimeout(() => {
      setCurrentUser(null); localStorage.removeItem('df_session'); setActiveTab('dashboard');
      setLoginForm({ username: '', password: '', otp: '' }); setLoginStep('credentials'); setIsTransitioning(false);
    }, 1000);
  };

  // --- HANDLERS SINCRONIZADOS ---
  const syncUpdateUser = async (u: User) => {
    setUsers(prev => prev.map(item => item.id === u.id ? u : item));
    if (currentUser?.id === u.id) { setCurrentUser(u); localStorage.setItem('df_session', JSON.stringify(u)); }
    if (isOnline && syncQueue.length === 0) await supabase.from('app_users').update(u).eq('id', u.id);
    else enqueueAction('UPDATE_USER', u);
  };

  const syncAddDriver = async (d: Partial<Driver>) => {
    const newId = d.id || `drv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const driverToSave = { ...d, id: newId } as Driver;
    setDrivers(prev => [...prev, driverToSave]);
    if (isOnline && syncQueue.length === 0) await supabase.from('drivers').insert(driverToSave);
    else enqueueAction('ADD_DRIVER', driverToSave);
  };

  const syncUpdateDriver = async (d: Driver) => {
    setDrivers(prev => prev.map(item => item.id === d.id ? d : item));
    if (isOnline && syncQueue.length === 0) await supabase.from('drivers').update(d).eq('id', d.id);
    else enqueueAction('UPDATE_DRIVER', d);
  };

  const syncDeleteDriver = async (id: string) => {
    setDrivers(prev => prev.filter(item => item.id !== id));
    if (isOnline && syncQueue.length === 0) await supabase.from('drivers').delete().eq('id', id);
    else enqueueAction('DELETE_DRIVER', id);
  };

  const syncPublishRole = async (r: DailyRole) => {
    setHistory(prev => [r, ...prev]);
    if (isOnline && syncQueue.length === 0) await supabase.from('daily_roles').insert(r);
    else enqueueAction('PUBLISH_ROLE', r);
  };

  const syncUpdateRole = async (r: DailyRole) => {
    setHistory(prev => prev.map(item => item.id === r.id ? r : item));
    if (isOnline && syncQueue.length === 0) await supabase.from('daily_roles').update(r).eq('id', r.id);
    else enqueueAction('UPDATE_ROLE', r);
  };

  const syncDeleteRole = async (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (isOnline && syncQueue.length === 0) await supabase.from('daily_roles').delete().eq('id', id);
    else enqueueAction('DELETE_ROLE', id);
  };

  const syncAddStore = async (s: Store) => {
    setStores(prev => [...prev, s]);
    if (isOnline && syncQueue.length === 0) await supabase.from('stores').insert(s);
    else enqueueAction('ADD_STORE', s);
  };

  const syncUpdateStore = async (s: Store) => {
    setStores(prev => prev.map(x => x.id === s.id ? s : x));
    if (isOnline && syncQueue.length === 0) await supabase.from('stores').update(s).eq('id', s.id);
    else enqueueAction('UPDATE_STORE', s);
  };

  const syncDeleteStore = async (id: string) => {
    setStores(prev => prev.filter(x => x.id !== id));
    if (isOnline && syncQueue.length === 0) await supabase.from('stores').delete().eq('id', id);
    else enqueueAction('DELETE_STORE', id);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative z-10 overflow-hidden" style={{ fontFamily: 'var(--font-main)' }}>
      {isTransitioning && <TransitionPreloader type={transitionType} />}
      {!currentUser ? (
        <div className="h-screen w-full flex flex-col items-center justify-center p-6 theme-bg-app relative">
          <GlassCard className="w-full max-w-[380px] p-10 shadow-2xl animate-in zoom-in-95 duration-700">
            <div className="flex flex-col items-center mb-8">
              <h1 className="text-3xl font-black theme-text-main uppercase tracking-tighter">DriveFlow</h1>
              <Truck className="text-blue-600 w-12 h-12 mt-4" />
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              {loginStep === 'credentials' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black theme-text-muted uppercase tracking-widest px-1">Usuario</label>
                    <input className="w-full glass-input rounded-2xl px-5 py-4 outline-none font-bold text-sm" placeholder="Ej: admin123" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value.toLowerCase()})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black theme-text-muted uppercase tracking-widest px-1">Contraseña</label>
                    <div className="relative">
                      <input type={showLoginPassword ? "text" : "password"} className="w-full glass-input rounded-2xl px-5 py-4 outline-none font-bold pr-12 text-sm" placeholder="***********" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </div>
                  </div>
                </>
              ) : (
                <input className="w-full glass-input rounded-2xl px-5 py-4 text-center text-2xl tracking-[0.5em] font-black" maxLength={6} value={loginForm.otp} onChange={e => setLoginForm({...loginForm, otp: e.target.value.replace(/\D/g, '')})} />
              )}
              {loginError && <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 py-3 rounded-xl">{loginError}</p>}
              <Button type="submit" className="w-full py-5 uppercase font-black tracking-widest text-[10px]">Acceder</Button>
            </form>
          </GlassCard>
        </div>
      ) : (
        <>
          <div className="md:hidden theme-bg-surface border-b theme-border p-4 flex items-center justify-between sticky top-0 z-[60]">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="theme-text-main p-2 rounded-xl">{isSidebarOpen ? <X /> : <Menu />}</button>
              <div className="theme-text-main font-black uppercase text-xl">DriveFlow</div>
            </div>
            {!isOnline ? <CloudOff size={16} className="text-rose-500" /> : syncQueue.length > 0 ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <CloudCheck size={16} className="text-emerald-500" />}
          </div>

          {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65] md:hidden" onClick={() => setIsSidebarOpen(false)} />}

          <aside className={`fixed inset-y-0 left-0 z-[70] w-72 theme-bg-surface border-r theme-border p-6 flex flex-col transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between theme-text-main mb-12 px-2">
              <div className="text-2xl font-black uppercase tracking-tighter">DriveFlow</div>
              <div className="relative group">
                {!isOnline ? <CloudOff className="w-5 h-5 text-rose-500" /> : syncQueue.length > 0 ? <Cloud className="w-5 h-5 text-blue-500 animate-pulse" /> : <CloudCheck className="w-5 h-5 text-emerald-500" />}
                <span className="absolute left-full ml-3 top-0 scale-0 group-hover:scale-100 transition-transform origin-left bg-black text-[8px] font-black text-white px-2 py-1 rounded whitespace-nowrap z-[100]">{isOnline ? (syncQueue.length > 0 ? `Sincronizando ${syncQueue.length}...` : "Sincronizado") : "Offline"}</span>
              </div>
            </div>
            <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: HistoryIcon, role: 'all' },
                { id: 'scanner', label: 'Escáner QR', icon: QrCode, role: 'all' },
                { id: 'generator', label: 'Generador', icon: Calendar, role: 'privileged' },
                { id: 'drivers', label: 'Operadores', icon: Truck, role: 'privileged' },
                { id: 'admin', label: 'Gestión Central', icon: StoreIcon, role: UserRole.SUPERADMIN },
                { id: 'history', label: 'Historial', icon: HistoryIcon, role: 'all' },
                { id: 'download', label: 'Backup Sistema', icon: DownloadIcon, role: UserRole.SUPERADMIN },
                { id: 'settings', label: 'Configuración', icon: SettingsIcon, role: 'all' },
              ].filter(item => {
                if (item.role === 'all') return true;
                if (currentUser.role === UserRole.SUPERADMIN) return true;
                return item.role === 'privileged' && currentUser.role === UserRole.ADMIN;
              }).map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl' : 'theme-text-muted hover:theme-text-main hover:theme-bg-subtle'}`}>
                  <item.icon size={18} />
                  <span className="uppercase tracking-widest text-[9px] font-black">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-6 border-t theme-border">
              <div className="mb-6 px-5 py-5 theme-bg-subtle rounded-2xl border theme-border">
                <p className="theme-text-main font-black truncate text-sm uppercase">{currentUser.username}</p>
                <span className="text-[8px] theme-text-muted px-2 py-0.5 rounded-md font-black uppercase border theme-border mt-2 inline-block">{currentUser.role}</span>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-6 py-4 rounded-xl text-rose-500 font-black uppercase text-[10px]"><LogOut size={18} /> Salir</button>
            </div>
          </aside>
          
          <main className="flex-1 p-4 md:p-10 max-w-[1400px] mx-auto w-full overflow-y-auto custom-scrollbar flex flex-col relative z-10">
            {!isOnline && (
              <div className="mb-6 theme-bg-subtle border border-rose-500/20 p-4 rounded-2xl flex items-center justify-center gap-4">
                <CloudOff className="text-rose-500" size={18} />
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Modo Offline - Datos protegidos en el dispositivo</p>
              </div>
            )}
            <div className="flex-1">
              {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} stores={stores} drivers={drivers} history={history} users={users} />}
              {activeTab === 'scanner' && <Scanner drivers={drivers} stores={stores} />}
              {activeTab === 'generator' && <RoleGenerator currentUser={currentUser} stores={stores} drivers={drivers} history={history} onPublish={syncPublishRole} />}
              {activeTab === 'drivers' && <DriverManagement currentUser={currentUser} drivers={drivers} stores={stores} history={history} onAdd={syncAddDriver} onUpdate={syncUpdateDriver} onDelete={syncDeleteDriver} />}
              {activeTab === 'history' && <History history={history} currentUser={currentUser} onUpdateRole={syncUpdateRole} onDeleteRole={syncDeleteRole} />}
              {activeTab === 'settings' && <Settings currentUser={currentUser} onUpdateUser={syncUpdateUser} onAccountDeleted={handleLogout} />}
              {activeTab === 'download' && <DownloadPage />}
              {activeTab === 'admin' && <Superadmin users={users} stores={stores} drivers={drivers} history={history} onAddStore={syncAddStore} onUpdateStore={syncUpdateStore} onDeleteStore={syncDeleteStore} onAddAdmin={(u) => { const newU = { ...u, id: `u_${Date.now()}` } as User; setUsers(prev => [...prev, newU]); enqueueAction('UPDATE_USER', newU); }} onUpdateAdmin={syncUpdateUser} onDeleteAdmin={(id) => { setUsers(prev => prev.filter(u => u.id !== id)); enqueueAction('UPDATE_USER', { id, _deleted: true }); }} onClearHistory={() => { setHistory([]); enqueueAction('CLEAR_ROLES', null); }} />}
            </div>
            <footer className="mt-12 py-6 border-t theme-border text-center">
              <p className="opacity-40 text-[7px] font-black theme-text-muted uppercase tracking-[0.3em]">DriveFlow • Sincronización Inteligente v4.0</p>
            </footer>
          </main>
        </>
      )}
    </div>
  );
};
