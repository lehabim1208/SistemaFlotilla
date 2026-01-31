
import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, Key, CheckCircle, XCircle, Copy, RefreshCw, Moon, Sun, Palette, Globe, Clock, ShieldAlert, AlertTriangle, Info, Type } from 'lucide-react';
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
    fontFamily: 'Inter'
  });

  const [isEnabling2FA, setIsEnabling2FA] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [deleteModalStep, setDeleteModalStep] = useState<0 | 1 | 2 | 3>(0);
  const [deletePhraseInput, setDeletePhraseInput] = useState('');
  const [deleteProgress, setDeleteProgress] = useState(100);

  const requiredDeletePhrase = "CONFIRMO ELIMINAR MI CUENTA";

  const themeColors: ('indigo' | 'emerald' | 'rose' | 'amber' | 'violet')[] = ['indigo', 'emerald', 'rose', 'amber', 'violet'];
  const fontFamilies: ('Inter' | 'Roboto' | 'Outfit' | 'Montserrat')[] = ['Inter', 'Roboto', 'Outfit', 'Montserrat'];

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    onUpdateUser({ ...currentUser, settings: updated });
  };

  const startEnable2FA = async () => {
    const secret = new OTPAuth.Secret({ size: 20 });
    const secretStr = secret.base32;
    setTempSecret(secretStr);
    const totp = new OTPAuth.TOTP({
      issuer: 'DriversRol',
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

  const verifyAndEnable2FA = () => {
    if (!tempSecret) return;
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
    <div className="space-y-8 max-w-4xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <header>
        <h2 className="text-3xl font-black theme-text-main uppercase tracking-tighter">Configuración</h2>
        <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.3em]">Personalización y Seguridad</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <GlassCard className="p-8 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-6"><Palette className="text-[var(--primary)]" size={20} /><h3 className="text-sm font-black theme-text-main uppercase">Apariencia</h3></div>
            <p className="text-[9px] font-black theme-text-muted uppercase tracking-widest mb-3">Color de énfasis</p>
            <div className="flex gap-3 mb-8">
              {themeColors.map(color => (
                <button key={color} onClick={() => handleUpdateSettings({ themeColor: color })} className={`w-10 h-10 rounded-full transition-all border-4 ${settings.themeColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40'} ${color === 'indigo' ? 'bg-blue-600' : color === 'emerald' ? 'bg-emerald-600' : color === 'rose' ? 'bg-rose-600' : color === 'amber' ? 'bg-amber-500' : 'bg-violet-600'}`} />
              ))}
            </div>

            <p className="text-[9px] font-black theme-text-muted uppercase tracking-widest mb-3">Tipografía del Sistema</p>
            <div className="grid grid-cols-2 gap-2 mb-8">
              {fontFamilies.map(font => (
                <button 
                  key={font} 
                  onClick={() => handleUpdateSettings({ fontFamily: font })} 
                  style={{ fontFamily: `"${font}", sans-serif` }}
                  className={`px-4 py-3 rounded-xl border text-[11px] font-bold transition-all ${
                    settings.fontFamily === font 
                    ? 'bg-white/10 border-white text-white shadow-lg' 
                    : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'
                  }`}
                >
                  {font}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between p-4 theme-bg-subtle rounded-2xl border theme-border">
              <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">Modo Oscuro</span>
              <button onClick={() => handleUpdateSettings({ darkMode: !settings.darkMode })} className={`w-12 h-6 rounded-full transition-all relative ${settings.darkMode ? 'bg-blue-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.darkMode ? 'left-7' : 'left-1'}`} /></button>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2"><Shield className="text-emerald-500" size={20} /><h3 className="text-sm font-black theme-text-main uppercase">Seguridad 2FA</h3></div>
          {!currentUser.isTwoFactorEnabled && !isEnabling2FA ? (
            <Button onClick={startEnable2FA} className="w-full py-4 text-[9px] font-black uppercase tracking-widest">Activar Doble Factor</Button>
          ) : isEnabling2FA ? (
            <div className="space-y-4 text-center">
              <img src={qrCodeUrl} className="w-32 h-32 mx-auto bg-white p-2 rounded-xl" alt="QR" />
              <input maxLength={6} placeholder="000000" className="w-full glass-input rounded-xl px-4 py-3 text-center font-black text-xl tracking-[0.5em]" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} />
              <div className="flex gap-2"><Button onClick={() => setIsEnabling2FA(false)} variant="outline" className="flex-1 text-[9px]">Cancelar</Button><Button onClick={verifyAndEnable2FA} variant="success" className="flex-1 text-[9px]">Confirmar</Button></div>
            </div>
          ) : <Button onClick={() => onUpdateUser({...currentUser, isTwoFactorEnabled: false})} variant="outline" className="w-full text-rose-500 text-[9px]">Desactivar 2FA</Button>}
        </GlassCard>
      </div>

      <GlassCard className="p-8 border-rose-500/20 bg-rose-500/[0.02]">
        <div className="flex items-center gap-3 mb-8"><ShieldAlert className="text-rose-500" size={20} /><h3 className="text-sm font-black text-rose-500 uppercase">Zona Crítica</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button variant="outline" className="py-4 text-rose-500 text-[9px] font-black uppercase tracking-widest">Cerrar Sesiones</Button>
          {currentUser.role !== UserRole.SUPERADMIN && (
            <Button onClick={() => setDeleteModalStep(1)} variant="danger" className="py-4 text-[9px] font-black uppercase tracking-widest shadow-xl shadow-rose-900/40">Eliminar Cuenta</Button>
          )}
        </div>
      </GlassCard>

      <Modal isOpen={deleteModalStep > 0} onClose={() => deleteModalStep !== 3 && setDeleteModalStep(0)} title={deleteModalStep === 3 ? "Cuenta Eliminada" : "Confirmación"}>
        {deleteModalStep === 1 && (
          <div className="text-center space-y-6">
            <AlertTriangle className="text-rose-500 w-12 h-12 mx-auto" />
            <p className="text-[10px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest px-4">Esta acción es irreversible. Al confirmar, perderás acceso inmediato.</p>
            <div className="flex gap-3"><Button onClick={() => setDeleteModalStep(0)} variant="outline" className="flex-1 py-4 text-[10px]">Cancelar</Button><Button onClick={() => setDeleteModalStep(2)} variant="danger" className="flex-1 py-4 text-[10px]">Confirmar</Button></div>
          </div>
        )}
        {deleteModalStep === 2 && (
          <div className="space-y-6">
            <p className="text-[9px] font-bold text-amber-500 uppercase text-center">Escribe la frase para confirmar:</p>
            <p className="text-[11px] font-black text-rose-500 uppercase text-center font-mono py-2 bg-rose-500/5 rounded-lg">{requiredDeletePhrase}</p>
            <input className="w-full glass-input rounded-2xl px-6 py-4 outline-none font-bold" value={deletePhraseInput} onChange={(e) => setDeletePhraseInput(e.target.value)} />
            <Button disabled={deletePhraseInput !== requiredDeletePhrase} onClick={confirmAccountDeletion} variant="danger" className="w-full py-4 text-[10px] uppercase font-black">Eliminar mi cuenta</Button>
          </div>
        )}
        {deleteModalStep === 3 && (
          <div className="text-center space-y-8 py-6">
            <ShieldAlert className="text-rose-500 w-12 h-12 mx-auto animate-pulse" />
            <p className="text-[10px] theme-text-muted font-bold uppercase tracking-widest px-8">Cuenta eliminada. Tienes <span className="text-blue-500">30 días</span> para restaurarla con un super administrador.</p>
            <div className="w-full h-1.5 theme-bg-subtle rounded-full overflow-hidden"><div className="h-full bg-rose-500 transition-all duration-75" style={{ width: `${deleteProgress}%` }} /></div>
            <p className="text-[8px] font-black theme-text-muted uppercase">Saliendo en 10 seg...</p>
          </div>
        )}
      </Modal>
    </div>
  );
};
