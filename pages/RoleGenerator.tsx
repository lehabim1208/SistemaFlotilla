
import React, { useState, useMemo, useRef } from 'react';
import { Calendar, Save, Download, Clock, AlertCircle, Zap, Edit3, Check, GripVertical, MoveVertical, X as CloseIcon, MessageCircle, MapPin, Hash, ArrowRight, Info } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { User, Store, Driver, DailyRole, DriverStatus, Assignment, UserRole } from '../types';
import { STORE_SCHEDULES } from '../constants';

interface Props {
  currentUser: User;
  stores: Store[];
  drivers: Driver[];
  history: DailyRole[];
  onPublish: (role: DailyRole) => void;
}

export const RoleGenerator: React.FC<Props> = ({ currentUser, stores = [], drivers = [], history = [], onPublish }) => {
  const isSuper = currentUser?.role === UserRole.SUPERADMIN;
  
  const assignedStores = isSuper 
    ? (stores || []) 
    : (stores || []).filter(s => currentUser.assignedStoreIds?.includes(s.id));
    
  // Lógica de sede predeterminada: Walmart Cristal (s3) para adminanwar
  const [selectedStore, setSelectedStore] = useState(() => {
    if (currentUser.username === 'adminanwar') {
      const cristal = assignedStores.find(s => s.id === 's3');
      if (cristal) return cristal.id;
    }
    return assignedStores[0]?.id || '';
  });

  // Lógica de fecha predeterminada: Día siguiente
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const [requiredCount, setRequiredCount] = useState<number | string>(3);
  const [scheduleMode, setScheduleMode] = useState<'AUTO' | 'FIXED'>('FIXED');
  const [startEntryTime, setStartEntryTime] = useState('07:00');
  const [endEntryTime, setEndEntryTime] = useState('12:00');
  
  const [generatedRole, setGeneratedRole] = useState<DailyRole | null>(null);
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [tempSchedules, setTempSchedules] = useState<Record<number, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  
  const [showWarning, setShowWarning] = useState<{ isOpen: boolean; msg: string }>({ isOpen: false, msg: '' });
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const storeDrivers = useMemo(() => (drivers || []).filter(d => (d.assignedStoreIds || []).includes(selectedStore)), [selectedStore, drivers]);

  const isLocked = editingIndices.size > 0;

  const formatShortName = (name: string) => {
    if (!name) return 'S/N';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[1]}`;
  };

  const formatTo12h = (timeStr: string) => {
    if (!timeStr) return "07:00 AM";
    const cleanTime = timeStr.trim().toUpperCase();
    
    let hours = 0;
    let minutes = 0;

    // Detectar AM/PM existente
    const hasAMPM = cleanTime.includes('AM') || cleanTime.includes('PM');
    if (hasAMPM) {
      const ampm = cleanTime.includes('PM') ? 'PM' : 'AM';
      const timePart = cleanTime.replace('AM', '').replace('PM', '').trim();
      const [h, m] = timePart.split(':').map(Number);
      hours = h;
      minutes = m || 0;
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    } else {
      const [h, m] = cleanTime.split(':').map(Number);
      hours = h;
      minutes = m || 0;
    }

    const finalAMPM = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${finalAMPM}`;
  };

  const getMinutesFromSchedule = (timeStr: string) => {
    const formatted = formatTo12h(timeStr);
    const [main, ampm] = formatted.split(' ');
    let [h, m] = main.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const add10Hours = (time24: string) => {
    if (!time24 || !time24.includes(':')) return "17:00";
    const [h, m] = time24.split(':').map(Number);
    const newH = (h + 10) % 24;
    return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const getNaturalDate = (isoDate: string) => {
    if (!isoDate) return "Rol";
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const parts = isoDate.split('-');
    if (parts.length < 3) return isoDate;
    const [year, month, day] = parts;
    const monthName = months[parseInt(month) - 1];
    return `${parseInt(day)} de ${monthName} de ${year}`;
  };

  const performGeneration = () => {
    const count = typeof requiredCount === 'string' ? parseInt(requiredCount) : requiredCount;
    const busyDriverIds = (history || [])
      .filter(h => h.date === date)
      .flatMap(h => h.assignments.map(a => a.driverId));

    const available = storeDrivers.filter(d => 
      d.isActive === true && 
      d.status === DriverStatus.AVAILABLE &&
      !busyDriverIds.includes(d.id)
    );

    const store = (stores || []).find(s => s.id === selectedStore);
    if (!store) return;

    let candidates = [...available].sort(() => Math.random() - 0.5);
    let selection = candidates.slice(0, count as number);
    let assignments: Assignment[] = [];

    if (scheduleMode === 'FIXED') {
      const storeSchedules = STORE_SCHEDULES[selectedStore] || ['09:00 a 19:00'];
      assignments = selection.map((d, i) => {
        const scheduleIndex = Math.min(i, storeSchedules.length - 1);
        const rawScheduleStr = storeSchedules[scheduleIndex];
        const [entryRaw, exitRaw] = rawScheduleStr.toLowerCase().split(' a ');
        const scheduleStr = `${formatTo12h(entryRaw)} A ${formatTo12h(exitRaw)}`;
        return { driverId: d.id, driverName: d.fullName, schedule: scheduleStr, teamCode: d.teamCode };
      });
    } else {
      const startMin = getMinutesFromSchedule(startEntryTime);
      const endMin = getMinutesFromSchedule(endEntryTime);
      const totalWindow = endMin - startMin;
      const interval = (count as number) > 1 ? totalWindow / ((count as number) - 1) : 0;
      assignments = selection.map((d, i) => {
        const currentMin = startMin + (i * interval);
        const h = Math.floor(currentMin / 60);
        const m = Math.floor(currentMin % 60);
        const entry = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const exit = add10Hours(entry);
        return { driverId: d.id, driverName: d.fullName, schedule: `${formatTo12h(entry)} A ${formatTo12h(exit)}`, teamCode: d.teamCode };
      });
    }

    if (scheduleMode !== 'FIXED') {
        assignments.sort((a, b) => {
          const timeA = getMinutesFromSchedule(a.schedule.split(' A ')[0]);
          const timeB = getMinutesFromSchedule(b.schedule.split(' A ')[0]);
          return timeA - timeB;
        });
    }

    setGeneratedRole({
      id: `role_${Date.now()}`, storeId: store.id, storeName: store.name, storeCode: store.code, date, adminId: currentUser?.username || 'admin', createdAt: new Date().toISOString(),
      assignments
    });
    setEditingIndices(new Set());
    setTempSchedules({});
    setIsReorderMode(false);
    setToast({ message: 'Propuesta generada exitosamente.', type: 'success' });
    setShowDuplicateConfirm(false);
  };

  const handleGenerate = () => {
    const count = typeof requiredCount === 'string' ? parseInt(requiredCount) : requiredCount;
    if (!count || count <= 0) {
      setShowWarning({ isOpen: true, msg: 'Debes ingresar un número válido de conductores.' });
      return;
    }

    const alreadyHasRole = history.some(h => h.storeId === selectedStore && h.date === date);
    if (alreadyHasRole) {
      setShowDuplicateConfirm(true);
      return;
    }

    const busyDriverIds = (history || [])
      .filter(h => h.date === date)
      .flatMap(h => h.assignments.map(a => a.driverId));

    const available = storeDrivers.filter(d => 
      d.isActive === true && 
      d.status === DriverStatus.AVAILABLE &&
      !busyDriverIds.includes(d.id)
    );

    if (count > available.length) {
      setShowWarning({ isOpen: true, msg: `No hay suficientes conductores disponibles. Hay ${available.length} libres para esta fecha.` });
      return;
    }

    performGeneration();
  };

  const startEditing = (index: number, currentSchedule: string) => {
    const newEditing = new Set(editingIndices);
    newEditing.add(index);
    setEditingIndices(newEditing);
    setTempSchedules({ ...tempSchedules, [index]: currentSchedule });
  };

  const confirmEdit = (index: number) => {
    if (!generatedRole) return;
    const newAssignments = [...(generatedRole.assignments || [])];
    newAssignments[index].schedule = tempSchedules[index].toUpperCase();
    
    setGeneratedRole({ ...generatedRole, assignments: newAssignments });
    const newEditing = new Set(editingIndices);
    newEditing.delete(index);
    setEditingIndices(newEditing);
    
    setToast({ message: 'Horario actualizado.', type: 'success' });
  };

  const handlePublish = () => {
    if (!generatedRole || isLocked || isReorderMode) return;
    onPublish(generatedRole);
    setGeneratedRole(null);
    setToast({ message: 'Rol guardado', type: 'success' });
  };

  const handleShareWhatsAppFormal = () => {
    if (!generatedRole || isLocked) return;
    const storeName = generatedRole.storeName.toUpperCase();
    const roleDate = getNaturalDate(generatedRole.date).toUpperCase();
    let message = `*SMART GO LOGÍSTICA - REPORTE OPERATIVO*\n\n`;
    message += `*SEDE:* ${storeName}\n`;
    message += `*FECHA:* ${roleDate}\n`;
    message += `------------------------------------------\n\n`;
    message += `*RELACIÓN DE TURNOS Y ASIGNACIONES:*\n\n`;
    generatedRole.assignments.forEach((a, i) => {
      message += `${i + 1}. [${a.schedule}]\n`;
      message += `   OPERADOR: ${formatShortName(a.driverName).toUpperCase()}\n`;
      message += `   ID FLOTA: ${a.teamCode || 'S/ID'}\n\n`;
    });
    message += `------------------------------------------\n`;
    message += `_Notificación oficial del sistema DriveFlow._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleDownloadImage = () => {
    if (!generatedRole || isLocked || isReorderMode) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = currentUser.settings?.darkMode ?? true;
    
    const width = 1080;
    const headerHeight = 280;
    const rowHeight = 110;
    const padding = 70;
    const assignments = generatedRole.assignments || [];
    const totalHeight = headerHeight + (assignments.length * rowHeight) + 160;
    
    canvas.width = width;
    canvas.height = totalHeight;

    ctx.fillStyle = isDark ? '#111827' : '#ffffff';
    ctx.fillRect(0, 0, width, totalHeight);

    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 15;
    ctx.strokeRect(0, 0, width, totalHeight);

    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, width, headerHeight - 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((generatedRole.storeName || 'Sede Logística').toUpperCase(), width / 2, 100);
    
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText(`ROL OPERATIVO - ${getNaturalDate(generatedRole.date).toUpperCase()}`, width / 2, 155);
    
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`ID SEDE: ${generatedRole.storeCode || '---'} | GENERADO POR: ${currentUser.username.toUpperCase()}`, width / 2, 195);

    const tableTop = headerHeight + 20;
    ctx.textAlign = 'left';
    ctx.font = '800 22px Inter, sans-serif';
    ctx.fillStyle = isDark ? '#f8fafc' : '#1e293b';
    ctx.fillText('TURNO OPERATIVO', padding + 10, tableTop);
    ctx.fillText('NOMBRE DEL OPERADOR', padding + 360, tableTop);
    ctx.fillText('ID FLOTA', padding + 820, tableTop);

    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, tableTop + 25);
    ctx.lineTo(width - padding, tableTop + 25);
    ctx.stroke();

    assignments.forEach((assignment, index) => {
      const y = tableTop + 85 + (index * rowHeight);
      if (index % 2 === 0) {
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
        ctx.fillRect(padding, y - 55, width - (padding * 2), rowHeight - 10);
      }
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 24px monospace';
      const schedule12h = assignment.schedule.split(' A ').map(formatTo12h).join(' A ');
      ctx.fillText(schedule12h, padding + 10, y - 5);
      ctx.fillStyle = isDark ? '#f8fafc' : '#0f172a';
      ctx.font = 'bold 26px Inter, sans-serif';
      ctx.fillText(formatShortName(assignment.driverName).toUpperCase(), padding + 360, y - 5);
      ctx.fillStyle = isDark ? 'rgba(248, 250, 252, 0.4)' : '#64748b';
      ctx.font = 'bold 22px monospace';
      ctx.fillText(assignment.teamCode || '---', padding + 820, y - 5);
    });

    const footerY = totalHeight - 60;
    ctx.fillStyle = isDark ? 'rgba(248, 250, 252, 0.2)' : '#94a3b8';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DOCUMENTO GENERADO POR DRIVEFLOW LOGÍSTICA © ${new Date().getFullYear()}`, width / 2, footerY);

    const link = document.createElement('a');
    link.download = `ROL_${generatedRole.storeCode}_${generatedRole.date}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    setToast({ message: 'Imagen descargada.', type: 'success' });
  };

  const handleDrop = (i: number) => {
    if (draggedIndex === null || draggedIndex === i || !generatedRole) return;
    const nextAssignments = [...generatedRole.assignments];
    const sourceDriver = { driverId: nextAssignments[draggedIndex].driverId, driverName: nextAssignments[draggedIndex].driverName, teamCode: nextAssignments[draggedIndex].teamCode };
    const targetDriver = { driverId: nextAssignments[i].driverId, driverName: nextAssignments[i].driverName, teamCode: nextAssignments[i].teamCode };
    nextAssignments[draggedIndex] = { ...nextAssignments[draggedIndex], ...targetDriver };
    nextAssignments[i] = { ...nextAssignments[i], ...sourceDriver };
    setGeneratedRole({ ...generatedRole, assignments: nextAssignments });
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter leading-none">Generador de rol</h2>
      
      {toast && <Toast message={toast.message} type={toast.type === 'info' ? 'success' : toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        <div className="lg:col-span-1" style={{ isolation: 'isolate' }}>
          <div className="liquid-glass p-5 md:p-6 space-y-5 border theme-border rounded-3xl relative">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[10px] font-black theme-text-muted uppercase tracking-widest px-1">
                  <MapPin size={12} className="text-blue-500" /> Sede
                </label>
                <select className="w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3 theme-text-main font-bold outline-none text-[11px] focus:border-blue-500/50 transition-colors" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                  {assignedStores.map(s => <option key={s.id} value={s.id} className="theme-bg-surface">{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-black theme-text-muted uppercase tracking-widest px-1">
                    <Calendar size={12} className="text-blue-500" /> Fecha
                  </label>
                  <input type="date" className="w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3 theme-text-main font-bold outline-none text-[11px]" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-black theme-text-muted uppercase tracking-widest px-1">
                    <Hash size={12} className="text-blue-500" /> Cantidad
                  </label>
                  <input type="number" className="w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3 theme-text-main font-black outline-none text-[11px]" value={requiredCount} onChange={e => setRequiredCount(e.target.value === '' ? '' : parseInt(e.target.value))} />
                </div>
              </div>

              <div className="p-3 theme-bg-subtle rounded-2xl border theme-border space-y-4 shadow-inner">
                 <div className="flex gap-1.5 p-1 bg-black/10 rounded-xl">
                    <button onClick={() => setScheduleMode('AUTO')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${scheduleMode === 'AUTO' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted opacity-40'}`}>Auto</button>
                    <button onClick={() => setScheduleMode('FIXED')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${scheduleMode === 'FIXED' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted opacity-40'}`}>Fijo</button>
                 </div>
                 {scheduleMode === 'AUTO' && (
                    <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-300">
                      <div className="space-y-1">
                        <p className="text-[7px] font-black theme-text-muted uppercase px-1">Inicio</p>
                        <input type="time" className="w-full bg-black/20 border theme-border rounded-lg px-2 py-2 theme-text-main text-[10px] font-bold" value={startEntryTime} onChange={e => setStartEntryTime(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[7px] font-black theme-text-muted uppercase px-1">Fin</p>
                        <input type="time" className="w-full bg-black/20 border theme-border rounded-lg px-2 py-2 theme-text-main text-[10px] font-bold" value={endEntryTime} onChange={e => setEndEntryTime(e.target.value)} />
                      </div>
                    </div>
                 )}
                 {scheduleMode === 'FIXED' && (
                    <div className="px-1 py-1 animate-in fade-in duration-300">
                      <p className="text-[8px] font-bold theme-text-muted leading-tight uppercase opacity-60 italic">
                        Se usarán los horarios fijos predeterminados de la sede seleccionada.
                      </p>
                    </div>
                 )}
              </div>
              
              <div className="pt-2 relative">
                <Button className="w-full py-4 uppercase font-black tracking-widest text-[10px] bg-blue-600 hover:bg-blue-500 border-2 border-blue-400/50 active:scale-95 transition-all" onClick={handleGenerate}>
                  <Zap className="w-3 h-3" /> Generar Rol
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <GlassCard className="min-h-[500px] p-0 overflow-hidden flex flex-col border theme-border shadow-2xl">
            {generatedRole ? (
              <div className="flex flex-col h-full animate-in fade-in duration-500">
                <div className="p-6 theme-bg-subtle border-b theme-border flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-center md:text-left">
                    <h3 className="text-2xl font-black theme-text-main uppercase tracking-tighter leading-none">{generatedRole.storeName}</h3>
                    <p className="text-blue-500 font-mono font-black text-[9px] tracking-widest mt-1 uppercase opacity-80">
                      {getNaturalDate(generatedRole.date).toUpperCase()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleShareWhatsAppFormal} 
                      disabled={isLocked}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-600/10 border border-emerald-500/20 text-emerald-500 transition-all shadow-md ${isLocked ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:bg-emerald-600 hover:text-white'}`}
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button 
                      onClick={() => { setIsReorderMode(!isReorderMode); setEditingIndices(new Set()); }} 
                      disabled={isLocked}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${isLocked ? 'opacity-20 grayscale cursor-not-allowed' : (isReorderMode ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main')}`}
                    >
                      {isReorderMode ? <CloseIcon size={14} /> : <MoveVertical size={14} />}
                      {isReorderMode ? 'Cerrar' : 'Acomodar'}
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="theme-bg-subtle theme-text-muted text-[8px] font-black uppercase tracking-widest border-b theme-border sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="p-4 md:p-6 w-[40%] md:w-[240px]">Turno</th>
                        <th className="p-4 md:p-6">Operador</th>
                        <th className="p-4 md:p-6 text-right w-[80px]">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="theme-text-main divide-y theme-border">
                      {generatedRole.assignments.map((a, i) => {
                        const isBeingEdited = editingIndices.has(i);
                        const times = a.schedule.toUpperCase().split(' A ');
                        const entry = formatTo12h(times[0] || '---');
                        const exit = formatTo12h(times[1] || '---');
                        return (
                          <tr key={i} onDragOver={isReorderMode ? e => e.preventDefault() : undefined} onDrop={isReorderMode ? e => { e.preventDefault(); handleDrop(i); } : undefined} className={`transition-all ${isBeingEdited ? 'bg-blue-500/5' : ''} ${draggedIndex === i ? 'opacity-30' : ''} hover:bg-black/5`}>
                            <td className="p-4 md:p-6 align-middle">
                              {isBeingEdited ? (
                                <input className="w-full glass-input rounded-xl px-4 py-3 theme-text-main font-mono text-[12px] md:text-sm outline-none border-blue-500 shadow-xl" value={tempSchedules[i] || ''} onChange={e => setTempSchedules({...tempSchedules, [i]: e.target.value})} autoFocus />
                              ) : (
                                <div className="flex flex-col gap-1 w-fit">
                                  <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                                    <span className="font-mono text-[10px] md:text-xs font-black text-emerald-600 whitespace-nowrap">{entry}</span>
                                  </div>
                                  <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
                                    <span className="font-mono text-[10px] md:text-xs font-black text-rose-600 whitespace-nowrap">{exit}</span>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="p-4 md:p-6">
                              <div className="flex items-center gap-2 -ml-2">
                                {isReorderMode && <div draggable onDragStart={() => setDraggedIndex(i)} className="cursor-grab p-1.5 theme-bg-subtle rounded-lg border theme-border theme-text-muted"><GripVertical size={14} /></div>}
                                <div className="flex flex-col min-w-0">
                                  <span className="font-black uppercase tracking-tight text-xs md:text-base truncate theme-text-main leading-tight">{formatShortName(a.driverName)}</span>
                                  <span className="theme-text-muted text-[8px] md:text-[9px] font-mono tracking-widest">{a.teamCode}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 md:p-6 text-right">
                              {!isReorderMode && !isBeingEdited && <button onClick={() => startEditing(i, a.schedule)} className="p-2.5 theme-bg-subtle theme-text-muted rounded-xl hover:bg-blue-600 hover:text-white transition-all border theme-border shadow-sm"><Edit3 size={16} /></button>}
                              {isBeingEdited && <button onClick={() => confirmEdit(i)} className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-lg animate-pulse"><Check size={16} /></button>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-5 theme-bg-subtle border-t theme-border flex flex-col sm:flex-row gap-3 relative z-[20]">
                  <Button variant="success" className={`flex-1 py-4 font-black uppercase tracking-widest text-[10px] border border-emerald-500/20 ${isLocked || isReorderMode ? 'opacity-30 grayscale' : ''}`} onClick={handlePublish}>
                    <Save className="w-4 h-4" /> Guardar Rol
                  </Button>
                  <Button variant="outline" className={`flex-1 sm:flex-none px-6 py-4 font-black uppercase tracking-widest text-[10px] ${isLocked || isReorderMode ? 'opacity-30 grayscale' : ''}`} onClick={handleDownloadImage}>
                    <Download className="w-4 h-4" /> Descargar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center theme-text-muted opacity-20 m-12 border-4 border-dashed theme-border rounded-[3rem]">
                <Zap className="w-16 h-16 mb-4 animate-pulse" />
                <p className="font-black uppercase tracking-[0.4em] text-[10px]">Esperando Configuración</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <style>{`
        button:disabled {
          cursor: not-allowed !important;
          pointer-events: none !important;
        }
      `}</style>

      {/* Modal Advertencia de Validaciones (Conductores Insuficientes, etc) */}
      <Modal isOpen={showWarning.isOpen} onClose={() => setShowWarning({ ...showWarning, isOpen: false })} title="Atención">
        <div className="text-center space-y-6 p-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full mx-auto flex items-center justify-center border border-amber-500/20"><AlertCircle className="w-8 h-8 text-amber-500" /></div>
          <p className="theme-text-main font-bold uppercase text-[11px] leading-relaxed tracking-widest">{showWarning.msg}</p>
          <Button className="w-full py-4 uppercase font-black text-[10px] tracking-widest" variant="warning" onClick={() => setShowWarning({ ...showWarning, isOpen: false })}>Entendido</Button>
        </div>
      </Modal>

      {/* Modal Confirmación de Duplicados (Sede/Fecha ya existente) */}
      <Modal isOpen={showDuplicateConfirm} onClose={() => setShowDuplicateConfirm(false)} title="Rol Existente">
        <div className="text-center space-y-8 p-4 animate-in fade-in zoom-in-95 duration-300">
           <div className="w-20 h-20 bg-blue-600/10 rounded-full mx-auto flex items-center justify-center border border-blue-500/20 shadow-[0_0_20px_rgba(37,99,235,0.1)]">
              <Info className="w-10 h-10 text-blue-500" />
           </div>
           <div className="space-y-3">
              <p className="theme-text-main font-black uppercase text-[13px] leading-relaxed tracking-tight px-4">
                Ya tienes un rol para esta sede en esta fecha.
              </p>
              <p className="theme-text-muted font-bold uppercase text-[9px] tracking-[0.2em] opacity-70">
                ¿Aún así desea generar el rol?
              </p>
           </div>
           <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={() => setShowDuplicateConfirm(false)} variant="outline" className="flex-1 py-4 uppercase font-black tracking-widest text-[10px]">
                Cancelar
              </Button>
              <Button onClick={performGeneration} className="flex-[2] py-4 uppercase font-black tracking-widest text-[10px] bg-blue-600 shadow-xl shadow-blue-900/40">
                Sí, Generar Propuesta
              </Button>
           </div>
        </div>
      </Modal>
    </div>
  );
};
