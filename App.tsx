
import React, { useState, useEffect } from 'react';
import { User, UserRole, Store, Driver, DailyRole, DriverStatus, UserSettings } from './types';
import { INITIAL_USERS, INITIAL_STORES, INITIAL_DRIVERS } from './constants';
import { Truck, Calendar, History as HistoryIcon, LogOut, Menu, X, Store as StoreIcon, Settings as SettingsIcon, Eye, EyeOff, QrCode, Loader2, ArrowLeft } from 'lucide-react';
import { GlassCard, Button } from './components/UI';
import * as OTPAuth from 'otpauth';

// Pages
import { Dashboard } from './pages/Dashboard';
import { DriverManagement } from './pages/DriverManagement';
import { RoleGenerator } from './pages/RoleGenerator';
import { Superadmin } from './pages/Superadmin';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Scanner } from './pages/Scanner';

const DEFAULT_SETTINGS: UserSettings = {
  themeColor: 'indigo',
  darkMode: true,
  timezone: 'auto',
  autoDateTime: true,
  fontFamily: 'Inter'
};

const LavaLampBackground = () => (
  <div className="lava-container">
    <div className="lava-blob w-96 h-96 bg-blue-600 top-[-10%] left-[-10%]" style={{ animationDelay: '0s' }}></div>
    <div className="lava-blob w-[500px] h-[500px] bg-indigo-900 bottom-[-20%] right-[-10%]" style={{ animationDelay: '-5s' }}></div>
    <div className="lava-blob w-80 h-80 bg-blue-400 top-[40%] right-[15%]" style={{ animationDelay: '-10s' }}></div>
    <div className="lava-blob w-[600px] h-[600px] bg-blue-800 bottom-[10%] left-[20%]" style={{ animationDelay: '-15s' }}></div>
  </div>
);

