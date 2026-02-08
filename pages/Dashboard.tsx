
import React, { useState, useEffect } from 'react';
import { Store as StoreIcon, Truck, Calendar, Users, Activity, Clock, ClipboardList } from 'lucide-react';
import { GlassCard } from '../components/UI';
import { User, Store, Driver, DailyRole, DriverStatus, UserRole } from '../types';

interface DashboardProps {
  currentUser: User;
  stores: Store[];
  drivers: Driver[];
  history: DailyRole[];
  users: User[];
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, stores = [], drivers = [], history = [], users = [] }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isSuper = currentUser?.role === UserRole.SUPERADMIN;
  const safeDrivers = drivers || [];
  const safeStores = stores || [];
  const safeHistory = history || [];
  const safeUserStoreIds = currentUser?.assignedStoreIds || [];
  
  const assignedStores = isSuper ? safeStores : safeStores.filter(s => s && safeUserStoreIds.includes(s.id));
  const accessibleDrivers = isSuper ? safeDrivers : safeDrivers.filter(d => d && (d.assignedStoreIds || []).some(sid => safeUserStoreIds.includes(sid)));
  const accessibleHistory = isSuper ? safeHistory : safeHistory.filter(h => safeUserStoreIds.includes(h.storeId));

  const adminCount = users.filter(u => u.role === UserRole.ADMIN).length;
  const activeDriversCount = accessibleDrivers.filter(d => d.isActive).length;

  // Cálculos de Roles
  const todayIso = new Date().toISOString().split('T')[0];
  const rolesOp = accessibleHistory.filter(h => h.date === todayIso).length;
  const rolesFuture = accessibleHistory.filter(h => h.date > todayIso).length;
  const rolesDone = accessibleHistory.filter(h => h.date < todayIso).length;

  const displayName = currentUser.name || currentUser.username;

  const formattedDate = currentTime.toLocaleDateString('es-MX', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
  
  const formattedTime = currentTime.toLocaleTimeString('es-MX', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black theme-text-main uppercase tracking-tighter leading-none">
            Bienvenido, {displayName}
          </h1>
          <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.4em] opacity-60">
            Panel Operativo • Stats
          </p>
        </div>
        <div className="flex items-center gap-3 theme-bg-subtle px-4 py-2 rounded-2xl border theme-border">
          <Clock size={14} className="text-blue-500" />
          <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">
            {formattedDate} | {formattedTime}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Sedes Activas', value: assignedStores.length, color: 'text-blue-500', icon: StoreIcon },
          { label: 'Operadores', value: accessibleDrivers.length, color: 'text-emerald-500', icon: Truck },
          { label: 'Admins Activos', value: adminCount, color: 'text-indigo-500', icon: Users, hide: !isSuper },
        ].filter(k => !k.hide).map((k, i) => (
          <GlassCard 
            key={i} 
            className="p-6 relative overflow-hidden group transition-all duration-500 border-none ring-1 ring-white/10"
            style={{ 
              backgroundClip: 'padding-box',
              WebkitMaskImage: '-webkit-radial-gradient(white, black)'
            }}
          >
            <k.icon className={`absolute right-2 bottom-2 opacity-[0.05] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-700 ${k.color}`} size={76} />
            <p className={`${k.color} text-[8px] font-black uppercase tracking-widest mb-1 relative z-10`}>{k.label}</p>
            <div className="flex items-end gap-2 relative z-10">
              <h3 className="text-4xl font-black theme-text-main tracking-tighter">{k.value}</h3>
              <span className="text-[10px] font-bold theme-text-muted uppercase mb-1">Unid.</span>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-1 p-8" style={{ backgroundClip: 'padding-box', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-lg font-black theme-text-main uppercase tracking-tight">Estatus de Roles</h4>
            <ClipboardList className="text-blue-500 opacity-20" size={24} />
          </div>
          <div className="space-y-4">
             <div className="p-4 theme-bg-subtle rounded-3xl border theme-border flex items-center justify-between group transition-all hover:bg-emerald-500/5">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">En Operación</span>
                </div>
                <span className="text-xl font-black text-emerald-500">{rolesOp}</span>
             </div>

             <div className="p-4 theme-bg-subtle rounded-3xl border theme-border flex items-center justify-between group transition-all hover:bg-blue-500/5">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-blue-500" />
                   <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">Por Empezar</span>
                </div>
                <span className="text-xl font-black text-blue-500">{rolesFuture}</span>
             </div>

             <div className="p-4 theme-bg-subtle rounded-3xl border theme-border flex items-center justify-between group transition-all hover:opacity-60">
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full theme-bg-surface border theme-border" />
                   <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">Concluidos</span>
                </div>
                <span className="text-xl font-black theme-text-muted">{rolesDone}</span>
             </div>
          </div>
          <div className="mt-8 pt-6 border-t theme-border flex justify-between items-center">
             <span className="text-[9px] font-black theme-text-muted uppercase tracking-widest">Total Histórico</span>
             <span className="text-sm font-black theme-text-main">{accessibleHistory.length}</span>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-1 p-8" style={{ backgroundClip: 'padding-box', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
          <h4 className="text-lg font-black theme-text-main uppercase tracking-tight mb-8">Gafetes Vigentes</h4>
          <div className="flex items-center justify-center py-6">
             <div className="w-40 h-40 rounded-full border-[10px] theme-border flex flex-col items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border-[10px] border-emerald-500/20 border-t-emerald-500 animate-spin-slow" />
                <p className="text-4xl font-black theme-text-main">{activeDriversCount}</p>
                <p className="text-[9px] font-black text-emerald-500 uppercase">Vigentes</p>
             </div>
          </div>
          <div className="space-y-2 mt-6">
             <div className="flex justify-between p-3 theme-bg-subtle rounded-xl border theme-border">
                <span className="text-[10px] font-black theme-text-muted uppercase">Activos</span>
                <span className="text-xs font-black theme-text-main">{activeDriversCount}</span>
             </div>
             <div className="flex justify-between p-3 theme-bg-subtle rounded-xl border theme-border">
                <span className="text-[10px] font-black theme-text-muted uppercase">Expirados</span>
                <span className="text-xs font-black theme-text-main">{accessibleDrivers.length - activeDriversCount}</span>
             </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-1 p-8" style={{ backgroundClip: 'padding-box', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
          <h4 className="text-lg font-black theme-text-main uppercase tracking-tight mb-8">Disponibilidad</h4>
          <div className="space-y-6 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {assignedStores.length === 0 ? (
              <p className="text-[10px] font-bold theme-text-muted uppercase text-center py-10 opacity-30">Sin sedes asignadas</p>
            ) : (
              assignedStores.map(s => {
                const sDrivers = safeDrivers.filter(d => d.assignedStoreIds.includes(s.id));
                const available = sDrivers.filter(d => d.status === DriverStatus.AVAILABLE).length;
                return (
                  <div key={s.id} className="p-5 theme-bg-subtle rounded-3xl border theme-border group">
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="min-w-0">
                        <h5 className="font-black theme-text-main text-xs uppercase truncate leading-tight">{s.name}</h5>
                        <p className="text-blue-500 font-mono text-[8px] font-black">{s.code}</p>
                      </div>
                      <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 rounded-lg border border-blue-500/20 flex-shrink-0">
                        {available}
                      </span>
                    </div>
                    <div className="w-full theme-bg-surface rounded-full h-1 overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${sDrivers.length > 0 ? (available / sDrivers.length) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </GlassCard>
      </div>
      
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
};
