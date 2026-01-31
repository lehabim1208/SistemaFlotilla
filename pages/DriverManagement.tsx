
import React, { useState, useRef, useMemo } from 'react';
import { Truck, Plus, Info, Edit2, Trash2, User as UserIcon, Search, Filter, ChevronLeft, ChevronRight, Store as StoreIcon, DollarSign, Fuel, QrCode, Camera, Eye, Image as ImageIcon, TrendingUp, Calendar as CalendarIcon, Wallet, CheckCircle2, XCircle, AlertCircle, Clock, ChevronDown, ChevronUp, MapPin, Activity } from 'lucide-react';
import { GlassCard, Button, Modal } from '../components/UI';
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

export const DriverManagement: React.FC<Props> = ({ currentUser, drivers = [], stores = [], history = [], onAdd, onUpdate, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [viewing, setViewing] = useState<Driver | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showingBadge, setShowingBadge] = useState<Driver | null>(null);
  const [photoMenu, setPhotoMenu] = useState<{ isOpen: boolean; isEdit: boolean } | null>(null);
  const [showingPaymentDetails, setShowingPaymentDetails] = useState<Driver | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStore, setFilterStore] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  const [form, setForm] = useState<Partial<Driver>>({
    fullName: '', teamCode: '', baseSchedule: '07:00 A 17:00', status: DriverStatus.AVAILABLE, 
    assignedStoreIds: [], curp: '', rfc: '', nss: '', isActive: true, photoUrl: '',
    dailyWage: 350, dailyGas: 180, storeFinances: {}
  });

  const formatDateSafe = (isoDate: string) => {
    if (!isoDate) return '---';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  };

  const getMonthName = (monthIndex: number) => {
    return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][monthIndex];
  };

  // Función para abreviar nombre (1 nombre, 1 apellido)
  const formatShortName = (name: string) => {
    if (!name) return '---';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 2) return name;
    return `${parts[0]} ${parts[1]}`;
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
      const assignment = role.assignments.find(a => a.driverId === driverId);
      const hasAttended = !assignment?.attendance || assignment.attendance.status !== AttendanceStatus.ABSENT;

      if (assignment && hasAttended) {
        const storeId = role.storeId;
        const financeStore = driver.storeFinances?.[storeId];
        const wage = Number(financeStore?.dailyWage ?? (driver.dailyWage || 350));
        const gas = Number(financeStore?.dailyGas ?? (driver.dailyGas || 180));
        
        const dateObj = new Date(role.date + 'T00:00:00');
        const monthKey = `${dateObj.getFullYear()}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!monthlyLedger[monthKey]) {
          monthlyLedger[monthKey] = { 
            name: `${getMonthName(dateObj.getMonth())} ${dateObj.getFullYear()}`, 
            days: [], 
            payments: [] 
          };
        }

        currentPendingWage += wage;
        currentPendingGas += gas;

        monthlyLedger[monthKey].days.push({
          date: role.date,
          storeName: role.storeName,
          wage: wage,
          gas: gas
        });

        const dayOfMonth = dateObj.getDate();
        const isFeb = dateObj.getMonth() === 1;
        const lastDayCutoff = isFeb ? 27 : 29;

        if (dateObj.getDay() === 1 && currentPendingGas > 0) {
          monthlyLedger[monthKey].payments.push({ type: 'GASOLINA', date: role.date, amount: currentPendingGas, note: 'Corte Semanal (Lunes)' });
          currentPendingGas = 0;
        }

        const isWageCutoff = (dayOfMonth === 14 || dayOfMonth === lastDayCutoff);
        if (isWageCutoff && currentPendingWage > 0) {
          monthlyLedger[monthKey].payments.push({ type: 'SALARIO', date: role.date, amount: currentPendingWage, note: dayOfMonth === 14 ? 'Corte 1ra Quincena' : 'Corte 2da Quincena' });
          currentPendingWage = 0;
        }
      }
    });

    return { pendingWage: currentPendingWage, pendingGas: currentPendingGas, monthlyLedger };
  };

  const filteredDrivers = useMemo(() => {
    let result = (drivers || []).filter(d => 
      (d.assignedStoreIds || []).some(sid => (currentUser?.assignedStoreIds || []).includes(sid)) || 
      currentUser?.role === UserRole.SUPERADMIN
    );
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d => d.fullName.toLowerCase().includes(q) || d.teamCode.toLowerCase().includes(q));
    }
    if (filterStore !== 'all') result = result.filter(d => (d.assignedStoreIds || []).includes(filterStore));
    if (filterStatus !== 'all') result = result.filter(d => d.status === filterStatus);
    return result;
  }, [drivers, searchQuery, filterStore, filterStatus, currentUser]);

  const paginatedDrivers = filteredDrivers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const toggleMonth = (month: string) => {
    setExpandedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]);
  };

  const handleOpenAdd = () => {
    setForm({ 
      fullName: '', teamCode: '', baseSchedule: '07:00 A 17:00', status: DriverStatus.AVAILABLE, 
      assignedStoreIds: [], isActive: true, photoUrl: '', dailyWage: 350, dailyGas: 180, storeFinances: {},
      curp: '', rfc: '', nss: ''
    });
    setIsAdding(true);
  };

  const toggleStoreSelection = (storeId: string, target: 'form' | 'edit') => {
    const store = stores.find(s => s.id === storeId);
    const currentIds = target === 'form' ? (form.assignedStoreIds || []) : (editing?.assignedStoreIds || []);
    const isAddingStore = !currentIds.includes(storeId);
    const newIds = isAddingStore ? [...currentIds, storeId] : currentIds.filter(id => id !== storeId);
    
    let defaultWage = 350;
    let defaultGas = 180;
    if (store) {
      const code = store.code.toUpperCase();
      if (code.includes('BA') || code.includes('EXPRESS')) defaultWage = 400;
      if (code.includes('EXPRESS') || code.includes('CRISTAL')) defaultGas = 200;
    }

    if (target === 'form') {
      const newFinances = { ...(form.storeFinances || {}) };
      if (isAddingStore && !newFinances[storeId]) newFinances[storeId] = { dailyWage: defaultWage, dailyGas: defaultGas };
      setForm({ ...form, assignedStoreIds: newIds, storeFinances: newFinances });
    } else if (editing) {
      const newFinances = { ...(editing.storeFinances || {}) };
      if (isAddingStore && !newFinances[storeId]) newFinances[storeId] = { dailyWage: defaultWage, dailyGas: defaultGas };
      setEditing({ ...editing, assignedStoreIds: newIds, storeFinances: newFinances });
    }
  };

  const handleUpdateFinance = (storeId: string, field: 'dailyWage' | 'dailyGas', valueStr: string, target: 'form' | 'edit') => {
    const value = valueStr === '' ? 0 : Number(valueStr);
    if (target === 'form') {
      const newFinances = { ...(form.storeFinances || {}) };
      newFinances[storeId] = { ...(newFinances[storeId] || { dailyWage: 350, dailyGas: 180 }), [field]: value };
      setForm({ ...form, storeFinances: newFinances });
    } else if (editing) {
      const newFinances = { ...(editing.storeFinances || {}) };
      newFinances[storeId] = { ...(newFinances[storeId] || { dailyWage: 350, dailyGas: 180 }), [field]: value };
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">
            <Truck className="theme-text-main w-6 h-6 md:w-8 md:h-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black theme-text-main uppercase tracking-tighter leading-none">Operadores</h2>
            <p className="theme-text-muted text-[10px] md:text-xs font-bold uppercase tracking-wide opacity-60">Control de Personal y cortes financieros</p>
          </div>
        </div>
        <Button onClick={handleOpenAdd} variant="primary" className="w-full md:w-auto px-6 py-4 rounded-2xl bg-blue-600 shadow-xl shadow-blue-900/40">
          <Plus className="w-4 h-4" /> <span className="font-black uppercase tracking-widest text-[10px]">Nuevo Operador</span>
        </Button>
      </header>

      <GlassCard className="p-2 md:p-3">
        <div className="flex items-center gap-2">
          {/* BUSCADOR PRINCIPAL */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={16} />
            <input 
              type="text" 
              placeholder="Nombre o ID..." 
              className="w-full theme-bg-subtle theme-text-main rounded-xl pl-11 pr-4 py-3 text-xs outline-none font-bold border theme-border focus:border-blue-500/50 transition-colors" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>

          {/* FILTRO SEDE - BOTÓN ICONO */}
          <div className="relative group">
            <div className={`p-3 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${filterStore !== 'all' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'}`}>
              <MapPin size={18} />
              <select 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={filterStore} 
                onChange={e => setFilterStore(e.target.value)}
              >
                <option value="all">Todas las Sedes</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* FILTRO ESTADO - BOTÓN ICONO */}
          <div className="relative group">
            <div className={`p-3 rounded-xl border transition-all flex items-center justify-center cursor-pointer ${filterStatus !== 'all' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted hover:theme-text-main'}`}>
              <Filter size={18} />
              <select 
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">Cualquier Estatus</option>
                {Object.values(DriverStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="theme-bg-subtle theme-text-muted text-[8px] md:text-[9px] font-black uppercase tracking-widest border-b theme-border">
                <th className="p-5 md:p-6">Operador</th>
                <th className="p-5 md:p-6">Estatus</th>
                <th className="p-5 md:p-6">Gafete</th>
                <th className="p-5 md:p-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="theme-text-main divide-y theme-border">
              {paginatedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <Search size={48} className="theme-text-muted" />
                      <p className="text-xs font-black uppercase tracking-widest">No se encontraron resultados</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map(d => (
                  <tr key={d.id} className="hover:theme-bg-subtle group transition-colors">
                    <td className="p-5 md:p-6">
                      <div className="flex items-center gap-3">
                        {/* Foto 1:1 Forzada con object-cover */}
                        <div className="w-10 h-10 aspect-square rounded-xl theme-bg-subtle flex items-center justify-center font-black overflow-hidden border theme-border shrink-0">
                          {d.photoUrl ? (
                            <img src={d.photoUrl} className="w-full h-full object-cover" />
                          ) : (
                            <span className="uppercase">{d.fullName?.charAt(0)}</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          {/* Nombre corto en tabla (Abreviado) */}
                          <span className="font-black text-sm uppercase truncate">
                            {formatShortName(d.fullName)}
                          </span>
                          <span className="text-[10px] text-blue-500 font-mono">{d.teamCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 md:p-6">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${
                        d.status === DriverStatus.AVAILABLE ? 'text-emerald-500 bg-emerald-500/10' : 
                        d.status === DriverStatus.RESTING ? 'text-amber-500 bg-amber-500/10' : 
                        'text-slate-400 bg-slate-500/10'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="p-5 md:p-6">
                      <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${d.isActive ? 'text-emerald-500 border-emerald-500/30' : 'text-rose-500 border-rose-500/30'}`}>
                        {d.isActive ? 'Vigente' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="p-5 md:p-6 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setShowingBadge(d)} className="p-2 text-indigo-500 hover:bg-indigo-500/10 rounded-lg"><QrCode size={18} /></button>
                        <button onClick={() => setViewing(d)} className="p-2 text-sky-500 hover:bg-sky-500/10 rounded-lg"><Info size={18} /></button>
                        <button onClick={() => setEditing(d)} className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg"><Edit2 size={18} /></button>
                        <button onClick={() => setDeletingId(d.id)} className="p-2 text-rose-600 hover:bg-rose-600/10 rounded-lg"><Trash2 size={18} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Expediente del Operador (Información Detallada) */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="EXPEDIENTE DEL OPERADOR">
        {viewing && (() => {
          const stats = calculateFinancialHistory(viewing.id);
          const statusConfig = {
            [DriverStatus.AVAILABLE]: { color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10', dot: true },
            [DriverStatus.RESTING]: { color: 'text-amber-500 border-amber-500/20 bg-amber-500/10', dot: false },
            [DriverStatus.ABSENT]: { color: 'text-slate-400 border-slate-500/20 bg-slate-500/10', dot: false }
          };
          const config = statusConfig[viewing.status] || statusConfig[DriverStatus.ABSENT];

          return (
            <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-1 custom-scrollbar pb-6">
              <div className="flex flex-col items-center text-center pb-6 border-b theme-border">
                <div className="w-28 h-28 theme-bg-subtle rounded-[2.5rem] flex items-center justify-center mb-4 overflow-hidden border-2 theme-border shadow-2xl relative">
                  {viewing.photoUrl ? <img src={viewing.photoUrl} className="w-full h-full object-cover" /> : <UserIcon size={40} className="opacity-20" />}
                </div>
                
                <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border mb-4 ${config.color} animate-in fade-in zoom-in-95`}>
                  {config.dot && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,1)]" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">{viewing.status}</span>
                </div>

                <h4 className="text-xl font-black theme-text-main uppercase leading-none">{viewing.fullName}</h4>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                   <span className="text-blue-500 font-mono font-black text-[10px] uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">{viewing.teamCode}</span>
                   <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border ${viewing.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                      {viewing.isActive ? 'Gafete Vigente' : 'Inactivo / Vencido'}
                   </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div className="p-4 theme-bg-subtle rounded-2xl border theme-border">
                    <p className="text-[8px] font-black theme-text-muted uppercase mb-1">CURP</p>
                    <p className="text-[11px] font-bold uppercase truncate theme-text-main font-mono">{viewing.curp || '---'}</p>
                 </div>
                 <div className="p-4 theme-bg-subtle rounded-2xl border theme-border">
                    <p className="text-[8px] font-black theme-text-muted uppercase mb-1">RFC</p>
                    <p className="text-[11px] font-bold uppercase truncate theme-text-main font-mono">{viewing.rfc || '---'}</p>
                 </div>
                 <div className="p-4 theme-bg-subtle rounded-2xl border theme-border">
                    <p className="text-[8px] font-black theme-text-muted uppercase mb-1">NSS</p>
                    <p className="text-[11px] font-bold uppercase truncate theme-text-main font-mono">{viewing.nss || '---'}</p>
                 </div>
                 <div className="p-4 theme-bg-subtle rounded-2xl border theme-border">
                    <p className="text-[8px] font-black theme-text-muted uppercase mb-1">Horario Fijo</p>
                    <p className="text-[11px] font-bold uppercase truncate theme-text-main">{viewing.baseSchedule || 'S/H'}</p>
                 </div>
              </div>

              <div className="p-6 theme-bg-subtle rounded-[2.5rem] border theme-border space-y-4">
                 <div className="flex items-center gap-2 border-b theme-border pb-3">
                    <MapPin size={16} className="text-blue-500" />
                    <h5 className="text-[10px] font-black theme-text-main uppercase tracking-widest">Sedes y Tarifas Asignadas</h5>
                 </div>
                 <div className="space-y-3">
                    {(viewing.assignedStoreIds || []).map(sid => {
                       const store = stores.find(s => s.id === sid);
                       const finances = viewing.storeFinances?.[sid] || { dailyWage: 350, dailyGas: 180 };
                       return (
                         <div key={sid} className="flex justify-between items-center p-3 bg-black/10 rounded-2xl border theme-border">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black theme-text-main uppercase">{store?.name || '---'}</span>
                               <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">{store?.code}</span>
                            </div>
                            <div className="flex gap-4 text-right">
                               <div><p className="text-[7px] font-black theme-text-muted uppercase">Sueldo</p><p className="text-xs font-black text-emerald-500">${finances.dailyWage}</p></div>
                               <div><p className="text-[7px] font-black theme-text-muted uppercase">Gas</p><p className="text-xs font-black text-amber-500">${finances.dailyGas}</p></div>
                            </div>
                         </div>
                       );
                    })}
                 </div>
              </div>

              <div className="p-6 theme-bg-subtle rounded-[2.5rem] border theme-border space-y-7 bg-gradient-to-br from-transparent to-blue-500/[0.04]">
                 <div className="flex items-center gap-2 border-b theme-border pb-4"><TrendingUp size={16} className="text-blue-500" /><h5 className="text-[10px] font-black theme-text-main uppercase tracking-widest leading-none">Saldo Pendiente Actual</h5></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black theme-text-muted uppercase flex items-center gap-1"><DollarSign size={10} className="text-emerald-500"/> Salario x Cobrar</p>
                      <p className="text-3xl font-black text-emerald-500 leading-none tracking-tight">${stats.pendingWage}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black theme-text-muted uppercase flex items-center gap-1"><Fuel size={10} className="text-amber-500"/> Gasolina x Cobrar</p>
                      <p className="text-3xl font-black text-amber-500 leading-none tracking-tight">${stats.pendingGas}</p>
                    </div>
                 </div>
                 <Button onClick={() => setShowingPaymentDetails(viewing)} variant="outline" className="w-full py-4 text-[10px] font-black uppercase tracking-widest border-blue-500/30 text-blue-500 hover:bg-blue-600 hover:text-white transition-all shadow-lg"><Eye size={16} /> Ver historial y cortes</Button>
              </div>

              <Button onClick={() => setViewing(null)} variant="outline" className="w-full py-4 text-[11px] font-black uppercase tracking-widest">Cerrar Expediente</Button>
            </div>
          );
        })()}
      </Modal>

      {/* Detalle de Pagos Históricos */}
      <Modal isOpen={!!showingPaymentDetails} onClose={() => { setShowingPaymentDetails(null); setExpandedMonths([]); }} title="DETALLE DE PAGOS">
        {showingPaymentDetails && (() => {
          const stats = calculateFinancialHistory(showingPaymentDetails.id);
          const months = Object.keys(stats.monthlyLedger).sort().reverse();
          
          return (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 mb-4 flex items-center gap-3">
                <AlertCircle size={18} className="text-amber-500 shrink-0" />
                <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest leading-relaxed">
                  Corte Salarial: Días 14 y 29. Gasolina: Lunes. El trabajo en días de pago (15 y 30) se suma al nuevo periodo.
                </p>
              </div>

              {months.length === 0 ? (
                <div className="py-20 text-center opacity-20 uppercase text-[9px] font-black tracking-widest">Sin registros en el periodo actual</div>
              ) : (
                months.map(month => (
                  <div key={month} className="rounded-2xl border theme-border overflow-hidden">
                    <button onClick={() => toggleMonth(month)} className="w-full p-5 theme-bg-subtle flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <CalendarIcon size={18} className="theme-text-muted group-hover:text-blue-500 transition-colors" />
                        <span className="text-xs font-black uppercase theme-text-main">{stats.monthlyLedger[month].name}</span>
                      </div>
                      {expandedMonths.includes(month) ? <ChevronUp size={18} className="theme-text-muted" /> : <ChevronDown size={18} className="theme-text-muted" />}
                    </button>
                    
                    {expandedMonths.includes(month) && (
                      <div className="p-4 space-y-4 theme-bg-surface animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase theme-text-muted mb-2 tracking-widest">Servicios Realizados</p>
                            {stats.monthlyLedger[month].days.map((day: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center p-3 bg-black/10 rounded-xl border theme-border">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-black theme-text-main leading-none">{formatDateSafe(day.date)}</span>
                                  <span className="text-[7px] font-bold text-blue-500 uppercase mt-1">{day.storeName}</span>
                                </div>
                                <div className="flex gap-3 text-right">
                                    <div><p className="text-[7px] font-black theme-text-muted uppercase">Salario</p><p className="text-[10px] font-black text-emerald-500">${day.wage}</p></div>
                                    <div><p className="text-[7px] font-black theme-text-muted uppercase">Gas</p><p className="text-[10px] font-black text-amber-500">${day.gas}</p></div>
                                </div>
                              </div>
                            ))}
                        </div>

                        {stats.monthlyLedger[month].payments.length > 0 && (
                          <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-blue-500 mb-2 tracking-widest border-t border-blue-500/20 pt-4">Liquidaciones Registradas</p>
                              {stats.monthlyLedger[month].payments.map((p: any, idx: number) => (
                                <div key={idx} className={`p-4 rounded-xl border flex justify-between items-center ${p.type === 'SALARIO' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
                                  <div className="flex flex-col">
                                      <span className={`text-[9px] font-black uppercase ${p.type === 'SALARIO' ? 'text-emerald-500' : 'text-amber-500'}`}>{p.type} LIQUIDADO</span>
                                      <span className="text-[8px] font-bold theme-text-muted mt-1">{p.note} • {formatDateSafe(p.date)}</span>
                                  </div>
                                  <span className={`text-xl font-black ${p.type === 'SALARIO' ? 'text-emerald-500' : 'text-amber-500'}`}>${p.amount}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
              <Button onClick={() => setShowingPaymentDetails(null)} variant="primary" className="w-full py-5 text-[10px] font-black uppercase tracking-widest mt-4 bg-blue-600">Cerrar Historial</Button>
            </div>
          );
        })()}
      </Modal>

      {/* Modales de Gestión (Creación y Edición) */}
      <Modal isOpen={isAdding || !!editing} onClose={() => { setIsAdding(false); setEditing(null); }} title={isAdding ? "Nuevo Operador" : "Editar Operador"}>
        <form onSubmit={e => { e.preventDefault(); if(isAdding) onAdd(form); else editing && onUpdate(editing); setIsAdding(false); setEditing(null); }} className="space-y-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
           <div className="flex flex-col items-center py-2">
              <div className="w-28 h-28 rounded-[2rem] theme-bg-subtle border-2 theme-border flex items-center justify-center overflow-hidden relative group cursor-pointer shadow-xl" onClick={() => setPhotoMenu({ isOpen: true, isEdit: !!editing })}>
                {(isAdding ? form.photoUrl : editing?.photoUrl) ? <img src={isAdding ? form.photoUrl : editing?.photoUrl} className="w-full h-full object-cover" /> : <UserIcon size={40} className="theme-text-muted opacity-20" />}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white"><Camera size={20} /><span className="text-[8px] font-black uppercase mt-1">Foto</span></div>
              </div>
           </div>

           <div className="space-y-4">
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest border-b theme-border pb-2 flex items-center gap-2">Identidad</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">Nombre Completo</label>
                  <input className="w-full glass-input rounded-xl px-4 py-3 font-bold" value={isAdding ? form.fullName : editing?.fullName} onChange={e => isAdding ? setForm({...form, fullName: e.target.value}) : editing && setEditing({...editing, fullName: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">Usuario / Código</label>
                  <input className="w-full glass-input rounded-xl px-4 py-3 font-mono text-xs" value={isAdding ? form.teamCode : editing?.teamCode} onChange={e => isAdding ? setForm({...form, teamCode: e.target.value}) : editing && setEditing({...editing, teamCode: e.target.value})} required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">CURP</label>
                  <input className="w-full glass-input rounded-xl px-4 py-3 font-mono text-xs uppercase" value={isAdding ? form.curp : editing?.curp} onChange={e => isAdding ? setForm({...form, curp: e.target.value.toUpperCase()}) : editing && setEditing({...editing, curp: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">RFC</label>
                  <input className="w-full glass-input rounded-xl px-4 py-3 font-mono text-xs uppercase" value={isAdding ? form.rfc : editing?.rfc} onChange={e => isAdding ? setForm({...form, rfc: e.target.value.toUpperCase()}) : editing && setEditing({...editing, rfc: e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">NSS</label>
                  <input className="w-full glass-input rounded-xl px-4 py-3 font-mono text-xs" value={isAdding ? form.nss : editing?.nss} onChange={e => isAdding ? setForm({...form, nss: e.target.value}) : editing && setEditing({...editing, nss: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">Horario Fijo</label>
                  <input className="w-full glass-input rounded-xl px-4 py-3 font-bold text-xs" value={isAdding ? form.baseSchedule : editing?.baseSchedule} onChange={e => isAdding ? setForm({...form, baseSchedule: e.target.value}) : editing && setEditing({...editing, baseSchedule: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">Estatus</label>
                  <select className="w-full glass-input rounded-xl px-4 py-3 text-xs font-bold" value={isAdding ? form.status : editing?.status} onChange={e => isAdding ? setForm({...form, status: e.target.value as DriverStatus}) : editing && setEditing({...editing, status: e.target.value as DriverStatus})}>
                    {Object.values(DriverStatus).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase theme-text-muted">Gafete</label>
                  <select className="w-full glass-input rounded-xl px-4 py-3 text-xs font-bold" value={String(isAdding ? form.isActive : editing?.isActive)} onChange={e => isAdding ? setForm({...form, isActive: e.target.value === 'true'}) : editing && setEditing({...editing, isActive: e.target.value === 'true'})}>
                    <option value="true">Vigente</option>
                    <option value="false">Inactivo / Vencido</option>
                  </select>
                </div>
              </div>
           </div>

           <div className="space-y-4">
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest border-b theme-border pb-2">Sedes y Tarifas por Sede</p>
              <div className="grid grid-cols-1 gap-3 p-3 bg-black/10 rounded-3xl border theme-border">
                {stores.map(s => {
                  const isChecked = isAdding ? (form.assignedStoreIds || []).includes(s.id) : (editing?.assignedStoreIds || []).includes(s.id);
                  const finances = isAdding ? (form.storeFinances?.[s.id]) : (editing?.storeFinances?.[s.id]);
                  return (
                    <div key={s.id} className={`p-4 rounded-2xl border transition-all ${isChecked ? 'bg-blue-600/5 border-blue-500/30' : 'theme-bg-subtle border-transparent opacity-60'}`}>
                       <label className="flex items-center gap-3 cursor-pointer mb-3">
                         <input type="checkbox" className="w-4 h-4 accent-blue-600 rounded" checked={isChecked} onChange={() => toggleStoreSelection(s.id, isAdding ? 'form' : 'edit')} />
                         <span className="text-[10px] font-black uppercase">{s.name}</span>
                       </label>
                       {isChecked && finances && (
                         <div className="grid grid-cols-2 gap-3 pl-7 animate-in slide-in-from-top-2">
                           <div>
                             <p className="text-[7px] font-black uppercase theme-text-muted mb-1">Salario Diario</p>
                             <input 
                                type="number" 
                                className="w-full bg-black/20 border theme-border rounded-lg px-3 py-2 text-[10px] font-black text-emerald-500" 
                                value={finances.dailyWage || ''} 
                                onChange={e => handleUpdateFinance(s.id, 'dailyWage', e.target.value, isAdding ? 'form' : 'edit')} 
                              />
                           </div>
                           <div>
                             <p className="text-[7px] font-black uppercase theme-text-muted mb-1">Gasolina Diaria</p>
                             <input 
                                type="number" 
                                className="w-full bg-black/20 border theme-border rounded-lg px-3 py-2 text-[10px] font-black text-amber-500" 
                                value={finances.dailyGas || ''} 
                                onChange={e => handleUpdateFinance(s.id, 'dailyGas', e.target.value, isAdding ? 'form' : 'edit')} 
                              />
                           </div>
                         </div>
                       )}
                    </div>
                  );
                })}
              </div>
           </div>
           <Button type="submit" variant="success" className="w-full py-5 text-[11px] font-black uppercase">{isAdding ? "Registrar Operador" : "Guardar Cambios"}</Button>
        </form>
      </Modal>

      {/* Otros Modales (Badge, Foto, Confirmación) */}
      <Modal isOpen={!!showingBadge} onClose={() => setShowingBadge(null)} title="Gafete Digital">{showingBadge && <Badge driver={showingBadge} />}</Modal>
      <Modal isOpen={!!photoMenu} onClose={() => setPhotoMenu(null)} title="Opciones de Foto">
        <div className="grid grid-cols-1 gap-3">
           <Button variant="outline" className="py-4" onClick={() => fileInputRef.current?.click()}><ImageIcon size={18} /> Galería</Button>
           <Button variant="primary" className="py-4 bg-blue-600" onClick={() => cameraInputRef.current?.click()}><Camera size={18} /> Cámara</Button>
           <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileAction(e, !!editing)} />
           <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={(e) => handleFileAction(e, !!editing)} />
        </div>
      </Modal>
      <Modal isOpen={!!deletingId} onClose={() => setDeletingId(null)} title="Eliminar">
        <div className="text-center space-y-6">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <p className="text-[10px] font-black uppercase">¿Deseas eliminar permanentemente a este operador?</p>
          <div className="flex gap-4">
            <Button onClick={() => setDeletingId(null)} variant="outline" className="flex-1 py-4">No, Cancelar</Button>
            <Button onClick={() => { deletingId && onDelete(deletingId); setDeletingId(null); }} variant="danger" className="flex-1 py-4">Sí, Eliminar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
