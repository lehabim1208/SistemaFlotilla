
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, UserRole, Store, Driver, DailyRole, Incident, UserSettings, Note } from './types';
import { INITIAL_USERS, INITIAL_STORES, INITIAL_DRIVERS } from './constants';
import { Truck, Calendar, History as HistoryIcon, LogOut, Menu, X, Store as StoreIcon, Settings as SettingsIcon, Eye, EyeOff, QrCode, Loader2, Cloud, CloudCheck, CloudOff, Fingerprint, Keyboard, ArrowLeft, Delete, User as UserIcon, ArrowRight, UserMinus, AlertTriangle, Bell, StickyNote, Save, ShieldCheck } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from './components/UI';
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
import { Incidents } from './pages/Incidents';
import { Notes } from './pages/Notes';

// --- CONFIGURACIÓN SUPABASE ---
const supabaseUrl = 'https://egahherinysusrsesaug.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnYWhoZXJpbnlzdXNyc2VzYXVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNTk4MTAsImV4cCI6MjA4NTgzNTgxMH0.XtrsSAFEWafnERIDANqh1_Rvz5Pd4a2XLIRhbxlA9eA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface OfflineAction {
  id: string;
  type: 'UPDATE_USER' | 'DELETE_USER' | 'ADD_DRIVER' | 'UPDATE_DRIVER' | 'DELETE_DRIVER' | 'PUBLISH_ROLE' | 'UPDATE_ROLE' | 'DELETE_ROLE' | 'ADD_STORE' | 'UPDATE_STORE' | 'DELETE_STORE' | 'CLEAR_ROLES' | 'ADD_INCIDENT' | 'UPDATE_INCIDENT' | 'DELETE_INCIDENT' | 'ADD_NOTE' | 'DELETE_NOTE' | 'UPDATE_NOTE';
  payload: any;
  timestamp: number;
}

