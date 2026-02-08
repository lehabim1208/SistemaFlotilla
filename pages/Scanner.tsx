
import React, { useState, useEffect, useRef } from 'react';
import { Camera, QrCode, ShieldCheck, XCircle, Loader2, Image as ImageIcon, ChevronDown, ChevronUp, MapPin, User as UserIcon, Wallet, FileText, BadgeCheck, ShieldAlert } from 'lucide-react';
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
        setError("No se pudo inicializar el motor de escaneo.");
      }
    };
    loadScannerEngine();

    return () => {
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

  const handleProcessImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !jsQR) return;

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
        if (!ctx) { setProcessing(false); return; }

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
            const found = drivers.find(d => d.qrCodeKey === scannedData || d.id === scannedData || `SG-ID-${d.id}` === scannedData);
            if (found) setResult(found);
            else setError("GAFETE NO RECONOCIDO EN LA BASE DE DATOS.");
          } else {
            setError("NO SE DETECTÓ NINGÚN CÓDIGO QR VÁLIDO.");
          }
        } catch (err) {
          setError("ERROR AL PROCESAR LA IMAGEN.");
        }
        setProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter leading-none">Escáner de Validación</h2>
        <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.2em]">Verificación de Identidad SmartGo</p>
      </header>

      <div className="max-w-2xl mx-auto py-8">
        <GlassCard className="p-10 flex flex-col items-center justify-center text-center space-y-10 border-dashed border-2 theme-border relative overflow-hidden">
          <div className={`w-32 h-32 rounded-[3rem] flex items-center justify-center border-2 transition-all duration-700 shadow-2xl ${processing ? 'bg-blue-600/30 border-blue-500 animate-pulse scale-110' : 'theme-bg-subtle border-blue-500/30'}`}>
            {processing ? <Loader2 className="text-blue-400 w-12 h-12 animate-spin" /> : <QrCode className="text-blue-400 w-12 h-12" />}
          </div>
          <div className="space-y-3">
            <h3 className="text-xl font-black theme-text-main uppercase tracking-tight">{processing ? 'Verificando Expediente...' : 'Validar Gafete Institucional'}</h3>
            <p className="theme-text-muted text-[10px] max-w-xs mx-auto font-black uppercase tracking-widest leading-relaxed">Posicione el código QR del gafete frente a la cámara o suba una foto nítida.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
            <Button onClick={() => cameraInputRef.current?.click()} disabled={processing} className="flex-1 py-5 uppercase font-black tracking-widest text-[9px] bg-blue-600 shadow-xl shadow-blue-900/40"><Camera size={18} /> USAR CÁMARA</Button>
            <Button onClick={() => galleryInputRef.current?.click()} disabled={processing} variant="outline" className="flex-1 py-5 uppercase font-black tracking-widest text-[9px]"><ImageIcon size={18} /> SUBIR FOTO</Button>
          </div>
          <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleProcessImage} />
          <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" onChange={handleProcessImage} />
        </GlassCard>
      </div>

      <Modal isOpen={!!error} onClose={() => setError(null)} title="ERROR DE VALIDACIÓN">
        <div className="text-center space-y-6 p-4">
          <XCircle className="w-16 h-16 text-rose-500 mx-auto" />
          <p className="theme-text-main text-sm font-black uppercase tracking-tight">{error}</p>
          <Button variant="danger" className="w-full py-4 uppercase font-black text-[10px]" onClick={() => setError(null)}>Reintentar</Button>
        </div>
      </Modal>

      <Modal isOpen={!!result} onClose={() => { setResult(null); setShowMore(false); }} title="EXPEDIENTE VERIFICADO">
        {result && (
          <div className={`relative space-y-6 pt-4 transition-all duration-700 ${!isWindowFocused ? 'blur-2xl grayscale' : ''}`}>
            {/* Header del Perfil */}
            <div className="flex flex-col items-center text-center">
              <div className={`w-32 h-32 rounded-[3rem] border-4 overflow-hidden mb-6 theme-bg-subtle shadow-2xl ${result.isActive ? 'border-emerald-500 shadow-emerald-500/20' : 'border-rose-500 shadow-rose-500/20'}`}>
                {result.photoUrl ? <img src={result.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><UserIcon size={48} className="theme-text-muted opacity-20" /></div>}
              </div>
              <h3 className="text-2xl font-black theme-text-main uppercase mb-1 tracking-tight leading-tight px-4">{result.fullName}</h3>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-xl tracking-widest">{result.teamCode}</span>
                <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border tracking-widest ${result.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                   {result.isActive ? <BadgeCheck size={12} className="inline mr-1" /> : <ShieldAlert size={12} className="inline mr-1" />}
                   {result.isActive ? 'GAFETE ACTIVO' : 'SISTEMA BLOQUEADO'}
                </span>
              </div>
            </div>
            
            <div className="space-y-4">
               <button 
                onClick={() => setShowMore(!showMore)} 
                className="w-full py-5 theme-bg-subtle border theme-border rounded-[2rem] text-[11px] font-black uppercase text-blue-500 flex items-center justify-center gap-3 transition-all hover:bg-blue-600/5 active:scale-95"
               >
                 {showMore ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                 {showMore ? 'Ocultar Información' : 'Ver Expediente Completo'}
               </button>

               {showMore && (
                 <div className="space-y-6 animate-in slide-in-from-top-6 duration-500 pb-2">
                    {/* Sección 1: Identidad Legal */}
                    <div className="grid grid-cols-2 gap-3">
                       {[
                         { l: 'CURP Oficial', v: result.curp || 'S/N' },
                         { l: 'RFC Fiscal', v: result.rfc || 'S/N' },
                         { l: 'Número SS', v: result.nss || 'S/N' },
                         { l: 'Estado Sanitario', v: calculateCofeprisStatus(result.cofepris_expiration || '').toUpperCase(), extra: result.cofepris_expiration }
                       ].map((item, i) => (
                         <div key={i} className="p-4 theme-bg-subtle rounded-2xl border theme-border shadow-sm">
                           <p className="text-[8px] font-black theme-text-muted uppercase mb-1 tracking-widest">{item.l}</p>
                           <p className={`text-[11px] font-black theme-text-main truncate ${i === 3 ? getCofeprisBadgeStyles(item.v.toLowerCase()).split(' ')[1] : ''}`}>{item.v}</p>
                           {item.extra && <p className="text-[7px] font-bold theme-text-muted mt-1 uppercase opacity-60">Vence: {item.extra.split('-').reverse().join('/')}</p>}
                         </div>
                       ))}
                    </div>

                    {/* Sección 2: Finanzas y Sedes */}
                    <div className="p-5 theme-bg-subtle rounded-[2.5rem] border theme-border space-y-5 shadow-2xl relative overflow-hidden">
                       <div className="absolute top-0 right-0 p-4 opacity-[0.03]"><Wallet size={80} /></div>
                       <div className="flex items-center gap-2 border-b theme-border pb-3">
                          <MapPin size={16} className="text-blue-500" />
                          <h5 className="text-[11px] font-black theme-text-main uppercase tracking-widest">Sedes y Tarifas Pactadas</h5>
                       </div>
                       <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {(result.assignedStoreIds || []).length === 0 ? (
                            <div className="text-center py-8 opacity-20"><FileText size={40} className="mx-auto mb-2" /><p className="text-[10px] font-black uppercase">Sin asignaciones registradas</p></div>
                          ) : (
                            (result.assignedStoreIds || []).map(sid => {
                               const store = stores.find(s => s.id === sid);
                               const fin = result.storeFinances?.[sid] || { dailyWage: result.dailyWage || 0, dailyGas: result.dailyGas || 0 };
                               return (
                                 <div key={sid} className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border theme-border group hover:border-blue-500/40 transition-colors">
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-[12px] font-black theme-text-main uppercase truncate leading-none mb-1">{store?.name || 'Sede Especial'}</span>
                                      <span className="text-[9px] text-blue-500 font-black uppercase tracking-tighter opacity-70">{store?.code || 'SG-CODE'}</span>
                                    </div>
                                    <div className="flex gap-6 text-right flex-shrink-0">
                                       <div className="space-y-0.5">
                                         <p className="text-[7px] font-black theme-text-muted uppercase tracking-tighter">Sueldo</p>
                                         <p className="text-[13px] font-black text-emerald-500 leading-none">${fin.dailyWage}</p>
                                       </div>
                                       <div className="space-y-0.5">
                                         <p className="text-[7px] font-black theme-text-muted uppercase tracking-tighter">Gasolina</p>
                                         <p className="text-[13px] font-black text-amber-500 leading-none">${fin.dailyGas}</p>
                                       </div>
                                    </div>
                                 </div>
                               );
                            })
                          )}
                       </div>
                    </div>
                 </div>
               )}
            </div>
            
            <Button onClick={() => { setResult(null); setShowMore(false); }} className="w-full py-6 font-black uppercase text-[11px] bg-blue-600 shadow-2xl shadow-blue-900/50 tracking-[0.2em] border-2 border-blue-400/20 active:scale-95 transition-all">Finalizar Consulta</Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
