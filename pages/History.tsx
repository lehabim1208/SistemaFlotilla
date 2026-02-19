
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  History as HistoryIcon, Eye, Clock, User as UserIcon, Download, Calendar, 
  Truck, Edit3, Save, Check, X, GripVertical, ClipboardCheck, AlertCircle, 
  Search, CheckCircle2, XCircle, Clock4, FileCode, ImageIcon, Upload, 
  MessageSquare, Trash2, Activity, CheckCircle, MoveVertical, Loader2,
  FileText, Ghost, ChevronLeft, ChevronRight, Plus, RefreshCcw, ArrowRight, Camera, ExternalLink, Maximize2, Move, Timer, ArrowUpDown,
  UserMinus, UserPlus, Trash, Info, Trash2 as TrashIcon
} from 'lucide-react';
import { GlassCard, Modal, Button, Toast } from '../components/UI';
import { DailyRole, Assignment, User, AttendanceStatus, AttendanceRecord, UserRole, Driver, DriverStatus } from '../types';

interface Props {
  history: DailyRole[];
  currentUser?: User;
  onUpdateRole?: (updatedRole: DailyRole) => void;
  onDeleteRole?: (id: string) => void;
  drivers?: Driver[];
}

const ITEMS_PER_PAGE = 6; 
const IMGBB_API_KEY = '605cbcef44fb63ad7761c9eadd84c06e';

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200; 
      const MAX_HEIGHT = 1200;
      let width = img.width;
      let height = img.height;
      if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
      else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Error al comprimir')); }, 'image/jpeg', 0.6);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Error al cargar')); };
    img.src = url;
  });
};

