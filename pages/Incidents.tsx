
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AlertTriangle, MapPin, Truck, Plus, Camera, Search, Filter, ShieldAlert, CheckCircle2, Map as MapIcon, Loader2, ChevronRight, User as UserIcon, X, Check, MapPinned, Navigation, Store as StoreIcon, ChevronLeft, Trash2, Edit2, Info } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { User, Store, Driver, Incident, IncidenceLevel, UserRole } from '../types';
import { INCIDENT_CATEGORIES } from '../constants';

interface Props {
  currentUser: User;
  stores: Store[];
  drivers: Driver[];
  incidents: Incident[];
  onAddIncident: (inc: Incident) => void;
  onUpdateIncident: (inc: Incident) => void;
  onDeleteIncident: (id: string) => void;
}

const ITEMS_PER_PAGE = 10;
const IMGBB_API_KEY = '605cbcef44fb63ad7761c9eadd84c06e';

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1200;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Compresión fallida')), 'image/jpeg', 0.6);
    };
    img.src = url;
  });
};

export const Incidents: React.FC<Props> = ({ currentUser, stores, drivers, incidents, onAddIncident, onUpdateIncident, onDeleteIncident }) => {
  const [isReporting, setIsReporting] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [activeSelection, setActiveSelection] = useState<'tipo' | 'driver' | 'sede' | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [useManualLocation, setUseManualLocation] = useState(false);
  const [isMapPicking, setIsMapPicking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingIncident, setViewingIncident] = useState<Incident | null>(null);
  const [editingIncident, setEditingIncident] = useState<Incident | null>(null);
  const [deletingIncidentId, setDeletingIncidentId] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Incident>>({
    type: INCIDENT_CATEGORIES[0],
    level: IncidenceLevel.MEDIUM,
    description: '',
    resolved: false,
    address: ''
  });

  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isSuper = currentUser.role === UserRole.SUPERADMIN;
  const filteredStores = useMemo(() => isSuper ? stores : stores.filter(s => currentUser.assignedStoreIds.includes(s.id)), [stores, currentUser, isSuper]);
  const filteredDrivers = useMemo(() => isSuper ? drivers : drivers.filter(d => (d.assignedStoreIds || []).some(sid => currentUser.assignedStoreIds.includes(sid))), [drivers, currentUser, isSuper]);

  const filteredIncidentsList = useMemo(() => {
    let result = incidents;
    if (!isSuper) {
        result = result.filter(i => (i.storeId && currentUser.assignedStoreIds.includes(i.storeId)) || i.reporterId === currentUser.username);
    }
    if (filterType !== 'all') result = result.filter(i => i.type === filterType);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.id.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    return result;
  }, [incidents, filterType, searchQuery, currentUser, isSuper]);

  const totalPages = Math.max(1, Math.ceil(filteredIncidentsList.length / ITEMS_PER_PAGE));
  const paginatedIncidents = useMemo(() => filteredIncidentsList.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredIncidentsList, currentPage]);

  const handleLocationSearch = async (val: string) => {
    setForm(prev => ({ ...prev, address: val }));
    if (val.length < 4) { setLocationSuggestions([]); return; }
    setIsSearchingLocation(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&addressdetails=1&limit=5`);
      const data = await res.json();
      setLocationSuggestions(data);
    } catch (e) { console.error(e); }
    finally { setIsSearchingLocation(false); }
  };

  const selectSuggestion = (s: any) => {
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setForm(prev => ({ ...prev, address: s.display_name, location: { lat, lng } }));
    setLocationSuggestions([]);
  };

  useEffect(() => {
    if (isMapPicking) {
      setTimeout(() => {
        const initialLat = form.location?.lat || 19.4326;
        const initialLng = form.location?.lng || -99.1332;

        if (!mapRef.current) {
          const map = (window as any).L.map('map-container').setView([initialLat, initialLng], 15);
          (window as any).L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(map);

          const marker = (window as any).L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
          
          marker.on('dragend', async () => {
            const pos = marker.getLatLng();
            setForm(prev => ({ ...prev, location: { lat: pos.lat, lng: pos.lng } }));
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}`);
              const data = await res.json();
              if (data.display_name) setForm(prev => ({ ...prev, address: data.display_name }));
            } catch (e) {}
          });

          mapRef.current = map;
          markerRef.current = marker;
        } else {
            mapRef.current.setView([initialLat, initialLng], 15);
            markerRef.current.setLatLng([initialLat, initialLng]);
        }
      }, 300);
    } else {
        if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    }
  }, [isMapPicking]);

  const handleAutoLocation = async () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        setForm(prev => ({ ...prev, location: { lat, lng }, address: data.display_name || `Coord: ${lat}, ${lng}` }));
      } catch (e) {
        setForm(prev => ({ ...prev, location: { lat, lng }, address: `Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
      }
      setIsLocating(false);
    }, () => {
      setToast({ message: 'GPS bloqueado o no disponible', type: 'error' });
      setIsLocating(false);
    });
  };

  useEffect(() => {
    if (isReporting && !useManualLocation) handleAutoLocation();
  }, [isReporting, useManualLocation]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append('image', compressed);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: fd });
      const result = await res.json();
      if (result.success) {
        setForm(prev => ({ ...prev, evidenceUrl: result.data.url }));
        setToast({ message: 'Fotografía cargada', type: 'success' });
      }
    } catch (err) { setToast({ message: 'Error al subir imagen', type: 'error' }); }
    finally { setIsUploading(false); }
  };

  const handleSave = () => {
    if (!form.description) { setToast({ message: 'La descripción es necesaria', type: 'error' }); return; }
    
    if (editingIncident) {
        const updated = { ...editingIncident, ...form } as Incident;
        onUpdateIncident(updated);
        setEditingIncident(null);
        setToast({ message: 'Incidencia actualizada en base de datos', type: 'success' });
    } else {
        const newInc: Incident = {
          id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
          type: form.type || 'Otro',
          level: form.level || IncidenceLevel.MEDIUM,
          description: form.description,
          reporterId: currentUser.username,
          date: new Date().toISOString(),
          resolved: false,
          driverId: form.driverId,
          storeId: form.storeId,
          location: form.location,
          address: form.address,
          evidenceUrl: form.evidenceUrl
        };
        onAddIncident(newInc);
        setToast({ message: 'Incidencia registrada en base de datos', type: 'success' });
    }
    setIsReporting(false);
    setForm({ type: INCIDENT_CATEGORIES[0], level: IncidenceLevel.MEDIUM, description: '', address: '' });
  };

  const confirmDelete = () => {
    if (deletingIncidentId) {
      onDeleteIncident(deletingIncidentId);
      setDeletingIncidentId(null);
      setToast({ message: 'Registro eliminado permanentemente', type: 'success' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20"><AlertTriangle className="text-blue-500 w-8 h-8" /></div>
          <div><h2 className="text-3xl font-black theme-text-main uppercase tracking-tighter">Incidencias</h2><p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.3em]">Registro de Sucesos</p></div>
        </div>
        <Button onClick={() => { setForm({ type: INCIDENT_CATEGORIES[0], level: IncidenceLevel.MEDIUM, description: '', address: '' }); setEditingIncident(null); setIsReporting(true); }} className="w-full md:w-auto px-8 py-4 shadow-xl bg-blue-600"><Plus size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Nuevo Reporte</span></Button>
      </header>

      <GlassCard className="p-2 md:p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={16} />
            <input type="text" placeholder="ID o Descripción..." className="w-full theme-bg-subtle theme-text-main rounded-xl pl-11 pr-4 py-3 text-xs outline-none font-bold border theme-border focus:border-blue-500 transition-colors" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
          </div>
          <button onClick={() => setShowFilterModal(true)} className={`p-3.5 rounded-xl border transition-all ${filterType !== 'all' ? 'bg-blue-600 text-white' : 'theme-bg-subtle theme-text-muted border-theme-border'}`}><Filter size={18} /></button>
        </div>
      </GlassCard>

      <div className="space-y-4">
        {paginatedIncidents.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center opacity-20 border-2 border-dashed theme-border rounded-[3rem]"><ShieldAlert size={48} className="mb-4" /><p className="text-xs font-black uppercase tracking-widest text-center">Sin reportes grabados</p></div>
        ) : (
          paginatedIncidents.map(inc => {
            const drv = drivers.find(d => d.id === inc.driverId);
            return (
              <GlassCard key={inc.id} className="p-4 md:p-5 hover:shadow-2xl transition-all border-none ring-1 ring-white/5 relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${inc.level === IncidenceLevel.HIGH ? 'bg-rose-500' : inc.level === IncidenceLevel.MEDIUM ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div className="flex justify-between items-start mb-3">
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-blue-500 font-mono tracking-tighter">{inc.id}</span>
                       <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${inc.level === IncidenceLevel.HIGH ? 'bg-rose-500/20 text-rose-500' : inc.level === IncidenceLevel.MEDIUM ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-600/20 text-blue-600'}`}>{inc.level}</span>
                     </div>
                     <h4 className="text-[11px] font-black theme-text-main uppercase tracking-widest">{inc.type}</h4>
                  </div>
                  <div className="flex flex-col items-end"><p className="text-[8px] theme-text-muted uppercase font-bold">{new Date(inc.date).toLocaleDateString('es-MX')}</p>{inc.resolved && <CheckCircle2 className="text-emerald-500" size={14} />}</div>
                </div>
                <p className="text-[10px] theme-text-main font-bold leading-relaxed line-clamp-2 mb-4 bg-black/10 p-3 rounded-xl">{inc.description}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t theme-border">
                   <div className="flex items-center gap-3">
                     <div className="flex items-center gap-1.5 px-2 py-1 theme-bg-subtle rounded-lg border theme-border">
                       <div className="w-5 h-5 rounded bg-black/20 flex items-center justify-center overflow-hidden shrink-0">{drv?.photoUrl ? <img src={drv.photoUrl} className="w-full h-full object-cover" /> : <UserIcon size={10} className="text-blue-500" />}</div>
                       <span className="text-[8px] font-black theme-text-main uppercase">{drv?.fullName.split(' ')[0] || 'Gral.'}</span>
                     </div>
                   </div>
                   <div className="flex gap-2">
                     <button onClick={() => setViewingIncident(inc)} className="p-2 theme-bg-subtle text-blue-500 rounded-lg border theme-border hover:bg-blue-500 hover:text-white transition-all"><Info size={14}/></button>
                     <button onClick={() => { setEditingIncident(inc); setForm(inc); setIsReporting(true); }} className="p-2 theme-bg-subtle text-amber-500 rounded-lg border theme-border hover:bg-amber-500 hover:text-white transition-all"><Edit2 size={14}/></button>
                     <button onClick={() => setDeletingIncidentId(inc.id)} className="p-2 theme-bg-subtle text-rose-500 rounded-lg border theme-border hover:bg-rose-500 hover:text-white transition-all"><Trash2 size={14}/></button>
                   </div>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-center gap-4 py-6">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 theme-bg-subtle border theme-border rounded-xl disabled:opacity-20 transition-all"><ChevronLeft size={16} /></button>
        <span className="text-[10px] font-black theme-text-main uppercase tracking-widest">{currentPage} de {totalPages}</span>
        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="p-2 theme-bg-subtle border theme-border rounded-xl disabled:opacity-20 transition-all"><ChevronRight size={16} /></button>
      </div>

      <Modal isOpen={isReporting} onClose={() => setIsReporting(false)} title={editingIncident ? "EDITAR REPORTE" : "NUEVA INCIDENCIA"}>
        <div className="space-y-6 pb-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Categoría</label>
              <button onClick={() => setActiveSelection('tipo')} className="w-full theme-bg-subtle border theme-border rounded-xl px-5 py-4 text-xs font-black theme-text-main text-left flex justify-between items-center">{form.type} <ChevronRight size={14} className="opacity-40" /></button>
            </div>

            <div className="space-y-1.5">
               <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Gravedad</label>
               <div className="grid grid-cols-3 gap-2">
                 {Object.values(IncidenceLevel).map(l => (
                   <button key={l} onClick={() => setForm({...form, level: l})} className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${form.level === l ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'theme-bg-subtle theme-border theme-text-muted opacity-40'}`}>{l}</button>
                 ))}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-stretch">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Operador</label>
                <button onClick={() => setActiveSelection('driver')} className="flex-1 w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3.5 text-[10px] font-black theme-text-main text-left truncate flex justify-between items-center">{filteredDrivers.find(d => d.id === form.driverId)?.fullName.split(' ')[0] || 'Seleccionar'} <ChevronRight size={12} className="opacity-40" /></button>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Sede</label>
                <button onClick={() => setActiveSelection('sede')} className="flex-1 w-full theme-bg-subtle border theme-border rounded-xl px-4 py-3.5 text-[10px] font-black theme-text-main text-left truncate flex justify-between items-center">{filteredStores.find(s => s.id === form.storeId)?.name.split(' ')[0] || 'Seleccionar'} <ChevronRight size={12} className="opacity-40" /></button>
              </div>
            </div>

            <div className="space-y-1.5"><label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Hechos</label><textarea className="w-full glass-input rounded-2xl px-5 py-4 text-xs font-bold min-h-[100px] outline-none border focus:border-blue-500/50" placeholder="Detalles del suceso..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>

            <div className="p-4 theme-bg-subtle rounded-3xl border theme-border space-y-4">
               <div className="flex items-center justify-between"><div className="flex items-center gap-2"><MapPinned size={16} className="text-blue-500" /><span className="text-[10px] font-black theme-text-main uppercase tracking-widest">Localización</span></div><div className="flex bg-black/20 p-1 rounded-xl"><button onClick={() => setUseManualLocation(false)} className={`px-3 py-1.5 rounded-lg text-[7px] font-black uppercase transition-all ${!useManualLocation ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted'}`}>Auto</button><button onClick={() => setUseManualLocation(true)} className={`px-3 py-1.5 rounded-lg text-[7px] font-black uppercase transition-all ${useManualLocation ? 'bg-blue-600 text-white shadow-lg' : 'theme-text-muted'}`}>Manual</button></div></div>
               {useManualLocation ? (
                 <div className="space-y-3">
                   <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500/50" size={14} /><input placeholder="Buscar dirección..." className="w-full glass-input rounded-xl pl-9 pr-4 py-3 text-[10px] outline-none font-bold" value={form.address || ''} onChange={e => handleLocationSearch(e.target.value)} />{isSearchingLocation && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={12} />}{locationSuggestions.length > 0 && (<div className="absolute top-full left-0 w-full mt-2 theme-bg-app border theme-border rounded-xl shadow-2xl z-[100] overflow-hidden">{locationSuggestions.map((s, i) => (<button key={i} onClick={() => selectSuggestion(s)} className="w-full p-3 text-left theme-text-main hover:bg-blue-600 hover:text-white transition-colors text-[9px] font-black uppercase border-b theme-border last:border-0">{s.display_name}</button>))}</div>)}</div>
                   <button onClick={() => setIsMapPicking(true)} className="w-full py-3 bg-blue-600/5 text-blue-500 border border-blue-500/20 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all"><MapIcon size={12}/> Seleccionar Punto en Mapa</button>
                 </div>
               ) : (
                 <div className="p-3 theme-bg-app border border-blue-500/20 rounded-2xl text-center space-y-2">{isLocating ? <Loader2 className="animate-spin text-blue-500 mx-auto" size={16} /> : <Navigation size={16} className="text-blue-500 mx-auto" />}<p className="text-[8px] font-bold theme-text-main uppercase leading-relaxed px-4">{form.address || 'Localizando...'}</p></div>
               )}
            </div>

            <div className="flex gap-2">
               <button onClick={() => cameraInputRef.current?.click()} className="flex-1 p-4 theme-bg-subtle border border-theme-border rounded-2xl flex flex-col items-center gap-1 hover:border-blue-500/30 transition-all group">{isUploading ? <Loader2 size={24} className="animate-spin text-blue-500" /> : <Camera size={24} className="theme-text-muted group-hover:text-blue-500" />}<span className="text-[8px] font-black uppercase theme-text-muted">Añadir Evidencia</span></button>
               {form.evidenceUrl && (<div className="w-16 h-16 rounded-2xl border border-emerald-500/30 overflow-hidden relative group"><img src={form.evidenceUrl} className="w-full h-full object-cover" /><button onClick={() => setForm({...form, evidenceUrl: ''})} className="absolute inset-0 bg-rose-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><X size={14}/></button></div>)}
               <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={isUploading || isLocating} className="w-full py-5 font-black uppercase text-[11px] bg-blue-600 shadow-2xl tracking-widest">Guardar incidencia</Button>
        </div>
      </Modal>

      <Modal isOpen={isMapPicking} onClose={() => setIsMapPicking(false)} title="FIJAR UBICACIÓN">
         <div className="space-y-4 pb-4">
            <p className="text-[9px] font-bold theme-text-muted uppercase text-center px-6">Mueva el marcador azul para señalar el lugar exacto del suceso.</p>
            <div id="map-container" className="aspect-square w-full shadow-inner border theme-border max-h-[350px]"></div>
            <Button onClick={() => setIsMapPicking(false)} className="w-full py-4 uppercase font-black bg-blue-600">Guardar Ubicación</Button>
         </div>
      </Modal>

      <Modal isOpen={!!activeSelection} onClose={() => setActiveSelection(null)} title={`SELECCIONAR ${activeSelection?.toUpperCase()}`}>
         <div className="space-y-2 pb-6 max-h-[400px] overflow-y-auto custom-scrollbar">
            {activeSelection === 'tipo' && INCIDENT_CATEGORIES.map(c => (<button key={c} onClick={() => { setForm({...form, type: c}); setActiveSelection(null); }} className="w-full p-4 theme-bg-subtle border theme-border rounded-2xl text-[10px] font-black uppercase theme-text-main hover:bg-blue-600 hover:text-white transition-all text-left flex items-center justify-between">{c} {form.type === c && <Check size={14} />}</button>))}
            {activeSelection === 'driver' && (<>{filteredDrivers.map(d => (<button key={d.id} onClick={() => { setForm({...form, driverId: d.id}); setActiveSelection(null); }} className="w-full p-4 theme-bg-subtle border theme-border rounded-2xl flex items-center gap-3 hover:bg-blue-600 hover:text-white transition-all group"><div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center font-black overflow-hidden shrink-0 border border-white/5">{d.photoUrl ? <img src={d.photoUrl} className="w-full h-full object-cover" /> : d.fullName.charAt(0)}</div><div className="text-left min-w-0"><p className="text-[11px] font-black uppercase truncate leading-tight group-hover:text-white">{d.fullName}</p><p className="text-[8px] opacity-60 font-mono tracking-widest">{d.teamCode}</p></div></button>))}</>)}
            {activeSelection === 'sede' && (<>{filteredStores.map(s => (<button key={s.id} onClick={() => { setForm({...form, storeId: s.id}); setActiveSelection(null); }} className="w-full p-4 theme-bg-subtle border theme-border rounded-2xl text-[11px] font-black uppercase theme-text-main hover:bg-blue-600 hover:text-white transition-all text-left">{s.name}</button>))}</>)}
         </div>
      </Modal>

      <Modal isOpen={!!deletingIncidentId} onClose={() => setDeletingIncidentId(null)} title="CONFIRMAR BORRADO">
         <div className="text-center space-y-6 py-4">
            <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto animate-pulse" />
            <div className="space-y-2"><p className="text-sm font-black theme-text-main uppercase">¿Eliminar registro?</p><p className="text-[9px] theme-text-muted font-bold uppercase px-8">Esta acción borrará el reporte definitivamente de la base de datos.</p></div>
            <div className="flex gap-4 px-2"><Button onClick={() => setDeletingIncidentId(null)} variant="outline" className="flex-1 py-4 font-black">CANCELAR</Button><Button onClick={confirmDelete} variant="danger" className="flex-1 py-4 font-black shadow-xl shadow-rose-900/40">ELIMINAR</Button></div>
         </div>
      </Modal>

      <Modal isOpen={!!viewingIncident} onClose={() => setViewingIncident(null)} title="DETALLE">
        {viewingIncident && (() => {
          const drv = drivers.find(d => d.id === viewingIncident.driverId);
          const st = stores.find(s => s.id === viewingIncident.storeId);
          return (
            <div className="space-y-6 pb-6">
              <div className="flex justify-between items-center bg-black/10 p-4 rounded-2xl border theme-border"><span className="text-xs font-black text-blue-500 font-mono">{viewingIncident.id}</span><span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${viewingIncident.level === IncidenceLevel.HIGH ? 'bg-rose-500 text-white' : viewingIncident.level === IncidenceLevel.MEDIUM ? 'bg-amber-500 text-black' : 'bg-blue-600 text-white'}`}>{viewingIncident.level}</span></div>
              <div className="p-4 theme-bg-subtle border theme-border rounded-2xl"><p className="text-[8px] font-black theme-text-muted uppercase mb-1">Descripción</p><p className="text-sm font-bold theme-text-main leading-relaxed">{viewingIncident.description}</p></div>
              <div className="grid grid-cols-2 gap-3"><div className="p-4 theme-bg-subtle border theme-border rounded-2xl"><p className="text-[8px] font-black theme-text-muted uppercase mb-2">Operador</p><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-xl bg-black/20 overflow-hidden flex items-center justify-center shrink-0">{drv?.photoUrl ? <img src={drv.photoUrl} className="w-full h-full object-cover" /> : <UserIcon size={18} className="text-blue-500" />}</div><p className="text-[10px] font-black uppercase theme-text-main truncate">{drv?.fullName.split(' ')[0] || '---'}</p></div></div><div className="p-4 theme-bg-subtle border theme-border rounded-2xl"><p className="text-[8px] font-black theme-text-muted uppercase mb-2">Sede</p><div className="flex items-center gap-2"><div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0"><StoreIcon size={18} className="text-emerald-500" /></div><p className="text-[10px] font-black uppercase theme-text-main truncate">{st?.name.split(' ')[0] || '---'}</p></div></div></div>
              <div className="p-4 theme-bg-subtle border theme-border rounded-2xl flex items-start gap-3"><MapPin className="text-blue-500 shrink-0" size={18} /><div><p className="text-[8px] font-black theme-text-muted uppercase mb-1">Dirección</p><p className="text-[10px] font-bold theme-text-main leading-tight">{viewingIncident.address || 'No grabada'}</p></div></div>
              {viewingIncident.evidenceUrl && (<div className="aspect-video w-full rounded-2xl overflow-hidden border theme-border shadow-xl"><img src={viewingIncident.evidenceUrl} className="w-full h-full object-cover" /></div>)}
              <Button onClick={() => setViewingIncident(null)} variant="outline" className="w-full py-4 uppercase font-black tracking-widest text-[10px]">Cerrar</Button>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
