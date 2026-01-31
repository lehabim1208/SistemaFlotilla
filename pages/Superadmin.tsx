
import React, { useState } from 'react';
import { Store as StoreIcon, Edit2, Trash2, Eye, EyeOff, Shield, Power, PowerOff, AlertCircle } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { User, Store, UserRole } from '../types';

interface Props {
  users: User[];
  stores: Store[];
  onAddStore: (s: Partial<Store>) => void;
  onUpdateStore: (s: Store) => void;
  onDeleteStore: (id: string) => void;
  onAddAdmin: (u: Partial<User>) => void;
  onUpdateAdmin: (u: User) => void;
  onDeleteAdmin: (id: string) => void;
}

export const Superadmin: React.FC<Props> = ({ users = [], stores = [], onAddStore, onUpdateStore, onDeleteStore, onAddAdmin, onUpdateAdmin, onDeleteAdmin }) => {
  const [view, setView] = useState<'admins' | 'stores'>('admins');
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);
  
  const [newStore, setNewStore] = useState({ name: '', code: '' });
  const [newAdmin, setNewAdmin] = useState({ username: '', password: '', assignedStoreIds: [] as string[] });
  const [showPwd, setShowPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const handleCreateAdmin = () => {
    if (!newAdmin.username) return;
    onAddAdmin({ ...newAdmin, password: newAdmin.password || newAdmin.username, role: UserRole.ADMIN, assignedStoreIds: newAdmin.assignedStoreIds || [], isTwoFactorEnabled: false });
    setNewAdmin({ username: '', password: '', assignedStoreIds: [] });
    setToast({ message: 'Administrador creado', type: 'success' });
  };

  const toggleAdminStatus = (u: User) => {
    onUpdateAdmin({ ...u, isDeleted: !u.isDeleted });
    setToast({ message: `Acceso de ${u.username} ${!u.isDeleted ? 'bloqueado' : 'restaurado'}`, type: 'info' });
  };

  const handleEditAdmin = (u: User) => {
    setEditingAdmin({ ...u, password: u.password || u.username });
    setShowEditPwd(false);
  };

  const handleAddStoreAction = () => {
    if (!newStore.name || !newStore.code) return;
    onAddStore(newStore);
    setNewStore({ name: '', code: '' });
    setToast({ message: 'Sede registrada correctamente', type: 'success' });
  };

  const handleUpdateStoreAction = (s: Store) => {
    onUpdateStore(s);
    setEditingStore(null);
    setToast({ message: 'Tienda editada correctamente', type: 'success' });
  };

  const handleDeleteStoreAction = () => {
    if (deletingStoreId) {
      onDeleteStore(deletingStoreId);
      setDeletingStoreId(null);
      setToast({ message: 'Se borró correctamente', type: 'success' });
    }
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="flex gap-2 p-1.5 theme-bg-subtle rounded-xl w-full md:w-fit border theme-border shadow-2xl">
        <button onClick={() => setView('admins')} className={`flex-1 md:flex-none px-4 md:px-6 py-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${view === 'admins' ? 'bg-[var(--primary)] text-white shadow-xl' : 'theme-text-muted hover:theme-text-main'}`}>Admins</button>
        <button onClick={() => setView('stores')} className={`flex-1 md:flex-none px-4 md:px-6 py-3 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all ${view === 'stores' ? 'bg-[var(--primary)] text-white shadow-xl' : 'theme-text-muted hover:theme-text-main'}`}>Tiendas</button>
      </div>

      {view === 'admins' ? (
        <GlassCard className="p-8">
          <h3 className="text-2xl font-black theme-text-main mb-6 uppercase">Administradores</h3>
          <div className="flex flex-col gap-4 mb-8 theme-bg-subtle p-6 rounded-3xl border theme-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="Usuario" className="w-full glass-input rounded-xl px-4 py-3 text-sm outline-none" value={newAdmin.username} onChange={e => setNewAdmin({...newAdmin, username: e.target.value})} />
              <div className="relative">
                <input type={showPwd ? "text" : "password"} placeholder="Contraseña" className="w-full glass-input rounded-xl px-4 py-3 text-sm outline-none pr-12" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} />
                <button onClick={() => setShowPwd(!showPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showPwd ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </div>
            <Button onClick={handleCreateAdmin} variant="success" className="w-full py-4 text-[10px] uppercase font-black">Registrar Admin</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="theme-text-muted text-[8px] uppercase font-black border-b theme-border">
                <tr><th className="py-4 px-2">Usuario</th><th className="py-4 px-2">Estatus Acceso</th><th className="py-4 px-2 text-right">Gestión</th></tr>
              </thead>
              <tbody className="theme-text-main divide-y theme-border">
                {users.filter(u => u.role === UserRole.ADMIN).map(u => (
                  <tr key={u.id} className={`hover:theme-bg-subtle transition-colors ${u.isDeleted ? 'bg-rose-500/[0.02]' : ''}`}>
                    <td className="py-4 px-2">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className={u.isDeleted ? 'text-rose-500' : 'text-blue-500'} />
                        <span className={`font-black uppercase text-sm ${u.isDeleted ? 'text-rose-500 opacity-50' : ''}`}>{u.username}</span>
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <button onClick={() => toggleAdminStatus(u)} className={`w-12 h-6 rounded-full p-1 transition-all flex items-center shadow-inner ${u.isDeleted ? 'bg-rose-500/30' : 'bg-emerald-500'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-all transform ${u.isDeleted ? 'translate-x-0' : 'translate-x-6'}`} />
                      </button>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleEditAdmin(u)} className="p-2 text-amber-500 hover:bg-amber-500/10 rounded-lg"><Edit2 size={16} /></button>
                        <button onClick={() => onDeleteAdmin(u.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="p-8">
          <h3 className="text-2xl font-black theme-text-main mb-6 uppercase">Sedes Logísticas</h3>
          <div className="flex flex-col md:flex-row gap-3 mb-8">
            <input placeholder="Nombre de sede" className="flex-1 glass-input rounded-xl px-4 py-3 text-sm outline-none" value={newStore.name} onChange={e => setNewStore({...newStore, name: e.target.value})} />
            <input placeholder="Código" className="flex-1 glass-input rounded-xl px-4 py-3 uppercase text-sm outline-none" value={newStore.code} onChange={e => setNewStore({...newStore, code: e.target.value})} />
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

      {/* Modales de Gestión */}
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

      <Modal isOpen={!!editingAdmin} onClose={() => setEditingAdmin(null)} title="Perfil de Administrador">
        {editingAdmin && (
          <form onSubmit={(e) => { e.preventDefault(); onUpdateAdmin(editingAdmin); setEditingAdmin(null); setToast({ message: 'Cambios guardados', type: 'success' }); }} className="space-y-6">
            <div className="space-y-4">
              <input className="w-full glass-input rounded-xl px-4 py-3 font-black uppercase outline-none" value={editingAdmin.username} onChange={e => setEditingAdmin({...editingAdmin, username: e.target.value})} />
              <div className="relative">
                <input className="w-full glass-input rounded-xl px-4 py-3 outline-none pr-12" type={showEditPwd ? "text" : "password"} value={editingAdmin.password || ''} onChange={e => setEditingAdmin({...editingAdmin, password: e.target.value})} />
                <button type="button" onClick={() => setShowEditPwd(!showEditPwd)} className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted">{showEditPwd ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[8px] font-black theme-text-muted uppercase pl-2">Zonas de Control:</p>
              <div className="max-h-60 overflow-y-auto space-y-1 p-2 bg-black/10 rounded-xl">
                {stores.map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-3 rounded-lg hover:theme-bg-subtle cursor-pointer">
                    <input type="checkbox" checked={editingAdmin.assignedStoreIds?.includes(s.id)} onChange={e => {
                      const ids = editingAdmin.assignedStoreIds || [];
                      setEditingAdmin({...editingAdmin, assignedStoreIds: e.target.checked ? [...ids, s.id] : ids.filter(i => i !== s.id)});
                    }} className="accent-blue-500" />
                    <span className="theme-text-main font-black uppercase text-[10px]">{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" variant="warning" className="w-full py-5 text-[10px] uppercase font-black">Guardar Cambios</Button>
          </form>
        )}
      </Modal>
    </div>
  );
};
