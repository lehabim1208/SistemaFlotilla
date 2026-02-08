
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info as InfoIcon } from 'lucide-react';

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`liquid-glass rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl ${className}`}>
    {children}
  </div>
);

export const Button: React.FC<{ 
  onClick?: () => void; 
  children: React.ReactNode; 
  variant?: 'primary' | 'danger' | 'success' | 'outline' | 'warning' | 'info';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}> = ({ onClick, children, variant = 'primary', className = "", type = 'button', disabled = false }) => {
  const variants = {
    /* Usar var(--primary) para que cambie según la configuración del usuario */
    primary: 'bg-[var(--primary)] hover:opacity-90 text-white shadow-lg shadow-[var(--primary-glow)]',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    info: 'bg-sky-500 hover:bg-sky-600 text-white',
    outline: 'theme-bg-subtle hover:bg-white/10 theme-text-main border theme-border'
  };
  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="liquid-glass w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar relative">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-black theme-text-main uppercase tracking-tighter">{title}</h3>
          <button onClick={onClose} className="theme-text-muted hover:theme-text-main p-2 transition-transform hover:scale-110"><X /></button>
        </div>
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
};

export const Toast: React.FC<{ 
  message: string; 
  type: 'success' | 'error' | 'info'; 
  onClose: () => void 
}> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-sky-600 text-white'
  };

  const Icon = type === 'success' ? CheckCircle : type === 'info' ? InfoIcon : AlertCircle;

  return (
    <div className="fixed bottom-6 right-6 z-[150] animate-in slide-in-from-right-10 duration-300">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-2xl border border-white/10 backdrop-blur-xl ${styles[type]}`}>
        <Icon size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">{message}</span>
        <button onClick={onClose} className="ml-1 hover:scale-110 transition-transform">
          <X size={12} />
        </button>
      </div>
    </div>
  );
};