// Icono de Camión de Reparto (Box Truck) Rediseñado - Más pequeño y estilizado
const FastDeliveryIcon = ({ className = "" }: { className?: string }) => (
  <div className={`relative flex items-center justify-center ${className}`}>
    {/* Líneas de velocidad fluyendo hacia la izquierda */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
       <div className="absolute top-[35%] left-[-5px] w-6 h-0.5 bg-blue-500 rounded-full animate-speed" style={{ animationDelay: '0s' }}></div>
       <div className="absolute top-[50%] left-[-15px] w-10 h-0.5 bg-blue-400 rounded-full animate-speed" style={{ animationDelay: '0.2s' }}></div>
       <div className="absolute top-[65%] left-[-2px] w-8 h-0.5 bg-blue-600 rounded-full animate-speed" style={{ animationDelay: '0.4s' }}></div>
    </div>
    
    <svg width="100" height="65" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-truck">
      <defs>
        <linearGradient id="truckBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#3b82f6' }} />
          <stop offset="100%" style={{ stopColor: '#1d4ed8' }} />
        </linearGradient>
      </defs>
      {/* Caja de carga */}
      <rect x="2" y="6" width="12" height="10" rx="1" fill="url(#truckBodyGrad)" />
      {/* Cabina */}
      <path d="M14 8H18L21 12V16H14V8Z" fill="#1e293b" />
      {/* Ventana */}
      <path d="M15 9H17.5L19.5 12H15V9Z" fill="#94a3b8" />
      {/* Ruedas más pequeñas */}
      <circle cx="6" cy="18" r="1.8" fill="#0f172a" stroke="#ffffff" strokeWidth="0.5" />
      <circle cx="17.5" cy="18" r="1.8" fill="#0f172a" stroke="#ffffff" strokeWidth="0.5" />
      {/* Separador */}
      <rect x="13.5" y="7" width="0.5" height="9" fill="white" opacity="0.2" />
      {/* Detalles */}
      <rect x="4" y="8" width="8" height="1" fill="white" opacity="0.2" rx="0.5" />
    </svg>
  </div>
);

const TransitionPreloader = ({ type }: { type: 'login' | 'logout' }) => (
  <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center theme-bg-app animate-in fade-in duration-500 transition-colors duration-500">
    <div className="mb-10 transform scale-125">
      <FastDeliveryIcon />
    </div>
    <p className="text-blue-500 font-black uppercase tracking-[0.5em] text-[10px] animate-pulse">
      {type === 'login' ? 'Iniciando Sistema' : 'Finalizando Sesión'}
    </p>
  </div>
);

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('df_session');
    return saved ? JSON.parse(saved) : null;
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
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    const saved = localStorage.getItem('df_incidents');
    return saved ? JSON.parse(saved) : [];
  });
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('df_notes');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('df_active_tab') || 'dashboard';
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionType, setTransitionType] = useState<'login' | 'logout'>('login');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', description: '', color: 'transparent' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [loginStep, setLoginStep] = useState<'credentials' | '2fa'>('credentials');
  const [isFastLoginOpen, setIsFastLoginOpen] = useState(false);
  const [fastLoginView, setFastLoginView] = useState<'options' | 'pin'>('options');
  const [rememberMe, setRememberMe] = useState(true);
  
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', otp: '' });
  const [otpStatus, setOtpStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pinInput, setPinInput] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isBiometricChecking, setIsBiometricChecking] = useState(false);

  const [lastUsername, setLastUsername] = useState<string | null>(() => localStorage.getItem('df_last_username'));

  const otpInputRef = useRef<HTMLInputElement>(null);

  const lastUser = useMemo(() => {
    return users.find(u => u.username === lastUsername);
  }, [users, lastUsername]);

  useEffect(() => {
    localStorage.setItem('df_users', JSON.stringify(users));
    localStorage.setItem('df_stores', JSON.stringify(stores));
    localStorage.setItem('df_drivers', JSON.stringify(drivers));
    localStorage.setItem('df_history', JSON.stringify(history));
    localStorage.setItem('df_incidents', JSON.stringify(incidents));
    localStorage.setItem('df_notes', JSON.stringify(notes));
    localStorage.setItem('df_sync_queue', JSON.stringify(syncQueue));
    localStorage.setItem('df_active_tab', activeTab);
    if (currentUser) {
      localStorage.setItem('df_session', JSON.stringify(currentUser));
    }
  }, [users, stores, drivers, history, incidents, notes, syncQueue, activeTab, currentUser]);

  // Lógica de tema robusta con persistencia independiente para el Login
  useEffect(() => {
    const persistentPref = localStorage.getItem('df_theme_preference');
    let shouldBeDark = true;

    if (persistentPref !== null) {
      shouldBeDark = persistentPref === 'dark';
    } else if (currentUser) {
      shouldBeDark = currentUser.settings?.darkMode ?? true;
    } else {
      const savedSession = localStorage.getItem('df_session');
      if (savedSession) {
        try {
          const user = JSON.parse(savedSession);
          shouldBeDark = user.settings?.darkMode ?? true;
        } catch(e) {}
      }
    }
    
    if (shouldBeDark) document.documentElement.classList.remove('light-mode');
    else document.documentElement.classList.add('light-mode');
  }, [currentUser?.settings?.darkMode]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (isOnline && syncQueue.length > 0 && !isSyncing) processSyncQueue();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, syncQueue.length]);

  const mapIncidentToDB = (inc: Incident) => ({
    id: inc.id,
    type: inc.type,
    level: inc.level,
    description: inc.description,
    driver_id: inc.driverId,
    store_id: inc.storeId,
    reporter_id: inc.reporterId,
    date: inc.date,
    location: inc.location,
    address: inc.address,
    evidence_url: inc.evidenceUrl,
    resolved: inc.resolved
  });

  const processSyncQueue = async () => {
    if (syncQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);
    const queue = [...syncQueue];
    const failedActions: OfflineAction[] = [];
    
    try {
      for (const action of queue) {
        let error = null;
        switch (action.type) {
          case 'UPDATE_USER': ({ error } = await supabase.from('app_users').upsert(action.payload)); break;
          case 'DELETE_USER': ({ error } = await supabase.from('app_users').delete().eq('id', action.payload)); break;
          case 'ADD_DRIVER': ({ error } = await supabase.from('drivers').insert(action.payload)); break;
          case 'UPDATE_DRIVER': ({ error } = await supabase.from('drivers').update(action.payload).eq('id', action.payload.id)); break;
          case 'DELETE_DRIVER': ({ error } = await supabase.from('drivers').delete().eq('id', action.payload)); break;
          case 'PUBLISH_ROLE': ({ error } = await supabase.from('daily_roles').insert(action.payload)); break;
          case 'UPDATE_ROLE': ({ error } = await supabase.from('daily_roles').update(action.payload).eq('id', action.payload.id)); break;
          case 'DELETE_ROLE': ({ error } = await supabase.from('daily_roles').delete().eq('id', action.payload)); break;
          case 'CLEAR_ROLES': ({ error } = await supabase.from('daily_roles').delete().neq('id', '0')); break;
          case 'ADD_STORE': ({ error } = await supabase.from('stores').insert(action.payload)); break;
          case 'UPDATE_STORE': ({ error } = await supabase.from('stores').update(action.payload).eq('id', action.payload.id)); break;
          case 'DELETE_STORE': ({ error } = await supabase.from('stores').delete().eq('id', action.payload)); break;
          case 'ADD_INCIDENT': ({ error } = await supabase.from('incidents').insert(mapIncidentToDB(action.payload))); break;
          case 'UPDATE_INCIDENT': ({ error } = await supabase.from('incidents').update(mapIncidentToDB(action.payload)).eq('id', action.payload.id)); break;
          case 'DELETE_INCIDENT': ({ error } = await supabase.from('incidents').delete().eq('id', action.payload)); break;
          case 'ADD_NOTE': ({ error } = await supabase.from('notes').insert(action.payload)); break;
          case 'UPDATE_NOTE': ({ error } = await supabase.from('notes').update(action.payload).eq('id', action.payload.id)); break;
          case 'DELETE_NOTE': ({ error } = await supabase.from('notes').delete().eq('id', action.payload)); break;
        }
        if (error) failedActions.push(action);
      }
    } catch (err) {
      console.error("Critical Sync Error:", err);
    } finally {
      setSyncQueue(failedActions);
      setIsSyncing(false);
      if (failedActions.length === 0) fetchAllDataSilent();
    }
  };

  const enqueueAction = (type: OfflineAction['type'], payload: any) => {
    const newAction: OfflineAction = { id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, type, payload, timestamp: Date.now() };
    setSyncQueue(prev => [...prev, newAction]);
  };

  const fetchAllDataSilent = async () => {
    if (!navigator.onLine || syncQueue.length > 0) return; 
    setIsSyncing(true);
    try {
      const [uRes, sRes, dRes, hRes, iRes, nRes] = await Promise.all([
        supabase.from('app_users').select('*'),
        supabase.from('stores').select('*'),
        supabase.from('drivers').select('*'),
        supabase.from('daily_roles').select('*').order('date', { ascending: false }),
        supabase.from('incidents').select('*').order('date', { ascending: false }),
        supabase.from('notes').select('*').order('created_at', { ascending: false })
      ]);
      if (uRes.data) setUsers(uRes.data);
      if (sRes.data) setStores(sRes.data);
      if (dRes.data) setDrivers(dRes.data);
      if (hRes.data) setHistory(hRes.data);
      if (iRes.data) {
        const mappedIncidents: Incident[] = iRes.data.map((row: any) => ({
          id: row.id, type: row.type, level: row.level, description: row.description,
          driverId: row.driver_id, storeId: row.store_id, reporterId: row.reporter_id,
          date: row.date, location: row.location, address: row.address, evidenceUrl: row.evidence_url, resolved: row.resolved
        }));
        setIncidents(mappedIncidents);
      }
      if (nRes.data) setNotes(nRes.data);
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsSyncing(false); 
    }
  };

  useEffect(() => {
    fetchAllDataSilent();
    const interval = setInterval(fetchAllDataSilent, 300000); 
    return () => clearInterval(interval);
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) { e.preventDefault(); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); }
    if (loginStep === 'credentials') {
      const user = users.find(u => u.username === loginForm.username.toLowerCase());
      if (user && user.isDeleted) { setLoginError('Cuenta deshabilitada.'); return; }
      if (user && loginForm.password === user.password) {
        if (user.isTwoFactorEnabled && user.twoFactorSecret) { setPendingUser(user); setLoginStep('2fa'); setLoginError(''); }
        else executeSuccessfulLogin(user);
      } else setLoginError('Credenciales incorrectas');
    } else if (loginStep === '2fa') {
      verifyOtp();
    }
  };

  const verifyOtp = () => {
    if (!pendingUser?.twoFactorSecret) return;
    const totp = new OTPAuth.TOTP({ secret: pendingUser.twoFactorSecret, algorithm: 'SHA1', digits: 6, period: 30 });
    const isValid = totp.validate({ token: loginForm.otp, window: 1 }) !== null;
    
    otpInputRef.current?.blur();

    if (isValid) {
      setOtpStatus('success');
      setTimeout(() => executeSuccessfulLogin(pendingUser), 600);
    } else {
      setOtpStatus('error');
      setLoginError('Token inválido');
      setTimeout(() => {
        setOtpStatus('idle');
        setLoginForm(prev => ({ ...prev, otp: '' }));
      }, 1000);
    }
  };

  useEffect(() => {
    if (loginStep === '2fa' && loginForm.otp.length === 6) {
      verifyOtp();
    }
  }, [loginForm.otp]);

  const handlePinInput = (num: string) => {
    if (pinInput.length >= 4) return;
    const newPin = pinInput + num;
    setPinInput(newPin);
    setLoginError('');
    if (newPin.length === 4) {
      if (lastUser && lastUser.settings?.pinCode === newPin) executeSuccessfulLogin(lastUser);
      else { setLoginError('PIN Incorrecto'); setTimeout(() => { setPinInput(''); }, 1000); }
    }
  };

  const executeSuccessfulLogin = (user: User) => {
    if (rememberMe) { localStorage.setItem('df_last_username', user.username); setLastUsername(user.username); }
    
    if (user.settings) {
      localStorage.setItem('df_theme_preference', user.settings.darkMode ? 'dark' : 'light');
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    setTransitionType('login'); setIsTransitioning(true);
    setTimeout(() => {
      setCurrentUser(user); setShowLoginPassword(false); setPinInput(''); setIsFastLoginOpen(false);
      setLoginForm({ username: '', password: '', otp: '' }); setLoginError(''); setOtpStatus('idle'); setIsTransitioning(false);
    }, 1500);
  };

  const handleContinueAs = () => {
    if (!lastUser) return;
    const hasQuickAccess = lastUser.settings?.pinCode || lastUser.settings?.biometricsEnabled;
    if (hasQuickAccess) {
      setIsFastLoginOpen(true);
      setFastLoginView('options');
      setLoginError('');
    } else {
      setLoginForm(prev => ({ ...prev, username: lastUser.username }));
      setToast({ message: 'Coloque su contraseña', type: 'info' });
      setIsFastLoginOpen(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!lastUser || !lastUser.settings?.biometricsEnabled || isBiometricChecking) return;
    setIsBiometricChecking(true);
    setLoginError("");
    try {
      if (window.isSecureContext && navigator.credentials && !window.location.host.includes('aistudio')) {
        const options: any = { publicKey: { challenge: new Uint8Array([1, 2, 3, 4, 5]), allowCredentials: [], timeout: 60000, userVerification: "required" } };
        await navigator.credentials.get(options);
      } else await new Promise(r => setTimeout(r, 1500));
      executeSuccessfulLogin(lastUser);
    } catch (err) { setLoginError("Biometría fallida."); } finally { setIsBiometricChecking(false); }
  };

  const handleLogout = () => {
    setTransitionType('logout'); setIsTransitioning(true); setIsSidebarOpen(false);
    setTimeout(() => {
      setCurrentUser(null); localStorage.removeItem('df_session'); setActiveTab('dashboard');
      setLoginForm({ username: '', password: '', otp: '' }); setLoginStep('credentials'); setIsTransitioning(false);
    }, 1000);
  };

  const handleForgetUser = () => {
    localStorage.removeItem('df_last_username');
    setLastUsername(null);
    setIsFastLoginOpen(false);
    setToast({ message: 'Cuenta olvidada correctamente', type: 'info' });
  };

  const syncAddNote = async (note: Note) => {
    setNotes(prev => [note, ...prev]);
    if (isOnline && syncQueue.length === 0) {
      const { error } = await supabase.from('notes').insert(note);
      if (error) enqueueAction('ADD_NOTE', note);
    } else {
      enqueueAction('ADD_NOTE', note);
    }
  };

  const handleSaveQuickNote = async () => {
    if (!currentUser || !newNote.description.trim()) return;
    const noteId = `note_${Date.now()}`;
    const note: Note = {
      id: noteId,
      user_id: currentUser.id,
      title: newNote.title.trim(),
      description: newNote.description.trim(),
      color: newNote.color || 'transparent',
      created_at: new Date().toISOString(),
      is_pinned: false
    };
    
    await syncAddNote(note);
    
    setNewNote({ title: '', description: '', color: 'transparent' });
    setIsNoteModalOpen(false);
    setToast({ message: 'Nota guardada con éxito', type: 'success' });
  };

  const syncAddIncident = async (inc: Incident) => {
    setIncidents(prev => [inc, ...prev]);
    if (isOnline && syncQueue.length === 0) await supabase.from('incidents').insert(mapIncidentToDB(inc));
    else enqueueAction('ADD_INCIDENT', inc);
  };

  const syncUpdateIncident = async (inc: Incident) => {
    setIncidents(prev => prev.map(i => i.id === inc.id ? inc : i));
    if (isOnline && syncQueue.length === 0) await supabase.from('incidents').update(mapIncidentToDB(inc)).eq('id', inc.id);
    else enqueueAction('UPDATE_INCIDENT', inc);
  };

  const syncDeleteIncident = async (id: string) => {
    setIncidents(prev => prev.filter(i => i.id !== id));
    if (isOnline && syncQueue.length === 0) await supabase.from('incidents').delete().eq('id', id);
    else enqueueAction('DELETE_INCIDENT', id);
  };

  const syncUpdateUser = async (u: User) => {
    setUsers(prev => prev.map(item => item.id === u.id ? u : item));
    if (u.settings) {
      localStorage.setItem('df_theme_preference', u.settings.darkMode ? 'dark' : 'light');
    }
    if (currentUser?.id === u.id) setCurrentUser(u);
    if (isOnline && syncQueue.length === 0) await supabase.from('app_users').upsert(u);
    else enqueueAction('UPDATE_USER', u);
  };

  const syncDeleteUser = async (id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    if (isOnline && syncQueue.length === 0) {
      const { error } = await supabase.from('app_users').delete().eq('id', id);
      if (error) {
        console.error("Supabase delete failed, enqueuing:", error);
        enqueueAction('DELETE_USER', id);
      }
    } else {
      enqueueAction('DELETE_USER', id);
    }
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
    if (isOnline && syncQueue.length === 0) {
      setIsSyncing(true);
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) enqueueAction('DELETE_DRIVER', id);
      setIsSyncing(false);
    } else {
      enqueueAction('DELETE_DRIVER', id);
    }
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

  const syncUpdateNote = async (n: Note) => {
    setNotes(prev => prev.map(item => item.id === n.id ? n : item));
    if (isOnline && syncQueue.length === 0) {
      const { error } = await supabase.from('notes').update(n).eq('id', n.id);
      if (error) enqueueAction('UPDATE_NOTE', n);
    } else {
      enqueueAction('UPDATE_NOTE', n);
    }
  };

  const syncDeleteNote = async (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (isOnline && syncQueue.length === 0) {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) enqueueAction('DELETE_NOTE', id);
    } else {
      enqueueAction('DELETE_NOTE', id);
    }
  };

  const handleOtpCellClick = () => {
    otpInputRef.current?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative z-10 overflow-hidden" style={{ fontFamily: 'var(--font-main)' }}>
      {isTransitioning && <TransitionPreloader type={transitionType} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {!currentUser ? (
        <div className="h-screen w-full flex flex-col items-center justify-center p-4 md:p-6 theme-bg-app relative overflow-hidden">
           {/* Decoración ambiental */}
           <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]" />
           <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/5 rounded-full blur-[100px]" />

          <GlassCard className="w-full max-w-[380px] p-6 md:p-10 shadow-2xl animate-in zoom-in-95 duration-700 relative z-20 overflow-visible">
            <div className="flex flex-col items-center mb-8">
              <div className="mb-3">
                 <FastDeliveryIcon />
              </div>
              <h1 className="text-xl font-black theme-text-main uppercase tracking-[0.2em] drop-shadow-sm leading-none">DriveFlow</h1>
              
              {lastUser && loginStep === 'credentials' && (
                <div className="mt-6 animate-fade-in-up">
                  <button onClick={handleContinueAs} className="group flex items-center gap-2 theme-text-muted hover:theme-text-main transition-all bg-black/20 hover:bg-black/40 px-4 py-2 rounded-full border border-white/5">
                    <UserIcon size={12} className="text-blue-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                      Como <span className="text-blue-500 font-black">{lastUser.username}</span>
                    </span>
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {loginStep === 'credentials' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-[0.3em] px-1 opacity-60">Usuario</label>
                    <input 
                      className="w-full glass-input rounded-xl px-5 py-4 outline-none font-bold text-sm focus:ring-2 ring-blue-500/20" 
                      placeholder="admin..." 
                      value={loginForm.username} 
                      onChange={e => setLoginForm({...loginForm, username: e.target.value.toLowerCase()})} 
                      autoCapitalize="none" 
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black theme-text-muted uppercase tracking-[0.3em] px-1 opacity-60">Contraseña</label>
                    <div className="relative">
                      <input 
                        type={showLoginPassword ? "text" : "password"} 
                        className="w-full glass-input rounded-xl px-5 py-4 outline-none font-bold pr-14 text-sm focus:ring-2 ring-blue-500/20" 
                        placeholder="••••••••••••" 
                        value={loginForm.password} 
                        onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                        required
                      />
                      <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted hover:theme-text-main transition-colors">
                        {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-1">
                    <button type="button" onClick={() => setRememberMe(!rememberMe)} className={`w-10 h-5 rounded-full relative transition-all flex items-center p-1 ${rememberMe ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-black/40'}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-md transition-transform ${rememberMe ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                    <span className="text-[9px] font-black theme-text-muted uppercase tracking-widest opacity-70">Recordar</span>
                  </div>
                  {loginError && !isFastLoginOpen && <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 py-3 rounded-xl animate-shake border border-rose-500/20">{loginError}</p>}
                  <Button type="submit" className="w-full py-4 uppercase font-black tracking-[0.2em] text-[11px] bg-blue-600 shadow-xl shadow-blue-900/40 border border-blue-500/20 active:scale-[0.98]">Acceder</Button>
                </>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center space-y-3">
                    <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mx-auto mb-2 border border-blue-500/20 shadow-inner">
                      <ShieldCheck size={32} />
                    </div>
                    <h3 className="text-lg font-black theme-text-main uppercase tracking-tight">Verificación 2FA</h3>
                    <p className="text-[10px] theme-text-muted font-bold uppercase tracking-widest leading-relaxed px-2 opacity-80">
                      Ingrese el código de 6 dígitos de su aplicación.
                    </p>
                  </div>

                  <div className="relative" onClick={handleOtpCellClick}>
                    <input 
                      ref={otpInputRef}
                      type="tel" 
                      pattern="[0-9]*"
                      maxLength={6} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-default"
                      value={loginForm.otp} 
                      onChange={e => setLoginForm({...loginForm, otp: e.target.value.replace(/\D/g, '')})} 
                    />
                    <div className={`grid grid-cols-6 gap-2 ${otpStatus === 'error' ? 'animate-shake' : otpStatus === 'success' ? 'animate-success-pulse' : ''}`}>
                      {[...Array(6)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`aspect-[3/4] rounded-xl border-2 flex items-center justify-center text-2xl font-black transition-all duration-300 ${
                            loginForm.otp.length === i 
                              ? 'border-blue-500 bg-blue-600/10 shadow-[0_0_15px_rgba(37,99,235,0.25)] scale-110' 
                              : loginForm.otp.length > i 
                                ? 'border-blue-500/50 theme-bg-subtle theme-text-main' 
                                : 'theme-border theme-bg-subtle opacity-30'
                          } ${otpStatus === 'success' ? 'border-emerald-500 theme-text-main bg-emerald-500/10' : otpStatus === 'error' ? 'border-rose-500 text-rose-500 bg-rose-500/10' : ''}`}
                        >
                          {loginForm.otp[i] || ''}
                        </div>
                      ))}
                    </div>
                  </div>

                  {loginError && (
                    <p className="text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 py-3 rounded-xl border border-rose-500/20">{loginError}</p>
                  )}

                  <button 
                    type="button" 
                    onClick={() => { setLoginStep('credentials'); setLoginForm(prev => ({...prev, otp: ''})); setLoginError(''); setOtpStatus('idle'); }} 
                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black theme-text-muted uppercase tracking-widest hover:theme-text-main transition-colors py-2"
                  >
                    <ArrowLeft size={16} /> Regresar
                  </button>
                </div>
              )}
            </form>
          </GlassCard>
          
          <Modal isOpen={isFastLoginOpen} onClose={() => setIsFastLoginOpen(false)} title="ACCESO RÁPIDO">
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mb-3 shadow-inner">
                  <UserIcon size={32} />
                </div>
                <h4 className="text-xl font-black theme-text-main uppercase tracking-tighter">{lastUser?.username}</h4>
                <p className="text-[9px] font-black theme-text-muted uppercase tracking-[0.3em] mt-1 opacity-60">Sesión persistente</p>
                {loginError && <p className="mt-4 text-rose-500 text-[10px] font-black uppercase text-center bg-rose-500/10 py-2 px-4 rounded-xl animate-shake w-full border border-rose-500/20">{loginError}</p>}
              </div>
              
              {fastLoginView === 'options' ? (
                <div className="grid grid-cols-1 gap-3">
                   {lastUser?.settings?.biometricsEnabled && (
                     <button onClick={handleBiometricLogin} disabled={isBiometricChecking} className="w-full p-6 theme-bg-subtle rounded-3xl border theme-border flex items-center gap-4 hover:bg-blue-600/5 transition-all group active:scale-[0.98]">
                       <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-lg">
                         {isBiometricChecking ? <Loader2 className="animate-spin" size={24} /> : <Fingerprint size={24} />}
                       </div>
                       <div className="text-left">
                         <p className="text-[12px] font-black theme-text-main uppercase tracking-widest">Biometría</p>
                         <p className="text-[8px] font-bold theme-text-muted uppercase tracking-tight">Acceso inmediato</p>
                       </div>
                       <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transition-all text-blue-500 translate-x-[-10px] group-hover:translate-x-0" size={18} />
                     </button>
                   )}
                   {lastUser?.settings?.pinCode && (
                     <button onClick={() => setFastLoginView('pin')} className="w-full p-6 theme-bg-subtle rounded-3xl border theme-border flex items-center gap-4 hover:bg-emerald-600/5 transition-all group active:scale-[0.98]">
                       <div className="w-12 h-12 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-lg">
                         <Keyboard size={24} />
                       </div>
                       <div className="text-left">
                         <p className="text-[12px] font-black theme-text-main uppercase tracking-widest">Código PIN</p>
                         <p className="text-[8px] font-bold theme-text-muted uppercase tracking-tight">Teclado numérico</p>
                       </div>
                       <ArrowRight className="ml-auto opacity-0 group-hover:opacity-100 transition-all text-emerald-500 translate-x-[-10px] group-hover:translate-x-0" size={18} />
                     </button>
                   )}
                   <button onClick={() => handleForgetUser()} className="w-full py-4 mt-2 flex items-center justify-center gap-3 text-rose-500/60 hover:text-rose-500 transition-colors">
                     <UserMinus size={16} />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em]">Olvidar cuenta</span>
                   </button>
                </div>
              ) : (
                <div className="space-y-4 animate-in slide-in-from-right-4">
                  <button onClick={() => { setFastLoginView('options'); setLoginError(''); setPinInput(''); }} className="flex items-center gap-2 text-[10px] font-black theme-text-muted uppercase hover:text-blue-500 py-2"><ArrowLeft size={16} /> Volver</button>
                  <div className="text-center space-y-4">
                    <h2 className="text-xs font-black theme-text-main uppercase tracking-[0.3em]">Ingrese PIN</h2>
                    <div className="flex justify-center gap-4 py-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${pinInput.length > i ? 'bg-blue-600 border-blue-400 scale-125 shadow-[0_0_10px_rgba(37,99,235,0.6)]' : 'theme-border opacity-30'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 px-2">
                    {['1','2','3','4','5','6','7','8','9','','0'].map((num, i) => (
                      num === '' ? <div key={i} /> : (
                        <button key={num} onClick={() => handlePinInput(num)} className="w-full h-14 flex items-center justify-center theme-bg-subtle border theme-border rounded-xl text-xl font-black theme-text-main active:scale-90 transition-all hover:bg-blue-600/10">
                          {num}
                        </button>
                      )
                    ))}
                    <button onClick={() => { setPinInput(prev => prev.slice(0, -1)); setLoginError(''); }} className="w-full h-14 flex items-center justify-center text-rose-500 active:scale-90 bg-rose-500/5 rounded-xl border border-rose-500/20">
                      <Delete size={22} />
                    </button>
                  </div>
                </div>
              )}
              <button onClick={() => { setIsFastLoginOpen(false); if (lastUser) { setLoginForm(prev => ({ ...prev, username: lastUser.username })); } }} className="w-full py-4 text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] hover:theme-text-main transition-colors border-t theme-border mt-2">Usar contraseña</button>
            </div>
          </Modal>
        </div>
      ) : (
        <>
          <div className="md:hidden theme-bg-surface border-b theme-border p-4 flex items-center justify-between sticky top-0 z-[60]"><div className="flex items-center gap-3"><button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="theme-text-main p-2 rounded-xl">{isSidebarOpen ? <X /> : <Menu />}</button><div className="theme-text-main font-black uppercase text-xl">DriveFlow</div></div>{!isOnline ? <CloudOff size={16} className="text-rose-500" /> : syncQueue.length > 0 ? <Loader2 size={16} className="text-blue-500 animate-spin" /> : <CloudCheck size={16} className="text-emerald-500" />}</div>
          {isSidebarOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
          <aside className={`fixed inset-y-0 left-0 z-[70] w-72 theme-bg-surface border-r theme-border p-6 flex flex-col transition-transform duration-500 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <div className="flex items-center justify-between theme-text-main mb-12 px-2"><div className="text-2xl font-black uppercase tracking-tighter">DriveFlow</div><div className="relative group">{!isOnline ? <CloudOff className="w-5 h-5 text-rose-500" /> : syncQueue.length > 0 ? <Cloud className="w-5 h-5 text-blue-500 animate-pulse" /> : <CloudCheck className="w-5 h-5 text-emerald-500" />}</div></div>
            <nav className="space-y-1 flex-1 overflow-y-auto custom-scrollbar">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: HistoryIcon, role: 'all' },
                { id: 'incidents', label: 'Incidencias', icon: AlertTriangle, role: 'all' },
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
              }).map(item => (<button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-xl' : 'theme-text-muted hover:theme-text-main'}`}><item.icon size={18} /><span className="uppercase tracking-widest text-[9px] font-black">{item.label}</span></button>))}
            </nav>
            <div className="mt-auto pt-6 border-t theme-border">
              <div className="mb-4 p-2.5 theme-bg-subtle rounded-2xl border theme-border flex items-center justify-between shadow-sm relative group">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <UserIcon size={12} className="text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="theme-text-main font-black truncate text-[11px] uppercase leading-none">{currentUser.username}</p>
                    <span className="text-[7px] theme-text-muted font-black uppercase opacity-60 leading-none">{currentUser.role}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsNoteModalOpen(true)}
                  className="w-7 h-7 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-sm shrink-0 border border-blue-500/20 active:scale-90"
                  title="Nueva Nota"
                >
                  <StickyNote size={12} />
                </button>
              </div>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-5 py-3 rounded-xl text-rose-500 font-black uppercase text-[10px] hover:bg-rose-500/10 transition-colors"><LogOut size={16} /> Salir</button>
            </div>
          </aside>

          {/* Modal Crear Nota */}
          <Modal isOpen={isNoteModalOpen} onClose={() => setIsNoteModalOpen(false)} title="NUEVA NOTA">
            <div className="space-y-4 pb-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Título</label>
                  <input 
                    className="w-full glass-input rounded-xl px-4 py-3 outline-none font-bold text-xs" 
                    placeholder="Ej: Pendiente urgente..." 
                    value={newNote.title}
                    onChange={e => setNewNote({...newNote, title: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Contenido</label>
                  <textarea 
                    className="w-full glass-input rounded-xl px-4 py-3 outline-none font-bold text-xs min-h-[100px]" 
                    placeholder="¿Qué tienes en mente?" 
                    value={newNote.description}
                    onChange={e => setNewNote({...newNote, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={handleSaveQuickNote} variant="primary" className="w-full py-4 uppercase font-black bg-blue-600 shadow-xl shadow-blue-900/40">
                  <Save size={16} /> Crear nota
                </Button>
                <button 
                  onClick={() => { 
                    setIsNoteModalOpen(false); 
                    setActiveTab('notes'); 
                    setIsSidebarOpen(false); 
                  }}
                  className="text-[9px] font-black theme-text-muted uppercase hover:text-blue-500 transition-colors text-center tracking-[0.2em] py-2"
                >
                  Ver todas mis notas
                </button>
              </div>
            </div>
          </Modal>

          <main className="flex-1 p-4 md:p-10 max-w-[1400px] mx-auto w-full overflow-y-auto custom-scrollbar flex flex-col relative z-10">
            {!isOnline && (<div className="mb-6 theme-bg-subtle border border-rose-500/20 p-4 rounded-2xl flex items-center justify-center gap-4"><CloudOff className="text-rose-500" size={18} /><p className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center">Modo Offline - Datos locales protegidos</p></div>)}
            <div className="flex-1">
              {activeTab === 'dashboard' && <Dashboard currentUser={currentUser} stores={stores} drivers={drivers} history={history} users={users} />}
              {activeTab === 'incidents' && <Incidents currentUser={currentUser} stores={stores} drivers={drivers} incidents={incidents} onAddIncident={syncAddIncident} onUpdateIncident={syncUpdateIncident} onDeleteIncident={syncDeleteIncident} />}
              {activeTab === 'scanner' && <Scanner drivers={drivers} stores={stores} />}
              {activeTab === 'generator' && <RoleGenerator currentUser={currentUser} stores={stores} drivers={drivers} history={history} onPublish={syncPublishRole} />}
              {activeTab === 'drivers' && <DriverManagement currentUser={currentUser} drivers={drivers} stores={stores} history={history} onAdd={syncAddDriver} onUpdate={syncUpdateDriver} onDelete={syncDeleteDriver} />}
              {activeTab === 'history' && <History history={history} currentUser={currentUser} drivers={drivers} onUpdateRole={syncUpdateRole} onDeleteRole={syncDeleteRole} />}
              {activeTab === 'settings' && <Settings currentUser={currentUser} onUpdateUser={syncUpdateUser} onAccountDeleted={handleLogout} />}
              {activeTab === 'admin' && <Superadmin users={users} stores={stores} drivers={drivers} history={history} onAddStore={syncAddStore} onUpdateStore={syncUpdateStore} onDeleteStore={syncDeleteStore} onAddAdmin={(u) => { const newU = { ...u, id: `u_${Date.now()}` } as User; setUsers(prev => [...prev, newU]); if (isOnline) supabase.from('app_users').insert(newU); else enqueueAction('UPDATE_USER', newU); }} onUpdateAdmin={syncUpdateUser} onDeleteAdmin={syncDeleteUser} onClearHistory={() => { setHistory([]); enqueueAction('CLEAR_ROLES', null); }} />}
              {activeTab === 'notes' && <Notes notes={notes} currentUser={currentUser} onUpdateNote={syncUpdateNote} onDeleteNote={syncDeleteNote} onAddNote={syncAddNote} />}
            </div>
            <footer className="mt-12 py-6 border-t theme-border text-center"><p className="opacity-40 text-[9px] font-black theme-text-muted uppercase tracking-[0.1em]">DriveFlow - Por Lehabim Cruz</p></footer>
          </main>
        </>
      )}
    </div>
  );
};
