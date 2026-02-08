
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Store, Driver, DailyRole, DriverStatus, UserSettings } from './types';
import { INITIAL_USERS, INITIAL_STORES, INITIAL_DRIVERS } from './constants';
import { Truck, Calendar, History as HistoryIcon, LogOut, Menu, X, Store as StoreIcon, Settings as SettingsIcon, Eye, EyeOff, QrCode, Loader2, Cloud, CloudCheck, CloudOff } from 'lucide-react';
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

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('df_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [globalSettings, setGlobalSettings] = useState<UserSettings>(() => {
    const savedGlobal = localStorage.getItem('df_global_config');
    if (savedGlobal) {
      return { ...JSON.parse(savedGlobal), fontFamily: 'Inter' };
    }
    const session = localStorage.getItem('df_session');
    if (session) {
      const user = JSON.parse(session);
      if (user.settings) return { ...user.settings, fontFamily: 'Inter' };
    }
    return defaultSettings;
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<OfflineAction[]>(() => {
    const saved = localStorage.getItem('df_sync_queue');
    return saved ? JSON.parse(saved) : [];
  });

  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', otp: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'login' | 'logout'>('login');
  
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
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
          case 'UPDATE_USER':
            await supabase.from('app_users').update(action.payload).eq('id', action.payload.id);
            break;
          case 'ADD_DRIVER':
            await supabase.from('drivers').insert(action.payload);
            break;
          case 'UPDATE_DRIVER':
            await supabase.from('drivers').update(action.payload).eq('id', action.payload.id);
            break;
          case 'DELETE_DRIVER':
            await supabase.from('drivers').delete().eq('id', action.payload);
            break;
          case 'PUBLISH_ROLE':
            await supabase.from('daily_roles').insert(action.payload);
            break;
          case 'UPDATE_ROLE':
            await supabase.from('daily_roles').update(action.payload).eq('id', action.payload.id);
            break;
          case 'DELETE_ROLE':
            await supabase.from('daily_roles').delete().eq('id', action.payload);
            break;
          case 'CLEAR_ROLES':
            await supabase.from('daily_roles').delete().neq('id', '0');
            break;
          case 'ADD_STORE':
            await supabase.from('stores').insert(action.payload);
            break;
          case 'UPDATE_STORE':
            await supabase.from('stores').update(action.payload).eq('id', action.payload.id);
            break;
          case 'DELETE_STORE':
            await supabase.from('stores').delete().eq('id', action.payload);
            break;
        }
      } catch (err) {
        console.error("Fallo al sincronizar acción:", action.type, err);
        failedActions.push(action);
      }
    }

    setSyncQueue(failedActions);
    localStorage.setItem('df_sync_queue', JSON.stringify(failedActions));
    setIsSyncing(false);
    if (failedActions.length === 0) {
      fetchAllDataSilent(); // Refrescar datos finales después de vaciar la cola
    }
  };

  const enqueueAction = (type: OfflineAction['type'], payload: any) => {
    const newAction: OfflineAction = {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type,
      payload,
      timestamp: Date.now()
    };
    const newQueue = [...syncQueue, newAction];
    setSyncQueue(newQueue);
    localStorage.setItem('df_sync_queue', JSON.stringify(newQueue));
  };

  // EFECTO: Aplicar configuraciones al DOM (Prioridad absoluta)
  useEffect(() => {
    document.documentElement.style.setProperty('--primary', '#2563eb');
    document.documentElement.style.setProperty('--primary-glow', 'rgba(37, 99, 235, 0.3)');

    if (globalSettings.darkMode) {
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.add('light-mode');
    }

    document.documentElement.style.setProperty('--font-main', "'Inter', sans-serif");
    localStorage.setItem('df_global_config', JSON.stringify(globalSettings));
  }, [globalSettings]);

  useEffect(() => {
    if (currentUser?.settings) {
      setGlobalSettings({ ...currentUser.settings, fontFamily: 'Inter' });
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('df_active_tab', activeTab);
    }
  }, [activeTab, currentUser]);

  useEffect(() => {
    localStorage.setItem('df_users', JSON.stringify(users));
    localStorage.setItem('df_stores', JSON.stringify(stores));
    localStorage.setItem('df_drivers', JSON.stringify(drivers));
    localStorage.setItem('df_history', JSON.stringify(history));
  }, [users, stores, drivers, history]);

  const fetchAllDataSilent = async () => {
    if (!navigator.onLine) return; // No intentar si estamos offline
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    if (loginStep === 'credentials') {
      const user = users.find(u => u.username === loginForm.username);
      if (user && user.isDeleted) {
        setLoginError('Cuenta deshabilitada.');
        return;
      }
      if (user && loginForm.password === user.password) {
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
          setPendingUser(user);
          setLoginStep('2fa');
          setLoginError('');
        } else {
          setTransitionType('login');
          setIsTransitioning(true);
          setTimeout(() => {
            setCurrentUser(user);
            if (user.settings) setGlobalSettings({ ...user.settings, fontFamily: 'Inter' });
            setIsSidebarOpen(false);
            localStorage.setItem('df_session', JSON.stringify(user));
            setLoginForm({ username: '', password: '', otp: '' });
            setLoginError('');
            setIsTransitioning(false);
          }, 1500);
        }
      } else { 
        setLoginError('Credenciales incorrectas'); 
      }
    } else {
      if (!pendingUser?.twoFactorSecret) return;
      const totp = new OTPAuth.TOTP({ secret: pendingUser.twoFactorSecret, algorithm: 'SHA1', digits: 6, period: 30 });
      if (totp.validate({ token: loginForm.otp }) !== null) {
        setTransitionType('login');
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentUser(pendingUser);
          if (pendingUser.settings) setGlobalSettings({ ...pendingUser.settings, fontFamily: 'Inter' });
          setIsSidebarOpen(false);
          localStorage.setItem('df_session', JSON.stringify(pendingUser));
          setLoginForm({ username: '', password: '', otp: '' });
          setLoginStep('credentials');
          setLoginError('');
          setIsTransitioning(false);
        }, 1500);
      } else { 
        setLoginError('Token inválido'); 
      }
    }
  };

  const handleLogout = () => {
    setTransitionType('logout');
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentUser(null);
      setIsSidebarOpen(false);
      localStorage.removeItem('df_session');
      localStorage.removeItem('df_active_tab');
      setLoginForm({ username: '', password: '', otp: '' });
      setLoginStep('credentials');
      setLoginError('');
      setShowLoginPassword(false);
      setActiveTab('dashboard');
      setIsTransitioning(false);
    }, 1000);
  };

  const syncUpdateUser = async (u: User) => {
    setUsers(prev => prev.map(item => item.id === u.id ? u : item));
    if (currentUser?.id === u.id) {
      setCurrentUser(u);
      localStorage.setItem('df_session', JSON.stringify(u));
      if (u.settings) setGlobalSettings({ ...u.settings, fontFamily: 'Inter' });
    }
    if (isOnline) {
      await supabase.from('app_users').update(u).eq('id', u.id);
    } else {
      enqueueAction('UPDATE_USER', u);
    }
  };

  const syncAddDriver = async (d: Partial<Driver>) => {
    const newId = d.id || `drv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const driverToSave = { ...d, id: newId } as Driver;
    setDrivers(prev => [...prev, driverToSave]);
    if (isOnline) {
      const { error } = await supabase.from('drivers').insert(driverToSave);
      if (error) enqueueAction('ADD_DRIVER', driverToSave);
    } else {
      enqueueAction('ADD_DRIVER', driverToSave);
    }
  };

  const syncUpdateDriver = async (d: Driver) => {
    setDrivers(prev => prev.map(item => item.id === d.id ? d : item));
    if (isOnline) {
      const { error } = await supabase.from('drivers').update(d).eq('id', d.id);
      if (error) enqueueAction('UPDATE_DRIVER', d);
    } else {
      enqueueAction('UPDATE_DRIVER', d);
    }
  };

  const syncDeleteDriver = async (id: string) => {
    setDrivers(prev => prev.filter(item => item.id !== id));
    if (isOnline) {
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) enqueueAction('DELETE_DRIVER', id);
    } else {
      enqueueAction('DELETE_DRIVER', id);
    }
  };

  const syncPublishRole = async (r: DailyRole) => {
    setHistory(prev => [r, ...prev]);
    if (isOnline) {
      const { error } = await supabase.from('daily_roles').insert(r);
      if (error) enqueueAction('PUBLISH_ROLE', r);
    } else {
      enqueueAction('PUBLISH_ROLE', r);
    }
  };

  const syncUpdateRole = async (r: DailyRole) => {
    setHistory(prev => prev.map(item => item.id === r.id ? r : item));
    if (isOnline) {
      const { error } = await supabase.from('daily_roles').update(r).eq('id', r.id);
      if (error) enqueueAction('UPDATE_ROLE', r);
    } else {
      enqueueAction('UPDATE_ROLE', r);
    }
  };

  const syncDeleteRole = async (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (isOnline) {
      const { error } = await supabase.from('daily_roles').delete().eq('id', id);
      if (error) enqueueAction('DELETE_ROLE', id);
    } else {
      enqueueAction('DELETE_ROLE', id);
    }
  };

  const syncClearAllRoles = async () => {
    setHistory([]);
    localStorage.removeItem('df_history');
    if (isOnline) {
      await supabase.from('daily_roles').delete().neq('id', '0');
    } else {
      enqueueAction('CLEAR_ROLES', null);
    }
  };

  const syncAddStore = async (s: Store) => {
    setStores(prev => [...prev, s]);
    if (isOnline) {
      await supabase.from('stores').insert(s);
    } else {
      enqueueAction('ADD_STORE', s);
    }
  };

  const syncUpdateStore = async (s: Store) => {
    setStores(prev => prev.map(x => x.id === s.id ? s : x));
    if (isOnline) {
      await supabase.from('stores').update(s).eq('id', s.id);
    } else {
      enqueueAction('UPDATE_STORE', s);
    }
  };

  const syncDeleteStore = async (id: string) => {
    setStores(prev => prev.filter(x => x.id !== id));
    if (isOnline) {
      await supabase.from('stores').delete().eq('id', id);
    } else {
      enqueueAction('DELETE_STORE', id);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative z-10 overflow-hidden" style={{ fontFamily: 'var(--font-main)' }}>
      {isTransitioning && <TransitionPreloader type={transitionType} />}
      
      {!currentUser ? (
        <div className="h-screen w-full flex flex-col items-center justify-center p-6 theme-bg-app relative transition-colors duration-500">
          <GlassCard className="w-full max-w-[380px] p-10 relative z-10 shadow-2xl theme-border transition-all duration-500 animate-in zoom-in-95 duration-700">
            <div className="flex flex-col items-center mb-8">
              <h1 className="text-3xl font-black text-center uppercase tracking-tighter theme-text-main">DriveFlow</h1>
              <div className="mt-4 flex items-center justify-center">
                <svg viewBox="0 0 512 512" className="w-16 h-16 filter drop-shadow-[0_0_10px_rgba(37,99,235,0.4)]">
                   <path fill="#2563eb" d="M488 232c-2.4-11.8-8-22.4-16.1-31L416 128H288v256h160c17.7 0 32-14.3 32-32V232z"/>
                   <path fill="#ffffff" d="M320 160h64l48 64h-112v-64z" opacity="0.6"/>
                   <path fill="#2563eb" d="M288 80H32c-17.7 0-32 14.3-32 32v224c0 17.7 14.3 32 32 32h256V80z" opacity="0.8"/>
                   <circle fill="#1e293b" cx="112" cy="384" r="48"/>
                   <circle fill="#1e293b" cx="400" cy="384" r="48"/>
                   <circle fill="#94a3b8" cx="112" cy="384" r="20"/>
                   <circle fill="#94a3b8" cx="400" cy="384" r="20"/>
                   <path fill="#f59e0b" d="M464 272h24v40h-24z" />
                </svg>
              </div>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-6">
              {loginStep === 'credentials' ? (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.3em] px-1">Usuario</label>
                    <input 
                      className="w-full glass-input rounded-2xl px-5 py-4 outline-none font-bold text-sm" 
                      placeholder="Ej: admin123" 
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck="false"
                      value={loginForm.username} 
                      onChange={e => setLoginForm({...loginForm, username: e.target.value.toLowerCase()})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black theme-text-muted uppercase tracking-[0.3em] px-1">Contraseña</label>
                    <div className="relative">
                      <input 
                        type={showLoginPassword ? "text" : "password"} 
                        className="w-full glass-input rounded-2xl px-5 py-4 outline-none font-bold pr-12 text-sm" 
                        placeholder="••••••••" 
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        value={loginForm.password} 
                        onChange={e => setLoginForm({...loginForm, password: e.target.value.toLowerCase()})} 
                      />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-[10px] font-black theme-text-muted uppercase text-center tracking-widest">Ingrese Código 2FA</p>
                  <input 
                    className="w-full glass-input rounded-2xl px-5 py-4 outline-none font-black text-center text-2xl tracking-[0.5em]" 
                    placeholder="000000" 
                    maxLength={6}
                    value={loginForm.otp} 
                    onChange={e => setLoginForm({...loginForm, otp: e.target.value.replace(/\D/g, '')})} 
                  />
                  <button type="button" onClick={() => setLoginStep('credentials')} className="w-full text-[9px] font-black text-blue-500 uppercase tracking-widest">Volver al inicio</button>
                </div>
              )}
              {loginError && <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 py-3 rounded-xl border border-rose-500/20">{loginError}</p>}
              <Button type="submit" className="w-full py-5 uppercase font-black tracking-widest text-[10px] rounded-2xl shadow-xl shadow-blue-900/40">Acceder al Sistema</Button>
            </form>
          </GlassCard>
        </div>
      ) : (
        <>
          <div className="md:hidden theme-bg-surface border-b theme-border p-4 flex items-center gap-4 sticky top-0 z-[60]">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="theme-text-main p-2 rounded-xl transition-all hover:bg-white/5 active:scale-90"
            >
              {isSidebarOpen ? <X /> : <Menu />}
            </button>
            <div className="flex items-center gap-2 theme-text-main font-black uppercase text-xl flex-1 text-left text-ellipsis overflow-hidden whitespace-nowrap">DriveFlow</div>
            <div className="flex items-center gap-2">
              {!isOnline ? <CloudOff size={16} className="text-rose-500" /> : syncQueue.length > 0 ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <CloudCheck size={16} className="text-emerald-500" />}
            </div>
          </div>

          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65] md:hidden" 
              onClick={() => setIsSidebarOpen(false)} 
            />
          )}

          <aside className={`fixed inset-y-0 left-0 z-[70] w-72 theme-bg-surface border-r theme-border p-6 flex flex-col transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between theme-text-main mb-12 px-2">
              <div className="text-2xl font-black uppercase tracking-tighter">DriveFlow</div>
              <div className="relative group">
                {!isOnline ? (
                  <CloudOff className="w-5 h-5 text-rose-500/50" />
                ) : syncQueue.length > 0 ? (
                  <div className="relative">
                    <Cloud className="w-5 h-5 text-blue-500 animate-pulse" />
                    <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[8px] font-black w-4 h-4 flex items-center justify-center rounded-full border border-white/20">
                      {syncQueue.length}
                    </span>
                  </div>
                ) : (
                  <CloudCheck className="w-5 h-5 text-emerald-500/40" />
                )}
                <div className="absolute left-full ml-3 top-0 scale-0 group-hover:scale-100 transition-transform origin-left bg-black/80 text-[8px] font-black text-white px-3 py-1.5 rounded-lg whitespace-nowrap z-[100] border border-white/10">
                  {isOnline ? (syncQueue.length > 0 ? `Sincronizando ${syncQueue.length} cambios...` : "Sistema al día") : "Modo Offline - Cambios locales"}
                </div>
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
                { id: 'settings', label: 'Configuración', icon: SettingsIcon, role: 'all' },
              ].filter(item => {
                if (item.role === 'all') return true;
                if (currentUser.role === UserRole.SUPERADMIN) return true;
                return item.role === 'privileged' && currentUser.role === UserRole.ADMIN;
              }).map(item => (
                <button 
                  key={item.id} 
                  onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} 
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-[#2563eb] text-white shadow-xl' : 'theme-text-muted hover:theme-text-main hover:theme-bg-subtle'}`}
                >
                  <item.icon size={18} />
                  <span className="uppercase tracking-widest text-[9px] font-black">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-6 border-t theme-border">
              <div className="mb-6 px-5 py-5 theme-bg-subtle rounded-2xl border theme-border relative group">
                <div className="flex items-center justify-between gap-2">
                  <p className="theme-text-main font-black truncate text-sm uppercase flex-1">{currentUser.username}</p>
                  <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'} shadow-[0_0_8px_rgba(16,185,129,0.6)] border border-white/10 shrink-0`}></div>
                </div>
                <span className="text-[8px] theme-text-muted px-2 py-0.5 rounded-md font-black uppercase border theme-border mt-2 inline-block">{currentUser.role}</span>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-6 py-4 rounded-xl text-rose-500 hover:bg-rose-500/10 font-black uppercase tracking-widest text-[10px] transition-all"><LogOut size={18} /> Salir</button>
            </div>
          </aside>
          
          <main className="flex-1 p-4 md:p-10 max-w-[1400px] mx-auto w-full overflow-y-auto custom-scrollbar flex flex-col relative z-10">
            {!isOnline && (
              <div className="mb-6 theme-bg-subtle border border-rose-500/20 p-4 rounded-2xl flex items-center justify-center gap-4 animate-in slide-in-from-top-2">
                <CloudOff className="text-rose-500" size={18} />
                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Sin Conexión a Internet - Trabajando con datos locales</p>
              </div>
            )}
            <div className="flex-1">
              {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} stores={stores} drivers={drivers} history={history} users={users} />}
              {activeTab === 'scanner' && <Scanner drivers={drivers} stores={stores} />}
              {activeTab === 'generator' && <RoleGenerator currentUser={currentUser} stores={stores} drivers={drivers} history={history} onPublish={syncPublishRole} />}
              {activeTab === 'drivers' && <DriverManagement currentUser={currentUser} drivers={drivers} stores={stores} history={history} onAdd={syncAddDriver} onUpdate={syncUpdateDriver} onDelete={syncDeleteDriver} />}
              {activeTab === 'history' && <History history={history} currentUser={currentUser} onUpdateRole={syncUpdateRole} onDeleteRole={syncDeleteRole} />}
              {activeTab === 'settings' && <Settings currentUser={currentUser} onUpdateUser={syncUpdateUser} onAccountDeleted={handleLogout} />}
              {activeTab === 'admin' && (
                <Superadmin 
                  users={users} 
                  stores={stores} 
                  drivers={drivers}
                  history={history}
                  onAddStore={syncAddStore} 
                  onUpdateStore={syncUpdateStore}
                  onDeleteStore={syncDeleteStore}
                  onAddAdmin={async (u) => { 
                    const newU = { ...u, id: `u_${Date.now()}` } as User;
                    setUsers(prev => [...prev, newU]);
                    if (isOnline) {
                      await supabase.from('app_users').insert(newU);
                    } else {
                      enqueueAction('UPDATE_USER', newU); 
                    }
                  }}
                  onUpdateAdmin={syncUpdateUser}
                  onDeleteAdmin={async (id) => { 
                    setUsers(prev => prev.filter(u => u.id !== id));
                    if (isOnline) {
                      await supabase.from('app_users').delete().eq('id', id);
                    } else {
                      enqueueAction('UPDATE_USER', { id, _deleted: true }); // Marcamos para borrar
                    }
                  }}
                  onClearHistory={syncClearAllRoles}
                />
              )}
            </div>
            <footer className="mt-12 py-6 border-t theme-border text-center flex flex-col items-center gap-2">
              <p className="opacity-40 text-[7px] font-black theme-text-muted uppercase tracking-[0.3em]">
                DriveFlow - Por Lehabim Cruz
              </p>
              {isSyncing && (
                <div className="flex items-center gap-2 text-[6px] font-black text-blue-500 uppercase">
                  <Loader2 className="w-2 h-2 animate-spin" /> {syncQueue.length > 0 ? 'Subiendo cambios pendientes...' : 'Sincronizando con la nube...'}
                </div>
              )}
            </footer>
          </main>
        </>
      )}
    </div>
  );
};
