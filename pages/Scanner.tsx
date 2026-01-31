
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
        hour12: false, 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }));
    }, 1000);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const handleProcessImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!jsQR) {
      setError("El sistema de escaneo se está inicializando. Por favor espera.");
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
          setError("Error en el procesador gráfico del dispositivo.");
          setProcessing(false);
          return;
        }

        const maxDim = 1024;
        let scale = 1;
        if (img.width > maxDim || img.height > maxDim) {
          scale = maxDim / Math.max(img.width, img.height);
        }

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            const scannedData = code.data.trim();
            
            // Lógica de búsqueda ESTRICTA para evitar colisiones de ID
            // Comparamos únicamente valores exactos
            const found = (drivers || []).find(d => 
              d.qrCodeKey === scannedData || 
              d.id === scannedData || 
              `SG-ID-${d.id}` === scannedData ||
              `SG-DRV-${d.id}` === scannedData
            );
            
            if (found) {
              setResult(found);
            } else {
              setError("GAFETE NO RECONOCIDO O NO REGISTRADO EN LA FLOTA.");
            }
          } else {
            setError("NO SE ENCONTRÓ NINGÚN CÓDIGO QR. INTENTA CON OTRA IMAGEN O MEJORA LA ILUMINACIÓN.");
          }
        } catch (err) {
          console.error("QR Analysis error:", err);
          setError("FALLO AL ANALIZAR LOS DATOS DEL GAFETE.");
        }
        setProcessing(false);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
      };
      img.onerror = () => {
        setError("ERROR AL CARGAR LA IMAGEN.");
        setProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const getStoreNames = (ids: string[]) => {
    return ids.map(id => stores.find(s => s.id === id)?.name || id).join(', ');
  };

  const securityOverlayStyles = {
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
    KhtmlUserSelect: 'none',
    MozUserSelect: 'none',
    msUserSelect: 'none',
    userSelect: 'none',
  } as React.CSSProperties;

  return (
    <div className="space-y-6 animate-in fade-in duration-700" style={securityOverlayStyles}>
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-4xl font-black theme-text-main uppercase tracking-tighter leading-none">Validación de Gafetes</h2>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <p className="theme-text-muted text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">Verificación SmartGo en tiempo real</p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-8">
        <GlassCard className="p-8 md:p-12 flex flex-col items-center justify-center text-center space-y-10 border-dashed border-2 theme-border">
          
          <div className="relative">
            <div className={`w-36 h-36 rounded-[3rem] flex items-center justify-center border-2 transition-all duration-700 shadow-2xl ${
              processing 
                ? 'bg-indigo-600/30 border-indigo-500 animate-pulse scale-110' 
                : 'theme-bg-subtle border-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.15)] animate-qr-pulse'
            }`}>
              {processing ? (
                <Loader2 className="text-indigo-400 w-16 h-16 animate-spin" />
              ) : (
                <QrCode className="text-blue-400 w-16 h-16 filter drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-2xl font-black theme-text-main uppercase tracking-tight">
              {processing ? 'Verificando Identidad...' : 'Validar Operador'}
            </h3>
            <p className="theme-text-muted text-[11px] max-w-sm mx-auto font-black uppercase tracking-widest leading-relaxed">
              Escanear el código QR del gafete institucional para validar acceso y vigencia del personal operativo.
            </p>
          </div>

          <input 
            type="file" 
            ref={cameraInputRef}
            className="hidden" 
            accept="image/*" 
            capture="environment"
            onChange={handleProcessImage}
          />
          <input 
            type="file" 
            ref={galleryInputRef}
            className="hidden" 
            accept="image/*" 
            onChange={handleProcessImage}
          />

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
            <Button 
              onClick={() => cameraInputRef.current?.click()} 
              disabled={processing || !jsQR}
              className={`flex-1 py-5 uppercase font-black tracking-[0.2em] text-[10px] shadow-2xl transition-all active:scale-95 ${
                processing || !jsQR ? 'opacity-50 cursor-not-allowed grayscale' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/40'
              }`}
            >
              <Camera size={18} /> USAR CÁMARA
            </Button>
            
            <Button 
              onClick={() => galleryInputRef.current?.click()} 
              disabled={processing || !jsQR}
              variant="outline"
              className={`flex-1 py-5 uppercase font-black tracking-[0.2em] text-[10px] transition-all active:scale-95 ${
                processing || !jsQR ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:bg-black/5'
              }`}
            >
              <ImageIcon size={18} /> DESDE GALERÍA
            </Button>
          </div>
        </GlassCard>
      </div>

      <Modal isOpen={!!error} onClose={() => setError(null)} title="ATENCIÓN">
        <div className="text-center space-y-6 p-4">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full mx-auto flex items-center justify-center border border-rose-500/20 animate-pulse">
            <XCircle className="w-10 h-10 text-rose-500" />
          </div>
          <div className="space-y-2">
            <h4 className="text-rose-500 font-black text-xs uppercase tracking-[0.2em]">Fallo de Validación</h4>
            <p className="theme-text-main text-sm font-black uppercase leading-relaxed tracking-tight">{error}</p>
          </div>
          <Button 
            variant="danger" 
            className="w-full py-4 uppercase font-black text-[10px] tracking-widest shadow-xl shadow-rose-900/20" 
            onClick={() => setError(null)}
          >
            Entendido / Reintentar
          </Button>
        </div>
      </Modal>

      <Modal isOpen={!!result} onClose={() => { setResult(null); setShowMore(false); }} title="CERTIFICADO DE VIGENCIA">
        {result && (
          <div className={`relative space-y-6 overflow-hidden pt-4 transition-all duration-500 ${!isWindowFocused ? 'blur-3xl grayscale' : ''}`}>
            
            {/* MARCA DE AGUA ACTIVA DINÁMICA */}
            <div className="absolute inset-0 pointer-events-none z-[60] overflow-hidden opacity-10 select-none">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350%] rotate-[-30deg] flex flex-col gap-12">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="whitespace-nowrap animate-marquee flex gap-12">
                    {[...Array(8)].map((_, j) => (
                      <span key={j} className="text-[16px] font-black theme-text-main uppercase tracking-[1em] bg-blue-500/10 px-8 py-3 rounded-full border theme-border">
                        {result.isActive ? 'OPERADOR AUTORIZADO' : 'ACCESO DENEGADO'} • {validationTime} • {result.id}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* AVISO DE CAPTURA PROTEGIDA SI PIERDE EL FOCO */}
            {!isWindowFocused && (
              <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 backdrop-blur-3xl text-center p-8">
                <ShieldAlert className="w-20 h-20 text-blue-500 mb-4 animate-pulse" />
                <h4 className="text-xl font-black text-white uppercase tracking-tighter">Vista Protegida</h4>
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mt-2">No se permiten capturas de pantalla ni cambio de ventana.</p>
              </div>
            )}

            <div className="flex flex-col items-center text-center relative z-10">
              <div className={`w-32 h-32 md:w-36 md:h-36 rounded-[3rem] border-4 overflow-hidden mb-6 theme-bg-subtle shadow-2xl transition-all duration-500 ${
                result.isActive ? 'border-emerald-500 shadow-emerald-500/20' : 'border-rose-500 shadow-rose-500/20'
              }`}>
                {result.photoUrl ? (
                  <img src={result.photoUrl} className="w-full h-full object-cover" alt={result.fullName} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl font-black theme-text-muted opacity-10 uppercase">
                    {result.fullName?.charAt(0)}
                  </div>
                )}
              </div>
              
              <h3 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter leading-none mb-1">{result.fullName}</h3>
              <p className="text-blue-500 font-mono font-black tracking-widest uppercase text-[10px] bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20 mt-2">
                {result.teamCode}
              </p>

              <div className={`w-full mt-8 py-6 rounded-[2rem] flex flex-col items-center justify-center gap-1 border-2 transition-all ${
                result.isActive ? 'bg-emerald-600/10 border-emerald-500/20 text-emerald-600' : 'bg-rose-600/10 border-rose-500/20 text-rose-600'
              }`}>
                <div className="flex items-center gap-4">
                  {result.isActive ? <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" /> : <XCircle className="w-8 h-8 md:w-10 md:h-10" />}
                  <div className="text-left">
                    <p className="text-[8px] font-black uppercase opacity-60 tracking-[0.4em]">Estatus SmartGo</p>
                    <p className="text-lg md:text-xl font-black uppercase tracking-tight">{result.isActive ? 'ACTIVO / VIGENTE' : 'INACTIVO / BLOQUEADO'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 space-y-4">
               <button 
                  onClick={() => setShowMore(!showMore)}
                  className="w-full flex items-center justify-center gap-2 py-3 theme-bg-subtle border theme-border rounded-2xl text-[10px] font-black uppercase tracking-widest text-blue-500 hover:theme-bg-surface transition-all"
               >
                 {showMore ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                 {showMore ? 'Ocultar expediente' : 'Ver expediente completo'}
               </button>

               {showMore && (
                 <div className="space-y-3 animate-in slide-in-from-top-4 duration-500">
                    <div className="p-4 theme-bg-subtle rounded-3xl border theme-border backdrop-blur-md">
                      <p className="text-[8px] font-black theme-text-muted uppercase tracking-widest mb-1">Identificación CURP</p>
                      <p className="text-sm font-mono theme-text-main tracking-widest">{result.curp || 'NO REGISTRADO'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 theme-bg-subtle rounded-3xl border theme-border backdrop-blur-md">
                        <p className="text-[8px] theme-text-muted uppercase font-black tracking-widest mb-1">RFC</p>
                        <p className="text-sm font-mono theme-text-main truncate">{result.rfc || '---'}</p>
                      </div>
                      <div className="p-4 theme-bg-subtle rounded-3xl border theme-border backdrop-blur-md">
                        <p className="text-[8px] theme-text-muted uppercase font-black tracking-widest mb-1">NSS</p>
                        <p className="text-sm font-mono theme-text-main truncate">{result.nss || '---'}</p>
                      </div>
                    </div>

                    <div className="p-4 theme-bg-subtle rounded-3xl border theme-border backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-1">
                        <StoreIcon size={12} className="text-blue-500" />
                        <p className="text-[8px] font-black theme-text-muted uppercase tracking-widest">Sedes de Operación</p>
                      </div>
                      <p className="text-[10px] font-black theme-text-main uppercase leading-relaxed">
                        {getStoreNames(result.assignedStoreIds || [])}
                      </p>
                    </div>

                    {/* SECCIÓN UNIFICADA DE HORARIO */}
                    <div className="p-4 theme-bg-subtle rounded-3xl border theme-border backdrop-blur-md">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={12} className="text-indigo-500" />
                        <p className="text-[8px] theme-text-muted uppercase font-black tracking-widest">Horario Operativo</p>
                      </div>
                      <p className="text-[10px] font-black theme-text-main uppercase">
                        {result.baseSchedule || 'SIN HORARIO DEFINIDO'}
                      </p>
                    </div>
                 </div>
               )}
            </div>

            <div className="flex flex-col gap-2 pt-4 relative z-10">
              <Button onClick={() => { setResult(null); setShowMore(false); }} className="w-full py-5 font-black uppercase tracking-widest text-[11px] bg-blue-600 shadow-2xl shadow-blue-900/40">Confirmar y Cerrar</Button>
              <p className="text-[8px] theme-text-muted font-black uppercase text-center tracking-[0.3em] opacity-40">Hash Validación: {Math.random().toString(36).substr(2, 10).toUpperCase()}</p>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }

        @keyframes qr-pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
          }
          70% {
            transform: scale(1.05);
            box-shadow: 0 0 25px 15px rgba(59, 130, 246, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
          }
        }
        .animate-qr-pulse {
          animation: qr-pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
      `}</style>
    </div>
  );
};
