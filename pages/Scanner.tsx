
import React, { useState, useEffect, useRef } from 'react';
import { Camera, QrCode, ShieldCheck, XCircle, RefreshCw, AlertCircle, Loader2, Image as ImageIcon, ChevronDown, ChevronUp, Landmark, Clock, Store as StoreIcon, ShieldAlert } from 'lucide-react';
import { GlassCard, Button, Modal } from '../components/UI';
import { Driver, Store } from '../types';

interface ScannerProps {
  drivers: Driver[];
  stores: Store[];
}

export const Scanner: React.FC<ScannerProps> = ({ drivers = [], stores = [] }) => {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<Driver | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationTime, setValidationTime] = useState<string>('');
  const [showMore, setShowMore] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [jsQR, setJsQR] = useState<any>(null);

  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    const loadScannerEngine = async () => {
      try {
        const mod = await import('https://esm.sh/jsqr@1.4.0');
        setJsQR(() => mod.default);
      } catch (err) {
        console.error("Error loading jsQR:", err);
        setError("No se pudo inicializar el motor de escaneo.");
      }
    };

    loadScannerEngine();
    
    const timer = setInterval(() => {
      const now = new Date();
      setValidationTime(now.toLocaleString('es-MX', { 
        hour12: false, day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      }));
    }, 1000);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const calculateCofeprisStatus = (dateStr: string) => {
    if (!dateStr) return 'No registrado';
    const exp = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = exp.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    if (days < 0) return 'Vencido';
    if (days <= 30) return 'Vence pronto';
    return 'Vigente';
  };

  const getCofeprisBadgeStyles = (status: string) => {
    switch (status) {
      case 'Vigente': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Vence pronto': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Vencido': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const formatMonthYear = (dateStr?: string) => {
    if (!dateStr) return 'S/F';
    const parts = dateStr.split('-');
    if (parts.length < 2) return 'S/F';
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  };

  const handleProcessImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!jsQR) {
      setError("Inicializando motor...");
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);
    setShowMore(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setError("Procesador gráfico ocupado.");
          setProcessing(false);
          return;
        }

        const maxDim = 1024;
        let scale = 1;
        if (img.width > maxDim || img.height > maxDim) scale = maxDim / Math.max(img.width, img.height);

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });

          if (code && code.data) {
            const scannedData = code.data.trim();
            const found = (drivers || []).find(d => 
              d.qrCodeKey === scannedData || d.id === scannedData || `SG-ID-${d.id}` === scannedData || `SG-DRV-${d.id}` === scannedData
            );
            if (found) setResult(found);
            else setError("GAFETE NO RECONOCIDO.");
          } else {
            setError("NO SE ENCONTRÓ QR.");
          }
        } catch (err) {
          setError("ERROR DE ANÁLISIS.");
        }
        setProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const getStoreNames = (ids: string[]) => ids.map(id => stores.find(s => s.id === id)?.name || id).join(', ');

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-4xl font-black theme-text-main uppercase tracking-tighter leading-none">Validación</h2>
        <p className="theme-text-muted text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">SmartGo en tiempo real</p>
      </header>

      <div className="max-w-2xl mx-auto py-8">
        <GlassCard className="p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-10 border-dashed border-2 theme-border">
          <div className={`w-32 h-32 rounded-[3rem] flex items-center justify-center border-2 transition-all duration-700 shadow-2xl ${processing ? 'bg-indigo-600/30 border-indigo-500 animate-pulse scale-110' : 'theme-bg-subtle border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.15)] animate-qr-pulse'}`}>
            {processing ? <Loader2 className="text-indigo-400 w-12 h-12 animate-spin" /> : <QrCode className="text-blue-400 w-12 h-12" />}
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-black theme-text-main uppercase">{processing ? 'Verificando...' : 'Validar Gafete'}</h3>
            <p className="theme-text-muted text-[10px] max-w-sm mx-auto font-black uppercase tracking-widest leading-relaxed">Escanee el código institucional para confirmar vigencia y accesos.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
            <Button onClick={() => cameraInputRef.current?.click()} disabled={processing || !jsQR} className="flex-1 py-5 uppercase font-black tracking-widest text-[9px] bg-blue-600 shadow-xl shadow-blue-900/40"><Camera size={18} /> CÁMARA</Button>
            <Button onClick={() => galleryInputRef.current?.click()} disabled={processing || !jsQR} variant="outline" className="flex-1 py-5 uppercase font-black tracking-widest text-[9px]"><ImageIcon size={18} /> GALERÍA</Button>
          </div>
          <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleProcessImage} />
          <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleProcessImage} />
        </GlassCard>
      </div>

      <Modal isOpen={!!error} onClose={() => setError(null)} title="ATENCIÓN">
        <div className="text-center space-y-6 p-4">
          <div className="w-16 h-16 bg-rose-500/10 rounded-full mx-auto flex items-center justify-center border border-rose-500/20"><XCircle className="w-8 h-8 text-rose-500" /></div>
          <p className="theme-text-main text-sm font-black uppercase tracking-tight">{error}</p>
          <Button variant="danger" className="w-full py-4 uppercase font-black text-[10px]" onClick={() => setError(null)}>Reintentar</Button>
        </div>
      </Modal>

      <Modal isOpen={!!result} onClose={() => { setResult(null); setShowMore(false); }} title="CERTIFICADO">
        {result && (
          <div className={`relative space-y-6 pt-4 transition-all duration-500 ${!isWindowFocused ? 'blur-3xl' : ''}`}>
            <div className="flex flex-col items-center text-center">
              <div className={`w-32 h-32 rounded-[2.5rem] border-4 overflow-hidden mb-6 theme-bg-subtle shadow-2xl ${result.isActive ? 'border-emerald-500' : 'border-rose-500'}`}>
                {result.photoUrl ? <img src={result.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl font-black theme-text-muted opacity-10 uppercase">{result.fullName?.charAt(0)}</div>}
              </div>
              <h3 className="text-2xl font-black theme-text-main uppercase mb-1">{result.fullName}</h3>
              <div className="flex flex-col items-center gap-2 mt-2">
                <p className="text-blue-500 font-mono font-black tracking-widest text-[9px] bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">{result.teamCode}</p>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${getCofeprisBadgeStyles(calculateCofeprisStatus(result.cofepris_expiration || ''))}`}>
                  <ShieldCheck size={10} />
                  <span className="text-[8px] font-black uppercase tracking-widest">Cofepris: {calculateCofeprisStatus(result.cofepris_expiration || '').toUpperCase()}</span>
                </div>
              </div>
              <div className={`w-full mt-6 py-4 rounded-2xl flex items-center justify-center gap-3 border-2 ${result.isActive ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-600' : 'bg-rose-600/10 border-rose-500/20 text-rose-600'}`}>
                {result.isActive ? <ShieldCheck className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                <p className="text-sm font-black uppercase">{result.isActive ? 'ACTIVO' : 'BLOQUEADO'}</p>
              </div>
            </div>
            <div className="space-y-3">
               <button onClick={() => setShowMore(!showMore)} className="w-full py-3 theme-bg-subtle border theme-border rounded-xl text-[9px] font-black uppercase text-blue-500">{showMore ? 'Ocultar' : 'Ver Detalles'}</button>
               {showMore && (
                 <div className="space-y-2 animate-in slide-in-from-top-2">
                    <div className="p-3 theme-bg-subtle rounded-xl border theme-border"><p className="text-[7px] font-black theme-text-muted uppercase">CURP</p><p className="text-[10px] font-mono theme-text-main">{result.curp || '---'}</p></div>
                    <div className="p-3 theme-bg-subtle rounded-xl border theme-border"><p className="text-[7px] font-black theme-text-muted uppercase">Sedes</p><p className="text-[10px] font-black theme-text-main uppercase">{getStoreNames(result.assignedStoreIds || [])}</p></div>
                 </div>
               )}
            </div>
            <Button onClick={() => { setResult(null); setShowMore(false); }} className="w-full py-5 font-black uppercase text-[10px] bg-blue-600">Cerrar</Button>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes qr-pulse { 0% { transform: scale(1); } 70% { transform: scale(1.05); } 100% { transform: scale(1); } }
        .animate-qr-pulse { animation: qr-pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1); }
      `}</style>
    </div>
  );
};
