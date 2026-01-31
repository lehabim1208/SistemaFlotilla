import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
// Importación total para máxima compatibilidad con el empaquetado de producción
import * as GoogleGenAIModule from "@google/genai";
import { User, Store, Driver, DailyRole, UserRole } from '../types';

interface SmartAssistantProps {
  currentUser: User;
  stores: Store[];
  drivers: Driver[];
  history: DailyRole[];
  users: User[];
}

// Componente para formatear mensajes (Markdown básico y Tablas)
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
      if (!cells.every(c => c.match(/^-+$/))) currentTable.push(cells);
      return;
    } 

    if (inTable && currentTable.length > 0) {
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
      elements.push(<li key={index} className="ml-5 list-disc theme-text-main mb-2 pl-1">{content}</li>);
    } else {
      elements.push(<p key={index} className="theme-text-main mb-1.5 leading-relaxed">{content}</p>);
    }
  });

  return <div className="assistant-content">{elements}</div>;
};

export const SmartAssistant: React.FC<SmartAssistantProps> = ({ currentUser, stores, drivers, history, users }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: `Hola **${currentUser.username}**. He sincronizado los expedientes. ¿Qué deseas consultar?` }
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
      const now = new Date();
      const isoToday = now.toISOString().split('T')[0];
      
      const dataMap = {
        conductores: drivers.map(d => ({
          n: d.fullName,
          id_flota: d.teamCode,
          curp: d.curp || 'No registrado',
          rfc: d.rfc || 'No registrado',
          nss: d.nss || 'No registrado',
          estatus: d.status,
          sedes: stores.filter(s => d.assignedStoreIds.includes(s.id)).map(s => s.name)
        })),
        historial_reciente: history.slice(0, 10)
      };

      // 1. Obtención de API Key (Vite requiere prefijo VITE_)
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key no configurada en Vercel");

      // 2. LÓGICA ROBUSTA DE DETECCIÓN DE CONSTRUCTOR (Soluciona el error void 0)
      const mod: any = GoogleGenAIModule;
      const AIConstructor = mod.GoogleGenerativeAI || 
                           mod.default?.GoogleGenerativeAI || 
                           (mod.default && typeof mod.default === 'function' ? mod.default : null);

      if (!AIConstructor) {
        throw new Error("No se pudo localizar el constructor de GoogleGenerativeAI en el módulo.");
      }

      // 3. Inicialización del SDK
      const genAI = new AIConstructor(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemInstruction = `
        Eres el Smart Assistant de Smart Go Logística.
        FECHA ACTUAL: ${now.toLocaleDateString()} (ISO: ${isoToday}).
        REGLAS: Responde con datos exactos de la lista 'conductores'. Usa tablas si comparas datos.
        DATOS: ${JSON.stringify(dataMap)}
      `;

      // 4. Ejecución de consulta
      const result = await model.generateContent(`${systemInstruction}\n\nUsuario: ${userMsg}`);
      const response = await result.response;
      const botText = response.text();

      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMsg = error.message?.includes("API Key") 
        ? "Error: Clave de acceso no encontrada en el servidor." 
        : "Error de sincronización con el núcleo. Intenta de nuevo.";
      setMessages(prev => [...prev, { role: 'bot', text: errorMsg }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 bg-blue-600 rounded-2xl shadow-xl flex items-center justify-center text-white transition-all border border-white/20 active:scale-95"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] w-[92vw] md:w-[480px] h-[80vh] liquid-glass rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl border border-white/10 animate-in slide-in-from-bottom-5">
          <div className="p-6 bg-blue-600 flex items-center gap-4 shrink-0 shadow-lg">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
              <Bot className="text-white" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-black uppercase text-[10px] tracking-widest">Smart Assistant</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-[8px] text-white/70 font-bold uppercase tracking-tighter">Conexión Segura</span>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/5">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl text-[11px] max-w-[85%] ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                    : 'theme-bg-subtle theme-text-main border theme-border rounded-tl-none shadow-sm'
                }`}>
                  <FormattedMessage text={m.text} />
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 p-3 theme-bg-subtle rounded-2xl border theme-border">
                  <Loader2 className="animate-spin text-blue-500" size={14} />
                  <span className="text-[9px] font-black uppercase theme-text-muted tracking-widest">Procesando...</span>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t theme-border bg-black/20 backdrop-blur-md">
            <div className="flex gap-2">
              <input 
                className="flex-1 glass-input rounded-xl px-4 py-3 text-xs outline-none border border-white/5 focus:border-blue-500/50 transition-all"
                placeholder="Preguntar sobre conductores o historial..."
                value={input}
                onChange={e => setInput(e.target.value)}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isTyping}
                className={`p-3 rounded-xl transition-all ${
                  input.trim() && !isTyping ? 'bg-blue-600 text-white shadow-lg scale-105 active:scale-95' : 'bg-white/5 text-white/20'
                }`}
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
