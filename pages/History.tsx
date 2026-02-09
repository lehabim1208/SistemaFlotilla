
import React, { useState, useRef, useMemo } from 'react';
import { 
  History as HistoryIcon, Eye, Clock, User as UserIcon, Download, Calendar, 
  Truck, Edit3, Save, Check, X, GripVertical, ClipboardCheck, AlertCircle, 
  Search, CheckCircle2, XCircle, Clock4, FileCode, ImageIcon, Upload, 
  MessageSquare, Trash2, Activity, CheckCircle, MoveVertical, Loader2,
  FileText, Ghost, ChevronLeft, ChevronRight, Plus
} from 'lucide-react';
import { GlassCard, Modal, Button, Toast } from '../components/UI';
import { DailyRole, Assignment, User, RoleVersion, AttendanceStatus, AttendanceRecord, UserRole } from '../types';

interface Props {
  history: DailyRole[];
  currentUser?: User;
  onUpdateRole?: (updatedRole: DailyRole) => void;
  onDeleteRole?: (id: string) => void;
}

const ITEMS_PER_PAGE = 5;
const IMGBB_API_KEY = '605cbcef44fb63ad7761c9eadd84c06e';

// Función optimizada para comprimir imágenes rápidamente
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800; // Reducción estratégica
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Error al comprimir imagen'));
        },
        'image/jpeg',
        0.5 // Peso ultra ligero
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen'));
    };
    img.src = url;
  });
};

