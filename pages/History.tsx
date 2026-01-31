
import React, { useState, useRef, useMemo } from 'react';
import { History as HistoryIcon, Eye, Clock, User as UserIcon, Download, Calendar, Truck, Edit3, Save, Check, X, GripVertical, ChevronDown, ChevronUp, ClipboardCheck, AlertCircle, Upload, FileText, ImageIcon, MoveVertical, Search } from 'lucide-react';
import { GlassCard, Modal, Button, Toast } from '../components/UI';
import { DailyRole, Assignment, User, RoleVersion, AttendanceStatus, AttendanceRecord } from '../types';

interface Props {
  history: DailyRole[];
  currentUser?: User;
  onUpdateRole?: (updatedRole: DailyRole) => void;
}

export const History: React.FC<Props> = ({ history, currentUser, onUpdateRole }) => {
  const [selectedRole, setSelectedRole] = useState<DailyRole | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Estados para Edición de Rol
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editingIndices, setEditingIndices] = useState<Set<number>>(new Set());
  const [tempSchedules, setTempSchedules] = useState<Record<number, string>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<RoleVersion | null>(null);

  // Estados para Asistencia
  const [attendanceModal, setAttendanceModal] = useState<{ isOpen: boolean; assignmentIndex: number | null }>({ isOpen: false, assignmentIndex: null });
  const [tempAttendance, setTempAttendance] = useState<AttendanceRecord>({ 
    status: AttendanceStatus.PRESENT, 
    reason: '', 
    evidenceUrl: '', 
    evidenceType: 'image',
    updatedAt: '' 
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeHistory = history || [];

  // Filtrado en tiempo real
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return safeHistory;
    const q = searchQuery.toLowerCase().trim();
    return safeHistory.filter(h => 
      h.storeName.toLowerCase().includes(q) || 
      h.storeCode.toLowerCase().includes(q) ||
      h.assignments.some(a => a.driverName.toLowerCase().includes(q))
    );
  }, [safeHistory, searchQuery]);

  const formatDateLabel = (isoDate: string) => {
    if (!isoDate) return '---';
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
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

  // --- Lógica de Edición ---

  const handleStartEdit = (index: number, currentSchedule: string) => {
    const newEditing = new Set(editingIndices);
    newEditing.add(index);
    setEditingIndices(newEditing);
    setTempSchedules({ ...tempSchedules, [index]: currentSchedule });
  };

  const handleConfirmScheduleEdit = (index: number) => {
    if (!selectedRole) return;
    const newAssignments = [...selectedRole.assignments];
    newAssignments[index].schedule = tempSchedules[index];
    setSelectedRole({ ...selectedRole, assignments: newAssignments });
    
    const newEditing = new Set(editingIndices);
    newEditing.delete(index);
    setEditingIndices(newEditing);
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
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex || !selectedRole) return;
    
    const newAssignments = [...selectedRole.assignments];
    
    const driversData = newAssignments.map(a => ({
      driverId: a.driverId,
      driverName: a.driverName,
      teamCode: a.teamCode,
      attendance: a.attendance
    }));

    const [movedDriver] = driversData.splice(draggedIndex, 1);
    driversData.splice(targetIndex, 0, movedDriver);

    const reordered = newAssignments.map((a, i) => ({
      ...driversData[i],
      schedule: a.schedule 
    }));

    setSelectedRole({ ...selectedRole, assignments: reordered });
    setDraggedIndex(null);
  };

  const handleSaveRoleChanges = () => {
    if (!selectedRole || !onUpdateRole) return;
    
    const originalRoleInHistory = safeHistory.find(h => h.id === selectedRole.id);
    if (originalRoleInHistory) {
      const snapshot = JSON.parse(JSON.stringify(originalRoleInHistory.assignments));
      const newVersion: RoleVersion = {
        assignments: snapshot,
        updatedAt: new Date().toISOString(),
        adminId: currentUser?.username || 'unknown'
      };
      
      const updatedRole: DailyRole = {
        ...selectedRole,
        updatedAt: new Date().toISOString(),
        versions: originalRoleInHistory.versions ? [...originalRoleInHistory.versions, newVersion] : [newVersion]
      };
      
      onUpdateRole(updatedRole);
      setSelectedRole(updatedRole);
      setToast({ message: 'Cambios guardados con éxito', type: 'success' });
      setIsEditingRole(false);
      setShowVersions(true); 
    }
  };

  const handleCancelEdit = () => {
    const original = safeHistory.find(h => h.id === selectedRole?.id);
    if (original) {
      setSelectedRole(JSON.parse(JSON.stringify(original)));
    }
    setIsEditingRole(false);
    setEditingIndices(new Set());
    setToast({ message: 'Edición cancelada', type: 'info' });
  };

  // --- Lógica de Descarga ---

  const handleDownloadImage = () => {
    if (!selectedRole || isEditingRole) return;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const width = 1000;
      const headerHeight = 220;
      const rowHeight = 85;
      const padding = 60;
      const assignments = selectedRole.assignments || [];
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
      ctx.fillText((selectedRole.storeName || 'TIENDA').toUpperCase(), width / 2, 90);
      const formattedDateText = getNaturalDate(selectedRole.date);
      ctx.fillStyle = '#2563eb'; 
      ctx.font = 'bold 24px monospace';
      ctx.fillText(formattedDateText.toUpperCase(), width / 2, 135);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.fillText(selectedRole.storeCode || '---', width / 2, 170);
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
      ctx.fillText('ID FLOTA / USUARIO', colIdX, tableTop);
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
        ctx.fillText((assignment.driverName || 'S/N').toUpperCase(), colNameX, y);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(assignment.teamCode || '---', colIdX, y);
      });
      const footerY = totalHeight - 60;
      ctx.textAlign = 'center';
      ctx.font = 'italic 14px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText(`Copia descargada de historial • @${selectedRole.adminId} el ${new Date().toLocaleString()}`, width / 2, footerY);
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.fillText('SISTEMA DE GESTIÓN • DOCUMENTO OFICIAL DE OPERACIÓN', width / 2, footerY + 25);
      const link = document.createElement('a');
      link.download = `ROL_HISTORIAL_${selectedRole.storeCode}_${selectedRole.date}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      setToast({ message: 'Imagen exportada con éxito.', type: 'success' });
    } catch (e) {
      setToast({ message: 'Error en exportación.', type: 'error' });
    }
  };

  // --- Lógica de Asistencia ---

  const handleOpenAttendance = (index: number) => {
    if (!selectedRole) return;
    const current = selectedRole.assignments[index].attendance || { 
      status: AttendanceStatus.PRESENT, 
      reason: '', 
      evidenceUrl: '', 
      evidenceType: 'image',
      updatedAt: new Date().toISOString() 
    };
    setTempAttendance(current);
    setAttendanceModal({ isOpen: true, assignmentIndex: index });
  };

  const saveAttendance = () => {
    if (!selectedRole || attendanceModal.assignmentIndex === null || !onUpdateRole) return;
    const newAssignments = [...selectedRole.assignments];
    newAssignments[attendanceModal.assignmentIndex].attendance = { ...tempAttendance, updatedAt: new Date().toISOString() };
    
    const updated = { ...selectedRole, assignments: newAssignments };
    onUpdateRole(updated);
    setSelectedRole(updated);
    setAttendanceModal({ isOpen: false, assignmentIndex: null });
    setToast({ message: 'Asistencia actualizada exitosamente', type: 'success' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempAttendance({ 
          ...tempAttendance, 
          evidenceUrl: reader.result as string, 
          evidenceType: file.type.includes('pdf') ? 'pdf' : 'image' 
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20 shadow-xl">
            <HistoryIcon className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-3xl font-black theme-text-main uppercase tracking-tighter">Historial</h2>
            <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.3em]">Auditoría Operativa y Asistencia</p>
          </div>
        </div>
      </div>

      {/* Buscador de Historial */}
      <GlassCard className="p-4 md:p-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por tienda, código o nombre de operador..." 
            className="w-full glass-input rounded-xl pl-12 pr-4 py-3 text-sm outline-none font-bold" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
          />
        </div>
      </GlassCard>

      {toast && <Toast message={toast.message} type={toast.type === 'info' ? 'success' : toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHistory.length === 0 ? (
          <div className="col-span-full py-40 flex flex-col items-center justify-center text-center opacity-10">
            {searchQuery ? <Search className="w-16 h-16 mb-6 theme-text-muted" /> : <HistoryIcon className="w-16 h-16 mb-6 theme-text-muted" />}
            <p className="font-black uppercase tracking-[0.5em] text-sm w-full theme-text-muted">
              {searchQuery ? 'Sin resultados para la búsqueda' : 'Sin registros históricos'}
            </p>
          </div>
        ) : (
          filteredHistory.map((role) => (
            <GlassCard key={role.id} className="group hover:border-blue-500/30 transition-all duration-500">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-blue-600/20 text-blue-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{role.storeCode}</div>
                <div className="flex items-center gap-2 theme-text-muted opacity-40"><Calendar className="w-3 h-3" /><span className="text-[10px] font-bold">{formatDateLabel(role.date)}</span></div>
              </div>
              <h4 className="text-xl font-black theme-text-main mb-6 uppercase tracking-tight truncate">{role.storeName}</h4>
              <button onClick={() => { setSelectedRole(JSON.parse(JSON.stringify(role))); setIsEditingRole(false); setShowVersions(false); }} className="w-full flex items-center justify-center gap-2 bg-blue-600/10 text-blue-500 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">Ver Detalle <Eye size={14} /></button>
            </GlassCard>
          ))
        )}
      </div>

      <Modal isOpen={!!selectedRole} onClose={() => setSelectedRole(null)} title="Detalle del Rol">
        {selectedRole && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-6 theme-bg-subtle rounded-[2.5rem] border theme-border">
              <div className="text-center sm:text-left">
                <h4 className="text-2xl font-black theme-text-main uppercase tracking-tight">{selectedRole.storeName}</h4>
                <p className="text-blue-500 font-mono text-xs font-black uppercase">{formatDateLabel(selectedRole.date)}</p>
              </div>
              <div className="flex gap-2">
                 <button 
                   disabled={isEditingRole}
                   onClick={handleDownloadImage} 
                   className={`flex items-center gap-2 px-6 py-3 theme-bg-subtle text-blue-500 rounded-2xl transition-all shadow-lg border theme-border ${isEditingRole ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:bg-blue-600 hover:text-white'}`} 
                   title="Descargar Imagen"
                 >
                   <Download size={20} />
                   <span className="text-[10px] font-black uppercase tracking-widest">Descargar imagen</span>
                 </button>
                 <button 
                   onClick={() => isEditingRole ? handleCancelEdit() : setIsEditingRole(true)} 
                   className={`p-3 rounded-2xl transition-all shadow-lg border theme-border ${isEditingRole ? 'bg-rose-500 text-white shadow-rose-500/20' : 'theme-bg-subtle text-amber-500 hover:bg-amber-500 hover:text-white'}`} 
                   title={isEditingRole ? "Cerrar Edición" : "Editar Rol"}
                 >
                   {isEditingRole ? <X size={20} /> : <Edit3 size={20} />}
                 </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border theme-border theme-bg-subtle">
              <table className="w-full text-left">
                <thead className="theme-bg-subtle text-[8px] font-black uppercase theme-text-muted">
                  <tr>
                    <th className="p-4">Horario</th>
                    <th className="p-4">Operador / Usuario</th>
                    <th className="p-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y theme-border">
                  {selectedRole.assignments.map((a, i) => {
                    const isEditingSchedule = editingIndices.has(i);
                    return (
                      <tr 
                        key={i} 
                        onDragOver={isEditingRole ? handleDragOver : undefined}
                        onDrop={isEditingRole ? (e) => handleDrop(e, i) : undefined}
                        className={`hover:theme-bg-surface transition-colors ${draggedIndex === i ? 'opacity-30' : ''}`}
                      >
                        <td className="p-4">
                          {isEditingSchedule ? (
                            <input 
                              className="w-full glass-input rounded-xl px-2 py-1 text-[10px] font-mono outline-none border-blue-500" 
                              value={tempSchedules[i]} 
                              onChange={e => setTempSchedules({...tempSchedules, [i]: e.target.value})}
                              autoFocus
                            />
                          ) : (
                            <span className="font-mono text-[10px] text-blue-500 font-black">{a.schedule}</span>
                          )}
                        </td>
                        <td className="p-4">
                           <div className="flex items-center gap-3">
                              {isEditingRole && (
                                <div 
                                  draggable 
                                  onDragStart={(e) => handleDragStart(e, i)}
                                  className="cursor-grab p-1 theme-bg-subtle rounded-lg theme-text-muted hover:theme-text-main"
                                >
                                  <GripVertical size={14} />
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black uppercase theme-text-main leading-none">{a.driverName}</span>
                                <span className="text-[8px] font-mono theme-text-muted mt-1 uppercase tracking-widest">{a.teamCode || 'S/ID'}</span>
                                <span className={`text-[7px] font-bold uppercase tracking-widest mt-0.5 ${
                                  a.attendance?.status === AttendanceStatus.ABSENT ? 'text-rose-500' : 
                                  a.attendance?.status === AttendanceStatus.DELAYED ? 'text-amber-500' : 
                                  a.attendance?.status === AttendanceStatus.PRESENT ? 'text-emerald-500' : 'theme-text-muted opacity-40'
                                }`}>
                                  {a.attendance?.status || 'SIN REGISTRAR'}
                                </span>
                              </div>
                           </div>
                        </td>
                        <td className="p-4 text-center">
                          {!isEditingRole ? (
                            <button onClick={() => handleOpenAttendance(i)} className="p-2.5 theme-bg-subtle text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all" title="Asistencia">
                              <ClipboardCheck size={18}/>
                            </button>
                          ) : (
                            isEditingSchedule ? (
                              <button onClick={() => handleConfirmScheduleEdit(i)} className="p-2 bg-emerald-600 text-white rounded-xl shadow-lg">
                                <Check size={14} />
                              </button>
                            ) : (
                              <button onClick={() => handleStartEdit(i, a.schedule)} className="p-2 theme-bg-subtle text-amber-500 rounded-xl">
                                <Edit3 size={14} />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isEditingRole && (
              <Button onClick={handleSaveRoleChanges} variant="success" className="w-full py-4 text-[10px] uppercase font-black tracking-widest shadow-xl">
                <Save size={16} /> Guardar Cambios y Nueva Versión
              </Button>
            )}

            {selectedRole.versions && selectedRole.versions.length > 0 && (
              <div className="space-y-3">
                <button 
                  onClick={() => setShowVersions(!showVersions)} 
                  className="flex items-center gap-2 text-[10px] font-black uppercase theme-text-muted hover:theme-text-main transition-colors pl-2"
                >
                  <HistoryIcon size={14} /> Historial de Versiones ({selectedRole.versions.length})
                </button>
                {showVersions && (
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar p-2 theme-bg-subtle rounded-2xl border theme-border">
                    {selectedRole.versions.slice().reverse().map((v, idx) => {
                      const verNum = selectedRole.versions!.length - idx;
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setViewingVersion(v)}
                          className="flex justify-between items-center p-3 theme-bg-surface rounded-xl border theme-border hover:border-blue-500/50 cursor-pointer transition-all"
                        >
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black theme-text-main uppercase">Versión {verNum} {verNum === 1 ? '(Original)' : ''}</span>
                            <span className="text-[7px] font-bold theme-text-muted">Editado por: {v.adminId}</span>
                          </div>
                          <div className="flex items-center gap-3">
                             <span className="text-[8px] font-mono theme-text-muted">{new Date(v.updatedAt).toLocaleString()}</span>
                             <Eye size={14} className="theme-text-muted" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Button onClick={() => setSelectedRole(null)} variant="outline" className="w-full py-4 text-[10px] uppercase font-black">Cerrar Detalle</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!viewingVersion} onClose={() => setViewingVersion(null)} title="Previsualización de Versión">
        {viewingVersion && (
          <div className="space-y-6">
             <div className="p-4 theme-bg-subtle rounded-2xl border theme-border flex justify-between items-center">
                <div>
                   <p className="text-[8px] font-black theme-text-muted uppercase">Editado por</p>
                   <p className="text-xs font-black theme-text-main uppercase">{viewingVersion.adminId}</p>
                </div>
                <div className="text-right">
                   <p className="text-[8px] font-black theme-text-muted uppercase">Fecha de edición</p>
                   <p className="text-xs font-black theme-text-main uppercase">{new Date(viewingVersion.updatedAt).toLocaleString()}</p>
                </div>
             </div>

             <div className="overflow-hidden rounded-2xl border theme-border">
                <table className="w-full text-left">
                  <thead className="theme-bg-subtle text-[8px] font-black uppercase theme-text-muted">
                    <tr><th className="p-3">Horario</th><th className="p-3">Operador / ID</th></tr>
                  </thead>
                  <tbody className="divide-y theme-border theme-text-main">
                    {viewingVersion.assignments.map((a, idx) => (
                      <tr key={idx} className="theme-bg-surface">
                        <td className="p-3 font-mono text-[10px] text-blue-500">{a.schedule}</td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase">{a.driverName}</span>
                            <span className="text-[7px] font-mono theme-text-muted uppercase">{a.teamCode}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             
             <p className="text-[8px] font-bold theme-text-muted uppercase text-center italic">
               * Esta es una vista de solo lectura de una configuración previa.
             </p>

             <Button onClick={() => setViewingVersion(null)} className="w-full py-4 text-[10px] font-black uppercase tracking-widest">Cerrar Previsualización</Button>
          </div>
        )}
      </Modal>

      <Modal isOpen={attendanceModal.isOpen} onClose={() => setAttendanceModal({ isOpen: false, assignmentIndex: null })} title="Registro de Asistencia">
        <div className="space-y-6">
           <div className="flex gap-2 p-1.5 theme-bg-subtle rounded-2xl border theme-border">
              {Object.values(AttendanceStatus).map(s => (
                <button 
                  key={s} 
                  onClick={() => setTempAttendance({ ...tempAttendance, status: s as AttendanceStatus })}
                  className={`flex-1 py-3 text-[8px] font-black uppercase rounded-xl transition-all ${
                    tempAttendance.status === s ? 'bg-blue-600 text-white shadow-xl' : 'theme-text-muted opacity-40 hover:opacity-100'
                  }`}
                >
                  {s}
                </button>
              ))}
           </div>

           {(tempAttendance.status === AttendanceStatus.DELAYED || tempAttendance.status === AttendanceStatus.ABSENT) && (
             <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase theme-text-muted pl-1 tracking-widest">Motivo de la incidencia</label>
                   <textarea 
                     className="w-full glass-input rounded-2xl p-4 text-sm outline-none resize-none h-24" 
                     placeholder="Escribe la razón (opcional)..." 
                     value={tempAttendance.reason || ''} 
                     onChange={e => setTempAttendance({...tempAttendance, reason: e.target.value})} 
                   />
                </div>
                
                <div className="space-y-1">
                   <label className="text-[9px] font-black uppercase theme-text-muted pl-1 tracking-widest">Evidencia de soporte (Opcional)</label>
                   <div className="flex items-center gap-4">
                      <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed theme-border rounded-2xl theme-bg-subtle hover:theme-bg-surface transition-all group"
                      >
                        {tempAttendance.evidenceUrl ? (
                           <div className="flex flex-col items-center gap-2">
                              {tempAttendance.evidenceType === 'pdf' ? <FileText className="text-emerald-500" size={32}/> : <ImageIcon className="text-emerald-500" size={32}/>}
                              <span className="text-[8px] font-black text-emerald-500 uppercase">Archivo Cargado</span>
                              <span onClick={(e) => { e.stopPropagation(); setTempAttendance({...tempAttendance, evidenceUrl: ''}); }} className="text-rose-500 text-[8px] font-black uppercase mt-1 underline">Eliminar</span>
                           </div>
                        ) : (
                           <>
                              <Upload className="text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
                              <span className="text-[9px] font-black theme-text-muted uppercase">JPG, PNG o PDF</span>
                           </>
                        )}
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                   </div>
                </div>
             </div>
           )}

           <Button onClick={saveAttendance} variant="success" className="w-full py-5 text-[10px] font-black uppercase tracking-widest shadow-2xl">Confirmar Registro</Button>
        </div>
      </Modal>
    </div>
  );
};
