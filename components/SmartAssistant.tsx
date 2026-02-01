
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, Sparkles, BrainCircuit, HelpCircle, Table as TableIcon } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { User, Store, Driver, DailyRole, UserRole, AttendanceStatus } from '../types';

interface SmartAssistantProps {
  currentUser: User;
  stores: Store[];
  drivers: Driver[];
  history: DailyRole[];
  users: User[];
}

const FormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentTable: string[][] = [];
  let inTable = false;

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('|') && trimmedLine.indexOf('|') !== trimmedLine.lastIndexOf('|')) {
      inTable = true;
      const cells = trimmedLine.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1);
      if (!cells.every(c => c.match(/^-+$/))) {
        currentTable.push(cells);
      }
      return;
    } 

    if (inTable) {
      if (currentTable.length > 0) {
        elements.push(
          <div key={`table-${index}`} className="my-4 overflow-x-auto border theme-border rounded-2xl bg-black/20">
            <table className="w-full text-[10px] text-left border-collapse">
              <thead>
                <tr className="theme-bg-subtle border-b theme-border">
                  {currentTable[0].map((h, i) => (
                    <th key={i} className="p-3 font-black uppercase tracking-tighter theme-text-muted border-r theme-border last:border-r-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {currentTable.slice(1).map((row, ri) => (
                  <tr key={ri} className="hover:bg-white/5 transition-colors">
                    {row.map((cell, ci) => (
                      <td key={ci} className="p-3 font-medium theme-text-main border-r theme-border last:border-r-0">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      currentTable = [];
      inTable = false;
    }

    if (trimmedLine === '') {
      elements.push(<div key={index} className="h-3" />);
      return;
    }

    const parts = line.split(/(\*\*.*?\*\*)/g);
    const content = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-blue-400">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      elements.push(
        <li key={index} className="ml-5 list-disc theme-text-main mb-2 pl-1">
          {content.slice(0)}
        </li>
      );
    } else {
      elements.push(<p key={index} className="theme-text-main mb-1.5 leading-relaxed">{content}</p>);
    }
  });

  if (inTable && currentTable.length > 0) {
    elements.push(
      <div key="final-table" className="my-4 overflow-x-auto border theme-border rounded-2xl bg-black/20">
        <table className="w-full text-[10px] text-left border-collapse">
          <thead>
            <tr className="theme-bg-subtle border-b theme-border">
              {currentTable[0].map((h, i) => (
                <th key={i} className="p-3 font-black uppercase tracking-tighter theme-text-muted border-r theme-border last:border-r-0">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y theme-border">
            {currentTable.slice(1).map((row, ri) => (
              <tr key={ri} className="hover:bg-white/5 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="p-3 font-medium theme-text-main border-r theme-border last:border-r-0">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div className="assistant-content">{elements}</div>;
};

export const SmartAssistant: React.FC<SmartAssistantProps> = ({ currentUser, stores, drivers, history, users }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: `Hola **${currentUser.username}**. He sincronizado los expedientes y el historial. ¿Qué deseas consultar?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const toLocalISO = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const now = new Date();
      const tomorrowDate = new Date();
      tomorrowDate.setDate(now.getDate() + 1);

      const isoToday = toLocalISO(now);
      const isoTomorrow = toLocalISO(tomorrowDate);
      const dayName = now.toLocaleDateString('es-MX', { weekday: 'long' });

      const dataMap = {
        admins: users.filter(u => u.role === UserRole.ADMIN).map(u => ({
          n: u.username,
          s_ids: u.assignedStoreIds
        })),
        sedes: stores.map(s => ({
          id: s.id,
          n: s.name,
          c: s.code
        })),
        conductores: drivers.map(d => ({
          n: d.fullName,
          id_flota: d.teamCode,
          curp: d.curp || 'No registrado',
          rfc: d.rfc || 'No registrado',
          nss: d.nss || 'No registrado',
          estatus: d.status,
          gafete_vigente: d.isActive ? 'SÍ' : 'NO',
          finanzas: d.storeFinances,
          sedes_asignadas: stores.filter(s => d.assignedStoreIds.includes(s.id)).map(s => s.name)
        })),
        historial_roles: history.slice(0, 20).map(h => ({
          fecha: h.date,
          sede: h.storeName,
          admin: h.adminId,
          asignaciones: h.assignments.map(a => ({
            n: a.driverName,
            id: a.teamCode,
            h: a.schedule,
            asist: a.attendance?.status || 'Pendiente'
          }))
        }))
      };

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemInstruction = `
        Eres el Smart Assistant de Smart Go Logística. 
        
        SITUACIÓN TEMPORAL (LOCAL):
        - HOY ES: ${dayName.toUpperCase()}, ${now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
        - ISO HOY: ${isoToday}
        - ISO MAÑANA: ${isoTomorrow}
        
        REGLAS DE RESPUESTA:
        1. Responde DIRECTAMENTE. Tienes ACCESO TOTAL a los expedientes de los conductores.
        2. Si preguntan por CURP, RFC, NSS o estatus de un ID de flota (ej: W_SMARTGO_39), búscalo en la lista 'conductores'.
        3. No digas que no tienes alcance a la información si el dato está en 'conductores'.
        4. Sé exacto con los datos financieros y horarios.
        
        DATOS INTEGRALES DEL SISTEMA:
        ${JSON.stringify(dataMap)}

        LÓGICA DE BÚSQUEDA DE CONDUCTORES:
        - El "ID de usuario" o "ID de flota" es el campo 'id_flota' en los datos.
        - Para la CURP, busca el campo 'curp'.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: userMsg,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0,
        },
      });

      const botText = response.text || "Lo siento, tuve un problema al consultar el expediente.";
      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'bot', text: "Error de sincronización con el núcleo. Intenta de nuevo." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 bg-blue-600 rounded-2xl shadow-[0_10px_40px_rgba(37,99,235,0.5)] flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all group border border-white/20"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} className="group-hover:rotate-12 transition-transform" />}
        {!isOpen && <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#0d1117] rounded-full animate-pulse"></span>}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] w-[92vw] md:w-[480px] h-[85vh] max-h-[800px] liquid-glass rounded-[2.5rem] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-500 shadow-2xl border-white/10">
          <div className="p-6 bg-gradient-to-r from-blue-700 to-blue-600 flex items-center gap-4 shadow-lg shrink-0">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
              <Bot className="text-white" size={28} />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-black uppercase text-xs tracking-widest leading-none">Smart Assistant</h3>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
                <span className="text-[9px] text-white/70 font-black uppercase tracking-widest">EXPEDIENTES ACTIVOS</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors p-2 bg-white/5 rounded-xl">
              <X size={20} />
            </button>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-gradient-to-b from-transparent to-black/30"
          >
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`flex gap-3 max-w-[95%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center border ${m.role === 'user' ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-900/40' : 'theme-bg-subtle theme-border shadow-sm'}`}>
                    {m.role === 'user' ? <UserIcon size={16} className="text-white" /> : <Sparkles size={16} className="text-blue-500" />}
                  </div>
                  <div className={`p-4 rounded-3xl text-[11px] leading-relaxed shadow-sm ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none font-bold' 
                      : 'theme-bg-subtle theme-text-main border theme-border rounded-tl-none'
                  }`}>
                    <FormattedMessage text={m.text} />
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex gap-4 items-center p-4 theme-bg-subtle rounded-3xl border theme-border shadow-inner">
                  <Loader2 size={16} className="animate-spin text-blue-500" />
                  <span className="text-[9px] font-black uppercase theme-text-muted tracking-widest">CONSULTANDO EXPEDIENTES...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-5 theme-bg-subtle border-t theme-border bg-black/40 backdrop-blur-xl shrink-0">
            <div className="relative flex items-center gap-3">
              <input 
                type="text" 
                placeholder="¿Cuál es la CURP del usuario W_SMARTGO_39?"
                className="flex-1 glass-input rounded-2xl pl-5 pr-12 py-4 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner"
                value={input}
                onChange={e => setInput(e.target.value)}
              />
              <button 
                type="submit"
                disabled={!input.trim() || isTyping}
                className={`p-4 rounded-2xl transition-all ${
                  input.trim() && !isTyping ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40 scale-105 active:scale-95' : 'bg-white/5 text-white/20'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
            <div className="flex items-center justify-center gap-2 mt-4 opacity-40">
              <BrainCircuit size={10} className="theme-text-muted" />
              <p className="text-[7px] text-center theme-text-muted font-black uppercase tracking-[0.3em]">
                Smart Go AI • Engine 3.7 • Full Archive Access
              </p>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
