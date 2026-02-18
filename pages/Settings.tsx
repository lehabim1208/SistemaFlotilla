
import React, { useState, useEffect } from 'react';
import { Shield, Sun, Moon, ShieldAlert, Eye, EyeOff, Lock, Fingerprint, Keyboard, Trash2, Bell, BellOff, ArrowLeft, Key, Delete, AlertTriangle, ShieldCheck, CheckCircle, Copy, Check } from 'lucide-react';
import { GlassCard, Button, Toast, Modal } from '../components/UI';
import { User, UserSettings, UserRole } from '../types';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

interface SettingsProps {
  currentUser: User;
  onUpdateUser: (user: User) => void;
  onAccountDeleted: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser, onUpdateUser, onAccountDeleted }) => {
  const [settings, setSettings] = useState<UserSettings>(currentUser.settings || {
    themeColor: 'indigo',
    darkMode: true,
    timezone: 'auto',
    autoDateTime: true,
    fontFamily: 'Inter',
    biometricsEnabled: false,
    notificationsEnabled: true
  });

  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [isChangingPwd, setIsChangingPwd] = useState(false);
  const [pwdForm, setPwdForm] = useState({ old: '', new: '' });
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const [isSettingPin, setIsSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');

  const [deleteModalStep, setDeleteModalStep] = useState<0 | 1 | 2 | 3>(0);
  const [deletePhraseInput, setDeletePhraseInput] = useState('');
  const [deleteProgress, setDeleteProgress] = useState(100);

  const requiredDeletePhrase = "CONFIRMO ELIMINAR MI CUENTA";

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings, themeColor: 'indigo' as const, fontFamily: 'Inter' as const };
    setSettings(updated);
    onUpdateUser({ ...currentUser, settings: updated });
  };

  const handleToggleNotifications = async () => {
    const targetState = !settings.notificationsEnabled;
    if (targetState) {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setToast({ message: 'El navegador bloqueó las notificaciones. Actívelas manualmente.', type: 'error' });
                return;
            }
        }
    }
    handleUpdateSettings({ notificationsEnabled: targetState });
    setToast({ message: targetState ? 'Notificaciones activadas.' : 'Notificaciones silenciadas.', type: 'success' });
  };

  const handleToggleBiometrics = async () => {
    const targetState = !settings.biometricsEnabled;
    if (targetState) {
      if (!window.PublicKeyCredential) {
        setToast({ message: 'Su dispositivo no soporta biometría web.', type: 'error' });
        return;
      }
      try {
        await new Promise(r => setTimeout(r, 1000));
        handleUpdateSettings({ biometricsEnabled: true });
        setToast({ message: 'Acceso biométrico activado.', type: 'success' });
      } catch (err) {
        setToast({ message: 'Se canceló la activación.', type: 'error' });
      }
    } else {
      handleUpdateSettings({ biometricsEnabled: false });
      setToast({ message: 'Biometría desactivada.', type: 'success' });
    }
  };

  const handleSavePin = () => {
    if (newPin.length !== 4) {
      setToast({ message: 'El PIN debe ser de 4 números', type: 'error' });
      return;
    }
    handleUpdateSettings({ pinCode: newPin });
    setIsSettingPin(false);
    setNewPin('');
    setToast({ message: 'PIN guardado correctamente', type: 'success' });
  };

  const removePin = () => {
    handleUpdateSettings({ pinCode: undefined });
    setToast({ message: 'PIN eliminado', type: 'success' });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.old !== currentUser.password) {
      setToast({ message: 'Contraseña actual incorrecta', type: 'error' });
      return;
    }
    onUpdateUser({ ...currentUser, password: pwdForm.new });
    setIsChangingPwd(false);
    setPwdForm({ old: '', new: '' });
    setToast({ message: 'Contraseña actualizada', type: 'success' });
  };

  const startEnable2FA = async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const secretStr = secret.base32;
    setTempSecret(secretStr);
    const totp = new OTPAuth.TOTP({
      issuer: 'DriveFlow',
      label: currentUser.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secretStr
    });
    try {
      const url = await QRCode.toDataURL(totp.toString());
      setQrCodeUrl(url);
      setIsEnabling2FA(true);
    } catch (err) {
      setToast({ message: 'Error al generar QR', type: 'error' });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(tempSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setToast({ message: 'Clave secreta copiada al portapapeles', type: 'info' });
  };

  const verifyAndEnable2FA = () => {
    const totp = new OTPAuth.TOTP({ secret: tempSecret, algorithm: 'SHA1', digits: 6, period: 30 });
    if (totp.validate({ token: verificationCode, window: 1 }) !== null) {
      onUpdateUser({ ...currentUser, isTwoFactorEnabled: true, twoFactorSecret: tempSecret });
      setIsEnabling2FA(false);
      setVerificationCode('');
      setToast({ message: '2FA activado', type: 'success' });
    } else {
      setToast({ message: 'Código inválido', type: 'error' });
    }
  };

  const confirmAccountDeletion = () => {
    onUpdateUser({ ...currentUser, isDeleted: true });
    setDeleteModalStep(3);
  };

  useEffect(() => {
    if (deleteModalStep === 3) {
      const duration = 10000;
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        setDeleteProgress(Math.max(0, 100 - (elapsed / duration) * 100));
        if (elapsed >= duration) {
          clearInterval(interval);
          onAccountDeleted();
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [deleteModalStep]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <header>
        <h2 className="text-3xl font-black theme-text-main uppercase tracking-tighter">Configuración</h2>
        <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.3em]">Personalización y Seguridad del Núcleo</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard className="p-8 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Sun className="text-blue-500" size={20} />
              <h3 className="text-sm font-black theme-text-main uppercase">Apariencia</h3>
            </div>
            
            <div className="flex items-center justify-between p-6 theme-bg-subtle rounded-3xl border theme-border shadow-sm">
              <div className="flex items-center gap-3">
                {settings.darkMode ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-amber-500" />}
                <div className="flex flex-col">
                  <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">Modo Oscuro</span>
                  <span className="text-[8px] font-bold theme-text-muted uppercase tracking-tighter">{settings.darkMode ? 'Activado' : 'Desactivado'}</span>
                </div>
              </div>
              <button 
                onClick={() => handleUpdateSettings({ darkMode: !settings.darkMode })} 
                className={`w-14 h-7 rounded-full transition-all relative ${settings.darkMode ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${settings.darkMode ? 'left-8' : 'left-1'}`} />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-6">
              <Bell className="text-blue-500" size={20} />
              <h3 className="text-sm font-black theme-text-main uppercase">Notificaciones</h3>
            </div>
            
            <div className="flex items-center justify-between p-6 theme-bg-subtle rounded-3xl border theme-border shadow-sm">
              <div className="flex items-center gap-3">
                {settings.notificationsEnabled ? <Bell size={20} className="text-blue-400" /> : <BellOff size={20} className="text-slate-500" />}
                <div className="flex flex-col">
                  <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">Alertas Críticas</span>
                  <span className="text-[8px] font-bold theme-text-muted uppercase tracking-tighter">{settings.notificationsEnabled ? 'Recibiendo' : 'Silenciadas'}</span>
                </div>
              </div>
              <button 
                onClick={handleToggleNotifications} 
                className={`w-14 h-7 rounded-full transition-all relative ${settings.notificationsEnabled ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all ${settings.notificationsEnabled ? 'left-8' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="text-emerald-500" size={20} />
            <h3 className="text-sm font-black theme-text-main uppercase">Seguridad de Acceso</h3>
          </div>
          
          <div className="space-y-3">
             <div className="flex items-center justify-between p-4 theme-bg-subtle rounded-2xl border theme-border shadow-sm">
              <div className="flex items-center gap-3">
                <Fingerprint size={20} className={settings.biometricsEnabled ? 'text-blue-500' : 'theme-text-muted'} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">Acceso Biométrico</span>
                  <span className="text-[7px] font-bold theme-text-muted uppercase">{settings.biometricsEnabled ? 'Activado' : 'Desactivado'}</span>
                </div>
              </div>
              <button onClick={handleToggleBiometrics} className={`w-12 h-6 rounded-full transition-all relative ${settings.biometricsEnabled ? 'bg-blue-600' : 'bg-black/20'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.biometricsEnabled ? 'left-7' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 theme-bg-subtle rounded-2xl border theme-border shadow-sm">
              <div className="flex items-center gap-3">
                <Keyboard size={20} className={settings.pinCode ? 'text-emerald-500' : 'theme-text-muted'} />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">PIN de Desbloqueo</span>
                  <span className="text-[7px] font-bold theme-text-muted uppercase">{settings.pinCode ? 'Configurado' : 'Sin configurar'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {settings.pinCode && (
                  <button onClick={removePin} className="p-2 text-rose-500 bg-rose-500/10 rounded-lg"><Trash2 size={14} /></button>
                )}
                <button onClick={() => { setNewPin(''); setIsSettingPin(true); }} className="p-2 text-blue-500 bg-blue-500/10 rounded-lg"><Key size={14} /></button>
              </div>
            </div>

             <Button onClick={() => setIsChangingPwd(true)} variant="outline" className="w-full py-4 text-[9px] font-black uppercase tracking-widest border-blue-500/20 text-blue-500">
               <Lock size={14} /> Cambiar Contraseña
             </Button>

             {!currentUser.isTwoFactorEnabled && !isEnabling2FA ? (
              <Button onClick={startEnable2FA} className="w-full py-4 text-[9px] font-black uppercase tracking-widest bg-blue-600 shadow-xl shadow-blue-900/40">Activar 2FA (Google/MS)</Button>
            ) : isEnabling2FA ? (
              <div className="space-y-6 text-center p-6 theme-bg-subtle rounded-3xl border border-blue-500/30 animate-in slide-in-from-top-4 shadow-2xl">
                <div className="space-y-2">
                   <h4 className="text-[10px] font-black uppercase tracking-widest theme-text-main">Paso 1: Escanea el QR</h4>
                   <div className="bg-white p-4 rounded-[2rem] inline-block shadow-2xl mx-auto border-4 border-white/10">
                     <img src={qrCodeUrl} className="w-32 h-32" alt="QR" />
                   </div>
                </div>

                <div className="space-y-3">
                   <h4 className="text-[10px] font-black uppercase tracking-widest theme-text-main">Ó Configuración Manual</h4>
                   <div className="flex items-center gap-2 bg-black/20 p-4 rounded-2xl border theme-border">
                      <code className="flex-1 font-mono text-[11px] font-black text-blue-400 truncate tracking-widest">{tempSecret}</code>
                      <button 
                        onClick={copyToClipboard}
                        className={`p-2.5 rounded-xl transition-all ${copied ? 'bg-emerald-500 text-white shadow-lg' : 'theme-bg-surface theme-text-main hover:bg-blue-600 hover:text-white border theme-border'}`}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                   </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest theme-text-main">Paso 2: Verifica el Token</h4>
                  <input maxLength={6} placeholder="000000" className="w-full glass-input rounded-2xl px-4 py-4 text-center font-black text-2xl tracking-[0.5em] outline-none border-blue-500/50 shadow-inner" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} />
                </div>

                <div className="flex gap-3"><Button onClick={() => setIsEnabling2FA(false)} variant="outline" className="flex-1 text-[9px] py-4">Cancelar</Button><Button onClick={verifyAndEnable2FA} variant="success" className="flex-1 text-[9px] py-4 font-black shadow-emerald-900/40 shadow-xl">Confirmar</Button></div>
              </div>
            ) : (
              <div className="p-6 theme-bg-subtle rounded-3xl border border-emerald-500/20 text-center space-y-4">
                <CheckCircle className="text-emerald-500 w-10 h-10 mx-auto" />
                <p className="text-[10px] font-black theme-text-main uppercase">Seguridad 2FA Activa</p>
                <Button onClick={() => onUpdateUser({...currentUser, isTwoFactorEnabled: false})} variant="outline" className="w-full text-rose-500 border-rose-500/20 text-[9px]">Desactivar 2FA</Button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-8 border-rose-500/20 bg-rose-500/[0.02]">
        <div className="flex items-center gap-3 mb-8">
          <ShieldAlert className="text-rose-500" size={20} />
          <h3 className="text-sm font-black text-rose-500 uppercase">Zona Crítica</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" className="py-4 text-rose-500 text-[9px] font-black uppercase tracking-widest hover:bg-rose-500/10 transition-colors">Cerrar Sesiones Activas</Button>
          {currentUser.role !== UserRole.SUPERADMIN && (
            <Button onClick={() => setDeleteModalStep(1)} variant="danger" className="py-4 text-[9px] font-black uppercase tracking-widest shadow-xl shadow-rose-900/40">Eliminar Cuenta</Button>
          )}
        </div>
      </GlassCard>

      <Modal isOpen={isSettingPin} onClose={() => setIsSettingPin(false)} title="NUEVO PIN">
        <div className="space-y-4 py-1">
           <div className="text-center space-y-3">
              <p className="text-[8px] font-black theme-text-muted uppercase tracking-widest px-4 leading-tight opacity-70">Define tu código de seguridad de 4 dígitos para acceso rápido.</p>
              <div className="flex justify-center gap-3 py-2">
                 {[...Array(4)].map((_, i) => (
                   <div key={i} className={`w-8 h-10 rounded-xl border-2 flex items-center justify-center text-lg font-black transition-all ${newPin.length > i ? 'border-blue-500 bg-blue-600/10 theme-text-main shadow-md scale-110' : 'theme-border theme-text-muted opacity-40'}`}>
                      {newPin[i] ? '•' : ''}
                   </div>
                 ))}
              </div>
           </div>
           <div className="grid grid-cols-3 gap-2 px-2">
              {['1','2','3','4','5','6','7','8','9','','0','DEL'].map((num, i) => (
                num === '' ? <div key={i} /> : (
                  <button key={num} type="button" onClick={() => { if (num === 'DEL') setNewPin(prev => prev.slice(0, -1)); else if (newPin.length < 4) setNewPin(prev => prev + num); }} className={`w-full h-12 rounded-xl flex items-center justify-center font-black text-lg transition-all active:scale-90 ${num === 'DEL' ? 'text-rose-500 theme-bg-subtle' : 'theme-text-main theme-bg-subtle border theme-border hover:border-blue-500/50'}`}>
                    {num === 'DEL' ? <Delete size={18} /> : num}
                  </button>
                )
              ))}
           </div>
           <Button disabled={newPin.length !== 4} onClick={handleSavePin} variant="success" className="w-full py-4 uppercase font-black shadow-lg text-[9px] tracking-widest">Establecer PIN</Button>
        </div>
      </Modal>

      <Modal isOpen={isChangingPwd} onClose={() => { setIsChangingPwd(false); setPwdForm({old:'', new:''}); }} title="CAMBIAR CONTRASEÑA">
         <form onSubmit={handlePasswordChange} className="space-y-6 py-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black theme-text-muted uppercase tracking-widest px-1">Contraseña Actual</label>
              <div className="relative">
                <input type={showOldPwd ? "text" : "password"} className="w-full glass-input rounded-xl px-5 py-4 outline-none font-bold pr-12 text-sm" placeholder="***********" value={pwdForm.old} onChange={e => setPwdForm({...pwdForm, old: e.target.value})} required />
                <button type="button" onClick={() => setShowOldPwd(!showOldPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showOldPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black theme-text-muted uppercase tracking-widest px-1">Nueva Contraseña</label>
              <div className="relative">
                <input type={showNewPwd ? "text" : "password"} className="w-full glass-input rounded-xl px-5 py-4 outline-none font-bold pr-12 text-sm" placeholder="***********" value={pwdForm.new} onChange={e => setPwdForm({...pwdForm, new: e.target.value})} required />
                <button type="button" onClick={() => setShowNewPwd(!showNewPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showNewPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <Button type="submit" className="w-full py-5 uppercase font-black tracking-widest text-[10px] bg-blue-600 shadow-xl shadow-blue-900/40">Actualizar Contraseña</Button>
         </form>
      </Modal>

      <Modal isOpen={deleteModalStep > 0} onClose={() => deleteModalStep !== 3 && setDeleteModalStep(0)} title={deleteModalStep === 3 ? "Cuenta Eliminada" : "Confirmación Crítica"}>
        {deleteModalStep === 1 && (
          <div className="text-center space-y-6">
            <AlertTriangle className="text-rose-500 w-12 h-12 mx-auto" />
            <p className="text-[10px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest px-4">Esta acción es irreversible. Al confirmar, perderás acceso inmediato y tus datos serán marcados para eliminación.</p>
            <div className="flex gap-3"><Button onClick={() => setDeleteModalStep(0)} variant="outline" className="flex-1 py-4 text-[10px]">Cancelar</Button><Button onClick={() => setDeleteModalStep(2)} variant="danger" className="flex-1 py-4 text-[10px]">Continuar</Button></div>
          </div>
        )}
        {deleteModalStep === 2 && (
          <div className="space-y-6">
            <p className="text-[9px] font-bold text-amber-500 uppercase text-center">Escribe la frase para confirmar:</p>
            <p className="text-[11px] font-black text-rose-500 uppercase text-center font-mono py-3 bg-rose-500/5 rounded-2xl border border-rose-500/10">{requiredDeletePhrase}</p>
            <input className="w-full glass-input rounded-2xl px-6 py-4 outline-none font-bold text-center uppercase" value={deletePhraseInput} onChange={(e) => setDeletePhraseInput(e.target.value)} />
            <Button disabled={deletePhraseInput.toUpperCase() !== requiredDeletePhrase} onClick={confirmAccountDeletion} variant="danger" className="w-full py-5 text-[10px] uppercase font-black tracking-widest shadow-xl shadow-rose-900/40">Confirmar Eliminación</Button>
          </div>
        )}
        {deleteModalStep === 3 && (
          <div className="text-center space-y-8 py-6">
            <ShieldAlert className="text-rose-500 w-12 h-12 mx-auto animate-pulse" />
            <p className="text-[10px] theme-text-muted font-bold uppercase tracking-widest px-8">Cuenta eliminada. Tienes <span className="text-blue-500 font-black">30 días</span> para solicitar la restauración.</p>
            <div className="w-full h-2 theme-bg-subtle rounded-full overflow-hidden shadow-inner"><div className="h-full bg-rose-500 transition-all duration-75" style={{ width: `${deleteProgress}%` }} /></div>
          </div>
        )}
      </Modal>

      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
      `}</style>
    </div>
  );
};
