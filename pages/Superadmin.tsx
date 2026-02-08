
import React, { useState } from 'react';
// Fix: Added Loader2 to the imports from lucide-react
import { Store as StoreIcon, Edit2, Trash2, Eye, EyeOff, Shield, Power, PowerOff, AlertCircle, Settings as SettingsIcon, AlertTriangle, RefreshCcw, Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { User, Store, UserRole, Driver, DailyRole } from '../types';
import JSZip from 'jszip';

interface Props {
  users: User[];
  stores: Store[];
  drivers: Driver[];
  history: DailyRole[];
  onAddStore: (s: Partial<Store>) => void;
  onUpdateStore: (s: Store) => void;
  onDeleteStore: (id: string) => void;
  onAddAdmin: (u: Partial<User>) => void;
  onUpdateAdmin: (u: User) => void;
  onDeleteAdmin: (id: string) => void;
  onClearHistory: () => void;
}

export const Superadmin: React.FC<Props> = ({ 
  users = [], 
  stores = [], 
  drivers = [],
  history = [],
  onAddStore, 
  onUpdateStore, 
  onDeleteStore, 
  onAddAdmin, 
  onUpdateAdmin, 
  onDeleteAdmin,
  onClearHistory
}) => {
  const [view, setView] = useState<'admins' | 'stores' | 'system'>('admins');
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  const [deletingAdminId, setDeletingAdminId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetPhrase, setResetPhrase] = useState('');
  
  const [newStore, setNewStore] = useState({ name: '', code: '' });
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', assignedStoreIds: [] as string[] });
  const [showPwd, setShowPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleCreateAdmin = () => {
    if (!newAdmin.username || !newAdmin.password) return;
    onAddAdmin({
      id: `u${Date.now()}`,
      username: newAdmin.username,
      password: newAdmin.password,
      role: UserRole.ADMIN,
      assignedStoreIds: [],
      isTwoFactorEnabled: false,
      isDeleted: false
    });
    setNewAdmin({ username: '', password: '', assignedStoreIds: [] });
    setToast({ message: 'Admin registrado', type: 'success' });
  };

  const toggleAdminStatus = (u: User) => {
    onUpdateAdmin({ ...u, isDeleted: !u.isDeleted });
    setToast({ message: u.isDeleted ? 'Acceso restaurado' : 'Acceso restringido', type: 'info' });
  };

  const handleEditAdmin = (u: User) => setEditingAdmin({ ...u });

  const handleDeleteAdminAction = () => {
    if (deletingAdminId) {
      onDeleteAdmin(deletingAdminId);
      setDeletingAdminId(null);
      setToast({ message: 'Administrador eliminado correctamente', type: 'success' });
    }
  };

  const handleAddStoreAction = () => {
    if (!newStore.name || !newStore.code) return;
    onAddStore({ id: `s${Date.now()}`, name: newStore.name, code: newStore.code.toUpperCase() });
    setNewStore({ name: '', code: '' });
    setToast({ message: 'Sede registrada', type: 'success' });
  };

  const handleUpdateStoreAction = (s: Store) => {
    onUpdateStore(s);
    setEditingStore(null);
    setToast({ message: 'Sede actualizada', type: 'success' });
  };

  const handleDeleteStoreAction = () => {
    if (deletingStoreId) {
      onDeleteStore(deletingStoreId);
      setDeletingStoreId(null);
      setToast({ message: 'Sede eliminada', type: 'success' });
    }
  };

  const executeSystemReset = () => {
    onClearHistory();
    setShowResetConfirm(false);
    setResetStep(1);
    setResetPhrase('');
    setToast({ message: 'Historial eliminado íntegramente', type: 'success' });
  };

  // --- Lógica de Backup Maestro (JSON) ---
  const handleExportJSON = () => {
    const backupData = {
      timestamp: new Date().toISOString(),
      version: "2.5",
      tables: {
        users,
        stores,
        drivers,
        history
      }
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DriveFlow_MASTER_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setToast({ message: 'Backup Maestro (JSON) generado', type: 'success' });
  };

  // --- Lógica de Reportes CSV (Excel) ---
  const handleExportCSVs = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    
    // Función auxiliar para convertir a CSV seguro para Excel (UTF-8 BOM)
    const toExcelCSV = (headers: string[], rows: string[][]) => {
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      return '\uFEFF' + csvContent; // UTF-8 BOM para que Excel detecte tildes
    };

    // 1. Sedes
    const storeHeaders = ['ID', 'NOMBRE', 'CÓDIGO'];
    const storeRows = stores.map(s => [s.id, s.name, s.code]);
    zip.file('01_Sedes_Logisticas.csv', toExcelCSV(storeHeaders, storeRows));

    // 2. Operadores
    const driverHeaders = ['ID', 'NOMBRE COMPLETO', 'ID FLOTA', 'CURP', 'RFC', 'NSS', 'STATUS', 'ACTIVO', 'VENC_COFEPRIS'];
    const driverRows = drivers.map(d => [
      d.id, d.fullName, d.teamCode, d.curp || '', d.rfc || '', d.nss || '', d.status, d.isActive ? 'SÍ' : 'NO', d.cofepris_expiration || ''
    ]);
    zip.file('02_Operadores_Expedientes.csv', toExcelCSV(driverHeaders, driverRows));

    // 3. Historial de Roles (Relación detallada)
    const historyHeaders = ['ID_ROL', 'FECHA', 'SEDE', 'CÓDIGO_SEDE', 'TURNO', 'OPERADOR', 'ID_FLOTA_OPERADOR', 'ASISTENCIA', 'MOTIVO'];
    const historyRows = history.flatMap(role => 
      role.assignments.map(a => [
        role.id, role.date, role.storeName, role.storeCode, a.schedule, a.driverName, a.teamCode || '', a.attendance?.status || 'SIN REGISTRO', a.attendance?.reason || ''
      ])
    );
    zip.file('03_Historial_Roles_Completo.csv', toExcelCSV(historyHeaders, historyRows));

    // Generar ZIP y descargar
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DriveFlow_REPORTES_EXCEL_${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    
    setIsExporting(false);
    setToast({ message: 'Paquete de Reportes Excel (.csv) listo', type: 'success' });
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex gap-2 p-1.5 theme-bg-subtle rounded-xl w-full md:w-fit border theme-border shadow-2xl">
        <button 
          onClick={() => setView('admins')} 
          className={`flex-1 md:flex-none px-4 md:px-6 py-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${view === 'admins' ? 'bg-[var(--primary)] text-white shadow-xl' : 'theme-text-muted hover:theme-text-main'}`}
        >
          Admins
        </button>
        <button 
          onClick={() => setView('stores')} 
          className={`flex-1 md:flex-none px-4 md:px-6 py-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${view === 'stores' ? 'bg-[var(--primary)] text-white shadow-xl' : 'theme-text-muted hover:theme-text-main'}`}
        >
          Sedes
        </button>
        <button 
          onClick={() => setView('system')} 
          className={`flex-1 md:flex-none px-4 md:px-6 py-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${view === 'system' ? 'bg-rose-600 text-white shadow-xl' : 'theme-text-muted hover:theme-text-main'}`}
        >
          Sistema
        </button>
      </div>

      {view === 'admins' && (
        <GlassCard className="p-8">
          <h3 className="text-2xl font-black theme-text-main mb-6 uppercase tracking-tighter">Administradores</h3>
          <div className="flex flex-col gap-4 mb-8 theme-bg-subtle p-6 rounded-3xl border theme-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Usuario" className="w-full glass-input rounded-xl px-4 py-3 text-sm outline-none font-bold" value={newAdmin.username} onChange={e => setNewAdmin({...newAdmin, username: e.target.value})} />
              <div className="relative">
                <input type={showPwd ? "text" : "password"} placeholder="Contraseña" className="w-full glass-input rounded-xl px-4 py-3 text-sm outline-none pr-12 font-bold" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} />
                <button onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <Button onClick={handleCreateAdmin} variant="success" className="w-full py-4 text-[10px] uppercase font-black">Registrar Admin</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="theme-text-muted text-[8px] uppercase font-black border-b theme-border">
                <tr><th className="py-4 px-2">Usuario</th><th className="py-4 px-2">Acceso</th><th className="py-4 px-2 text-right">Gestión</th></tr>
              </thead>
              <tbody className="theme-text-main divide-y theme-border">
                {users.filter(u => u.role === UserRole.ADMIN).map(u => (
                  <tr key={u.id} className="hover:theme-bg-subtle transition-colors">
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className={u.isDeleted ? 'text-rose-500' : 'text-blue-500'} />
                        <span className={`font-black uppercase text-sm ${u.isDeleted ? 'text-rose-500 opacity-50' : ''}`}>{u.username}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <button onClick={() => toggleAdminStatus(u)} className={`w-10 h-5 rounded-full p-1 transition-all flex items-center ${u.isDeleted ? 'bg-rose-500/30' : 'bg-emerald-500'}`}>
                        <div className={`w-3 h-3 bg-white rounded-full shadow transition-all transform ${u.isDeleted ? 'translate-x-0' : 'translate-x-5'}`} />
                      </button>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleEditAdmin(u)} className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => setDeletingAdminId(u.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {view === 'stores' && (
        <GlassCard className="p-8">
          <h3 className="text-2xl font-black theme-text-main mb-6 uppercase tracking-tighter">Sedes Logísticas</h3>
          <div className="flex flex-col md:flex-row gap-3 mb-8">
            <input placeholder="Nombre de sede" className="flex-1 glass-input rounded-xl px-4 py-3 text-sm outline-none font-bold" value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})} />
            <input placeholder="Código" className="flex-1 glass-input rounded-xl px-4 py-3 uppercase text-sm outline-none font-bold" value={newStore.code} onChange={e => setNewStore({...newStore, code: e.target.value})} />
            <Button onClick={handleAddStoreAction} variant="success" className="py-4 px-8 text-[10px] uppercase font-black">Registrar</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map(s => (
              <div key={s.id} className="p-5 theme-bg-subtle rounded-2xl border theme-border flex justify-between items-center group transition-all hover:theme-bg-surface hover:shadow-xl">
                <div>
                  <p className="font-black theme-text-main uppercase text-sm truncate">{s.name}</p>
                  <p className="text-[var(--primary)] font-mono text-[9px] font-black">{s.code}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingStore(s)} className="p-2 text-amber-500 bg-amber-500/5 hover:bg-amber-500/20 border border-amber-500/10 rounded-xl transition-all"><Edit2 size={18} /></button>
                  <button onClick={() => setDeletingStoreId(s.id)} className="p-2 text-rose-500 bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 rounded-xl transition-all"><Trash2 size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {view === 'system' && (
        <div className="space-y-6">
          <GlassCard className="p-10 border-blue-500/20 bg-blue-500/[0.01] mb-6">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <Download className="text-blue-500" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black theme-text-main uppercase tracking-tighter">Exportación de Datos</h3>
                <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">Respaldo y Auditoría Administrativa</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 theme-bg-subtle rounded-3xl border theme-border space-y-4 hover:border-blue-500/30 transition-colors group">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-black theme-text-main uppercase">Backup Maestro</h4>
                  <FileJson className="text-blue-500/40 group-hover:text-blue-500 transition-colors" size={20} />
                </div>
                <p className="text-[9px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest opacity-60">
                  Descarga un archivo JSON completo con toda la estructura de la base de datos (Operadores, Sedes, Historial). Útil para migración o restauración técnica.
                </p>
                <Button 
                  onClick={handleExportJSON} 
                  variant="primary" 
                  className="w-full py-5 text-[10px] uppercase font-black bg-blue-600 shadow-xl shadow-blue-900/20"
                >
                  Exportar Backup (.json)
                </Button>
              </div>

              <div className="p-6 theme-bg-subtle rounded-3xl border theme-border space-y-4 hover:border-emerald-500/30 transition-colors group">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-black theme-text-main uppercase">Reportes Excel / CSV</h4>
                  <FileSpreadsheet className="text-emerald-500/40 group-hover:text-emerald-500 transition-colors" size={20} />
                </div>
                <p className="text-[9px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest opacity-60">
                  Genera reportes tabulares compatibles con Excel. Incluye lista de conductores, asistencias detalladas y configuración de sedes en formato separado.
                </p>
                <Button 
                  onClick={handleExportCSVs} 
                  disabled={isExporting}
                  variant="success" 
                  className="w-full py-5 text-[10px] uppercase font-black shadow-xl shadow-emerald-900/20"
                >
                  {isExporting ? <Loader2 className="animate-spin" size={16} /> : 'Descargar Reportes (.csv)'}
                </Button>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-10 border-rose-500/30 bg-rose-500/[0.02]">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
                <AlertTriangle className="text-rose-500" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-black text-rose-500 uppercase tracking-tighter">Zona de Peligro</h3>
                <p className="theme-text-muted text-[10px] font-black uppercase tracking-widest">Mantenimiento y Reseteo del Núcleo</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              <div className="p-6 theme-bg-subtle rounded-3xl border theme-border space-y-4">
                <h4 className="text-xs font-black theme-text-main uppercase">Reset Operativo</h4>
                <p className="text-[9px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest opacity-60">
                  Esta acción eliminará todos los roles publicados, el historial de asistencia y los balances financieros de los conductores. Úselo para entregar el sistema limpio al cliente.
                </p>
                <Button 
                  onClick={() => setShowResetConfirm(true)} 
                  variant="danger" 
                  className="w-full py-5 text-[10px] uppercase font-black shadow-xl shadow-rose-900/40"
                >
                  <RefreshCcw size={16} /> Reiniciar Historial de Roles
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modales de Gestión */}
      <Modal isOpen={showResetConfirm} onClose={() => { setShowResetConfirm(false); setResetStep(1); setResetPhrase(''); }} title="RESET DE SISTEMA">
        <div className="space-y-8 py-4 text-center">
          {resetStep === 1 ? (
            <>
              <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-rose-500/20 animate-pulse">
                <AlertTriangle className="text-rose-500" size={40} />
              </div>
              <div className="space-y-3">
                <h4 className="text-xl font-black theme-text-main uppercase tracking-tight">¿Estás absolutamente seguro?</h4>
                <p className="text-[10px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest px-4">
                  Se borrarán permanentemente todos los roles generados en todas las sedes. Esta acción <strong className="text-rose-500">no se puede deshacer</strong>.
                </p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => setShowResetConfirm(false)} variant="outline" className="flex-1 py-4 uppercase font-black">Cancelar</Button>
                <Button onClick={() => setResetStep(2)} variant="danger" className="flex-[2] py-4 uppercase font-black">Sí, Continuar</Button>
              </div>
            </>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-300">
               <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Para confirmar el borrado total, escribe:</p>
               <p className="text-sm font-black theme-text-main py-4 bg-black/20 rounded-2xl border theme-border font-mono tracking-widest uppercase">BORRAR TODO</p>
               <input 
                 className="w-full glass-input rounded-2xl px-6 py-5 text-center font-black uppercase outline-none focus:border-rose-500 shadow-inner" 
                 placeholder="ESCRIBE AQUÍ..."
                 value={resetPhrase}
                 onChange={e => setResetPhrase(e.target.value.toUpperCase())}
                 autoFocus
               />
               <Button 
                disabled={resetPhrase !== 'BORRAR TODO'} 
                onClick={executeSystemReset} 
                variant="danger" 
                className="w-full py-5 uppercase font-black text-[11px] shadow-2xl shadow-rose-900/60 tracking-[0.2em]"
               >
                 Confirmar Reset Permanente
               </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={!!editingStore} onClose={() => setEditingStore(null)} title="Editar Sede">
        {editingStore && (
          <form onSubmit={(e) => { e.preventDefault(); handleUpdateStoreAction(editingStore); }} className="space-y-4">
            <input className="w-full glass-input rounded-xl px-5 py-4 font-black uppercase" value={editingStore.name} onChange={e => setEditingStore({...editingStore, name: e.target.value})} />
            <input className="w-full glass-input rounded-xl px-5 py-4 font-mono uppercase" value={editingStore.code} onChange={e => setEditingStore({...editingStore, code: e.target.value})} />
            <Button type="submit" variant="warning" className="w-full py-5 text-[10px] uppercase font-black">Actualizar</Button>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deletingStoreId} onClose={() => setDeletingStoreId(null)} title="Eliminar Sede">
        <div className="text-center space-y-6">
          <AlertCircle className="text-rose-500 w-12 h-12 mx-auto" />
          <p className="text-sm font-bold theme-text-main uppercase">¿Confirmas la eliminación de esta sede?</p>
          <div className="flex gap-3"><Button onClick={() => setDeletingStoreId(null)} variant="outline" className="flex-1 py-4 text-[10px]">Cancelar</Button><Button onClick={handleDeleteStoreAction} variant="danger" className="flex-1 py-4 text-[10px]">Borrar</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!deletingAdminId} onClose={() => setDeletingAdminId(null)} title="Eliminar Administrador">
        <div className="text-center space-y-6">
          <AlertCircle className="text-rose-500 w-12 h-12 mx-auto" />
          <p className="text-sm font-bold theme-text-main uppercase">¿Confirmas la eliminación de este administrador?</p>
          <div className="flex gap-3">
            <Button onClick={() => setDeletingAdminId(null)} variant="outline" className="flex-1 py-4 text-[10px]">Cancelar</Button>
            <Button onClick={handleDeleteAdminAction} variant="danger" className="flex-1 py-4 text-[10px]">Borrar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editingAdmin} onClose={() => setEditingAdmin(null)} title="Perfil de Administrador">
        {editingAdmin && (
          <form onSubmit={(e) => { e.preventDefault(); onUpdateAdmin(editingAdmin); setEditingAdmin(null); setToast({ message: 'Cambios guardados', type: 'success' }); }} className="space-y-6">
            <div className="space-y-4">
              <input className="w-full glass-input rounded-xl px-4 py-3 font-black uppercase outline-none" value={editingAdmin.username} onChange={e => setEditingAdmin({...editingAdmin, username: e.target.value})} />
              <div className="relative">
                <input className="w-full glass-input rounded-xl px-4 py-3 outline-none pr-12 font-bold" type={showEditPwd ? "text" : "password"} value={editingAdmin.password || ''} onChange={e => setEditingAdmin({...editingAdmin, password: e.target.value})} />
                <button type="button" onClick={() => setShowEditPwd(!showEditPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showEditPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[8px] font-black theme-text-muted uppercase pl-2">Sedes Bajo Control:</p>
              <div className="max-h-60 overflow-y-auto space-y-1 p-2 bg-black/10 rounded-xl">
                {stores.map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-3 rounded-lg hover:theme-bg-subtle cursor-pointer">
                    <input type="checkbox" checked={editingAdmin.assignedStoreIds?.includes(s.id)} onChange={e => {
                      const ids = editingAdmin.assignedStoreIds || [];
                      setEditingAdmin({...editingAdmin, assignedStoreIds: e.target.checked ? [...ids, s.id] : ids.filter(i => i !== s.id)});
                    }} className="accent-blue-500 w-4 h-4" />
                    <span className="theme-text-main font-black uppercase text-[10px]">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" variant="warning" className="w-full py-5 text-[10px] uppercase font-black">Guardar Perfil</Button>
          </form>
        )}
      </Modal>
    </div>
  );
};