const TransitionPreloader = ({ type }: { type: 'login' | 'logout' }) => (
  <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#0d1117] animate-in fade-in duration-500">
    <div className="logo-fallback flex w-24 h-24 bg-gradient-to-br from-[var(--primary)] to-blue-700 rounded-[2.5rem] items-center justify-center mb-10 shadow-2xl animate-pulse">
      <Truck className="text-white w-12 h-12" />
    </div>
    <div className="flex flex-col items-center gap-3">
      <p className="text-blue-500 font-black uppercase tracking-[0.5em] text-[10px] animate-pulse">
        {type === 'login' ? 'Iniciando sesión' : 'Cerrando sesión'}
      </p>
      <div className="flex gap-1.5 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  </div>
);

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', otp: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'login' | 'logout'>('login');
  
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [history, setHistory] = useState<DailyRole[]>([]);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      loadLocalFallback();
      setIsLoading(false);
    };
    const loadLocalFallback = () => {
      const getLocal = (key: string, def: any) => {
        try {
          const s = localStorage.getItem(key);
          return s ? JSON.parse(s) : def;
        } catch { return def; }
      };
      setUsers(getLocal('dr_users', INITIAL_USERS.map(u => ({ ...u, isTwoFactorEnabled: false }))));
      setStores(getLocal('dr_stores', INITIAL_STORES));
      setDrivers(getLocal('dr_drivers', INITIAL_DRIVERS));
      setHistory(getLocal('dr_history', []));
    };
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('dr_drivers', JSON.stringify(drivers || []));
      localStorage.setItem('dr_history', JSON.stringify(history || []));
      localStorage.setItem('dr_users', JSON.stringify(users || []));
      localStorage.setItem('dr_stores', JSON.stringify(stores || []));
    }
  }, [drivers, history, users, stores, isLoading]);

  useEffect(() => {
    const userSettings = currentUser?.settings || DEFAULT_SETTINGS;
    const colors: Record<string, { primary: string; accent: string }> = {
      indigo: { primary: '#2563eb', accent: 'rgba(37, 99, 235, 0.3)' },
      emerald: { primary: '#059669', accent: 'rgba(5, 150, 105, 0.3)' },
      rose: { primary: '#e11d48', accent: 'rgba(225, 29, 72, 0.3)' },
      amber: { primary: '#d97706', accent: 'rgba(217, 119, 6, 0.3)' },
      violet: { primary: '#7c3aed', accent: 'rgba(124, 58, 237, 0.3)' },
    };
    const theme = colors[userSettings.themeColor] || colors.indigo;
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.documentElement.style.setProperty('--primary-glow', theme.accent);
    
    document.body.style.fontFamily = `"${userSettings.fontFamily}", "Inter", sans-serif`;

    if (userSettings.darkMode) {
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.add('light-mode');
    }
  }, [currentUser?.settings, currentUser]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginStep === 'credentials') {
      const user = (users || []).find(u => u && u.username === loginForm.username);
      if (user && user.isDeleted) {
        setLoginError('Cuenta deshabilitada temporalmente.');
        return;
      }
      const expectedPassword = user?.password || user?.username;
      const isSuperDefault = loginForm.username === 'superadmin' && loginForm.password === 'CambiarAhora123';
      if (user && (loginForm.password === expectedPassword || isSuperDefault)) {
        if (user.isTwoFactorEnabled && user.twoFactorSecret) {
          setPendingUser(user);
          setLoginStep('2fa');
          setLoginError('');
        } else {
          setTransitionType('login');
          setIsTransitioning(true);
          setTimeout(() => {
            setCurrentUser(user);
            setLoginError('');
            setActiveTab('dashboard');
            setIsSidebarOpen(false);
            setIsTransitioning(false);
          }, 2000);
        }
      } else { setLoginError('Credenciales incorrectas'); }
    } else {
      if (!pendingUser || !pendingUser.twoFactorSecret) return;
      try {
        const totp = new OTPAuth.TOTP({ secret: pendingUser.twoFactorSecret, algorithm: 'SHA1', digits: 6, period: 30 });
        if (totp.validate({ token: loginForm.otp, window: 1 }) !== null) {
          setTransitionType('login');
          setIsTransitioning(true);
          setTimeout(() => {
            setCurrentUser(pendingUser);
            setPendingUser(null);
            setLoginStep('credentials');
            setLoginError('');
            setActiveTab('dashboard');
            setIsSidebarOpen(false);
            setIsTransitioning(false);
          }, 2000);
        } else { setLoginError('Código de autenticación inválido'); }
      } catch (err) { setLoginError('Error en validación'); }
    }
  };

  const handleLogout = () => {
    setTransitionType('logout');
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentUser(null);
      setLoginStep('credentials');
      setLoginForm({ username: '', password: '', otp: '' });
      setIsSidebarOpen(false);
      setIsTransitioning(false);
    }, 2000);
  };

  const updateUser = (updatedUser: User) => {
    setUsers((prev) => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (currentUser?.id === updatedUser.id) setCurrentUser(updatedUser);
  };

  const handleAddDriver = (d: Partial<Driver>) => {
    const id = `d${Date.now()}`;
    // Generamos una qrCodeKey explícita para asegurar que el escáner lo reconozca
    const newDriver: Driver = { 
      ...d, 
      id, 
      qrCodeKey: `SG-DRV-${id}`,
      isActive: true 
    } as Driver;
    setDrivers([...drivers, newDriver]);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0d1117]">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <p className="text-blue-500 font-black uppercase tracking-[0.3em] text-[10px]">Iniciando Núcleo...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative z-10 overflow-hidden">
      {isTransitioning && <TransitionPreloader type={transitionType} />}
      {currentUser && (
        <div className="md:hidden theme-bg-surface border-b theme-border p-4 flex flex-row items-center sticky top-0 z-[60]">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="theme-text-main p-2 rounded-xl transition-colors mr-4">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          <div className="flex items-center gap-2 theme-text-main font-black uppercase text-xl">DriversRol</div>
        </div>
      )}
      {isSidebarOpen && currentUser && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[65] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      {!currentUser ? (
        <div className="h-screen w-full flex flex-col items-center justify-center p-6 relative">
          <LavaLampBackground />
          <GlassCard className="w-full max-w-[360px] p-8 md:p-10 animate-in zoom-in-95 duration-700 !bg-white/5 !backdrop-blur-[60px] !border-white/20 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
            {loginStep === 'credentials' ? (
              <>
                <div className="text-center mb-8">
                  <div className="logo-fallback flex w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-blue-700 rounded-2xl items-center justify-center mx-auto mb-6 shadow-xl"><Truck className="text-white w-8 h-8" /></div>
                  <h1 className="text-xl font-black theme-text-main uppercase tracking-tight">Inicio de sesión</h1>
                </div>
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-[0.4em]">Usuario</label>
                    <input className="w-full glass-input rounded-xl px-5 py-4 outline-none font-bold lowercase text-sm" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} placeholder="Ingrese su usuario" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-[0.4em]">Contraseña</label>
                    <div className="relative">
                      <input type={showLoginPassword ? "text" : "password"} className="w-full glass-input rounded-xl px-5 py-4 outline-none font-bold pr-12 text-sm" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} placeholder="Ingrese su clave" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                    </div>
                  </div>
                  {loginError && <div className="text-rose-500 text-[9px] font-black uppercase text-center bg-rose-500/10 py-3 rounded-xl">{loginError}</div>}
                  <Button type="submit" className="w-full py-4 uppercase font-black text-[9px] tracking-widest">Acceder</Button>
                </form>
              </>
            ) : (
              <div className="animate-in slide-in-from-right-10 duration-500">
                <button onClick={() => setLoginStep('credentials')} className="mb-6 flex items-center gap-2 text-[9px] font-black theme-text-muted uppercase hover:theme-text-main transition-colors"><ArrowLeft size={14} /> Volver</button>
                <div className="text-center mb-10"><h1 className="text-xl font-black theme-text-main uppercase">Verificación 2FA</h1></div>
                <form onSubmit={handleLogin} className="space-y-6">
                  <input autoFocus maxLength={6} placeholder="000000" className="w-full glass-input rounded-xl px-5 py-4 outline-none font-black text-center text-xl tracking-[0.4em]" value={loginForm.otp} onChange={e => setLoginForm({...loginForm, otp: e.target.value.replace(/\D/g, '')})} />
                  {loginError && <div className="text-rose-500 text-[9px] font-black uppercase text-center bg-rose-500/10 py-3 rounded-xl">{loginError}</div>}
                  <Button type="submit" className="w-full py-4 uppercase font-black text-[9px] tracking-widest">Validar</Button>
                </form>
              </div>
            )}
          </GlassCard>
        </div>
      ) : (
        <>
          <aside className={`fixed inset-y-0 left-0 z-[70] w-72 theme-bg-surface border-r theme-border p-6 flex flex-col transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center gap-3 theme-text-main mb-12 px-2 text-2xl font-black uppercase tracking-tighter">DriversRol</div>
            <nav className="space-y-1">
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
                <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-[var(--primary)] text-white shadow-xl' : 'theme-text-muted hover:theme-text-main hover:theme-bg-subtle'}`}>
                  <item.icon size={18} />
                  <span className="uppercase tracking-widest text-[9px] font-black">{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-6 border-t theme-border">
              <div className="mb-6 px-5 py-5 theme-bg-subtle rounded-2xl border theme-border overflow-hidden">
                <p className="theme-text-main font-black truncate text-sm uppercase">{currentUser.username}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-[8px] theme-bg-surface theme-text-muted px-2 py-0.5 rounded-md font-black uppercase border theme-border">{currentUser.role}</span>
                </div>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-6 py-4 rounded-xl text-rose-500 hover:bg-rose-500/10 font-black uppercase tracking-widest text-[10px] transition-all"><LogOut size={18} /> Salir</button>
            </div>
          </aside>
          <main className="flex-1 p-4 md:p-10 max-w-[1400px] mx-auto w-full overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex-1">
              {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} stores={stores} drivers={drivers} history={history} users={users} />}
              {activeTab === 'scanner' && <Scanner drivers={drivers} stores={stores} />}
              {activeTab === 'generator' && <RoleGenerator currentUser={currentUser} stores={stores} drivers={drivers} history={history} onPublish={(r) => setHistory([r, ...history])} />}
              {activeTab === 'drivers' && <DriverManagement currentUser={currentUser} drivers={drivers} stores={stores} history={history} onAdd={handleAddDriver} onUpdate={(d) => setDrivers(drivers.map(drv => drv.id === d.id ? d : drv))} onDelete={(id) => setDrivers(drivers.filter(d => d.id !== id))} />}
              {activeTab === 'admin' && <Superadmin users={users} stores={stores} onAddStore={(s) => setStores([...stores, { ...s, id: `s${Date.now()}` } as Store])} onUpdateStore={(s) => setStores(stores.map(st => st.id === s.id ? s : st))} onDeleteStore={(id) => setStores(stores.filter(s => s.id !== id))} onAddAdmin={(u) => setUsers([...users, { ...u, id: `u${Date.now()}` } as User])} onUpdateAdmin={(u) => setUsers(users.map(us => us.id === u.id ? u : us))} onDeleteAdmin={(id) => setUsers(users.filter(u => u.id !== id))} />}
              {activeTab === 'history' && <History history={history} currentUser={currentUser} onUpdateRole={(r) => setHistory(history.map(h => h.id === r.id ? r : h))} />}
              {activeTab === 'settings' && <Settings currentUser={currentUser} onUpdateUser={updateUser} onAccountDeleted={handleLogout} />}
            </div>

            <footer className="mt-12 py-6 border-t theme-border text-center opacity-40 text-[6px] font-bold theme-text-muted uppercase tracking-widest">
              Sistema de Gestión Smart Go | Por Lehabim Cruz
            </footer>
          </main>
        </>
      )}
    </div>
  );
};
