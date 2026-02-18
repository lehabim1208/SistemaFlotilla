
import React, { useState, useMemo } from 'react';
import { StickyNote, Plus, Search, Trash2, Pin, PinOff, Palette, MoreVertical, X, Clock, Edit2, AlertTriangle } from 'lucide-react';
import { GlassCard, Button, Modal, Toast } from '../components/UI';
import { Note, User } from '../types';

interface Props {
  notes: Note[];
  currentUser: User;
  onUpdateNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onAddNote: (note: Note) => void;
}

const COLORS = [
  // 3 Vibrantes
  { name: 'Cian', value: '#06b6d4' },
  { name: 'Lima', value: '#84cc16' },
  { name: 'Rosa', value: '#f43f5e' },
  // 3 Oscuros elegantes
  { name: 'Noche', value: '#1e3a8a' },
  { name: 'Obsidiana', value: '#3730a3' },
  { name: 'Carbono', value: '#334155' },
];

export const Notes: React.FC<Props> = ({ notes, currentUser, onUpdateNote, onDeleteNote, onAddNote }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', color: 'transparent' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const myNotes = useMemo(() => {
    return notes.filter(n => n.user_id === currentUser.id || n.user_id === currentUser.username);
  }, [notes, currentUser]);

  const filteredNotes = useMemo(() => {
    let result = myNotes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n => n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q));
    }
    return result;
  }, [myNotes, searchQuery]);

  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.is_pinned), [filteredNotes]);
  const otherNotes = useMemo(() => filteredNotes.filter(n => !n.is_pinned), [filteredNotes]);

  const handleSave = () => {
    if (!form.description.trim()) return;
    
    if (editingNote) {
      onUpdateNote({ ...editingNote, ...form });
      setToast({ message: 'Nota actualizada', type: 'success' });
    } else {
      const note: Note = {
        id: `note_${Date.now()}`,
        user_id: currentUser.id,
        title: form.title,
        description: form.description,
        color: form.color,
        created_at: new Date().toISOString(),
        is_pinned: false
      };
      onAddNote(note);
      setToast({ message: 'Nota registrada exitosamente', type: 'success' });
    }
    setIsCreating(false);
    setEditingNote(null);
    setForm({ title: '', description: '', color: 'transparent' });
  };

  const handleEditInit = (n: Note) => {
    setEditingNote(n);
    setForm({ title: n.title, description: n.description, color: n.color || 'transparent' });
    setIsCreating(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingNoteId) {
      onDeleteNote(deletingNoteId);
      setDeletingNoteId(null);
      setToast({ message: 'Nota eliminada permanentemente', type: 'success' });
    }
  };

  const togglePin = (n: Note) => {
    onUpdateNote({ ...n, is_pinned: !n.is_pinned });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/10 rounded-2xl border border-blue-500/20">
            <StickyNote className="text-blue-500 w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black theme-text-main uppercase tracking-tighter">Mis Notas</h2>
            <p className="theme-text-muted text-[10px] font-black uppercase tracking-[0.3em]">Gestión de Ideas y Pendientes</p>
          </div>
        </div>
        <Button onClick={() => { setEditingNote(null); setForm({ title: '', description: '', color: 'transparent' }); setIsCreating(true); }} className="w-full md:w-auto px-8 py-4 shadow-xl bg-blue-600 shadow-blue-900/40">
          <Plus size={18} /> <span className="text-[10px] font-black uppercase tracking-widest">Nueva Nota</span>
        </Button>
      </header>

      <GlassCard className="p-2 md:p-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50" size={16} />
          <input 
            type="text" 
            placeholder="Buscar en mis notas..." 
            className="w-full theme-bg-subtle theme-text-main rounded-xl pl-11 pr-4 py-3 text-xs outline-none font-bold border theme-border focus:border-blue-500 transition-colors"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </GlassCard>

      {pinnedNotes.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Pin size={12}/> Destacadas</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedNotes.map(n => <NoteCard key={n.id} note={n} onEdit={handleEditInit} onTogglePin={togglePin} onDelete={setDeletingNoteId} onUpdateColor={(c) => onUpdateNote({...n, color: c})} />)}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {pinnedNotes.length > 0 && <h4 className="text-[10px] font-black theme-text-muted uppercase tracking-[0.2em] px-2">Otras notas</h4>}
        {otherNotes.length === 0 && pinnedNotes.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center opacity-20 border-2 border-dashed theme-border rounded-[3rem]">
            <StickyNote size={48} className="mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-center">Buzón de notas vacío</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {otherNotes.map(n => <NoteCard key={n.id} note={n} onEdit={handleEditInit} onTogglePin={togglePin} onDelete={setDeletingNoteId} onUpdateColor={(c) => onUpdateNote({...n, color: c})} />)}
          </div>
        )}
      </div>

      {/* Modal Crear/Editar */}
      <Modal isOpen={isCreating} onClose={() => setIsCreating(false)} title={editingNote ? "EDITAR NOTA" : "NUEVA NOTA"}>
        <div className="space-y-6 pb-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Título</label>
              <input 
                className="w-full glass-input rounded-xl px-5 py-4 text-xs font-black theme-text-main outline-none border focus:border-blue-500" 
                placeholder="Identificador de la nota..." 
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
               <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Cuerpo de la Nota</label>
               <textarea 
                className="w-full glass-input rounded-2xl px-5 py-4 text-xs font-bold min-h-[150px] outline-none border focus:border-blue-500" 
                placeholder="Escribe tus pendientes aquí..." 
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
               />
            </div>
            <div className="space-y-2">
               <label className="text-[9px] font-black theme-text-muted uppercase tracking-widest pl-1">Color de fondo</label>
               <div className="flex flex-row flex-nowrap gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {COLORS.map(c => (
                    <button 
                      key={c.value} 
                      onClick={() => setForm({...form, color: c.value})}
                      className={`w-10 h-10 rounded-full border-2 shrink-0 transition-all hover:scale-110 ${form.color === c.value ? 'border-white scale-110 shadow-xl' : 'border-white/10'}`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
               </div>
            </div>
          </div>
          <Button onClick={handleSave} className="w-full py-5 font-black uppercase text-[11px] bg-blue-600 shadow-2xl tracking-widest">
            {editingNote ? "Guardar Cambios" : "Crear nota"}
          </Button>
        </div>
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal isOpen={!!deletingNoteId} onClose={() => setDeletingNoteId(null)} title="ELIMINAR NOTA">
         <div className="text-center space-y-6 py-4">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full mx-auto flex items-center justify-center border-2 border-rose-500/20">
              <AlertTriangle className="text-rose-500 animate-pulse" size={32} />
            </div>
            <div className="space-y-2 px-4">
               <h4 className="text-lg font-black theme-text-main uppercase tracking-tight">¿Confirmar eliminación?</h4>
               <p className="text-[10px] theme-text-muted font-bold uppercase tracking-widest leading-relaxed">
                 Esta acción borrará la nota permanentemente de la base de datos de DriveFlow.
               </p>
            </div>
            <div className="flex gap-3 pt-2">
               <Button onClick={() => setDeletingNoteId(null)} variant="outline" className="flex-1 py-4 font-black">CANCELAR</Button>
               <Button onClick={handleDeleteConfirm} variant="danger" className="flex-1 py-4 font-black shadow-xl shadow-rose-900/40">ELIMINAR</Button>
            </div>
         </div>
      </Modal>
    </div>
  );
};

