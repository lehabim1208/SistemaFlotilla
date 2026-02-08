
import React, { useState, useRef, useMemo } from 'react';
import { Truck, Plus, Info, Edit2, Trash2, User as UserIcon, Search, Filter, ChevronLeft, ChevronRight, Store as StoreIcon, DollarSign, Fuel, QrCode, Camera, Eye, Image as ImageIcon, TrendingUp, Calendar as CalendarIcon, Wallet, CheckCircle2, XCircle, AlertCircle, Clock, ChevronDown, ChevronUp, MapPin, Activity, FileText, ShieldCheck, BadgeCheck, UserMinus, Maximize2 } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { Driver, Store, DriverStatus, User, UserRole, DailyRole, AttendanceStatus, DriverStoreFinance } from '../types';
import { Badge } from '../components/Badge';

interface Props {
  currentUser: User;
  drivers: Driver[];
  stores: Store[];
  history: DailyRole[];
  onAdd: (d: Partial<Driver>) => void;
  onUpdate: (d: Driver) => void;
  onDelete: (id: string) => void;
}

const ITEMS_PER_PAGE = 10;

const STORE_FINANCE_DEFAULTS: Record<string, DriverStoreFinance> = {
  's1': { dailyWage: 400, dailyGas: 180 }, // Altotonga
  's2': { dailyWage: 400, dailyGas: 180 }, // Naranjos
  's3': { dailyWage: 350, dailyGas: 230 }, // Cristal
  's4': { dailyWage: 400, dailyGas: 180 }, // Casa Blanca
  's5': { dailyWage: 400, dailyGas: 200 }, // Express
};

