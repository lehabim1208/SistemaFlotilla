
import React, { useState, useMemo, useRef } from 'react';
import { Calendar, Save, Download, Clock, AlertCircle, Zap, Edit3, Check, GripVertical, MoveVertical, X as CloseIcon, MessageCircle, MapPin, Hash, ArrowRight, Info, Users, RefreshCcw, Search, UserCheck, UserPlus, Timer, X, ArrowUpDown, Trash2, Trash } from 'lucide-react';
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
    
  const [selectedStore, setSelectedStore] = useState(() => {
    if (currentUser.username === 'adminanwar') {
      const cristal = assignedStores.find(s => s.id === 's3');
      if (cristal) return cristal.id;
    }
    return assignedStores[0]?.id || '';
  });

  const [date, setDate] = useState(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const now = new Date();
    const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    return formatter.format(tomorrow);
  });

  const [requiredCount, setRequiredCount] = useState<number | string>(3);
  const [scheduleMode, setScheduleMode] = useState<'AUTO' | 'FIXED'>('FIXED');
  const [startEntryTime, setStartEntryTime] = useState('07:00');
  const [endEntryTime, setEndEntryTime] = useState('12:00');
  const [manualSelection, setManualSelection] = useState(false);
  const [selectedManualDriverIds, setSelectedManualDriverIds] = useState<string[]>([]);
  const [isPickingDrivers, setIsPickingDrivers] = useState(false);
  
  const [generatedRole, setGeneratedRole] = useState<DailyRole | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderSelectedIndex, setReorderSelectedIndex] = useState<number | null>(null);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  
  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [newOpDriver, setNewOpDriver] = useState<Driver | null>(null);
  const [newOpEntry, setNewOpEntry] = useState("07:00");
  const [newOpExit, setNewOpExit] = useState("17:00");

  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [pickerEntry, setPickerEntry] = useState("07:00");
  const [pickerExit, setPickerExit] = useState("17:00");

  const [deletingAssignmentIndex, setDeletingAssignmentIndex] = useState<number | null>(null);

  const [showWarning, setShowWarning] = useState<{ isOpen: boolean; msg: string }>({ isOpen: false, msg: '' });
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [searchPicker, setSearchPicker] = useState('');

  const currentPreviewSchedule = useMemo(() => {
    return `${formatTo12h(pickerEntry)} A ${formatTo12h(pickerExit)}`;
  }, [pickerEntry, pickerExit]);

  const storeDrivers = useMemo(() => (drivers || []).filter(d => (d.assignedStoreIds || []).includes(selectedStore)), [selectedStore, drivers]);

  const busyDriverIds = useMemo(() => {
    return (history || [])
      .filter(h => h.date === date)
      .flatMap(h => h.assignments.map(a => a.driverId));
  }, [history, date]);

  const availableDrivers = useMemo(() => {
    return storeDrivers.filter(d => 
      d.isActive === true && 
      d.status === DriverStatus.AVAILABLE && 
      !busyDriverIds.includes(d.id)
    );
  }, [storeDrivers, busyDriverIds]);

  function formatShortName(name: string) {
    if (!name) return 'S/N';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[1]}`;
  }

  function formatTo12h(timeStr: string) {
    if (!timeStr) return "07:00 AM";
    const cleanTime = timeStr.trim().toUpperCase();
    let hours = 0, minutes = 0;
    const hasAMPM = cleanTime.includes('AM') || cleanTime.includes('PM');
    if (hasAMPM) {
      const ampm = cleanTime.includes('PM') ? 'PM' : 'AM';
      const timePart = cleanTime.replace('AM', '').replace('PM', '').trim();
      const [h, m] = timePart.split(':').map(Number);
      hours = h; minutes = m || 0;
      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
    } else {
      const [h, m] = cleanTime.split(':').map(Number);
      if (isNaN(h)) return timeStr;
      hours = h; minutes = m || 0;
    }
    const finalAMPM = hours >= 12 ? 'PM' : 'AM';
    const h12 = hours % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${finalAMPM}`;
  }

  const getMinutesFromSchedule = (timeStr: string) => {
    const formatted = formatTo12h(timeStr);
    const [main, ampm] = formatted.split(' ');
    let [h, m] = main.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const time12To24 = (time12: string) => {
    const parts = time12.split(' ');
    if (parts.length < 2) return "07:00";
    const [time, ampm] = parts;
    let [h, m] = time.split(':').map(Number);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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

  const performGeneration = (preselectedIds?: string[]) => {
    const count = typeof requiredCount === 'string' ? parseInt(requiredCount) : requiredCount;
    const store = (stores || []).find(s => s.id === selectedStore);
    if (!store) return;

    let selection: Driver[] = [];
    if (preselectedIds && preselectedIds.length > 0) {
      selection = preselectedIds.map(id => drivers.find(d => d.id === id)!).filter(Boolean);
      selection = selection.sort(() => Math.random() - 0.5);
    } else {
      selection = [...availableDrivers].sort(() => Math.random() - 0.5).slice(0, count as number);
    }

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

    assignments.sort((a, b) => {
      const timeA = getMinutesFromSchedule(a.schedule.split(' A ')[0]);
      const timeB = getMinutesFromSchedule(b.schedule.split(' A ')[0]);
      return timeA - timeB;
    });

    setGeneratedRole({
      id: `role_${Date.now()}`, storeId: store.id, storeName: store.name, storeCode: store.code, date, adminId: currentUser?.username || 'admin', createdAt: new Date().toISOString(),
      assignments
    });
    setReorderSelectedIndex(null);
    setIsReorderMode(false);
    setToast({ message: 'Propuesta generada exitosamente.', type: 'success' });
    setShowDuplicateConfirm(false);
    setSelectedManualDriverIds([]);
  };

  const handleGenerate = () => {
    const count = typeof requiredCount === 'string' ? parseInt(requiredCount) : requiredCount;
    if (!count || count <= 0) {
      setShowWarning({ isOpen: true, msg: 'Debes ingresar un número válido de conductores.' });
      return;
    }
    const alreadyHasRole = history.some(h => h.storeId === selectedStore && h.date === date);
    if (alreadyHasRole && !showDuplicateConfirm) {
      setShowDuplicateConfirm(true);
      return;
    }
    if (count > availableDrivers.length) {
      setShowWarning({ isOpen: true, msg: `No hay suficientes conductores disponibles. Hay ${availableDrivers.length} libres para esta fecha.` });
      return;
    }
    if (manualSelection) {
      setIsPickingDrivers(true);
    } else {
      performGeneration();
    }
  };

  const handleRowClickForReorder = (index: number) => {
    if (!isReorderMode || !generatedRole) return;
    if (reorderSelectedIndex === null) {
      setReorderSelectedIndex(index);
    } else {
      if (reorderSelectedIndex === index) {
        setReorderSelectedIndex(null);
      } else {
        const next = [...generatedRole.assignments];
        const sourceDriver = { ...next[reorderSelectedIndex] };
        const targetDriver = { ...next[index] };
        
        next[reorderSelectedIndex] = { ...next[reorderSelectedIndex], driverId: targetDriver.driverId, driverName: targetDriver.driverName, teamCode: targetDriver.teamCode };
        next[index] = { ...next[index], driverId: sourceDriver.driverId, driverName: sourceDriver.driverName, teamCode: sourceDriver.teamCode };
        
        setGeneratedRole({ ...generatedRole, assignments: next });
        setReorderSelectedIndex(null);
        setToast({ message: 'Posiciones intercambiadas', type: 'info' });
      }
    }
  };

  const handleDeleteAssignmentConfirm = () => {
    if (deletingAssignmentIndex !== null && generatedRole) {
      const next = [...generatedRole.assignments];
      next.splice(deletingAssignmentIndex, 1);
      setGeneratedRole({ ...generatedRole, assignments: next });
      setDeletingAssignmentIndex(null);
      setToast({ message: 'Operador removido de la propuesta', type: 'info' });
    }
  };

  const handleAddNewOperator = () => {
    if (!newOpDriver || !generatedRole) return;
    const scheduleStr = `${formatTo12h(newOpEntry)} A ${formatTo12h(newOpExit)}`;
    const newAsgn: Assignment = {
      driverId: newOpDriver.id,
      driverName: newOpDriver.fullName,
      teamCode: newOpDriver.teamCode,
      schedule: scheduleStr
    };
    const next = [...generatedRole.assignments, newAsgn].sort((a, b) => {
      return getMinutesFromSchedule(a.schedule.split(' A ')[0]) - getMinutesFromSchedule(b.schedule.split(' A ')[0]);
    });
    setGeneratedRole({ ...generatedRole, assignments: next });
    setIsAddingOperator(false);
    setNewOpDriver(null);
    setToast({ message: 'Nuevo operador insertado en la propuesta.', type: 'success' });
  };

  const handleSwapDriver = (newDriver: Driver) => {
    if (swappingIndex === null || !generatedRole) return;
    const nextAssignments = [...generatedRole.assignments];
    nextAssignments[swappingIndex] = {
      ...nextAssignments[swappingIndex],
      driverId: newDriver.id,
      driverName: newDriver.fullName,
      teamCode: newDriver.teamCode
    };
    setGeneratedRole({ ...generatedRole, assignments: nextAssignments });
    setSwappingIndex(null);
    setToast({ message: 'Conductor actualizado.', type: 'success' });
  };

  const handlePublish = () => {
    if (!generatedRole) return;
    onPublish(generatedRole);
    setGeneratedRole(null);
    setToast({ message: 'Rol guardado exitosamente', type: 'success' });
  };

  const handleDownloadImage = () => {
    if (!generatedRole) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isLightMode = document.documentElement.classList.contains('light-mode');
    const isBA = generatedRole.storeCode.startsWith('BA_');

    const colors = {
      bg: isLightMode ? '#F1F5F9' : '#0F172A',
      card: isLightMode ? '#FFFFFF' : '#1E293B',
      primary: isBA ? '#15803d' : '#2563EB', 
      textMain: isLightMode ? '#0F172A' : '#F8FAFC',
      textMuted: isLightMode ? '#64748B' : '#94A3B8',
      border: isLightMode ? '#E2E8F0' : '#334155'
    };

    const width = 1200;
    const headerHeight = 320;
    const rowHeight = 160; 
    const padding = 80;
    const assignments = generatedRole.assignments || [];
    const totalHeight = headerHeight + (assignments.length * rowHeight) + 180;
    
    canvas.width = width;
    canvas.height = totalHeight;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, totalHeight);

    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, width, 240);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 64px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(generatedRole.storeName.toUpperCase(), width / 2, 110);
    
    ctx.font = '800 28px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.letterSpacing = "4px";
    ctx.fillText(`ROL OPERATIVO • ${getNaturalDate(generatedRole.date).toUpperCase()}`, width / 2, 165);

    const tableX = padding;
    const tableY = 220;
    const tableW = width - (padding * 2);
    const tableH = (assignments.length * rowHeight) + 120;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 60;
    ctx.fillStyle = colors.card;
    const r = 40;
    ctx.beginPath();
    ctx.moveTo(tableX + r, tableY);
    ctx.lineTo(tableX + tableW - r, tableY);
    ctx.quadraticCurveTo(tableX + tableW, tableY, tableX + tableW, tableY + r);
    ctx.lineTo(tableX + tableW, tableY + tableH - r);
    ctx.quadraticCurveTo(tableX + tableW, tableY + tableH, tableX + tableW - r, tableY + tableH);
    ctx.lineTo(tableX + r, tableY + tableH);
    ctx.quadraticCurveTo(tableX, tableY + tableH, tableX, tableY + tableH - r);
    ctx.lineTo(tableX, tableY + r);
    ctx.quadraticCurveTo(tableX, tableY, tableX + r, tableY);
    ctx.fill();
    ctx.restore();

    // ORGANIZACIÓN DE COLUMNAS REDISEÑADA
    ctx.textAlign = 'left';
    ctx.font = '900 22px Inter';
    ctx.fillStyle = colors.textMuted;
    ctx.letterSpacing = "2px";
    
    // Coordenadas base (mismo patrón que History)
    const col1_X = tableX + 60;  // Turno
    const col2_X = tableX + 340; // Operador
    const col3_X = tableX + 760; // ID Flota

    ctx.fillText('TURNO', col1_X, tableY + 70);
    ctx.fillText('OPERADOR', col2_X, tableY + 70); 
    ctx.fillText('ID FLOTA', col3_X, tableY + 70);

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tableX + 40, tableY + 100);
    ctx.lineTo(tableX + tableW - 40, tableY + 100);
    ctx.stroke();

    assignments.forEach((assignment, index) => {
      const y = tableY + 200 + (index * rowHeight);
      
      const times = assignment.schedule.toUpperCase().split(' A ');
      const entry = times[0] || '---';
      const exit = times[1] || '---';

      // TURNO
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 32px monospace';
      ctx.fillText(entry, col1_X, y - 25);
      ctx.fillStyle = '#f43f5e';
      ctx.fillText(exit, col1_X, y + 35);

      // OPERADOR - Aprovechar espacio central
      ctx.fillStyle = colors.textMain;
      ctx.font = '900 30px Inter'; 
      const name = formatShortName(assignment.driverName).toUpperCase();
      
      const maxNameWidth = 400; 
      let displayName = name;
      if (ctx.measureText(name).width > maxNameWidth) {
          while (ctx.measureText(displayName + "...").width > maxNameWidth && displayName.length > 0) {
              displayName = displayName.substring(0, displayName.length - 1);
          }
          displayName += "...";
      }
      ctx.fillText(displayName, col2_X, y + 5); 

      // ID FLOTA - Adaptable (Negro en modo claro, Blanco en modo oscuro)
      ctx.fillStyle = colors.textMain; 
      ctx.font = '900 24px Inter'; 
      ctx.fillText(assignment.teamCode || '---', col3_X, y + 5);

      if (index < assignments.length - 1) {
        ctx.strokeStyle = colors.border;
        ctx.setLineDash([8, 12]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tableX + 40, y + 80);
        ctx.lineTo(tableX + tableW - 40, y + 80);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    ctx.fillStyle = colors.textMuted;
    ctx.font = 'bold 18px Inter';
    ctx.textAlign = 'center';
    ctx.letterSpacing = "2px";
    ctx.fillText('ROL OPERATIVO EXTRAÍDO DE DRIVEFLOW LOGÍSTICA', width / 2, totalHeight - 60);

    const link = document.createElement('a');
    link.download = `ROL_${generatedRole.storeCode}_${generatedRole.date}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    setToast({ message: 'Imagen del rol descargada', type: 'success' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter leading-none">Generador de rol</h2>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

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
                 <div className="flex items-center justify-between px-1">
                    <span className="text-[8px] font-black theme-text-muted uppercase tracking-widest">Selección Manual</span>
                    <button onClick={() => setManualSelection(!manualSelection)} className={`w-10 h-5 rounded-full relative transition-all flex items-center p-0.5 ${manualSelection ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.4)]' : 'bg-black/40'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all transform ${manualSelection ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                 </div>
              </div>
              <Button className="w-full py-4 uppercase font-black tracking-widest text-[10px] bg-blue-600 hover:bg-blue-500 border-2 border-blue-400/50" onClick={handleGenerate}>
                <Zap className="w-3 h-3" /> {manualSelection ? 'Escoger y Generar' : 'Generar Propuesta'}
              </Button>
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
                    <p className="text-blue-500 font-mono font-black text-[9px] tracking-widest mt-1 uppercase opacity-80">{getNaturalDate(generatedRole.date).toUpperCase()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setIsReorderMode(!isReorderMode); setReorderSelectedIndex(null); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${isReorderMode ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-blue-600/10 text-blue-500 border-blue-500/20 hover:bg-blue-600 hover:text-white shadow-sm'}`}>
                      <ArrowUpDown size={14} /> {isReorderMode ? 'Fijar' : 'Acomodar'}
                    </button>
                    {!isReorderMode && (
                      <button onClick={() => { setSearchPicker(''); setIsAddingOperator(true); }} className="flex items-center gap-2 px-4 py-2 theme-bg-subtle text-emerald-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border theme-border shadow-sm">
                        <UserPlus size={14} /> <span className="text-[9px] font-black uppercase tracking-widest">Agregar</span>
                      </button>
                    )}
                  </div>
                </div>

                {isReorderMode && (
                  <div className="bg-blue-600/5 border-b border-blue-500/20 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-1">
                      <Info size={14} className="text-blue-500" />
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Manual de Reordenamiento</span>
                    </div>
                    <p className="text-[10px] font-bold text-blue-400 uppercase leading-tight tracking-tight">
                      Toque el nombre de un operador y luego otro para intercambiar sus turnos en la propuesta.
                    </p>
                  </div>
                )}
                
                <div className="flex-1 overflow-auto custom-scrollbar">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="theme-bg-subtle theme-text-muted text-[8px] font-black uppercase tracking-widest border-b theme-border sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="p-4 md:p-6 w-[35%]">Turno</th>
                        <th className="p-4 md:p-6">Operador</th>
                        {!isReorderMode && <th className="p-4 md:p-6 text-right w-[95px]">Acción</th>}
                      </tr>
                    </thead>
                    <tbody className="theme-text-main divide-y theme-border">
                      {generatedRole.assignments.map((a, i) => {
                        const times = a.schedule.toUpperCase().split(' A ');
                        const entry = formatTo12h(times[0] || '---'), exit = formatTo12h(times[1] || '---');
                        const isSelected = reorderSelectedIndex === i;
                        return (
                          <tr key={i} onClick={() => handleRowClickForReorder(i)} className={`transition-all hover:bg-black/5 ${isReorderMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-600/20 shadow-inner' : ''}`}>
                            <td className="p-4 md:p-6">
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const currentTimes = a.schedule.toUpperCase().split(' A ');
                                  setPickerEntry(time12To24(formatTo12h(currentTimes[0])));
                                  setPickerExit(time12To24(formatTo12h(currentTimes[1])));
                                  setEditingScheduleIndex(i); 
                                }}
                                className="flex flex-col gap-1 w-full text-left active:scale-95 transition-transform animate-subtle-pulse"
                              >
                                <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="font-mono text-[10px] font-black text-emerald-600 whitespace-nowrap">{entry}</span>
                                </div>
                                <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
                                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                  <span className="font-mono text-[10px] font-black text-rose-600 whitespace-nowrap">{exit}</span>
                                </div>
                              </button>
                            </td>
                            <td className="p-4 md:p-6">
                              <div className="flex flex-col min-w-0">
                                <span className="font-black uppercase tracking-tight text-xs md:text-base truncate theme-text-main leading-tight">{formatShortName(a.driverName)}</span>
                                <span className="theme-text-muted text-[8px] md:text-[9px] font-mono tracking-widest">{a.teamCode}</span>
                              </div>
                            </td>
                            {!isReorderMode && (
                              <td className="p-4 md:p-6 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button onClick={(e) => { e.stopPropagation(); setSearchPicker(''); setSwappingIndex(i); }} title="Reemplazar" className="p-1.5 theme-bg-subtle text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all border theme-border shadow-sm"><RefreshCcw size={14} /></button>
                                  <button onClick={(e) => { e.stopPropagation(); setDeletingAssignmentIndex(i); }} title="Eliminar" className="p-1.5 theme-bg-subtle text-rose-500 rounded-xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all shadow-sm"><Trash2 size={14} /></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="p-5 theme-bg-subtle border-t theme-border flex flex-col sm:flex-row gap-3 relative z-[20]">
                  <Button variant="success" className={`flex-1 py-4 font-black uppercase text-[10px] tracking-widest border border-emerald-500/20 ${isReorderMode ? 'opacity-30' : ''}`} onClick={handlePublish}>
                    <Save className="w-4 h-4" /> Guardar Rol Definitivo
                  </Button>
                  <Button variant="outline" className={`flex-1 sm:flex-none px-6 py-4 font-black uppercase text-[10px] tracking-widest ${isReorderMode ? 'opacity-30' : ''}`} onClick={handleDownloadImage}>
                    <Download className="w-4 h-4" /> Descargar Imagen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center theme-text-muted opacity-20 m-12 border-4 border-dashed theme-border rounded-[3rem]">
                <Zap className="w-16 h-16 mb-4 animate-pulse" />
                <p className="font-black uppercase tracking-[0.4em] text-[10px]">Sin Propuesta Generada</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <style>{`
        @keyframes subtle-pulse {
          0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          50% { transform: scale(1.02); opacity: 0.8; box-shadow: 0 0 10px 2px rgba(16, 185, 129, 0.2); }
          100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .animate-subtle-pulse {
          animation: subtle-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};
