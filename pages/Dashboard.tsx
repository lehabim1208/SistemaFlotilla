
import React from 'react';
import { Store as StoreIcon, Truck, Calendar, Users, Activity, Clock } from 'lucide-react';
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
  const isSuper = currentUser?.role === UserRole.SUPERADMIN;
  const safeDrivers = drivers || [];
  const safeStores = stores || [];
  const safeUserStoreIds = currentUser?.assignedStoreIds || [];
  const assignedStores = isSuper ? safeStores : safeStores.filter(s => s && safeUserStoreIds.includes(s.id));
  const accessibleDrivers = isSuper ? safeDrivers : safeDrivers.filter(d => d && (d.assignedStoreIds || []).some(sid => safeUserStoreIds.includes(sid)));
  const adminCount = users.filter(u => u.role === UserRole.ADMIN).length;
  const activeDriversCount = accessibleDrivers.filter(d => d.isActive).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black theme-text-main uppercase tracking-tighter leading-none">Panel Operativo</h1>
          <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Smart Go Logística • Stats</p>
        </div>
        <div className="flex items-center gap-3 theme-bg-subtle px-4 py-2 rounded-2xl border theme-border">
          <Clock size={14} className="text-blue-500" />
          <span className="text-[10px] font-black theme-text-muted uppercase tracking-widest">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      </header>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${isSuper ? '4' : '3'} gap-4`}>
        {[
          { label: 'Sedes Activas', value: assignedStores.length, color: 'text-blue-500', icon: StoreIcon },
          { label: 'Admins', value: adminCount, color: 'text-indigo-500', icon: Users, hide: !isSuper },
          { label: 'Operadores', value: accessibleDrivers.length, color: 'text-emerald-500', icon: Truck },
          { label: 'Histórico', value: history.length, color: 'text-amber-500', icon: Calendar },
        ].filter(k => !k.hide).map((k, i) => (
          <GlassCard key={i} className="p-6 relative overflow-hidden group">
            {/* Se aumenta opacidad de 5 a 10 para mejor percepción */}
            <k.icon className={`absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform ${k.color}`} size={100} />
            <p className={`${k.color} text-[8px] font-black uppercase tracking-widest mb-1`}>{k.label}</p>
            <div className="flex items-end gap-2">
              <h3 className="text-4xl font-black theme-text-main">{k.value}</h3>
              <span className="text-[10px] font-bold theme-text-muted uppercase">Unid.</span>
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="lg:col-span-1 p-8">
          <h4 className="text-lg font-black theme-text-main uppercase tracking-tight mb-8">Estado Gafetes</h4>
          <div className="flex items-center justify-center py-6">
             <div className="w-40 h-40 rounded-full border-[10px] theme-border flex flex-col items-center justify-center">
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
                <span className="text-[10px] font-black theme-text-muted uppercase">Inactivos</span>
                <span className="text-xs font-black theme-text-main">{accessibleDrivers.length - activeDriversCount}</span>
             </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-2 p-8">
          <h4 className="text-lg font-black theme-text-main uppercase tracking-tight mb-8">Disponibilidad por Sede</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {assignedStores.map(s => {
              const sDrivers = safeDrivers.filter(d => d.assignedStoreIds.includes(s.id));
              const available = sDrivers.filter(d => d.status === DriverStatus.AVAILABLE).length;
              return (
                <div key={s.id} className="p-5 theme-bg-subtle rounded-3xl border theme-border group">
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="min-w-0">
                      <h5 className="font-black theme-text-main text-sm uppercase truncate leading-tight">{s.name}</h5>
                      <p className="text-blue-500 font-mono text-[8px] font-black">{s.code}</p>
                    </div>
                    <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20 whitespace-nowrap flex-shrink-0">
                      {available} Disp.
                    </span>
                  </div>
                  <div className="w-full theme-bg-surface rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: `${sDrivers.length > 0 ? (available / sDrivers.length) * 100 : 0}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