export const DriverManagement: React.FC<Props> = ({ currentUser, drivers = [], stores = [], history = [], onAdd, onUpdate, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [viewing, setViewing] = useState<Driver | null>(null);
  const [fullPhotoUrl, setFullPhotoUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showingBadge, setShowingBadge] = useState<Driver | null>(null);
  const [photoMenu, setPhotoMenu] = useState<{ isOpen: boolean; isEdit: boolean } | null>(null);
  const [showingPaymentDetails, setShowingPaymentDetails] = useState<Driver | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBadge, setFilterBadge] = useState('all');
  const [filterCofepris, setFilterCofepris] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState<Partial<Driver>>({
    fullName: '', teamCode: '', status: DriverStatus.AVAILABLE, 
    assignedStoreIds: [], curp: '', rfc: '', nss: '', isActive: true, photoUrl: '',
    dailyWage: 350, dailyGas: 180, storeFinances: {}, cofepris_status: 'No registrado'
  });

  const isSuper = currentUser?.role === UserRole.SUPERADMIN;

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

  const formatFullDate = (dateStr?: string) => {
    if (!dateStr) return 'NO REGISTRADO';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
  };

  const accessibleStores = useMemo(() => {
    if (isSuper) return stores;
    return stores.filter(s => (currentUser.assignedStoreIds || []).includes(s.id));
  }, [stores, isSuper, currentUser]);

  const getStoreFinance = (driver: Driver | Partial<Driver>, storeId: string) => {
    const saved = driver.storeFinances?.[storeId];
    if (saved && (Number(saved.dailyWage) > 0 || Number(saved.dailyGas) > 0)) return saved;
    const base = STORE_FINANCE_DEFAULTS[storeId];
    if (base) return base;
    return { dailyWage: driver.dailyWage || 350, dailyGas: driver.dailyGas || 180 };
  };

  const calculateFinancialHistory = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return { pendingWage: 0, pendingGas: 0, monthlyLedger: {} };
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const validHistory = (history || []).filter(role => {
        const d = new Date(role.date + 'T00:00:00');
        return d >= threeMonthsAgo;
    });
    const monthlyLedger: Record<string, any> = {};
    let currentPendingWage = 0;
    let currentPendingGas = 0;
    const sortedRoles = [...validHistory].sort((a, b) => a.date.localeCompare(b.date));
    sortedRoles.forEach(role => {
      const dateObj = new Date(role.date + 'T00:00:00');
      const monthKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!monthlyLedger[monthKey]) {
        monthlyLedger[monthKey] = { id: monthKey, name: `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][dateObj.getMonth()]} ${dateObj.getFullYear()}`, days: [], payments: [] };
      }
      const assignment = role.assignments.find(a => a.driverId === driverId);
      const hasAttended = !assignment?.attendance || assignment.attendance.status !== AttendanceStatus.ABSENT;
      if (assignment && hasAttended) {
        const fin = getStoreFinance(driver, role.storeId);
        currentPendingWage += fin.dailyWage;
        currentPendingGas += fin.dailyGas;
        monthlyLedger[monthKey].days.push({ date: role.date, storeName: role.storeName, wage: fin.dailyWage, gas: fin.dailyGas });
      }
    });
    return { pendingWage: currentPendingWage, pendingGas: currentPendingGas, monthlyLedger };
  };

  const filteredDrivers = useMemo(() => {
    let result = (drivers || []).filter(d => (d.assignedStoreIds || []).some(sid => (currentUser?.assignedStoreIds || []).includes(sid)) || isSuper);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d => d.fullName.toLowerCase().includes(q) || d.teamCode.toLowerCase().includes(q));
    }
    if (filterStore !== 'all') result = result.filter(d => (d.assignedStoreIds || []).includes(filterStore));
    if (filterStatus !== 'all') result = result.filter(d => d.status === filterStatus);
    if (filterBadge !== 'all') result = result.filter(d => String(d.isActive) === filterBadge);
    if (filterCofepris !== 'all') result = result.filter(d => calculateCofeprisStatus(d.cofepris_expiration || '') === filterCofepris);
    return result;
  }, [drivers, searchQuery, filterStore, filterStatus, filterBadge, filterCofepris, currentUser]);

  const totalPages = Math.ceil(filteredDrivers.length / ITEMS_PER_PAGE);
  const paginatedDrivers = useMemo(() => filteredDrivers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredDrivers, currentPage]);

  const toggleStoreSelection = (storeId: string, target: 'form' | 'edit') => {
    const currentIds = target === 'form' ? (form.assignedStoreIds || []) : (editing?.assignedStoreIds || []);
    const isAddingStore = !currentIds.includes(storeId);
    const newIds = isAddingStore ? [...currentIds, storeId] : currentIds.filter(id => id !== storeId);
    const defaults = STORE_FINANCE_DEFAULTS[storeId] || { dailyWage: 350, dailyGas: 180 };

    if (target === 'form') {
      const newFinances = { ...(form.storeFinances || {}) };
      if (isAddingStore && !newFinances[storeId]) newFinances[storeId] = { ...defaults };
      setForm({ ...form, assignedStoreIds: newIds, storeFinances: newFinances });
    } else if (editing) {
      const newFinances = { ...(editing.storeFinances || {}) };
      if (isAddingStore && !newFinances[storeId]) newFinances[storeId] = { ...defaults };
      setEditing({ ...editing, assignedStoreIds: newIds, storeFinances: newFinances });
    }
  };

  const handleUpdateFinance = (storeId: string, field: 'dailyWage' | 'dailyGas', valueStr: string, target: 'form' | 'edit') => {
    const value = valueStr === '' ? 0 : Number(valueStr);
    if (target === 'form') {
      const newFinances = { ...(form.storeFinances || {}) };
      newFinances[storeId] = { ...(newFinances[storeId] || STORE_FINANCE_DEFAULTS[storeId] || { dailyWage: 350, dailyGas: 180 }), [field]: value };
      setForm({ ...form, storeFinances: newFinances });
    } else if (editing) {
      const newFinances = { ...(editing.storeFinances || {}) };
      newFinances[storeId] = { ...(newFinances[storeId] || STORE_FINANCE_DEFAULTS[storeId] || { dailyWage: 350, dailyGas: 180 }), [field]: value };
      setEditing({ ...editing, storeFinances: newFinances });
    }
  };

  const handleFileAction = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (isEdit && editing) setEditing({ ...editing, photoUrl: base64 });
        else setForm({ ...form, photoUrl: base64 });
        setPhotoMenu(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    if (editing) setEditing({ ...editing, photoUrl: '' });
    else setForm({ ...form, photoUrl: '' });
    setPhotoMenu(null);
    setToast({ message: 'Fotografía removida', type: 'info' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdding) {
      const payload = {
        ...form,
        cofepris_status: calculateCofeprisStatus(form.cofepris_expiration || ''),
        isActive: form.isActive ?? true,
        status: form.status || DriverStatus.AVAILABLE,
        storeFinances: form.storeFinances || {},
        dailyWage: Number(form.dailyWage) || 350,
        dailyGas: Number(form.dailyGas) || 180
      };
      onAdd(payload);
      setToast({ message: 'Operador registrado correctamente', type: 'success' });
    } else if (editing) {
      const payload = {
        ...editing,
        cofepris_status: calculateCofeprisStatus(editing.cofepris_expiration || '')
      };
      onUpdate(payload);
      setToast({ message: 'Operador actualizado correctamente', type: 'success' });
    }
    setIsAdding(false);
    setEditing(null);
  };

  const confirmDelete = () => {
    if (deletingId) {
      onDelete(deletingId);
      setDeletingId(null);
      setToast({ message: 'Operador eliminado permanentemente', type: 'success' });
    }
  };

  const currentPhoto = isAdding ? form.photoUrl : editing?.photoUrl;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20"><Truck className="theme-text-main w-6 h-6 md:w-8 md:h-8" /></div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter leading-none">Operadores</h2>
            <p className="theme-text-muted text-[10px] font-bold uppercase tracking-wide opacity-60 tracking-widest">Gestión de Personal Logístico</p>
          </div>
        </div>
        <Button onClick={() => { setForm({ fullName: '', teamCode: '', status: DriverStatus.AVAILABLE, assignedStoreIds: [], isActive: true, storeFinances: {}, curp: '', rfc: '', nss: '', cofepris_expiration: '', photoUrl: '' }); setIsAdding(true); }} variant="primary" className="w-full md:w-auto px-6 py-4 rounded-2xl bg-blue-600 shadow-xl shadow-blue-900/40">
          <Plus className="w-4 h-4" /> <span className="font-black uppercase tracking-widest text-[10px]">Nuevo Operador</span>
        </Button>
      </header>

      <GlassCard className="p-2 md:p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={16} />
            <input type="text" placeholder="Buscar por Nombre o ID..." className="w-full theme-bg-subtle theme-text-main rounded-xl pl-11 pr-4 py-3 text-xs outline-none font-bold border theme-border focus:border-blue-500 transition-colors" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
          </div>
          <button 
            type="button"
            onClick={() => setShowFilterModal(true)} 
            className={`p-3.5 rounded-xl border transition-all flex items-center justify-center ${filterStatus !== 'all' || filterBadge !== 'all' || filterCofepris !== 'all' || filterStore !== 'all' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'}`}
          >
            <Filter size={18} />
          </button>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="theme-bg-subtle theme-text-muted text-[8px] font-black uppercase tracking-widest border-b theme-border">
                <th className="p-5">Conductor</th>
                <th className="p-5">Estatus</th>
                <th className="p-5">Cofepris</th>
                <th className="p-5">Gafete</th>
                <th className="p-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="theme-text-main divide-y theme-border">
              {paginatedDrivers.length === 0 ? (
                <tr><td colSpan={5} className="p-16 text-center opacity-20"><Search size={48} className="mx-auto mb-4" /><p className="text-xs font-black uppercase">Sin resultados</p></td></tr>
              ) : (
                paginatedDrivers.map(d => (
                  <tr key={d.id} className="hover:theme-bg-subtle transition-colors group">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl theme-bg-subtle flex items-center justify-center font-black border theme-border overflow-hidden shrink-0">
                          {d.photoUrl ? <img src={d.photoUrl} className="w-full h-full object-cover" /> : d.fullName?.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-black text-[13px] uppercase truncate leading-tight">{(d.fullName || '').split(' ').slice(0, 2).join(' ')}</span>
                          <span className="text-[10px] text-blue-500 font-mono leading-tight">{d.teamCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${d.status === DriverStatus.AVAILABLE ? 'text-emerald-500 border-emerald-500/20' : 'text-amber-500 border-amber-500/20'}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col">
                        <span className={`px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase w-fit ${getCofeprisBadgeStyles(calculateCofeprisStatus(d.cofepris_expiration || ''))}`}>
                          {calculateCofeprisStatus(d.cofepris_expiration || '')}
                        </span>
                        <span className="text-[7px] theme-text-muted font-bold ml-0.5">{formatMonthYear(d.cofepris_expiration)}</span>
                      </div>
                    </td>
                    <td className="p-5">
                      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${d.isActive ? 'text-emerald-500 border-emerald-500/20' : 'text-rose-500 border-rose-500/20'}`}>
                        {d.isActive ? 'Vigente' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setShowingBadge(d)} title="Ver Gafete" className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg"><QrCode size={18} /></button>
                        <button onClick={() => setViewing(d)} title="Expediente" className="p-2 text-sky-500 hover:bg-sky-500/10 rounded-lg"><Info size={18} /></button>
                        <button onClick={() => setEditing(d)} title="Editar" className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg"><Edit2 size={18} /></button>
                        <button onClick={() => setDeletingId(d.id)} title="Eliminar" className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-center gap-2 border-t theme-border bg-black/5">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 theme-text-muted hover:theme-text-main disabled:opacity-20 transition-all"><ChevronLeft size={20} /></button>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button key={i} onClick={() => setCurrentPage(i + 1)} className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-blue-600 text-white shadow-lg' : 'theme-bg-subtle theme-text-muted hover:theme-text-main'}`}>{i + 1}</button>
              ))}
            </div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-2 theme-text-muted hover:theme-text-main disabled:opacity-20 transition-all"><ChevronRight size={20} /></button>
          </div>
        )}
      </GlassCard>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="EXPEDIENTE">
        {viewing && (() => {
          const stats = calculateFinancialHistory(viewing.id);
          const cofStatus = calculateCofeprisStatus(viewing.cofepris_expiration || '');
          return (
            <div className="space-y-6 pb-4">
              <div className="flex flex-col items-center text-center border-b theme-border pb-6">
                <div 
                  className={`w-20 h-20 theme-bg-subtle rounded-3xl flex items-center justify-center mb-4 border-2 overflow-hidden shadow-xl cursor-pointer hover:scale-105 transition-transform ${viewing.photoUrl ? 'border-blue-500/50' : 'border-theme-border opacity-50'}`}
                  onClick={() => viewing.photoUrl ? setFullPhotoUrl(viewing.photoUrl) : setToast({ message: 'Operador sin foto de perfil', type: 'info' })}
                >
                  {viewing.photoUrl ? (
                    <div className="relative w-full h-full group">
                      <img src={viewing.photoUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="text-white w-6 h-6" /></div>
                    </div>
                  ) : (
                    <UserIcon size={32} />
                  )}
                </div>
                <h4 className="text-xl font-black theme-text-main uppercase leading-tight px-1 mb-2">{viewing.fullName}</h4>
                <div className="flex flex-wrap justify-center gap-2 mt-1">
                  <span className="text-[9px] font-black uppercase px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg">{viewing.teamCode}</span>
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border ${viewing.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>{viewing.isActive ? 'Gafete: Vigente' : 'Gafete: Bloqueado'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 {[
                   { l: 'CURP', v: viewing.curp || '---' },
                   { l: 'RFC', v: viewing.rfc || '---' },
                   { l: 'NSS', v: viewing.nss || '---' },
                   { l: 'VENC. COFEPRIS', v: formatFullDate(viewing.cofepris_expiration), extra: cofStatus }
                 ].map((item, i) => (
                   <div key={i} className="p-3 theme-bg-subtle rounded-2xl border theme-border shadow-sm">
                     <p className="text-[9px] font-black theme-text-muted uppercase mb-1 tracking-widest">{item.l}</p>
                     <p className="text-xs font-black theme-text-main font-mono truncate">{item.v}</p>
                     {item.extra && <span className={`text-[8px] font-black uppercase mt-2 inline-block ${getCofeprisBadgeStyles(item.extra)} px-2 py-0.5 rounded-md`}>{item.extra}</span>}
                   </div>
                 ))}
              </div>

              <div className="p-4 theme-bg-subtle rounded-[2rem] border theme-border space-y-3">
                 <div className="flex items-center gap-2 border-b theme-border pb-2">
                    <MapPin size={14} className="text-blue-500" />
                    <h5 className="text-[10px] font-black theme-text-main uppercase tracking-[0.2em]">Sedes y Tarifas</h5>
                 </div>
                 <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                    {(viewing.assignedStoreIds || []).map(sid => {
                       const store = stores.find(s => s.id === sid);
                       const fin = getStoreFinance(viewing, sid);
                       return (
                         <div key={sid} className="flex justify-between items-center p-3 bg-black/10 rounded-xl border theme-border">
                            <div className="flex flex-col min-w-0"><span className="text-[11px] font-black theme-text-main uppercase leading-none truncate mb-1">{store?.name || 'Sede'}</span><span className="text-[8px] text-blue-500 font-bold uppercase opacity-60">{store?.code}</span></div>
                            <div className="flex gap-4 text-right flex-shrink-0">
                               <div><p className="text-[6px] font-black theme-text-muted uppercase">Sueldo</p><p className="text-[11px] font-black text-emerald-500">${fin.dailyWage}</p></div>
                               <div><p className="text-[6px] font-black theme-text-muted uppercase">Gas</p><p className="text-[11px] font-black text-amber-500">${fin.dailyGas}</p></div>
                            </div>
                         </div>
                       );
                    })}
                 </div>
              </div>

              <div className="p-4 theme-bg-subtle rounded-[2rem] border theme-border space-y-4 shadow-2xl">
                 <div className="flex items-center gap-2 border-b theme-border pb-2">
                    <Wallet size={14} className="text-emerald-500" />
                    <h5 className="text-[10px] font-black theme-text-main uppercase tracking-[0.2em]">Balance Operativo</h5>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-center">
                       <p className="text-[7px] font-black theme-text-muted uppercase mb-1">Pend. Salario</p>
                       <p className="text-xl font-black text-emerald-500 leading-none">${stats.pendingWage}</p>
                    </div>
                    <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10 text-center">
                       <p className="text-[7px] font-black theme-text-muted uppercase mb-1">Pend. Gasolina</p>
                       <p className="text-xl font-black text-emerald-500 leading-none">${stats.pendingGas}</p>
                    </div>
                 </div>
                 <Button onClick={() => setShowingPaymentDetails(viewing)} variant="outline" className="w-full py-4 text-[9px] font-black uppercase border-blue-500/20 text-blue-500 bg-blue-500/5">Ver Historial de Cortes</Button>
              </div>

              <Button onClick={() => setViewing(null)} variant="outline" className="w-full py-4 text-[10px] font-black uppercase opacity-60">Cerrar Expediente</Button>
            </div>
          );
        })()}
      </Modal>

      <Modal isOpen={!!fullPhotoUrl} onClose={() => setFullPhotoUrl(null)} title="FOTO DE PERFIL">
         {fullPhotoUrl && (
           <div className="flex flex-col items-center gap-6 pb-4">
              <div className="w-full aspect-square rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
                <img src={fullPhotoUrl} className="w-full h-full object-cover" />
              </div>
              <Button onClick={() => setFullPhotoUrl(null)} variant="outline" className="w-full py-4 uppercase font-black">Cerrar Vista</Button>
           </div>
         )}
      </Modal>

      <Modal isOpen={isAdding || !!editing} onClose={() => { setIsAdding(false); setEditing(null); }} title={isAdding ? "NUEVO" : "EDITAR"}>
        <form onSubmit={handleSubmit} className="space-y-6 pb-6">
           <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-[2.5rem] theme-bg-subtle border-2 theme-border flex items-center justify-center overflow-hidden relative cursor-pointer group hover:border-blue-500 transition-colors" onClick={() => setPhotoMenu({ isOpen: true, isEdit: !!editing })}>
                {currentPhoto ? (
                  <img src={currentPhoto} className="w-full h-full object-cover" />
                ) : (
                  <Camera size={32} className="opacity-20 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Edit2 className="text-white" /></div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">Nombre Completo</label><input className="w-full glass-input rounded-xl px-4 py-4 font-bold text-sm" value={isAdding ? form.fullName : editing?.fullName} onChange={e => isAdding ? setForm({...form, fullName: e.target.value.toUpperCase()}) : editing && setEditing({...editing, fullName: e.target.value.toUpperCase()})} required /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">ID Flota</label><input className="w-full glass-input rounded-xl px-4 py-4 font-mono text-xs uppercase" value={isAdding ? form.teamCode : editing?.teamCode} onChange={e => isAdding ? setForm({...form, teamCode: e.target.value.toUpperCase()}) : editing && setEditing({...editing, teamCode: e.target.value.toUpperCase()})} required /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">CURP</label><input className="w-full glass-input rounded-xl px-4 py-4 font-mono text-xs uppercase" value={isAdding ? form.curp : editing?.curp} onChange={e => isAdding ? setForm({...form, curp: e.target.value.toUpperCase()}) : editing && setEditing({...editing, curp: e.target.value.toUpperCase()})} maxLength={18} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">RFC</label><input className="w-full glass-input rounded-xl px-4 py-4 font-mono text-xs uppercase" value={isAdding ? form.rfc : editing?.rfc} onChange={e => isAdding ? setForm({...form, rfc: e.target.value.toUpperCase()}) : editing && setEditing({...editing, rfc: e.target.value.toUpperCase()})} maxLength={13} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">NSS</label><input className="w-full glass-input rounded-xl px-4 py-4 font-mono text-xs uppercase" value={isAdding ? form.nss : editing?.nss} onChange={e => isAdding ? setForm({...form, nss: e.target.value}) : editing && setEditing({...editing, nss: e.target.value})} maxLength={11} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">Venc. Cofepris</label><input type="date" className="w-full glass-input rounded-xl px-4 py-4 font-mono text-xs" value={isAdding ? form.cofepris_expiration : editing?.cofepris_expiration} onChange={e => isAdding ? setForm({...form, cofepris_expiration: e.target.value}) : editing && setEditing({...editing, cofepris_expiration: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">Estatus Operativo</label><select className="w-full glass-input rounded-xl px-4 py-4 text-xs font-bold" value={isAdding ? form.status : editing?.status} onChange={e => isAdding ? setForm({...form, status: e.target.value as DriverStatus}) : editing && setEditing({...editing, status: e.target.value as DriverStatus})}>{Object.values(DriverStatus).map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div className="space-y-1"><label className="text-[9px] font-black uppercase theme-text-muted pl-1">Estado Gafete</label><select className="w-full glass-input rounded-xl px-4 py-4 text-xs font-bold" value={String(isAdding ? form.isActive : editing?.isActive)} onChange={e => isAdding ? setForm({...form, isActive: e.target.value === 'true'}) : editing && setEditing({...editing, isActive: e.target.value === 'true'})}><option value="true">Vigente</option><option value="false">Bloqueado</option></select></div>
           </div>

           <div className="space-y-4">
              <p className="text-[10px] font-black theme-text-muted uppercase border-b theme-border pb-2 tracking-widest">Configuración por Sede</p>
              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {stores.filter(s => isSuper || (currentUser.assignedStoreIds || []).includes(s.id)).map(s => {
                  const isChecked = isAdding ? (form.assignedStoreIds || []).includes(s.id) : (editing?.assignedStoreIds || []).includes(s.id);
                  const currentFinances = isAdding ? getStoreFinance(form, s.id) : (editing ? getStoreFinance(editing, s.id) : { dailyWage: 350, dailyGas: 180 });
                  
                  return (
                    <div key={s.id} className={`p-4 rounded-3xl border transition-all ${isChecked ? 'bg-blue-600/5 border-blue-500/40 shadow-inner' : 'theme-bg-subtle border-transparent opacity-60'}`}>
                       <label className="flex items-center gap-4 cursor-pointer">
                         <input type="checkbox" className="w-5 h-5 accent-blue-600 rounded-lg" checked={isChecked} onChange={() => toggleStoreSelection(s.id, isAdding ? 'form' : 'edit')} />
                         <span className="text-[11px] font-black uppercase theme-text-main tracking-tight">{s.name}</span>
                       </label>
                       {isChecked && (
                         <div className="grid grid-cols-2 gap-4 mt-4 pl-9 animate-in fade-in slide-in-from-top-1 duration-300">
                           <div className="space-y-1.5">
                             <p className="text-[8px] font-black uppercase theme-text-muted tracking-widest flex items-center gap-1"><DollarSign size={10} /> Sueldo</p>
                             <input type="number" className="w-full bg-black/20 border theme-border rounded-xl px-3 py-2 text-sm font-black text-emerald-500 outline-none focus:border-emerald-500/50" value={currentFinances.dailyWage} onChange={e => handleUpdateFinance(s.id, 'dailyWage', e.target.value, isAdding ? 'form' : 'edit')} />
                           </div>
                           <div className="space-y-1.5">
                             <p className="text-[8px] font-black uppercase theme-text-muted tracking-widest flex items-center gap-1"><Fuel size={10} /> Gasolina</p>
                             <input type="number" className="w-full bg-black/20 border theme-border rounded-xl px-3 py-2 text-sm font-black text-amber-500 outline-none focus:border-amber-500/50" value={currentFinances.dailyGas} onChange={e => handleUpdateFinance(s.id, 'dailyGas', e.target.value, isAdding ? 'form' : 'edit')} />
                           </div>
                         </div>
                       )}
                    </div>
                  );
                })}
              </div>
           </div>
           <Button type="submit" variant="success" className="w-full py-4 text-[10px] font-black uppercase shadow-xl shadow-emerald-900/20 tracking-[0.2em]">{isAdding ? "Registrar Operador" : "Actualizar Operador"}</Button>
        </form>
      </Modal>

      <Modal isOpen={showFilterModal} onClose={() => setShowFilterModal(false)} title="FILTROS">
         <div className="space-y-5 pb-6">
            <div className="space-y-4">
               <div>
                  <label className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5 block">Sede Operativa</label>
                  <select className="w-full theme-bg-subtle border theme-border rounded-xl px-4 py-2.5 theme-text-main font-bold outline-none text-[10px]" value={filterStore} onChange={e => { setFilterStore(e.target.value); setCurrentPage(1); }}>
                    <option value="all">Todas las sedes</option>
                    {accessibleStores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
               </div>
               <div>
                  <label className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5 block">Estado Operativo</label>
                  <div className="grid grid-cols-2 gap-1.5">
                     {['all', ...Object.values(DriverStatus)].map(s => (
                       <button key={s} onClick={() => { setFilterStatus(s); setCurrentPage(1); }} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${filterStatus === s ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'}`}>{s === 'all' ? 'Cualquiera' : s}</button>
                     ))}
                  </div>
               </div>
               <div>
                  <label className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5 block">Vigencia Gafete</label>
                  <div className="grid grid-cols-2 gap-1.5">
                     {['all', 'true', 'false'].map(b => (
                       <button key={b} onClick={() => { setFilterBadge(b); setCurrentPage(1); }} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${filterBadge === b ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'}`}>{b === 'all' ? 'Todos' : b === 'true' ? 'Vigente' : 'Inactivo'}</button>
                     ))}
                  </div>
               </div>
               <div>
                  <label className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1.5 block">Estatus Cofepris</label>
                  <div className="grid grid-cols-2 gap-1.5">
                     {['all', 'Vigente', 'Vence pronto', 'Vencido', 'No registrado'].map(c => (
                       <button key={c} onClick={() => { setFilterCofepris(c); setCurrentPage(1); }} className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase border transition-all ${filterCofepris === c ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'}`}>{c === 'all' ? 'Todos' : c}</button>
                     ))}
                  </div>
               </div>
            </div>
            <div className="flex gap-2 pt-2">
               <button onClick={() => { setFilterStatus('all'); setFilterBadge('all'); setFilterCofepris('all'); setFilterStore('all'); setCurrentPage(1); }} className="flex-1 py-3 text-[9px] font-black uppercase theme-text-muted border theme-border rounded-xl">Limpiar</button>
               <Button onClick={() => setShowFilterModal(false)} className="flex-1 py-3.5 uppercase font-black bg-blue-600">Cerrar y Ver</Button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={!!photoMenu} onClose={() => setPhotoMenu(null)} title="FOTOGRAFÍA">
        <div className="grid grid-cols-1 gap-2 pb-4">
           <Button variant="outline" className="py-2.5 text-[9px] font-black" onClick={() => fileInputRef.current?.click()}><ImageIcon size={16} /> GALERÍA</Button>
           <Button variant="primary" className="py-2.5 text-[9px] font-black bg-blue-600" onClick={() => cameraInputRef.current?.click()}><Camera size={16} /> CÁMARA</Button>
           {currentPhoto && (
             <Button variant="danger" className="py-2.5 text-[9px] font-black" onClick={removePhoto}><Trash2 size={16} /> ELIMINAR FOTO ACTUAL</Button>
           )}
           <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileAction(e, !!editing)} />
           <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileAction(e, !!editing)} />
        </div>
      </Modal>

      <Modal isOpen={!!showingBadge} onClose={() => setShowingBadge(null)} title="GAFETE INSTITUCIONAL">
         {showingBadge && <Badge driver={showingBadge} />}
      </Modal>

      <Modal isOpen={!!deletingId} onClose={() => setDeletingId(null)} title="CONFIRMAR ELIMINACIÓN">
         <div className="text-center space-y-6 py-4">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto animate-pulse" />
            <div className="space-y-2">
               <p className="text-lg font-black theme-text-main uppercase tracking-tight">¿Desea eliminar este registro?</p>
               <p className="text-[10px] theme-text-muted font-bold uppercase tracking-widest px-4">Esta acción borrará al operador y todas sus estadísticas financieras permanentemente.</p>
            </div>
            <div className="flex gap-4 px-2">
               <Button onClick={() => setDeletingId(null)} variant="outline" className="flex-1 py-4 font-black">CANCELAR</Button>
               <Button onClick={confirmDelete} variant="danger" className="flex-1 py-4 font-black shadow-xl shadow-rose-900/40">ELIMINAR</Button>
            </div>
         </div>
      </Modal>

      <Modal isOpen={!!showingPaymentDetails} onClose={() => setShowingPaymentDetails(null)} title="HISTORIAL OPERATIVO">
         {showingPaymentDetails && (() => {
            const stats = calculateFinancialHistory(showingPaymentDetails.id);
            const entries = Object.values(stats.monthlyLedger).reverse();
            return (
              <div className="space-y-4 pb-6">
                {entries.length === 0 ? <div className="py-20 flex flex-col items-center opacity-30 text-[11px] uppercase font-black gap-4"><Activity size={40} /><p>Sin registros operativos recientes</p></div> : entries.map((m: any) => (
                  <div key={m.id} className="space-y-2">
                    <button onClick={() => setExpandedMonths(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])} className="w-full flex justify-between p-4 theme-bg-subtle border theme-border rounded-2xl text-[11px] font-black uppercase theme-text-main transition-all hover:bg-white/5 shadow-sm">
                      <span className="flex items-center gap-2"><CalendarIcon size={14} className="text-blue-500" /> {m.name}</span> {expandedMonths.includes(m.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedMonths.includes(m.id) && <div className="space-y-2 pl-3 animate-in slide-in-from-top-2 duration-300">{m.days.map((d: any, idx: number) => (
                      <div key={idx} className="p-3.5 theme-bg-surface border theme-border rounded-xl flex justify-between items-center text-xs font-bold shadow-inner">
                        <div className="flex flex-col"><span className="theme-text-main uppercase">{d.storeName}</span><span className="text-[8px] theme-text-muted mt-1">{d.date.split('-').reverse().join(' / ')}</span></div>
                        <div className="flex gap-3"><span className="px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg">+$ {d.wage}</span><span className="px-2 py-1 bg-amber-500/10 text-amber-500 rounded-lg">+$ {d.gas}</span></div>
                      </div>
                    ))}</div>}
                  </div>
                ))}
                <Button onClick={() => setShowingPaymentDetails(null)} variant="outline" className="w-full py-4 text-[10px] font-black uppercase">Cerrar Historial</Button>
              </div>
            );
         })()}
      </Modal>
    </div>
  );
};
