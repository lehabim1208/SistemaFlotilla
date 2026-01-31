
import React, { useState, useMemo } from 'react';
import { Calendar, Save, Download, Clock, AlertCircle, Zap, Edit3, Check, GripVertical, MoveVertical, X as CloseIcon, MessageCircle } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { User, Store, Driver, DailyRole, DriverStatus, Assignment, UserRole } from '../types';

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
    
  const [selectedStore, setSelectedStore] = useState(assignedStores[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [requiredCount, setRequiredCount] = useState<number | string>(3);
  const [scheduleMode, setScheduleMode] = useState<'AUTO' | 'FIXED'>('AUTO');
  const [startEntryTime, setStartEntryTime] = useState('07:00');
  const [endEntryTime, setEndEntryTime] = useState('12:00');
  
  const [generatedRole, setGeneratedRole] = useState<DailyRole | null>(null);
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [tempSchedules, setTempSchedules] = useState<Record<number, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  
  const [showWarning, setShowWarning] = useState<{ isOpen: boolean; msg: string }>({ isOpen: false, msg: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const storeDrivers = useMemo(() => (drivers || []).filter(d => (d.assignedStoreIds || []).includes(selectedStore)), [selectedStore, drivers]);

  const isLocked = editingIndices.size > 0;

  // Función para obtener solo un nombre y un apellido
  const formatShortName = (name: string) => {
    if (!name) return 'S/N';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 2) return name;
    return `${parts[0]} ${parts[1]}`;
  };

  const format12h = (time24: string) => {
    if (!time24 || !time24.includes(':')) return "07:00 AM";
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const add10Hours = (time24: string) => {
    if (!time24 || !time24.includes(':')) return "17:00";
    const [h, m] = time24.split(':').map(Number);
    const newH = (h + 10) % 24;
    return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const timeToMinutes = (time24: string) => {
    if (!time24 || !time24.includes(':')) return 420; // 07:00
    const [h, m] = time24.split(':').map(Number);
    return h * 60 + m;
  };

  const getNaturalDate = (isoDate: string) => {
    if (!isoDate) return "Rol";
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const parts = isoDate.split('-');
    if (parts.length < 3) return isoDate;
    const [year, month, day] = parts;
    const monthName = months[parseInt(month) - 1];
    return `Rol para el día ${parseInt(day)}/${monthName}/${year}`;
  };

  const handleGenerate = () => {
    const count = typeof requiredCount === 'string' ? parseInt(requiredCount) : requiredCount;
    if (!count || count <= 0) {
      setShowWarning({ isOpen: true, msg: 'Debes ingresar un número válido de operadores.' });
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
      setShowWarning({ isOpen: true, msg: `No hay suficientes operadores. Hay ${available.length} disponibles que no tienen rol asignado hoy en otras sedes.` });
      return;
    }

    const store = (stores || []).find(s => s.id === selectedStore);
    if (!store) return;

    let candidates = [...available].sort(() => Math.random() - 0.5);
    let selection = candidates.slice(0, count);
    let assignments: Assignment[] = [];

    if (scheduleMode === 'FIXED') {
      assignments = selection.map(d => {
        const scheduleStr = d.baseSchedule || '07:00 A 17:00';
        return { driverId: d.id, driverName: d.fullName, schedule: scheduleStr, teamCode: d.teamCode };
      });
    } else {
      const startMin = timeToMinutes(startEntryTime);
      const endMin = timeToMinutes(endEntryTime);
      const totalWindow = endMin - startMin;
      const interval = count > 1 ? totalWindow / (count - 1) : 0;
      assignments = selection.map((d, i) => {
        const currentMin = startMin + (i * interval);
        const h = Math.floor(currentMin / 60);
        const m = Math.floor(currentMin % 60);
        const entry = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const exit = add10Hours(entry);
        return { driverId: d.id, driverName: d.fullName, schedule: `${format12h(entry)} A ${format12h(exit)}`, teamCode: d.teamCode };
      });
    }

    assignments.sort((a, b) => {
      const getEntryMinutes = (s: string) => {
        const parts = s.split(' A ')[0].split(' ');
        if (parts.length < 1) return 0;
        const timeParts = parts[0].split(':');
        let h = parseInt(timeParts[0]);
        const m = parseInt(timeParts[1] || "0");
        if (parts[1] === 'PM' && h !== 12) h += 12;
        if (parts[1] === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      return getEntryMinutes(a.schedule) - getEntryMinutes(b.schedule);
    });

    setGeneratedRole({
      id: `role_${Date.now()}`, storeId: store.id, storeName: store.name, storeCode: store.code, date, adminId: currentUser?.username || 'admin', createdAt: new Date().toISOString(),
      assignments
    });
    setEditingIndices(new Set());
    setTempSchedules({});
    setIsReorderMode(false);
    setToast({ message: 'Propuesta generada.', type: 'success' });
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
    newAssignments[index].schedule = tempSchedules[index];
    
    setGeneratedRole({ ...generatedRole, assignments: newAssignments });
    const newEditing = new Set(editingIndices);
    newEditing.delete(index);
    setEditingIndices(newEditing);
    
    setToast({ message: 'Horario confirmado.', type: 'success' });
  };

  const handlePublish = () => {
    if (!generatedRole || isLocked || isReorderMode) return;
    try {
      onPublish(generatedRole);
      setGeneratedRole(null);
      setToast({ message: 'Rol guardado correctamente.', type: 'success' });
    } catch (e) {
      setToast({ message: 'Error al guardar.', type: 'error' });
    }
  };

  const handleShareWhatsAppFormal = () => {
    if (!generatedRole) return;
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
    message += `_Este reporte es una notificación oficial de la coordinación operativa._\n`;
    message += `_Atentamente: Departamento de Operaciones Smart Go_`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    setToast({ message: 'WhatsApp abierto.', type: 'info' });
  };

  const handleDownloadImage = () => {
    if (!generatedRole || isLocked || isReorderMode) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = 1000;
      const headerHeight = 220;
      const rowHeight = 85;
      const padding = 60;
      const assignments = generatedRole.assignments || [];
      const totalHeight = headerHeight + (assignments.length * rowHeight) + 140;
      canvas.width = width;
      canvas.height = totalHeight;
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, totalHeight);
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.2)'; 
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, width - 40, totalHeight - 40);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((generatedRole.storeName || 'TIENDA').toUpperCase(), width / 2, 90);
      const formattedDateText = getNaturalDate(generatedRole.date);
      ctx.fillStyle = '#2563eb'; 
      ctx.font = 'bold 24px monospace';
      ctx.fillText(formattedDateText.toUpperCase(), width / 2, 135);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(generatedRole.storeCode || '---', width / 2, 170);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(padding, 200);
      ctx.lineTo(width - padding, 200);
      ctx.stroke();
      const tableTop = 240;
      ctx.textAlign = 'left';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      const colTimeX = padding + 20;
      const colNameX = padding + 280;
      const colIdX = padding + 700;
      ctx.fillText('HORARIO (ENTRADA - SALIDA)', colTimeX, tableTop);
      ctx.fillText('OPERADOR', colNameX, tableTop);
      ctx.fillText('ID FLOTA', colIdX, tableTop);
      assignments.forEach((assignment, index) => {
        const y = tableTop + 60 + (index * rowHeight);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(padding, y - 45, width - (padding * 2), rowHeight - 15, 12);
            ctx.fill();
        } else {
            ctx.fillRect(padding, y - 45, width - (padding * 2), rowHeight - 15);
        }
        ctx.fillStyle = '#2563eb'; 
        ctx.font = 'bold 20px monospace';
        ctx.fillText(assignment.schedule, colTimeX, y);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Inter, sans-serif';
        // Usar nombre corto en la imagen
        ctx.fillText((formatShortName(assignment.driverName) || 'S/N').toUpperCase(), colNameX, y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(assignment.teamCode || '---', colIdX, y);
      });
      const footerY = totalHeight - 60;
      ctx.textAlign = 'center';
      ctx.font = 'italic 14px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText(`Registro generado por @${generatedRole.adminId} el ${new Date(generatedRole.createdAt).toLocaleString()}`, width / 2, footerY);
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('SISTEMA DE GESTIÓN • DOCUMENTO OFICIAL DE OPERACIÓN', width / 2, footerY + 25);
      const link = document.createElement('a');
      link.download = `ROL_${generatedRole.storeCode}_${generatedRole.date}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      setToast({ message: 'Imagen exportada con éxito.', type: 'success' });
    } catch (e) {
      setToast({ message: 'Error en exportación.', type: 'error' });
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      const ghost = document.createElement('div');
      ghost.style.display = 'none';
      e.dataTransfer.setDragImage(ghost, 0, 0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !generatedRole) return;
    const newAssignments = [...(generatedRole.assignments || [])];
    const operatorData = newAssignments.map(a => ({
      driverId: a.driverId,
      driverName: a.driverName,
      teamCode: a.teamCode
    }));
    const [movedOperator] = operatorData.splice(draggedIndex, 1);
    operatorData.splice(targetIndex, 0, movedOperator);
    const reorderedAssignments = newAssignments.map((assignment, i) => ({
      ...assignment,
      driverId: operatorData[i].driverId,
      driverName: operatorData[i].driverName,
      teamCode: operatorData[i].teamCode
    }));
    setGeneratedRole({
      ...generatedRole,
      assignments: reorderedAssignments
    });
    setDraggedIndex(null);
    setToast({ message: 'Operador movido exitosamente.', type: 'success' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter">Generador de rol</h2>
      
      {toast && <Toast message={toast.message} type={toast.type === 'info' ? 'success' : toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="space-y-5 p-5 md:p-6 h-fit">
          <div className="space-y-1">
            <label className="text-[9px] font-black theme-text-muted uppercase mb-2 block tracking-widest">Sede Logística</label>
            <select className="w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3 theme-text-main font-bold outline-none text-xs" value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
              {assignedStores.map(s => <option key={s.id} value={s.id} className="theme-bg-surface theme-text-main">{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black theme-text-muted uppercase mb-2 block tracking-widest">Fecha</label>
              <input type="date" className="w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3 theme-text-main font-bold outline-none text-xs" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black theme-text-muted uppercase mb-2 block tracking-widest">Cantidad</label>
              <input type="number" className="w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3 theme-text-main font-black outline-none text-xs" value={requiredCount} onChange={e => setRequiredCount(e.target.value === '' ? '' : parseInt(e.target.value))} />
            </div>
          </div>

          <div className="p-4 theme-bg-subtle rounded-2xl border theme-border space-y-4">
             <div className="flex gap-2 p-1 bg-black/20 rounded-xl">
                <button onClick={() => setScheduleMode('AUTO')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${scheduleMode === 'AUTO' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted opacity-40'}`}>Automático</button>
                <button onClick={() => setScheduleMode('FIXED')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${scheduleMode === 'FIXED' ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted opacity-40'}`}>Fijo</button>
             </div>
             {scheduleMode === 'AUTO' && (
                <div className="grid grid-cols-2 gap-3">
                  <input type="time" className="w-full bg-black/40 border theme-border rounded-lg px-2 py-2 theme-text-main text-[10px]" value={startEntryTime} onChange={e => setStartEntryTime(e.target.value)} />
                  <input type="time" className="w-full bg-black/40 border theme-border rounded-lg px-2 py-2 theme-text-main text-[10px]" value={endEntryTime} onChange={e => setEndEntryTime(e.target.value)} />
                </div>
             )}
          </div>
          <Button className="w-full py-4 uppercase font-black tracking-widest text-[10px] shadow-2xl bg-blue-600 hover:bg-blue-500" onClick={handleGenerate}><Zap className="w-3 h-3" /> Generar Propuesta</Button>
        </GlassCard>

        <GlassCard className="lg:col-span-2 min-h-[400px] p-0 overflow-hidden flex flex-col relative">
          {generatedRole ? (
            <div className="flex flex-col h-full animate-in fade-in duration-500">
              <div className="p-6 theme-bg-subtle border-b theme-border">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter leading-none">{generatedRole.storeName}</h3>
                    <p className="text-blue-500 font-mono font-black text-[10px] tracking-[0.2em] mt-1 uppercase">
                      {getNaturalDate(generatedRole.date)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleShareWhatsAppFormal} 
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-600/20 border border-emerald-500/30 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-lg"
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </button>
                    <button 
                      onClick={() => {
                        setIsReorderMode(!isReorderMode);
                        setEditingIndices(new Set());
                      }} 
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${isReorderMode ? 'bg-blue-700 border-blue-600 text-white shadow-lg scale-105' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'}`}
                    >
                      {isReorderMode ? <CloseIcon size={14} /> : <MoveVertical size={14} />}
                      {isReorderMode ? 'Cerrar' : 'Acomodar'}
                    </button>
                  </div>
                </div>
                {isLocked && (
                  <div className="mt-4 flex justify-center">
                    <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[8px] font-black uppercase tracking-widest rounded-lg animate-pulse">
                      Confirmación de horarios pendiente
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="theme-bg-subtle theme-text-muted text-[8px] font-black uppercase tracking-widest border-b theme-border sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="p-4 md:p-6 w-[35%]">Horario</th>
                      <th className="p-4 md:p-6">Operador e ID</th>
                      <th className="p-4 md:p-6 text-right w-[80px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="theme-text-main divide-y theme-border">
                    {(generatedRole.assignments || []).map((a, i) => {
                      const isBeingEdited = editingIndices.has(i);
                      return (
                        <tr 
                          key={i} 
                          onDragOver={isReorderMode ? handleDragOver : undefined}
                          onDrop={isReorderMode ? (e) => handleDrop(e, i) : undefined}
                          className={`transition-all border-l-2 ${isBeingEdited ? 'bg-blue-600/10 border-blue-500' : 'border-transparent'} ${draggedIndex === i ? 'opacity-30' : ''} ${isReorderMode ? 'hover:theme-bg-subtle' : ''}`}
                        >
                          <td className="p-4 md:p-6">
                            {isBeingEdited ? (
                              <input 
                                className="w-full glass-input rounded-xl px-3 py-2 theme-text-main font-mono text-[10px] outline-none border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                                value={tempSchedules[i] || ''}
                                onChange={e => setTempSchedules({...tempSchedules, [i]: e.target.value})}
                                autoFocus
                              />
                            ) : (
                              <span className="font-mono text-[11px] md:text-xs font-black text-blue-500">{a.schedule}</span>
                            )}
                          </td>
                          <td className="p-4 md:p-6">
                            <div className="flex items-center gap-4">
                              {isReorderMode && (
                                <div 
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, i)}
                                  className="cursor-grab active:cursor-grabbing p-2.5 theme-bg-subtle rounded-xl border theme-border theme-text-muted hover:theme-text-main transition-all shadow-sm"
                                  title="Arrastra para mover al operador"
                                >
                                  <GripVertical size={18} />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="font-black uppercase tracking-tight text-sm truncate theme-text-main max-w-[140px] md:max-w-none">
                                  {formatShortName(a.driverName)}
                                </span>
                                <span className="theme-text-muted text-[9px] font-mono tracking-widest">{a.teamCode}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 md:p-6 text-right">
                            {!isReorderMode && !isBeingEdited && (
                              <button 
                                onClick={() => startEditing(i, a.schedule)}
                                className="p-2.5 theme-bg-subtle theme-text-muted rounded-xl hover:bg-blue-600 hover:text-white transition-all border theme-border hover:border-blue-400/30"
                                title="Editar horario"
                              >
                                <Edit3 size={16} />
                              </button>
                            )}
                            {isBeingEdited && (
                              <div className="flex justify-end">
                                <button 
                                  onClick={() => confirmEdit(i)}
                                  className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/40"
                                  title="Confirmar cambios"
                                >
                                  <Check size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-5 theme-bg-subtle border-t theme-border flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="success" 
                  className={`flex-1 py-4 font-black uppercase tracking-widest text-[10px] transition-all ${isLocked || isReorderMode ? 'opacity-30 cursor-not-allowed grayscale' : ''}`} 
                  onClick={handlePublish}
                >
                  <Save className="w-4 h-4" /> Guardar Rol Final
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className={`flex-1 sm:flex-none px-6 transition-all font-black uppercase tracking-widest text-[10px] ${isLocked || isReorderMode ? 'opacity-30 cursor-not-allowed grayscale' : ''}`} 
                    onClick={handleDownloadImage}
                  >
                    <Download className="w-4 h-4" /> 
                    <span className="ml-1">Descargar imagen de rol</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center theme-text-muted opacity-10 border-4 border-dashed theme-border m-6 rounded-3xl">
              <Calendar className="w-12 h-12 mb-4" />
              <p className="font-black uppercase tracking-[0.4em] text-[8px]">Propuesta en espera</p>
            </div>
          )}
        </GlassCard>
      </div>

      <Modal isOpen={showWarning.isOpen} onClose={() => setShowWarning({ ...showWarning, isOpen: false })} title="Atención">
        <div className="text-center space-y-6 p-4">
          <div className="w-16 h-16 bg-amber-500/10 rounded-full mx-auto flex items-center justify-center border border-amber-500/20"><AlertCircle className="w-8 h-8 text-amber-500" /></div>
          <p className="theme-text-main font-medium leading-relaxed">{showWarning.msg}</p>
          <Button className="w-full py-4 uppercase font-black text-[10px] tracking-widest" variant="warning" onClick={() => setShowWarning({ ...showWarning, isOpen: false })}>Entendido</Button>
        </div>
      </Modal>
    </div>
  );
};