export const History: React.FC<Props> = ({ history, currentUser, onUpdateRole, onDeleteRole, drivers = [] }) => {
  const [selectedRole, setSelectedRole] = useState<DailyRole | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<DailyRole | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderSelectedIndex, setReorderSelectedIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [searchPicker, setSearchPicker] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [newOpDriver, setNewOpDriver] = useState<Driver | null>(null);
  const [newOpEntry, setNewOpEntry] = useState("07:00");
  const [newOpExit, setNewOpExit] = useState("17:00");

  const [tempAssignments, setTempAssignments] = useState<Assignment[]>([]);
  const [attendanceModal, setAttendanceModal] = useState<{ isOpen: boolean; index: number | null; isEditing: boolean }>({ isOpen: false, index: null, isEditing: false });
  const [showExtraFields, setShowExtraFields] = useState(false);
  const [attForm, setAttForm] = useState<AttendanceRecord>({
    status: AttendanceStatus.PRESENT, reason: '', evidenceUrl: '', evidenceType: 'image', updatedAt: ''
  });
  
  const [showConfirmDeleteEvidence, setShowConfirmDeleteEvidence] = useState(false);
  const [showEvidenceViewer, setShowEvidenceViewer] = useState<string | null>(null);
  
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [pickerEntry, setPickerEntry] = useState("07:00");
  const [pickerExit, setPickerExit] = useState("17:00");

  const [deletingAssignmentIndex, setDeletingAssignmentIndex] = useState<number | null>(null);

  const currentPreviewSchedule = useMemo(() => {
    return `${formatTo12h(pickerEntry)} A ${formatTo12h(pickerExit)}`;
  }, [pickerEntry, pickerExit]);
  
  const todayIso = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }, []);

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

  const getMinutesFromTime = (timeStr: string) => {
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

  const getNaturalDate = (isoDate: string) => {
    if (!isoDate) return "Rol";
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const parts = isoDate.split('-');
    if (parts.length < 3) return isoDate;
    return `${parseInt(parts[2])} de ${months[parseInt(parts[1]) - 1]} de ${parts[0]}`;
  };

  const sortedHistory = useMemo(() => {
    const isSuper = currentUser?.role === UserRole.SUPERADMIN;
    const userStoreIds = currentUser?.assignedStoreIds || [];
    let baseHistory = [...(history || [])];
    if (!isSuper) baseHistory = baseHistory.filter(h => userStoreIds.includes(h.storeId));
    return baseHistory.sort((a, b) => {
      if (a.date === todayIso && b.date !== todayIso) return -1;
      if (a.date !== todayIso && b.date === todayIso) return 1;
      return b.date.localeCompare(a.date);
    });
  }, [history, todayIso, currentUser]);

  const filteredHistory = useMemo(() => {
    let results = sortedHistory;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      results = results.filter(h => h.storeName.toLowerCase().includes(q) || h.storeCode.toLowerCase().includes(q) || h.date.includes(q));
    }
    return results;
  }, [sortedHistory, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const paginatedHistory = useMemo(() => filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredHistory, currentPage]);

  const handleOpenDetail = (role: DailyRole) => {
    setSelectedRole(role);
    setTempAssignments(JSON.parse(JSON.stringify(role.assignments || [])));
    setIsEditingRole(false);
    setIsReorderMode(false);
    setReorderSelectedIndex(null);
  };

  const handleOpenAttendance = (index: number) => {
    const current = tempAssignments[index].attendance;
    if (current) { 
      setAttForm(current); 
      setShowExtraFields(!!(current.reason || current.evidenceUrl)); 
      setAttendanceModal({ isOpen: true, index, isEditing: false });
    } else { 
      setAttForm({ status: AttendanceStatus.PRESENT, reason: '', evidenceUrl: '', evidenceType: 'image', updatedAt: '' }); 
      setShowExtraFields(false); 
      setAttendanceModal({ isOpen: true, index, isEditing: false });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingEvidence(true);
    setToast({ message: 'Procesando evidencia...', type: 'info' });
    try {
      const compressedBlob = await compressImage(file);
      const formData = new FormData();
      formData.append('image', compressedBlob, 'evidence.jpg');
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
      const result = await res.json();
      if (result.success) { 
        setAttForm(prev => ({ ...prev, evidenceUrl: result.data.url, evidenceType: 'image' })); 
        setToast({ message: 'Evidencia cargada', type: 'success' }); 
      } else { throw new Error('Upload failed'); }
    } catch (err) { 
      setToast({ message: 'Error al subir imagen', type: 'error' }); 
    } finally { 
      setIsUploadingEvidence(false); 
    }
  };

  const handleRemoveEvidence = () => {
    const newForm = { ...attForm, evidenceUrl: '' };
    setAttForm(newForm);
    setShowConfirmDeleteEvidence(false);
    if (attendanceModal.index !== null && selectedRole) {
       const updatedAssignments = [...tempAssignments];
       updatedAssignments[attendanceModal.index] = {
         ...updatedAssignments[attendanceModal.index],
         attendance: { ...newForm, updatedAt: new Date().toISOString() }
       };
       setTempAssignments(updatedAssignments);
       if (onUpdateRole) {
         onUpdateRole({
           ...selectedRole,
           assignments: updatedAssignments,
           updatedAt: new Date().toISOString()
         });
       }
    }
    setToast({ message: 'Referencia de imagen eliminada', type: 'info' });
  };

  const persistAttendanceChange = () => {
    if (attendanceModal.index === null || !selectedRole) return;
    const updatedAssignments = [...tempAssignments];
    updatedAssignments[attendanceModal.index] = {
      ...updatedAssignments[attendanceModal.index],
      attendance: { ...attForm, updatedAt: new Date().toISOString() }
    };
    setTempAssignments(updatedAssignments);
    if (onUpdateRole) {
      onUpdateRole({
        ...selectedRole,
        assignments: updatedAssignments,
        updatedAt: new Date().toISOString()
      });
    }
    setAttendanceModal({ ...attendanceModal, isOpen: false, isEditing: false });
    setShowExtraFields(false);
    setToast({ message: 'Sincronizado con base de datos', type: 'success' });
  };

  const handleSaveChanges = () => {
    if (!selectedRole || !onUpdateRole) return;
    const sorted = [...tempAssignments].sort((a, b) => {
      return getMinutesFromTime(a.schedule.split(' A ')[0]) - getMinutesFromTime(b.schedule.split(' A ')[0]);
    });
    const updatedRole = { 
      ...selectedRole, 
      assignments: sorted, 
      updatedAt: new Date().toISOString() 
    };
    onUpdateRole(updatedRole);
    setIsEditingRole(false);
    setIsReorderMode(false);
    setSelectedRole(updatedRole); 
    setTempAssignments(sorted);
    setToast({ message: 'Cambios guardados y ordenados', type: 'success' });
  };

  const handleDeleteRoleConfirm = () => {
    if (roleToDelete && onDeleteRole) {
      onDeleteRole(roleToDelete.id);
      setRoleToDelete(null);
      setToast({ message: 'Rol eliminado permanentemente', type: 'success' });
    }
  };

  const handleDeleteAssignmentConfirm = () => {
    if (deletingAssignmentIndex !== null) {
      const next = [...tempAssignments];
      next.splice(deletingAssignmentIndex, 1);
      setTempAssignments(next);
      setDeletingAssignmentIndex(null);
      setToast({ message: 'Operador removido del rol operativo', type: 'info' });
    }
  };

  const handleDownloadImage = () => {
    if (!selectedRole || isEditingRole) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isLightMode = document.documentElement.classList.contains('light-mode');
    const isBA = selectedRole.storeCode.startsWith('BA_');
    
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
    const assignments = tempAssignments || [];
    const totalHeight = headerHeight + (assignments.length * rowHeight) + 180;
    
    canvas.width = width;
    canvas.height = totalHeight;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, totalHeight);

    ctx.fillStyle = colors.primary;
    ctx.fillRect(0, 0, width, 240);
    
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 60px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(selectedRole.storeName.toUpperCase(), width / 2, 95);
    
    ctx.font = '700 32px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`[ ${selectedRole.storeCode} ]`, width / 2, 140);
    
    ctx.font = '800 24px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.letterSpacing = "4px";
    ctx.fillText(`ROL OPERATIVO • ${getNaturalDate(selectedRole.date).toUpperCase()}`, width / 2, 185);

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
    
    // Coordenadas base
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
      
      const maxNameWidth = 400; // Espacio amplio para el nombre
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
    link.download = `ROL_${selectedRole.storeCode}_${selectedRole.date}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
    setToast({ message: 'Imagen del rol descargada', type: 'success' });
  };

  const handleRowClickForReorder = (index: number) => {
    if (!isReorderMode) return;
    if (reorderSelectedIndex === null) {
      setReorderSelectedIndex(index);
    } else {
      if (reorderSelectedIndex === index) {
        setReorderSelectedIndex(null);
      } else {
        const next = [...tempAssignments];
        const opSource = { ...next[reorderSelectedIndex] };
        const opTarget = { ...next[index] };
        next[reorderSelectedIndex] = { ...next[reorderSelectedIndex], driverId: opTarget.driverId, driverName: opTarget.driverName, teamCode: opTarget.teamCode, attendance: opTarget.attendance };
        next[index] = { ...next[index], driverId: opSource.driverId, driverName: opSource.driverName, teamCode: opSource.teamCode, attendance: opSource.attendance };
        setTempAssignments(next);
        setReorderSelectedIndex(null);
        setToast({ message: 'Intercambio realizado', type: 'info' });
      }
    }
  };

  const handleSwapDriver = (newDriver: Driver) => {
    if (swappingIndex === null) return;
    const next = [...tempAssignments];
    next[swappingIndex] = { ...next[swappingIndex], driverId: newDriver.id, driverName: newDriver.fullName, teamCode: newDriver.teamCode };
    setTempAssignments(next); setSwappingIndex(null);
    setToast({ message: 'Conductor actualizado.', type: 'success' });
  };

  const handleAddNewOperator = () => {
    if (!newOpDriver || !selectedRole) return;
    const scheduleStr = `${formatTo12h(newOpEntry)} A ${formatTo12h(newOpExit)}`;
    const newAsgn: Assignment = {
      driverId: newOpDriver.id,
      driverName: newOpDriver.fullName,
      teamCode: newOpDriver.teamCode,
      schedule: scheduleStr
    };
    const next = [...tempAssignments, newAsgn].sort((a, b) => {
      return getMinutesFromTime(a.schedule.split(' A ')[0]) - getMinutesFromTime(b.schedule.split(' A ')[0]);
    });
    setTempAssignments(next);
    setIsAddingOperator(false);
    setNewOpDriver(null);
    setToast({ message: 'Nuevo operador insertado.', type: 'success' });
  };

  const [viewerScale, setViewerScale] = useState(1);
  const [viewerPosition, setViewerPosition] = useState({ x: 0, y: 0 });
  const [isDraggingViewer, setIsDraggingViewer] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const lastTouchDist = useRef<number | null>(null);

  const handleViewerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDraggingViewer(true);
      startPos.current = { x: e.touches[0].clientX - viewerPosition.x, y: e.touches[0].clientY - viewerPosition.y };
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      lastTouchDist.current = dist;
    }
  };

  const handleViewerTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDraggingViewer) {
      setViewerPosition({ x: e.touches[0].clientX - startPos.current.x, y: e.touches[0].clientY - startPos.current.y });
    } else if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const delta = dist / lastTouchDist.current;
      setViewerScale(prev => Math.min(6, Math.max(1, prev * delta)));
      lastTouchDist.current = dist;
    }
  };

  return (
    <div className="space-y-6 flex flex-col min-h-full">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20"><HistoryIcon className="w-7 h-7 text-blue-400" /></div>
        <div><h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter">Historial</h2><p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.3em]">Auditoría Operativa</p></div>
      </div>

      <GlassCard className="p-2 md:p-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={18} />
          <input type="text" placeholder="Sede, código o fecha..." className="w-full theme-bg-subtle theme-text-main rounded-xl pl-12 pr-4 py-3 text-xs md:text-sm outline-none font-bold border theme-border" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
        </div>
      </GlassCard>

      {toast && <Toast message={toast.message} type={toast.type === 'info' ? 'success' : toast.type} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {paginatedHistory.map((role) => {
          const isToday = role.date === todayIso;
          const isPast = role.date < todayIso;
          const isFuture = role.date > todayIso;
          const isSuper = currentUser?.role === UserRole.SUPERADMIN;
          const canDelete = isSuper || isFuture;

          return (
            <GlassCard key={role.id} className={`group border-2 transition-all relative overflow-hidden p-6 ${isToday ? 'border-emerald-500/30 bg-emerald-500/[0.03]' : 'border-transparent'}`}>
              <div className="flex justify-between items-start mb-5">
                <div className="flex flex-col gap-2">
                  <div className="bg-blue-600/10 text-blue-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-500/10 w-fit">{role.storeCode}</div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isToday && (
                    <div className="flex items-center gap-2 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]" />
                      <span className="text-[8px] font-black uppercase text-emerald-400 tracking-widest">En operación</span>
                    </div>
                  )}
                  {isFuture && (
                    <div className="flex items-center gap-2 bg-blue-500/20 px-3 py-1.5 rounded-xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                      <span className="w-2 h-2 bg-blue-400 rounded-full" />
                      <span className="text-[8px] font-black uppercase text-blue-400 tracking-widest">Por empezar</span>
                    </div>
                  )}
                  {isPast && (
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/5 opacity-60">
                      <span className="text-[8px] font-black uppercase theme-text-main tracking-widest">Concluido</span>
                    </div>
                  )}
                  {canDelete && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); setRoleToDelete(role); }}
                      className="p-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 active:scale-90 transition-all shadow-lg"
                    >
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mb-6">
                <h4 className="text-xl font-black theme-text-main uppercase truncate leading-tight mb-1">{role.storeName}</h4>
                <div className="flex items-center gap-2 theme-text-muted"><Calendar size={12} className="opacity-40" /><span className="text-[11px] font-bold">{role.date.split('-').reverse().join('/')}</span></div>
              </div>
              <Button onClick={() => handleOpenDetail(role)} variant="outline" className="w-full py-3.5 text-[10px] uppercase font-black hover:bg-blue-600 hover:text-white transition-all"><Eye size={14} /> Detalle</Button>
            </GlassCard>
          );
        })}
      </div>

      <div className="mt-auto py-8">
        <div className="flex items-center justify-center gap-1.5 p-1 theme-bg-subtle rounded-xl border theme-border w-fit mx-auto shadow-lg">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 theme-text-muted hover:theme-text-main disabled:opacity-10 transition-all rounded-lg"><ChevronLeft size={16} /></button>
          <div className="flex gap-1 px-1">{[...Array(totalPages)].map((_, i) => (<button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-md' : 'theme-text-muted hover:theme-text-main'}`}>{i + 1}</button>))}</div>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-2 theme-text-muted hover:theme-text-main disabled:opacity-10 transition-all rounded-lg"><ChevronRight size={16} /></button>
        </div>
      </div>

      <Modal isOpen={!!selectedRole} onClose={() => setSelectedRole(null)} title="DETALLE DEL ROL" className="max-w-xl">
        {selectedRole && (() => {
          const isToday = selectedRole.date === todayIso;
          const isFuture = selectedRole.date > todayIso;
          const canEdit = isToday || isFuture;

          return (
            <div className="space-y-4 -mx-4 md:mx-0">
              <div className="p-4 theme-bg-subtle rounded-[2rem] border theme-border flex flex-col items-center text-center shadow-inner relative overflow-hidden mx-4 md:mx-0">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-600/20" />
                <h4 className="text-lg font-black theme-text-main uppercase mb-0.5 leading-tight tracking-tight">{selectedRole.storeName}</h4>
                <p className="text-blue-500 font-bold text-[9px] uppercase mb-4 tracking-[0.2em]">{getNaturalDate(selectedRole.date).toUpperCase()}</p>
                
                <div className="flex flex-wrap justify-center gap-2">
                  {!isEditingRole ? (
                    <>
                      <button onClick={handleDownloadImage} className="flex items-center gap-2 px-4 py-2 theme-bg-subtle text-blue-500 rounded-xl transition-all border theme-border hover:bg-blue-600 hover:text-white shadow-sm">
                        <Download size={14} /><span className="text-[9px] font-black uppercase tracking-widest">Imagen</span>
                      </button>
                      {canEdit && (
                        <button onClick={() => setIsEditingRole(true)} className="flex items-center gap-2 px-4 py-2 theme-bg-subtle text-amber-500 rounded-xl hover:bg-amber-500 hover:text-white transition-all border theme-border shadow-sm">
                          <Edit3 size={14} /><span className="text-[9px] font-black uppercase tracking-widest">Editar</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setIsReorderMode(!isReorderMode); setReorderSelectedIndex(null); }} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border shadow-sm ${isReorderMode ? 'bg-blue-600 text-white border-blue-500' : 'theme-bg-subtle text-blue-500 border-theme-border hover:bg-blue-500/10'}`}>
                         <ArrowUpDown size={14} />
                         <span className="text-[9px] font-black uppercase tracking-widest">{isReorderMode ? 'Fijar' : 'Acomodar'}</span>
                      </button>
                      {!isReorderMode && (
                        <button onClick={() => { setSearchPicker(''); setIsAddingOperator(true); }} className="flex items-center gap-2 px-4 py-2 theme-bg-subtle text-emerald-500 rounded-xl hover:bg-emerald-600 hover:text-white transition-all border theme-border shadow-sm">
                           <UserPlus size={14} />
                           <span className="text-[9px] font-black uppercase tracking-widest">Agregar</span>
                        </button>
                      )}
                      <button onClick={() => { setIsEditingRole(false); setIsReorderMode(false); setTempAssignments(JSON.parse(JSON.stringify(selectedRole.assignments))); }} className="w-9 h-9 flex items-center justify-center bg-rose-500 text-white rounded-xl shadow-lg hover:bg-rose-600 active:scale-95 transition-all"><X size={18} /></button>
                    </div>
                  )}
                </div>
              </div>

              {isReorderMode && (
                <div className="bg-blue-600/5 border border-blue-500/20 p-3 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300 mx-4 md:mx-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Info size={12} className="text-blue-500" />
                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Instrucciones de Movimiento</span>
                  </div>
                  <p className="text-[9px] font-bold text-blue-400 uppercase leading-tight tracking-tight">
                    Toque el nombre de un operador y luego el de otro para intercambiar sus turnos. Los horarios permanecerán fijos.
                  </p>
                </div>
              )}

              <div className={`overflow-hidden rounded-[1.5rem] border theme-border shadow-xl transition-all ${isReorderMode ? 'ring-2 ring-blue-500/30' : ''} mx-1 md:mx-0`}>
                <table className="w-full text-left table-fixed">
                  <thead className="theme-bg-subtle theme-text-muted text-[8px] font-black uppercase tracking-[0.1em] border-b theme-border">
                    <tr>
                      <th className="p-3 w-[100px]">Turno</th>
                      <th className="p-3">Operador</th>
                      {!isReorderMode && <th className="p-3 text-center w-[70px] md:w-[75px]">Gest.</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y theme-border theme-bg-surface">
                    {tempAssignments.map((a, i) => {
                      const times = a.schedule.toUpperCase().split(' A ');
                      const entry = formatTo12h(times[0] || '---'), exit = formatTo12h(times[1] || '---');
                      const att = a.attendance;
                      const StatusIcon = att?.status === AttendanceStatus.PRESENT ? CheckCircle2 : att?.status === AttendanceStatus.DELAYED ? Clock4 : att?.status === AttendanceStatus.ABSENT ? XCircle : ClipboardCheck;
                      const iconColor = att?.status === AttendanceStatus.PRESENT ? 'text-emerald-500' : att?.status === AttendanceStatus.DELAYED ? 'text-amber-500' : att?.status === AttendanceStatus.ABSENT ? 'text-rose-500' : 'theme-text-muted opacity-30';
                      const isSelected = reorderSelectedIndex === i;

                      return (
                        <tr key={i} onClick={() => handleRowClickForReorder(i)} className={`transition-all ${isReorderMode ? 'cursor-pointer hover:bg-blue-500/10' : 'hover:bg-black/5'} ${isSelected ? 'bg-blue-600/20' : ''}`}>
                          <td className="p-2 md:p-3">
                            {isEditingRole ? (
                              <button 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  const currentTimes = a.schedule.toUpperCase().split(' A ');
                                  setPickerEntry(time12To24(formatTo12h(currentTimes[0])));
                                  setPickerExit(time12To24(formatTo12h(currentTimes[1])));
                                  setEditingScheduleIndex(i); 
                                }}
                                className="flex flex-col gap-1 w-full text-left active:scale-95 transition-transform"
                              >
                                <div className="flex items-center justify-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  <span className="font-mono text-[9px] font-black text-emerald-600 whitespace-nowrap text-center">{entry}</span>
                                </div>
                                <div className="flex items-center justify-center gap-1 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                  <span className="font-mono text-[9px] font-black text-rose-600 whitespace-nowrap text-center">{exit}</span>
                                </div>
                              </button>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/10"><span className="font-mono text-[9px] font-black text-emerald-600 whitespace-nowrap text-center">{entry}</span></div>
                                <div className="flex items-center justify-center gap-1 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20"><span className="font-mono text-[9px] font-black text-rose-600 whitespace-nowrap text-center">{exit}</span></div>
                              </div>
                            )}
                          </td>
                          <td className="p-2 md:p-3">
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1">
                                 <span className={`font-black uppercase theme-text-main truncate leading-tight tracking-tight text-[11px]`}>
                                    {formatShortName(a.driverName)}
                                 </span>
                                 {isEditingRole && !isReorderMode && <button onClick={(e) => { e.stopPropagation(); setSearchPicker(''); setSwappingIndex(i); }} className="text-blue-500 shrink-0"><RefreshCcw size={10} /></button>}
                              </div>
                              <span className={`theme-text-muted font-mono tracking-widest truncate mt-0.5 text-[7px]`}>
                                 {a.teamCode}
                              </span>
                            </div>
                          </td>
                          {!isReorderMode && (
                            <td className="p-2 md:p-3">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); handleOpenAttendance(i); }} className={`p-1.5 rounded-lg border theme-bg-subtle theme-border active:scale-95 transition-all shadow-sm ${iconColor} hover:bg-black/5`}>
                                  <StatusIcon size={14} />
                                </button>
                                {isEditingRole && (
                                  <button onClick={(e) => { e.stopPropagation(); setDeletingAssignmentIndex(i); }} className="p-1.5 rounded-lg border theme-bg-subtle border-rose-500/30 text-rose-500 active:scale-95 hover:bg-rose-500/10 transition-all shadow-sm">
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {isEditingRole && !isReorderMode && (
                <Button onClick={handleSaveChanges} variant="success" className="w-full py-3.5 uppercase font-black text-[9px] tracking-widest shadow-lg border border-emerald-500/20 mx-4 md:mx-0 w-[calc(100%-2rem)] md:w-full"><Save size={16} /> Guardar cambios definitivos</Button>
              )}
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={deletingAssignmentIndex !== null} onClose={() => setDeletingAssignmentIndex(null)} title="REMOVER OPERADOR">
         <div className="text-center space-y-6 py-4">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-rose-500/20"><AlertCircle className="text-rose-500 animate-pulse" size={32} /></div>
            <div className="space-y-2">
               <p className="text-sm font-black theme-text-main uppercase tracking-tight px-4">¿Quitar al operador del rol?</p>
               <p className="text-[9px] theme-text-muted font-bold uppercase tracking-widest px-8 opacity-60">Se eliminará la asignación actual de este rol operativo. Deberá guardar los cambios para confirmar.</p>
            </div>
            <div className="flex gap-3 px-2">
               <Button onClick={() => setDeletingAssignmentIndex(null)} variant="outline" className="flex-1 py-4 font-black">CANCELAR</Button>
               <Button onClick={handleDeleteAssignmentConfirm} variant="danger" className="flex-1 py-4 font-black shadow-xl shadow-rose-900/40 uppercase">REMOVER</Button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={isAddingOperator} onClose={() => { setIsAddingOperator(false); setNewOpDriver(null); }} title="AGREGAR OPERADOR">
         <div className="space-y-6 pb-2">
            {!newOpDriver ? (
               <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/50" size={14} />
                    <input placeholder="Buscar conductor..." className="w-full theme-bg-subtle theme-text-main rounded-xl pl-9 pr-4 py-3 text-[10px] font-bold outline-none border theme-border" value={searchPicker} onChange={e => setSearchPicker(e.target.value)} />
                  </div>
                  <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar space-y-2">
                    {(() => {
                       if (!selectedRole) return null;
                       const currentRoleIds = tempAssignments.map(a => a.driverId);
                       const otherRolesThisDay = history.filter(h => h.date === selectedRole.date && h.id !== selectedRole.id);
                       const busyOtherDayIds = otherRolesThisDay.flatMap(h => h.assignments.map(a => a.driverId));
                       const allOccupiedIds = new Set([...currentRoleIds, ...busyOtherDayIds]);
                       
                       const candidates = drivers.filter(d => 
                         (d.assignedStoreIds || []).includes(selectedRole.storeId) && 
                         !allOccupiedIds.has(d.id) && 
                         d.isActive && 
                         d.status === DriverStatus.AVAILABLE && 
                         (d.fullName.toLowerCase().includes(searchPicker.toLowerCase()) || d.teamCode.toLowerCase().includes(searchPicker.toLowerCase()))
                       );
                       
                       if (candidates.length === 0) return <div className="text-center py-10 opacity-20 uppercase font-black text-[9px]">Sin conductores disponibles</div>;
                       return candidates.map(d => (
                         <button key={d.id} onClick={() => setNewOpDriver(d)} className="w-full flex items-center justify-between p-3 theme-bg-subtle rounded-xl border border-transparent hover:border-blue-500/50 transition-all">
                            <div className="flex items-center gap-3">
                               <div className="w-9 h-9 rounded-lg theme-bg-surface border theme-border flex items-center justify-center font-black overflow-hidden shrink-0">{d.photoUrl ? <img src={d.photoUrl} className="w-full h-full object-cover" /> : d.fullName.charAt(0)}</div>
                               <div className="flex flex-col text-left">
                                  <span className="text-[10px] font-black uppercase theme-text-main">{formatShortName(d.fullName)}</span>
                                  <span className="text-[7px] theme-text-muted font-mono">{d.teamCode}</span>
                               </div>
                            </div>
                            <ArrowRight size={14} className="text-blue-500" />
                         </button>
                       ));
                    })()}
                  </div>
               </div>
            ) : (
               <div className="space-y-6 animate-in slide-in-from-right-4">
                  <div className="p-4 theme-bg-subtle border theme-border rounded-2xl flex items-center gap-3">
                     <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center shrink-0"><UserIcon className="text-blue-500" size={20} /></div>
                     <div className="flex flex-col"><span className="text-[11px] font-black theme-text-main uppercase">{formatShortName(newOpDriver.fullName)}</span><span className="text-[8px] theme-text-muted uppercase tracking-widest">{newOpDriver.teamCode}</span></div>
                     <button onClick={() => setNewOpDriver(null)} className="ml-auto p-2 theme-text-muted hover:text-rose-500"><RefreshCcw size={14} /></button>
                  </div>
                  <div className="p-4 theme-bg-subtle border theme-border rounded-2xl grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[8px] font-black theme-text-muted uppercase tracking-widest flex items-center gap-1"><Timer size={10} className="text-emerald-500" /> Entrada</label>
                        <input type="time" className="w-full glass-input rounded-xl px-3 py-2 font-mono text-xs outline-none" value={newOpEntry} onChange={e => setNewOpEntry(e.target.value)} />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[8px] font-black theme-text-muted uppercase tracking-widest flex items-center gap-1"><Timer size={10} className="text-rose-500" /> Salida</label>
                        <input type="time" className="w-full glass-input rounded-xl px-3 py-2 font-mono text-xs outline-none" value={newOpExit} onChange={e => setNewOpExit(e.target.value)} />
                     </div>
                  </div>
                  <Button onClick={handleAddNewOperator} variant="success" className="w-full py-4 uppercase font-black text-[9px] tracking-widest">Confirmar Inserción</Button>
               </div>
            )}
         </div>
      </Modal>

      <Modal isOpen={!!roleToDelete} onClose={() => setRoleToDelete(null)} title="ELIMINAR ROL">
         <div className="text-center space-y-6 py-4">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto animate-pulse" />
            <div className="space-y-2">
               <p className="text-sm font-black theme-text-main uppercase tracking-tight px-4">Se borrará el rol de {roleToDelete?.storeName} de la fecha {roleToDelete?.date.split('-').reverse().join('/')}.</p>
               <p className="text-[9px] theme-text-muted font-bold uppercase tracking-widest px-8 opacity-60">Esta acción es irreversible.</p>
            </div>
            <div className="flex gap-3 px-2">
               <Button onClick={() => setRoleToDelete(null)} variant="outline" className="flex-1 py-4 font-black">CANCELAR</Button>
               <Button onClick={handleDeleteRoleConfirm} variant="danger" className="flex-1 py-4 font-black shadow-xl shadow-rose-900/40">BORRAR ROL</Button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={editingScheduleIndex !== null} onClose={() => setEditingScheduleIndex(null)} title="AJUSTAR TURNO">
         {editingScheduleIndex !== null && (
           <div className="space-y-4 pb-2">
             <div className="p-5 theme-bg-subtle border theme-border rounded-[1.5rem] flex flex-col gap-4 shadow-inner">
               <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black theme-text-muted uppercase tracking-widest pl-1 flex items-center gap-1.5"><Timer size={10} className="text-emerald-500" /> Entrada</label>
                    <input type="time" className="w-full glass-input rounded-xl px-4 py-3 font-mono text-sm outline-none focus:border-emerald-500" value={pickerEntry} onChange={e => setPickerEntry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black theme-text-muted uppercase tracking-widest pl-1 flex items-center gap-1.5"><Timer size={10} className="text-rose-500" /> Salida</label>
                    <input type="time" className="w-full glass-input rounded-xl px-4 py-3 font-mono text-sm outline-none focus:border-rose-500" value={pickerExit} onChange={e => setPickerExit(e.target.value)} />
                  </div>
               </div>
               <div className="p-3 bg-black/10 rounded-xl border theme-border flex flex-col items-center gap-1">
                  <span className="text-[7px] font-black theme-text-muted uppercase tracking-widest">Vista Previa</span>
                  <span className="text-[12px] font-mono font-black text-blue-500 uppercase tracking-tighter">{currentPreviewSchedule}</span>
               </div>
             </div>
             <div className="flex gap-2">
                <Button onClick={() => setEditingScheduleIndex(null)} variant="outline" className="flex-1 py-3 text-[9px] font-black uppercase">Descartar</Button>
                <Button onClick={() => { const next = [...tempAssignments]; next[editingScheduleIndex].schedule = currentPreviewSchedule; setTempAssignments(next); setEditingScheduleIndex(null); }} variant="primary" className="flex-[2] py-3 text-[9px] font-black uppercase bg-blue-600">Fijar Horario</Button>
             </div>
           </div>
         )}
      </Modal>

      <Modal isOpen={attendanceModal.isOpen} onClose={() => { setAttendanceModal({ ...attendanceModal, isOpen: false }); setShowExtraFields(false); }} title="ASISTENCIA">
        {attendanceModal.index !== null && (
          <div className="space-y-4">
            {!tempAssignments[attendanceModal.index]?.attendance && !attendanceModal.isEditing ? (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in duration-500">
                <div className="w-14 h-14 bg-slate-500/10 rounded-2xl flex items-center justify-center border-2 border-dashed theme-border"><Ghost className="theme-text-muted opacity-30" size={28} /></div>
                <div className="space-y-1"><h4 className="text-xs font-black theme-text-main uppercase tracking-tight">Sin registro aún</h4><p className="text-[8px] theme-text-muted font-bold uppercase tracking-widest px-8 opacity-60">El operador no tiene estatus asignado hoy.</p></div>
                {isEditingRole && <Button onClick={() => setAttendanceModal({ ...attendanceModal, isEditing: true })} className="px-8 py-3 bg-blue-600 text-[9px] uppercase font-black"><Plus size={14} /> Registrar</Button>}
              </div>
            ) : (tempAssignments[attendanceModal.index]?.attendance && !attendanceModal.isEditing) ? (
              <div className="space-y-4 animate-in fade-in duration-500">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${attForm.status === AttendanceStatus.PRESENT ? 'bg-emerald-500/20 text-emerald-500' : attForm.status === AttendanceStatus.DELAYED ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'}`}>{attForm.status === AttendanceStatus.PRESENT ? <CheckCircle2 size={24} /> : attForm.status === AttendanceStatus.DELAYED ? <Clock4 size={24} /> : <XCircle size={24} />}</div>
                  <div className="text-center"><h4 className={`text-sm font-black uppercase tracking-widest ${attForm.status === AttendanceStatus.PRESENT ? 'text-emerald-500' : attForm.status === AttendanceStatus.DELAYED ? 'text-amber-500' : 'text-rose-500'}`}>{attForm.status}</h4><p className="text-[7px] font-black theme-text-muted uppercase tracking-wider">Sinc: {attForm.updatedAt ? new Date(attForm.updatedAt).toLocaleTimeString() : '---'}</p></div>
                </div>
                {attForm.reason && <div className="p-4 theme-bg-subtle rounded-2xl border theme-border"><p className="text-[8px] font-black theme-text-muted uppercase tracking-widest mb-2 flex items-center gap-1.5"><MessageSquare size={10} /> Notas</p><p className="text-[10px] font-bold theme-text-main leading-relaxed">{attForm.reason}</p></div>}
                {attForm.evidenceUrl && (
                  <button onClick={() => { setViewerScale(1); setViewerPosition({x:0,y:0}); setShowEvidenceViewer(attForm.evidenceUrl!); }} className="w-full p-3 bg-blue-600/5 border border-blue-500/20 rounded-2xl flex items-center gap-3 active:scale-95 transition-transform">
                    <ImageIcon className="text-blue-500" size={16} />
                    <span className="text-[9px] font-black theme-text-main uppercase">Ver Evidencia Visual</span>
                  </button>
                )}
                {isEditingRole && (
                  <Button onClick={() => setAttendanceModal({ ...attendanceModal, isEditing: true })} variant="outline" className="w-full py-3 text-blue-500 border-blue-500/20 text-[9px] uppercase font-black"><Edit3 size={14} /> Editar</Button>
                )}
              </div>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-3 gap-2">
                  {[ { s: AttendanceStatus.PRESENT, l: 'Asistió', c: 'bg-emerald-500', i: CheckCircle2 }, { s: AttendanceStatus.DELAYED, l: 'Demoró', c: 'bg-amber-500', i: Clock4 }, { s: AttendanceStatus.ABSENT, l: 'Faltó', c: 'bg-rose-500', i: XCircle } ].map(opt => (
                    <button key={opt.s} onClick={() => { setAttForm({ ...attForm, status: opt.s }); if (opt.s === AttendanceStatus.PRESENT) setShowExtraFields(false); }} className={`flex flex-col items-center justify-center p-2.5 rounded-xl transition-all gap-1.5 border ${attForm.status === opt.s ? `${opt.c} text-white shadow-lg border-transparent` : 'theme-bg-subtle theme-border theme-text-muted opacity-40'}`}><opt.i size={18} /><span className="font-black uppercase text-[7px] text-center leading-none">{opt.l}</span></button>
                  ))}
                </div>
                {(attForm.status !== AttendanceStatus.PRESENT) && !showExtraFields && (
                  <div className="flex justify-center pt-1"><button onClick={() => setShowExtraFields(true)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600/5 text-blue-500 rounded-xl border border-blue-500/10 text-[8px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"><Plus size={12} /> Notas / Foto</button></div>
                )}
                {showExtraFields && (
                  <div className="space-y-3 animate-in zoom-in-95 duration-300">
                     <textarea className="w-full glass-input rounded-xl p-3 text-[10px] font-bold min-h-[70px] outline-none" placeholder="Motivo..." value={attForm.reason} onChange={e => setAttForm({ ...attForm, reason: e.target.value })} />
                     <div className="flex items-center gap-2">
                        <button onClick={() => fileInputRef.current?.click()} disabled={isUploadingEvidence} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed transition-all ${attForm.evidenceUrl ? 'border-emerald-500/40 bg-emerald-500/5' : 'theme-border hover:border-blue-500/30'}`}>
                          {isUploadingEvidence ? <Loader2 className="animate-spin text-blue-500" size={16} /> : attForm.evidenceUrl ? (
                             <div className="flex items-center gap-2 text-emerald-500"><Check size={14} /><span className="text-[8px] font-black uppercase">Foto Lista</span></div>
                          ) : (<div className="flex items-center gap-2 text-blue-500/40"><Camera size={14} /><span className="text-[8px] font-black uppercase tracking-widest">Subir Foto</span></div>)}
                        </button>
                        {attForm.evidenceUrl && <button onClick={() => setShowConfirmDeleteEvidence(true)} className="p-3 theme-bg-subtle text-rose-500 rounded-xl border theme-border active:scale-90 transition-transform"><TrashIcon size={16} /></button>}
                     </div>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handleFileUpload} />
                  </div>
                )}
                <div className="flex gap-2 pt-2 border-t theme-border"><Button onClick={() => { setAttendanceModal({ ...attendanceModal, isOpen: false }); setShowExtraFields(false); }} variant="outline" className="flex-1 font-black text-[9px] uppercase text-rose-500">Cerrar</Button><Button disabled={isUploadingEvidence} onClick={persistAttendanceChange} variant="primary" className="flex-[2] py-3.5 uppercase font-black text-[9px] bg-blue-600 shadow-lg tracking-widest">{isUploadingEvidence ? 'Subiendo...' : 'Confirmar'}</Button></div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!showEvidenceViewer} onClose={() => setShowEvidenceViewer(null)} title="VISOR">
         {showEvidenceViewer && (
           <div className="space-y-4 pb-2">
              <div 
                ref={viewerRef}
                className="relative aspect-square w-full theme-bg-subtle border-2 border-white/5 rounded-[2rem] overflow-hidden shadow-2xl bg-black flex items-center justify-center touch-none select-none"
                onTouchStart={handleViewerTouchStart}
                onTouchMove={handleViewerTouchMove}
                onTouchEnd={() => setIsDraggingViewer(false)}
                onWheel={e => { const delta = e.deltaY > 0 ? 0.9 : 1.1; setViewerScale(prev => Math.min(6, Math.max(1, prev * delta))); }}
                onDoubleClick={() => { setViewerScale(1); setViewerPosition({x:0,y:0}); }}
              >
                 <img src={showEvidenceViewer} className="w-full h-full object-contain pointer-events-none transition-transform duration-75" style={{ transform: `translate(${viewerPosition.x}px, ${viewerPosition.y}px) scale(${viewerScale})`, transformOrigin: 'center center' }} />
              </div>
              <div className="flex gap-2">
                 <a href={showEvidenceViewer} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest"><ExternalLink size={14} /> Original</a>
                 <Button onClick={() => setShowEvidenceViewer(null)} variant="outline" className="flex-1 py-3 font-black text-[9px] uppercase">Cerrar</Button>
              </div>
           </div>
         )}
      </Modal>

      <Modal isOpen={swappingIndex !== null} onClose={() => setSwappingIndex(null)} title="REEMPLAZAR">
        <div className="space-y-3 pb-2">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/50" size={14} />
              <input placeholder="Filtrar por nombre..." className="w-full theme-bg-subtle theme-text-main rounded-xl pl-9 pr-4 py-2.5 text-[10px] font-bold outline-none border border-theme-border" value={searchPicker} onChange={e => setSearchPicker(e.target.value)} />
           </div>
           <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar space-y-1.5">
              {(() => {
                if (!selectedRole || !drivers || drivers.length === 0 || swappingIndex === null || !tempAssignments[swappingIndex]) return <div className="text-center py-6 opacity-20 uppercase font-black text-[9px]">Buscando...</div>;
                const currentReplacingId = tempAssignments[swappingIndex].driverId;
                const otherInRoleIds = tempAssignments.map(a => a.driverId).filter(id => id !== currentReplacingId);
                const otherRolesThisDay = history.filter(h => h.date === selectedRole.date && h.id !== selectedRole.id);
                const busyOtherDayIds = otherRolesThisDay.flatMap(h => h.assignments.map(a => a.driverId));
                const allOccupiedIds = new Set([...otherInRoleIds, ...busyOtherDayIds]);
                const filtered = drivers.filter(d => {
                  const isAssignedToThisStore = (d.assignedStoreIds || []).includes(selectedRole.storeId);
                  const isActive = d.isActive === true;
                  const isAvailable = d.status === DriverStatus.AVAILABLE; 
                  const isNotOccupied = !allOccupiedIds.has(d.id);
                  const matchesSearch = d.fullName.toLowerCase().includes(searchPicker.toLowerCase()) || d.teamCode.toLowerCase().includes(searchPicker.toLowerCase());
                  return isAssignedToThisStore && isActive && isAvailable && isNotOccupied && matchesSearch;
                });
                if (filtered.length === 0) return <div className="text-center py-10 opacity-30 flex flex-col items-center gap-2"><UserMinus className="w-8 h-8" /><p className="uppercase font-black text-[8px] tracking-widest px-10 leading-relaxed">Sin suplentes libres en esta sede hoy.</p></div>;
                return filtered.map(d => (
                  <button key={d.id} onClick={() => handleSwapDriver(d)} className="w-full flex items-center justify-between p-3 theme-bg-subtle rounded-xl border border-transparent hover:border-blue-500/50 transition-all group">
                     <div className="flex items-center gap-2.5 text-left">
                        <div className="w-8 h-8 rounded-lg theme-bg-surface border theme-border flex items-center justify-center font-black overflow-hidden shrink-0">{d.photoUrl ? <img src={d.photoUrl} className="w-full h-full object-cover" /> : d.fullName.charAt(0)}</div>
                        <div className="flex flex-col min-w-0">
                           <span className="text-[10px] font-black uppercase theme-text-main truncate group-hover:text-blue-400">{formatShortName(d.fullName)}</span>
                           <span className="text-[7px] theme-text-muted font-mono">{d.teamCode}</span>
                        </div>
                     </div>
                     <ArrowRight className="text-blue-500 opacity-0 group-hover:opacity-100 shrink-0" size={14} />
                  </button>
                ));
              })()}
           </div>
        </div>
      </Modal>

      <Modal isOpen={showConfirmDeleteEvidence} onClose={() => setShowConfirmDeleteEvidence(false)} title="ELIMINAR EVIDENCIA">
         <div className="text-center space-y-6 py-4">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto animate-pulse" />
            <div className="space-y-2">
               <p className="text-sm font-black theme-text-main uppercase tracking-tight px-4">¿Eliminar la foto de este registro?</p>
               <p className="text-[9px] theme-text-muted font-bold uppercase tracking-widest px-8 opacity-60">Se borrará la referencia a la imagen en la base de datos.</p>
            </div>
            <div className="flex gap-3 px-2">
               <Button onClick={() => setShowConfirmDeleteEvidence(false)} variant="outline" className="flex-1 py-4 font-black">CANCELAR</Button>
               <Button onClick={handleRemoveEvidence} variant="danger" className="flex-1 py-4 font-black shadow-xl shadow-rose-900/40">BORRAR</Button>
            </div>
         </div>
      </Modal>

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
