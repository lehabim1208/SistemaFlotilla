
import React, { useMemo } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Calendar, Activity, ShieldCheck, AlertCircle, Info, Star } from 'lucide-react';
import { GlassCard } from '../components/UI';
import { User, Store, Driver, DailyRole, Incident, AttendanceStatus } from '../types';

interface Props {
  currentUser: User;
  stores: Store[];
  drivers: Driver[];
  history: DailyRole[];
  incidents: Incident[];
}

export const AnalyticsHub: React.FC<Props> = ({ currentUser, stores, drivers, history, incidents }) => {
  
  // 1. Estadísticas de Confiabilidad (Scorecard)
  const scorecards = useMemo(() => {
    return drivers.map(d => {
      const assignments = history.flatMap(h => h.assignments.filter(a => a.driverId === d.id));
      const total = assignments.length;
      if (total === 0) return { id: d.id, name: d.fullName, score: 0, total };
      
      const attended = assignments.filter(a => a.attendance?.status === AttendanceStatus.PRESENT).length;
      const delayed = assignments.filter(a => a.attendance?.status === AttendanceStatus.DELAYED).length;
      const absent = assignments.filter(a => a.attendance?.status === AttendanceStatus.ABSENT).length;
      
      // Algoritmo: Presente=10pts, Demora=6pts, Falta=0pts
      const score = ((attended * 10) + (delayed * 6)) / (total * 10) * 100;
      return { id: d.id, name: d.fullName, score: Math.round(score), total, absent };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [drivers, history]);

  // 2. Heatmap de Asistencia (Últimos 28 días)
  const heatmapData = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const dayRoles = history.filter(h => h.date === iso);
      const allAsgn = dayRoles.flatMap(r => r.assignments);
      const absenses = allAsgn.filter(a => a.attendance?.status === AttendanceStatus.ABSENT).length;
      const count = allAsgn.length;
      
      let level = 0; // 0=ninguna asignación, 1=buena, 2=media ausentismo, 3=critica
      if (count > 0) {
        const rate = absenses / count;
        if (rate === 0) level = 1;
        else if (rate < 0.2) level = 2;
        else level = 3;
      }
      days.push({ iso, level, count });
    }
    return days;
  }, [history]);

  // 3. Proyecciones Financieras Semanales
  const financialProjections = useMemo(() => {
    const next7Days = [];
    const today = new Date();
    let totalWage = 0;
    let totalGas = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const iso = d.toISOString().split('T')[0];
        const dayRoles = history.filter(h => h.date === iso);
        
        dayRoles.forEach(r => {
            r.assignments.forEach(asg => {
                const drv = drivers.find(dr => dr.id === asg.driverId);
                const fin = drv?.storeFinances?.[r.storeId] || { dailyWage: drv?.dailyWage || 350, dailyGas: drv?.dailyGas || 180 };
                totalWage += fin.dailyWage;
                totalGas += fin.dailyGas;
            });
        });
    }
    return { totalWage, totalGas, totalNeeded: totalWage + totalGas };
  }, [history, drivers]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col gap-1">
        <h2 className="text-3xl font-black theme-text-main uppercase tracking-tighter leading-none">Inteligencia Operativa</h2>
        <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Analytics Hub v1.2</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* HEATMAP ASISTENCIA */}
        <GlassCard className="lg:col-span-2 p-8">
           <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-3">
               <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20"><Calendar className="text-blue-500" size={20} /></div>
               <h4 className="text-lg font-black theme-text-main uppercase">Heatmap de Cumplimiento</h4>
             </div>
             <div className="flex gap-2">
               {[1, 2, 3].map(lvl => (
                 <div key={lvl} className={`w-3 h-3 rounded-sm ${lvl === 1 ? 'bg-emerald-500' : lvl === 2 ? 'bg-amber-500' : 'bg-rose-500'}`} />
               ))}
             </div>
           </div>
           <div className="grid grid-cols-7 gap-3 mb-6">
             {heatmapData.map((d, i) => (
               <div key={i} className={`aspect-square rounded-xl border transition-all hover:scale-110 cursor-pointer flex items-center justify-center relative group ${
                 d.level === 0 ? 'theme-bg-subtle border-white/5' : 
                 d.level === 1 ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                 d.level === 2 ? 'bg-amber-500 border-amber-400' : 'bg-rose-500 border-rose-400 animate-pulse'
               }`}>
                 {d.count > 0 && <span className="text-[8px] font-black text-white">{d.count}</span>}
                 <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 bg-black/80 backdrop-blur-md p-2 rounded-lg border border-white/10 text-[8px] font-black uppercase text-white whitespace-nowrap">
                    {d.iso} • {d.count} Asignaciones
                 </div>
               </div>
             ))}
           </div>
           <p className="text-[9px] font-black theme-text-muted uppercase tracking-widest text-center opacity-60">Visualización de los últimos 28 días operativos</p>
        </GlassCard>

        {/* RANKING CONFIABILIDAD */}
        <GlassCard className="p-8">
          <div className="flex items-center gap-3 mb-8">
             <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20"><Star className="text-amber-500" size={20} /></div>
             <h4 className="text-lg font-black theme-text-main uppercase">Top Confiabilidad</h4>
          </div>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
             {scorecards.map((s, i) => (
               <div key={s.id} className="flex items-center justify-between p-4 theme-bg-subtle border theme-border rounded-2xl hover:bg-white/5 transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-black theme-text-muted w-4">{i + 1}</span>
                    <div className="flex flex-col min-w-0">
                       <span className="text-[11px] font-black theme-text-main uppercase truncate leading-tight">{s.name.split(' ')[0]} {s.name.split(' ')[1]}</span>
                       <span className="text-[8px] theme-text-muted font-bold uppercase tracking-tighter">{s.total} Turnos</span>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-black border ${s.score > 85 ? 'text-emerald-500 border-emerald-500/20' : s.score > 60 ? 'text-amber-500 border-amber-500/20' : 'text-rose-500 border-rose-500/20'}`}>
                    {s.score}%
                  </div>
               </div>
             ))}
          </div>
        </GlassCard>

        {/* PROYECCIONES FINANCIERAS */}
        <GlassCard className="p-8 space-y-6">
           <div className="flex items-center gap-3 mb-2">
             <div className="p-3 bg-emerald-600/10 rounded-2xl border border-emerald-500/20"><DollarSign className="text-emerald-500" size={20} /></div>
             <h4 className="text-lg font-black theme-text-main uppercase">Proyección Semanal</h4>
           </div>
           <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl text-center">
              <p className="text-[10px] font-black theme-text-muted uppercase tracking-widest mb-2">Total Estimado Requerido</p>
              <p className="text-4xl font-black text-emerald-500 tracking-tighter">${financialProjections.totalNeeded.toLocaleString()}</p>
              <p className="text-[8px] font-bold text-emerald-600/60 uppercase mt-2">Próximos 7 días de operación</p>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 theme-bg-subtle rounded-2xl border theme-border">
                 <p className="text-[8px] font-black theme-text-muted uppercase mb-1">Salarios</p>
                 <p className="text-lg font-black theme-text-main">${financialProjections.totalWage.toLocaleString()}</p>
              </div>
              <div className="p-4 theme-bg-subtle rounded-2xl border theme-border">
                 <p className="text-[8px] font-black theme-text-muted uppercase mb-1">Gasolina</p>
                 <p className="text-lg font-black theme-text-main">${financialProjections.totalGas.toLocaleString()}</p>
              </div>
           </div>
           <div className="p-4 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[9px] font-bold text-blue-400 leading-relaxed uppercase">Este monto se calcula basado en los roles ya generados y las tarifas pactadas por sede.</p>
           </div>
        </GlassCard>

        {/* ESTADÍSTICAS DE INCIDENCIAS */}
        <GlassCard className="lg:col-span-2 p-8">
           <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-rose-600/10 rounded-2xl border border-rose-500/20"><AlertCircle className="text-rose-500" size={20} /></div>
              <h4 className="text-lg font-black theme-text-main uppercase">Tendencia de Incidencias</h4>
           </div>
           <div className="flex flex-col items-center justify-center py-10 opacity-20 border-2 border-dashed theme-border rounded-3xl">
              <Activity size={48} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Sin datos históricos suficientes</p>
           </div>
        </GlassCard>
      </div>
    </div>
  );
};
