
import React, { useState } from 'react';
import { Store as StoreIcon, Edit2, Trash2, Eye, EyeOff, Shield, Power, PowerOff, AlertCircle, Settings as SettingsIcon, AlertTriangle, RefreshCcw, Download, Database, FileJson, FileSpreadsheet, Trash } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { User, Store, UserRole, Driver, DailyRole } from '../types';

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

  const downloadJSON = () => {
    const data = {
      version: '4.2',
      exportDate: new Date().toISOString(),
      users, // Se agregaron los usuarios al backup JSON
      stores,
      drivers,
      history
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_completo_driveflow_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'JSON con Usuarios generado', type: 'success' });
  };

  const downloadCSV = () => {
    // Exportamos el historial de roles (Assignments) que es lo más relevante para Excel
    let csv = "Fecha,Sede,Codigo,Operador,ID Flota,Horario,Asistencia\n";
    history.forEach(role => {
      role.assignments.forEach(a => {
        csv += `${role.date},${role.storeName.replace(/,/g, '')},${role.storeCode},${a.driverName.replace(/,/g, '')},${a.teamCode},${a.schedule.replace(/,/g, '-')},${a.attendance?.status || 'Pendiente'}\n`;
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_roles_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: 'Excel (CSV) generado', type: 'success' });
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
          className={`flex-1 md:flex-none px-4 md:px-6 py-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${view === 'system' ? 'bg-[var(--primary)] text-white shadow-xl' : 'theme-text-muted hover:theme-text-main'}`}
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
                        <span className={`font-black text-sm ${u.isDeleted ? 'text-rose-500 opacity-50' : ''}`}>{u.username}</span>
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
              <div key={s.id} className="p-4 theme-bg-subtle rounded-2xl border theme-border flex justify-between items-center group transition-all hover:theme-bg-surface hover:shadow-xl">
                <div className="min-w-0 flex-1 mr-3">
                  <p className="font-black theme-text-main text-[11px] truncate leading-tight">{s.name}</p>
                  <p className="text-[var(--primary)] font-mono text-[8px] font-black">{s.code}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setEditingStore(s)} className="p-2 text-amber-500 bg-amber-500/5 hover:bg-amber-500/20 border border-amber-500/10 rounded-lg transition-all"><Edit2 size={14} /></button>
                  <button onClick={() => setDeletingStoreId(s.id)} className="p-2 text-rose-500 bg-rose-500/5 hover:bg-rose-500/20 border border-rose-500/10 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {view === 'system' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {/* Card Limpieza */}
           <GlassCard className="p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20"><Trash className="text-rose-500" size={24} /></div>
                    <h4 className="text-lg font-black theme-text-main uppercase tracking-tighter">Limpiar Historial</h4>
                 </div>
                 <p className="text-[10px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest">
                    Elimina permanentemente todos los roles y registros de asistencia generados en todas las sedes hasta la fecha. Esta acción <strong className="text-rose-500">no se puede deshacer</strong> y es útil para iniciar un nuevo periodo contable.
                 </p>
              </div>
              <Button onClick={() => setShowResetConfirm(true)} variant="danger" className="w-full py-4 text-[10px] uppercase font-black shadow-xl shadow-rose-900/40">
                 Ejecutar Limpieza Total
              </Button>
           </GlassCard>

           {/* Card Descargas */}
           <GlassCard className="p-8 space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20"><Database className="text-blue-500" size={24} /></div>
                    <h4 className="text-lg font-black theme-text-main uppercase tracking-tighter">Descargar Datos</h4>
                 </div>
                 <p className="text-[10px] theme-text-muted font-bold uppercase leading-relaxed tracking-widest">
                    Obtén un respaldo físico de toda la información operativa almacenada en el sistema (Usuarios, Conductores, Sedes y Roles). Puedes elegir entre formato íntegro de base de datos (JSON) o reporte tabular (CSV).
                 </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 <Button onClick={downloadJSON} variant="outline" className="py-4 text-[9px] font-black uppercase tracking-widest border-blue-500/20 text-blue-500">
                    <FileJson size={16} /> Descargar JSON
                 </Button>
                 <Button onClick={downloadCSV} variant="outline" className="py-4 text-[9px] font-black uppercase tracking-widest border-emerald-500/20 text-emerald-500">
                    <FileSpreadsheet size={16} /> Descargar CSV
                 </Button>
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
            <input className="w-full glass-input rounded-xl px-5 py-4 font-bold" value={editingStore.name} onChange={e => setEditingStore({...editingStore, name: e.target.value})} />
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
              <input className="w-full glass-input rounded-xl px-4 py-3 font-bold outline-none" value={editingAdmin.username} onChange={e => setEditingAdmin({...editingAdmin, username: e.target.value})} />
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