const NoteCard: React.FC<{ 
  note: Note; 
  onEdit: (n: Note) => void; 
  onTogglePin: (n: Note) => void; 
  onDelete: (id: string) => void;
  onUpdateColor: (c: string) => void;
}> = ({ note, onEdit, onTogglePin, onDelete, onUpdateColor }) => {
  const [showPalette, setShowPalette] = useState(false);
  const isDarkColor = !note.color || note.color === 'transparent';

  return (
    <div 
      className="group p-5 rounded-[2rem] border theme-border transition-all hover:shadow-2xl relative overflow-hidden flex flex-col min-h-[180px] shadow-sm"
      style={{ 
        backgroundColor: note.color || 'transparent',
        borderColor: note.color && note.color !== 'transparent' ? 'rgba(255,255,255,0.3)' : undefined
      }}
    >
      <div className="flex justify-between items-start mb-3">
        <h5 className={`text-[14px] font-black uppercase tracking-tight leading-tight line-clamp-2 pr-8 ${!isDarkColor ? 'text-white drop-shadow-md' : 'theme-text-main'}`}>
          {note.title || 'SIN TÍTULO'}
        </h5>
        <button 
          onClick={() => onTogglePin(note)}
          className={`absolute top-4 right-4 p-2 rounded-xl transition-all shadow-sm ${note.is_pinned ? 'bg-black/40 text-white scale-110' : 'bg-black/10 text-white/70 hover:bg-black/30 hover:text-white'}`}
        >
          {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      </div>
      
      <p className={`text-[12px] font-bold leading-relaxed mb-8 flex-1 ${!isDarkColor ? 'text-white/90 drop-shadow-sm' : 'theme-text-main'}`}>
        {note.description}
      </p>

      <div className={`flex items-center justify-between pt-4 border-t transition-opacity ${!isDarkColor ? 'border-white/20' : 'theme-border'}`}>
        <div className="flex items-center gap-1">
           <button onClick={() => setShowPalette(!showPalette)} className={`p-2 rounded-lg transition-colors ${!isDarkColor ? 'text-white/70 hover:bg-white/20 hover:text-white' : 'theme-text-muted hover:text-blue-500'}`} title="Color"><Palette size={14}/></button>
           <button onClick={() => onEdit(note)} className={`p-2 rounded-lg transition-colors ${!isDarkColor ? 'text-white/70 hover:bg-white/20 hover:text-white' : 'theme-text-muted hover:text-amber-500'}`} title="Editar"><Edit2 size={14}/></button>
           <button onClick={() => onDelete(note.id)} className={`p-2 rounded-lg transition-colors ${!isDarkColor ? 'text-white/70 hover:bg-white/20 hover:text-white' : 'theme-text-muted hover:text-rose-500'}`} title="Eliminar"><Trash2 size={14}/></button>
        </div>
        <div className={`flex items-center gap-1.5 text-[8px] font-black uppercase opacity-60 ${!isDarkColor ? 'text-white' : 'theme-text-muted'}`}>
           <Clock size={10} />
           {new Date(note.created_at).toLocaleDateString()}
        </div>
      </div>

      {showPalette && (
        <div className="absolute bottom-12 left-4 z-20 theme-bg-app border theme-border p-2 rounded-2xl shadow-2xl flex flex-row flex-nowrap max-w-[200px] gap-2 overflow-x-auto animate-in zoom-in-95 duration-200 custom-scrollbar">
           {COLORS.map(c => (
             <button 
                key={c.value} 
                onClick={() => { onUpdateColor(c.value); setShowPalette(false); }}
                className="w-8 h-8 rounded-full border border-white/20 transition-transform hover:scale-110 shrink-0"
                style={{ backgroundColor: c.value }}
             />
           ))}
           <button onClick={() => setShowPalette(false)} className="p-1 text-rose-500 bg-rose-500/10 rounded-lg shrink-0"><X size={12}/></button>
        </div>
      )}
    </div>
  );
};