export const History: React.FC<Props> = ({ history, currentUser, onUpdateRole, onDeleteRole }) => {
  const [selectedRole, setSelectedRole] = useState<DailyRole | null>(null);
  const [deletingRole, setDeletingRole] = useState<DailyRole | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  
  const [tempAssignments, setTempAssignments] = useState<Assignment[]>([]);
  const [attendanceModal, setAttendanceModal] = useState<{ isOpen: boolean; index: number | null }>({ isOpen: false, index: null });
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [attForm, setAttForm] = useState<AttendanceRecord>({
    status: AttendanceStatus.PRESENT,
    reason: '',
    evidenceUrl: '',
    evidenceType: 'image',
    updatedAt: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayIso = new Date().toISOString().split('T')[0];

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

  const formatHistoryDate = (isoDate: string) => {
    if (!isoDate) return "";
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [year, month, day] = parts;
    return `${day}/${months[parseInt(month) - 1]}/${year}`;
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

  const sortedHistory = useMemo(() => {
    const isSuper = currentUser?.role === UserRole.SUPERADMIN;
    const userStoreIds = currentUser?.assignedStoreIds || [];

    let baseHistory = [...(history || [])];
    if (!isSuper) {
      baseHistory = baseHistory.filter(h => userStoreIds.includes(h.storeId));
    }

    return baseHistory.sort((a, b) => {
      const aIsToday = a.date === todayIso;
      const bIsToday = b.date === todayIso;
      const aIsFuture = a.date > todayIso;
      const bIsFuture = b.date > todayIso;
      const aIsPast = a.date < todayIso;
      const bIsPast = b.date < todayIso;

      if (aIsToday && !bIsToday) return -1;
      if (!aIsToday && bIsToday) return 1;
      if (aIsFuture && bIsPast) return -1;
      if (aIsPast && bIsFuture) return 1;
      if (aIsFuture && bIsFuture) return a.date.localeCompare(b.date);
      if (aIsPast && bIsPast) return b.date.localeCompare(a.date);
      return 0;
    });
  }, [history, todayIso, currentUser]);

  const filteredHistory = useMemo(() => {
    let results = sortedHistory;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(h => {
        const isToday = h.date === todayIso;
        const isFuture = h.date > todayIso;
        const statusStr = isToday ? 'en operación' : isFuture ? 'por comenzar' : 'concluido';
        const formattedDate = formatHistoryDate(h.date).toLowerCase();
        return (
          h.storeName.toLowerCase().includes(q) ||
          h.storeCode.toLowerCase().includes(q) ||
          h.date.includes(q) ||
          formattedDate.includes(q) ||
          statusStr.includes(q)
        );
      });
    }
    return results;
  }, [sortedHistory, searchQuery, todayIso]);

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  const getFullDateLabel = (isoDate: string) => {
    if (!isoDate) return "";
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const [year, month, day] = isoDate.split('-');
    return `Rol para el día ${parseInt(day)} de ${months[parseInt(month) - 1]} del ${year}`;
  };

  const handleOpenDetail = (role: DailyRole) => {
    setSelectedRole(role);
    setTempAssignments(JSON.parse(JSON.stringify(role.assignments || [])));
    setIsEditingRole(false);
  };

  const handleDeleteRoleConfirm = () => {
    if (deletingRole && onDeleteRole) {
      onDeleteRole(deletingRole.id);
      setToast({ message: 'Rol eliminado correctamente', type: 'success' });
      setDeletingRole(null);
    }
  };

  const handleCancelEditing = () => {
    const original = history.find(h => h.id === selectedRole?.id);
    if (original) {
      setTempAssignments(JSON.parse(JSON.stringify(original.assignments || [])));
    } else if (selectedRole) {
      setTempAssignments(JSON.parse(JSON.stringify(selectedRole.assignments || [])));
    }
    setIsEditingRole(false);
    setToast({ message: 'Cambios descartados', type: 'info' });
  };

  const handleOpenAttendance = (index: number) => {
    const current = tempAssignments[index].attendance;
    if (current) {
      setAttForm(current);
      setShowExtraFields(!!(current.reason || current.evidenceUrl));
    } else {
      setAttForm({ 
        status: AttendanceStatus.PRESENT, 
        reason: '', 
        evidenceUrl: '', 
        evidenceType: 'image',
        updatedAt: '' 
      });
      setShowExtraFields(false);
    }
    setAttendanceModal({ isOpen: true, index });
  };

  const saveAttendanceToTemp = () => {
    if (attendanceModal.index === null) return;
    const next = [...tempAssignments];
    next[attendanceModal.index] = {
      ...next[attendanceModal.index],
      attendance: { ...attForm, updatedAt: new Date().toISOString() }
    };
    setTempAssignments(next);
    setAttendanceModal({ isOpen: false, index: null });
    setShowExtraFields(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    
    // Si es imagen, comprimir optimizadamente y subir a ImgBB
    if (!isPdf && file.type.startsWith('image/')) {
      setIsUploadingEvidence(true);
      setToast({ message: 'Optimizando evidencia...', type: 'info' });

      try {
        const compressedBlob = await compressImage(file);
        
        const formData = new FormData();
        formData.append('image', compressedBlob, 'evidence.jpg');

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          setAttForm({ ...attForm, evidenceUrl: result.data.url, evidenceType: 'image' });
          setToast({ message: 'Evidencia cargada', type: 'success' });
        } else {
          throw new Error('Error al subir a ImgBB');
        }
      } catch (err) {
        console.error(err);
        setToast({ message: 'Error al procesar la imagen.', type: 'error' });
      } finally {
        setIsUploadingEvidence(false);
      }
    } else {
      // Si es PDF, mantener como Base64 (ImgBB no soporta PDF)
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttForm({ ...attForm, evidenceUrl: reader.result as string, evidenceType: isPdf ? 'pdf' : 'image' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragStart = (index: number) => {
    if (!isEditingRole) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex || !isEditingRole) return;
    const next = [...tempAssignments];
    const sourceDriver = { ...next[draggedIndex] };
    const targetDriver = { ...next[targetIndex] };
    
    next[draggedIndex] = { ...next[draggedIndex], driverId: targetDriver.driverId, driverName: targetDriver.driverName, teamCode: targetDriver.teamCode, attendance: targetDriver.attendance };
    next[targetIndex] = { ...next[targetIndex], driverId: sourceDriver.driverId, driverName: sourceDriver.driverName, teamCode: sourceDriver.teamCode, attendance: sourceDriver.attendance };

    setTempAssignments(next);
    setDraggedIndex(null);
  };

  const handleDownloadImage = () => {
    if (!selectedRole || isEditingRole) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = currentUser?.settings?.darkMode ?? true;
    
    const width = 1080;
    const headerHeight = 280;
    const rowHeight = 110;
    const padding = 70;
    const assignments = tempAssignments || [];
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
    ctx.fillText((selectedRole.storeName || 'Sede Logística').toUpperCase(), width / 2, 100);
    
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.fillText(`ROL OPERATIVO - ${getNaturalDate(selectedRole.date).toUpperCase()}`, width / 2, 155);
    
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`ID SEDE: ${selectedRole.storeCode || '---'} | GENERADO POR: ${selectedRole.adminId.toUpperCase()}`, width / 2, 195);

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
    link.download = `ROL_HISTORIAL_${selectedRole.storeCode}_${selectedRole.date}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    setToast({ message: 'Imagen exportada', type: 'success' });
  };

  const handleCloseMainModal = () => {
    setSelectedRole(null);
    setIsEditingRole(false);
    setTempAssignments([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">
          <HistoryIcon className="w-7 h-7 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter">Historial</h2>
          <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.3em]">Auditoría Operativa</p>
        </div>
      </div>

      <GlassCard className="p-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={18} />
          <input 
            type="text" 
            placeholder="Sede, código, fecha o estatus (concluido, operación...)" 
            className="w-full glass-input rounded-xl pl-12 pr-4 py-3 text-xs md:text-sm outline-none font-bold" 
            value={searchQuery} 
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} 
          />
        </div>
      </GlassCard>

      {toast && <Toast message={toast.message} type={toast.type === 'info' ? 'success' : toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedHistory.length === 0 ? (
          <div className="col-span-full py-20 opacity-20 text-center flex flex-col items-center gap-4">
            <Activity size={48} />
            <p className="text-xs font-black uppercase tracking-widest">Sin registros disponibles para tus sedes</p>
          </div>
        ) : (
          paginatedHistory.map((role) => {
            const isToday = role.date === todayIso;
            const isFuture = role.date > todayIso;
            return (
              <GlassCard key={role.id} className={`group border-2 transition-all relative overflow-hidden p-6 ${isToday ? 'border-emerald-500/20 shadow-emerald-500/5 bg-emerald-500/[0.01]' : isFuture ? 'border-blue-500/20 bg-blue-500/[0.01]' : 'border-transparent opacity-90'}`}>
                <div className="flex justify-between items-center mb-5">
                  <div className="bg-blue-600/10 text-blue-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/10">
                    {role.storeCode}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isToday ? (
                      <>
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-emerald-500 tracking-tighter">En operación</span>
                      </>
                    ) : isFuture ? (
                      <>
                        <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
                        <span className="text-[9px] font-black uppercase text-sky-400 tracking-tighter">Por comenzar</span>
                      </>
                    ) : (
                      <span className="text-[9px] font-black uppercase theme-text-muted tracking-tighter">Concluido</span>
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-xl font-black theme-text-main uppercase truncate leading-tight mb-1">{role.storeName}</h4>
                  <div className="flex items-center gap-2 theme-text-muted">
                    <Calendar size={12} className="opacity-40" />
                    <span className="text-[11px] font-bold tracking-tight">{formatHistoryDate(role.date)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => handleOpenDetail(role)} variant="outline" className="flex-1 py-3.5 text-[10px] uppercase font-black tracking-[0.15em] hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                    <Eye size={14} /> Ver Detalle
                  </Button>
                  {isFuture && (
                    <button 
                      onClick={() => setDeletingRole(role)}
                      className="p-3 theme-bg-subtle text-rose-500 rounded-xl border theme-border hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8">
          <button 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
            className="p-3 theme-bg-surface border theme-border rounded-xl theme-text-main disabled:opacity-20 transition-all hover:scale-105 active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button 
                key={i} 
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'theme-bg-surface theme-text-muted border theme-border hover:theme-text-main'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
            className="p-3 theme-bg-surface border theme-border rounded-xl theme-text-main disabled:opacity-20 transition-all hover:scale-105 active:scale-95"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      <Modal isOpen={!!selectedRole} onClose={handleCloseMainModal} title="DETALLE DEL ROL">
        {selectedRole && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="p-5 theme-bg-subtle rounded-[2.5rem] border theme-border flex flex-col items-center text-center">
              <h4 className="text-lg font-black theme-text-main uppercase mb-0.5 tracking-tight leading-tight">{selectedRole.storeName}</h4>
              <p className="text-blue-500 font-bold text-[10px] uppercase mb-4 tracking-widest">{getFullDateLabel(selectedRole.date)}</p>
              
              <div className="flex gap-2.5 items-center">
                <button 
                  onClick={handleDownloadImage} 
                  disabled={isEditingRole}
                  className={`flex items-center gap-2 px-4 py-2 theme-bg-subtle text-blue-500 rounded-xl transition-all border theme-border shadow-md ${isEditingRole ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:bg-blue-600 hover:text-white'}`}
                >
                  <Download size={14} /><span className="text-[9px] font-black uppercase">Descargar</span>
                </button>
                {isEditingRole ? (
                  <button onClick={handleCancelEditing} className="w-10 h-10 flex items-center justify-center bg-rose-500 text-white rounded-full shadow-lg border border-rose-400 hover:scale-105 active:scale-95 transition-transform">
                    <X size={20} />
                  </button>
                ) : (
                  (selectedRole.date >= todayIso) && (
                    <button onClick={() => setIsEditingRole(true)} className="flex items-center gap-2 px-4 py-2 theme-bg-subtle text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all border theme-border shadow-md">
                      <Edit3 size={14} /><span className="text-[9px] font-black uppercase">Editar / Acomodar</span>
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border theme-border shadow-xl">
              <table className="w-full text-left">
                <thead className="theme-bg-subtle text-[8px] font-black uppercase theme-text-muted border-b theme-border">
                  <tr>
                    <th className="p-3 w-[100px] md:w-[125px]">Turno</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 text-center w-[75px] md:w-[85px]">Gestión</th>
                  </tr>
                </thead>
                <tbody className="divide-y theme-border theme-bg-surface">
                  {tempAssignments.map((a, i) => {
                    const times = a.schedule.toUpperCase().split(' A ');
                    const entry = formatTo12h(times[0] || '---');
                    const exit = formatTo12h(times[1] || '---');
                    return (
                      <tr key={i} onDragOver={isEditingRole ? handleDragOver : undefined} onDrop={isEditingRole ? () => handleDrop(i) : undefined} className={`${draggedIndex === i ? 'opacity-20' : ''} transition-colors hover:bg-black/5`}>
                        <td className="p-2.5 align-middle">
                          {isEditingRole ? (
                            <input className="w-full glass-input rounded-lg px-2 py-1.5 font-mono text-[9px] theme-text-main outline-none focus:border-blue-500 transition-colors" value={a.schedule} onChange={e => {
                              const next = [...tempAssignments];
                              next[i] = { ...next[i], schedule: e.target.value };
                              setTempAssignments(next);
                            }} />
                          ) : (
                            <div className="flex flex-col gap-1 w-fit">
                              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
                                <span className="font-mono text-[10px] font-black text-emerald-600 whitespace-nowrap">{entry}</span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></div>
                                <span className="font-mono text-[10px] font-black text-rose-600 whitespace-nowrap">{exit}</span>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 align-middle overflow-hidden">
                          <div className="flex items-center gap-2">
                            {isEditingRole && <div draggable onDragStart={() => handleDragStart(i)} className="cursor-grab text-blue-500/40 p-0.5 hover:text-blue-500 transition-colors shrink-0"><GripVertical size={14} /></div>}
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] md:text-[12px] font-black uppercase theme-text-main truncate leading-none mb-0.5">{formatShortName(a.driverName)}</span>
                              <span className="text-[7.5px] theme-text-muted font-mono tracking-widest uppercase opacity-70 truncate">{a.teamCode}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-2.5 text-center align-middle">
                          <button 
                            onClick={() => handleOpenAttendance(i)} 
                            className={`flex flex-col items-center gap-1 mx-auto transition-all hover:scale-110 active:scale-90`}
                          >
                            <div className={`p-2 rounded-xl border shadow-sm transition-all ${
                              a.attendance?.status === AttendanceStatus.PRESENT ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' :
                              a.attendance?.status === AttendanceStatus.DELAYED ? 'bg-amber-500/20 border-amber-500 text-amber-500' :
                              a.attendance?.status === AttendanceStatus.ABSENT ? 'bg-rose-500/20 border-rose-500 text-rose-500' :
                              'theme-bg-subtle theme-border theme-text-muted opacity-30'
                            }`}>
                              {a.attendance?.status === AttendanceStatus.PRESENT ? <CheckCircle2 size={18} /> :
                               a.attendance?.status === AttendanceStatus.DELAYED ? <Clock4 size={18} /> :
                               a.attendance?.status === AttendanceStatus.ABSENT ? <XCircle size={18} /> : <ClipboardCheck size={18} />}
                            </div>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isEditingRole ? (
              <div className="flex flex-col gap-2.5">
                <Button onClick={() => {
                  if (!selectedRole || !onUpdateRole) return;
                  const updated = { ...selectedRole, assignments: tempAssignments, updatedAt: new Date().toISOString() };
                  onUpdateRole(updated);
                  setSelectedRole(updated);
                  setIsEditingRole(false);
                  setToast({ message: 'Cambios guardados', type: 'success' });
                }} variant="success" className="w-full py-4 text-[10px] uppercase font-black tracking-widest shadow-emerald-900/20">
                  <Save size={18} /> Guardar cambios del rol
                </Button>
                <p className="text-[8px] font-black theme-text-muted uppercase text-center tracking-widest opacity-60">Icono lateral para reacomodar operadores</p>
              </div>
            ) : (
              <Button onClick={handleCloseMainModal} variant="outline" className="w-full py-4 text-[10px] uppercase font-black tracking-widest opacity-60">Cerrar detalle</Button>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!deletingRole} onClose={() => setDeletingRole(null)} title="ELIMINAR ROL">
        <div className="text-center space-y-6 p-4">
          <div className="w-20 h-20 bg-rose-500/10 rounded-full mx-auto flex items-center justify-center border border-rose-500/20 animate-pulse">
            <AlertCircle className="w-10 h-10 text-rose-500" />
          </div>
          <div className="space-y-3">
             <h4 className="theme-text-main font-black uppercase text-[13px] tracking-tight px-4">
               ¿Confirmas la eliminación de este rol?
             </h4>
             <p className="theme-text-muted font-bold uppercase text-[9px] tracking-widest leading-relaxed opacity-70">
               Esta acción es irreversible y el rol será borrado del historial operativo de {deletingRole?.storeName}.
             </p>
          </div>
          <div className="flex gap-3 pt-4">
             <Button onClick={() => setDeletingRole(null)} variant="outline" className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest">
               Cancelar
             </Button>
             <Button onClick={handleDeleteRoleConfirm} variant="danger" className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-rose-900/40">
               Sí, Borrar Rol
             </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={attendanceModal.isOpen} onClose={() => { setAttendanceModal({ isOpen: false, index: null }); setShowExtraFields(false); }} title={isEditingRole ? "REGISTRO DE ASISTENCIA" : "DETALLE DE ASISTENCIA"}>
        <div className="space-y-6">
          {(!isEditingRole && attendanceModal.index !== null && !tempAssignments[attendanceModal.index].attendance) ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in-95 duration-500">
               <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center border border-blue-500/20">
                  <Ghost size={48} className="text-blue-500 opacity-40" />
               </div>
               <div className="space-y-3">
                  <p className="text-[12px] font-black theme-text-main uppercase tracking-widest">Sin actividad registrada</p>
                  <p className="text-[10px] theme-text-muted font-bold uppercase tracking-wider max-w-[260px] mx-auto opacity-70">Aún no se ha reportado el estatus de asistencia para este turno operativo.</p>
               </div>
            </div>
          ) : (
            <>
              <div className={`grid grid-cols-3 gap-3 p-2 bg-black/20 rounded-[2rem] shadow-inner ${!isEditingRole ? 'pointer-events-none opacity-80' : ''}`}>
                {[
                  { s: AttendanceStatus.PRESENT, l: 'Asistió', c: 'bg-emerald-500', i: CheckCircle2 },
                  { s: AttendanceStatus.DELAYED, l: 'Demoró', c: 'bg-amber-500', i: Clock4 },
                  { s: AttendanceStatus.ABSENT, l: 'No asistió', c: 'bg-rose-500', i: XCircle }
                ].map(opt => (
                  <div key={opt.s} className="flex flex-col items-center gap-2">
                    <button 
                      onClick={() => {
                        if (opt.s === AttendanceStatus.PRESENT) {
                          setAttForm({ ...attForm, status: opt.s, reason: '', evidenceUrl: '', evidenceType: 'image' });
                          setShowExtraFields(false);
                        } else {
                          setAttForm({ ...attForm, status: opt.s });
                        }
                      }} 
                      className={`w-full flex flex-col items-center justify-center p-5 rounded-2xl transition-all gap-2 ${attForm.status === opt.s ? `${opt.c} text-white shadow-xl scale-105 active:scale-95` : 'theme-text-muted opacity-40 hover:opacity-80'}`}
                    >
                      <opt.i size={24} />
                      <span className="font-black uppercase text-[8px] tracking-tighter text-center leading-tight">{opt.l}</span>
                    </button>
                    {isEditingRole && attForm.status === opt.s && opt.s !== AttendanceStatus.PRESENT && !showExtraFields && (
                      <button 
                        onClick={() => setShowExtraFields(true)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/10 text-blue-500 border border-blue-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest animate-in fade-in zoom-in-95 duration-300 active:scale-95"
                      >
                        <Plus size={10} /> Agregar
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {(showExtraFields || (!isEditingRole && (attForm.reason || attForm.evidenceUrl))) && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase theme-text-muted tracking-widest flex items-center gap-2 px-1"><MessageSquare size={16} /> Motivo / Observación</label>
                    <textarea 
                      readOnly={!isEditingRole}
                      className={`w-full glass-input rounded-2xl p-5 text-[13px] font-bold min-h-[100px] outline-none transition-colors ${!isEditingRole ? 'bg-transparent border-transparent px-1 opacity-90' : 'focus:border-blue-500/50 shadow-inner'}`} 
                      placeholder={isEditingRole ? "Describa el motivo..." : "Sin observaciones registradas."} 
                      value={attForm.reason} 
                      onChange={e => setAttForm({ ...attForm, reason: e.target.value })} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase theme-text-muted tracking-widest flex items-center gap-2 px-1"><Upload size={16} /> Evidencia</label>
                    {isEditingRole ? (
                      <div onClick={() => fileInputRef.current?.click()} className="w-full h-40 theme-bg-subtle border-2 border-dashed theme-border rounded-[2.5rem] flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group hover:border-blue-500/50 transition-colors bg-black/5">
                        {isUploadingEvidence ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                            <span className="text-[8px] font-black uppercase theme-text-muted">Optimizando...</span>
                          </div>
                        ) : attForm.evidenceUrl ? (
                          <div className="absolute inset-0">
                            {attForm.evidenceType === 'pdf' ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-rose-500 bg-rose-500/5"><FileCode size={40} /><span className="text-[10px] font-black mt-1 uppercase">PDF CARGADO</span></div>
                            ) : (
                              <img src={attForm.evidenceUrl} className="w-full h-full object-cover" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <div className="p-4 bg-rose-500 rounded-2xl shadow-xl hover:scale-110 transition-transform" onClick={e => { e.stopPropagation(); setAttForm({ ...attForm, evidenceUrl: '' }); }}>
                                <Trash2 size={28} className="text-white" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <div className="p-4 theme-bg-surface rounded-2xl border theme-border mb-2 text-blue-500"><Upload size={28} /></div>
                            <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Cargar Evidencia</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full min-h-[140px] theme-bg-subtle border theme-border rounded-[2.5rem] overflow-hidden flex items-center justify-center">
                        {attForm.evidenceUrl ? (
                          attForm.evidenceType === 'pdf' ? (
                            <a href={attForm.evidenceUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-3 text-blue-500 hover:scale-105 transition-transform">
                              <FileText size={54} />
                              <span className="text-[11px] font-black uppercase">Ver Documento PDF</span>
                            </a>
                          ) : (
                            <img src={attForm.evidenceUrl} className="w-full h-full object-contain max-h-[350px]" onClick={() => window.open(attForm.evidenceUrl, '_blank')} />
                          )
                        ) : (
                          <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest opacity-50">No hay evidencia adjunta</p>
                        )}
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex gap-4 pt-6 border-t theme-border">
            <Button onClick={() => { setAttendanceModal({ isOpen: false, index: null }); setShowExtraFields(false); }} variant="outline" className="flex-1 py-4.5 text-[11px] font-black uppercase tracking-widest">
              {isEditingRole ? "Cancelar" : "Cerrar"}
            </Button>
            {isEditingRole && (
              <Button onClick={saveAttendanceToTemp} disabled={isUploadingEvidence} variant="primary" className="flex-[2] py-4.5 text-[11px] font-black uppercase tracking-widest bg-blue-600 shadow-xl shadow-blue-900/40">Confirmar Registro</Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
