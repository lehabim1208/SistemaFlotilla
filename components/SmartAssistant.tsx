import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, Sparkles, BrainCircuit } from 'lucide-react';
// IMPORTACIÓN CORREGIDA: Usamos el nombre exportado por el SDK oficial
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

      // CORRECCIÓN VITE: Usamos import.meta.env en lugar de process.env
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("API Key no detectada. Revisa los Environment Variables en Vercel.");
}

// Esta forma detecta si la clase está en la raíz o en .default (común en builds de producción)
const AIClass = GoogleGenAIModule.GoogleGenerativeAI || (GoogleGenAIModule as any).default?.GoogleGenerativeAI;

if (!AIClass) {
  throw new Error("No se pudo encontrar el constructor de GoogleGenerativeAI en el módulo.");
}

const genAI = new AIClass(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const systemInstruction = `
        Eres el Smart Assistant de Smart Go Logística.
        FECHA ACTUAL: ${now.toLocaleDateString()} (ISO: ${isoToday}).
        REGLAS: Responde con datos exactos de la lista 'conductores'. Usa tablas si comparas datos.
        DATOS: ${JSON.stringify(dataMap)}
      `;

      // Llamada corregida al modelo
      const result = await model.generateContent(`${systemInstruction}\n\nUsuario: ${userMsg}`);
      const response = await result.response;
      const botText = response.text();

      setMessages(prev => [...prev, { role: 'bot', text: botText }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'bot', text: "Error de conexión. Verifica la API Key en Vercel." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[100] w-14 h-14 bg-blue-600 rounded-2xl shadow-xl flex items-center justify-center text-white transition-all border border-white/20"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-[100] w-[92vw] md:w-[480px] h-[80vh] liquid-glass rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl">
          <div className="p-6 bg-blue-600 flex items-center gap-4 shrink-0">
            <Bot className="text-white" size={28} />
            <div className="flex-1">
              <h3 className="text-white font-black uppercase text-xs">Smart Assistant</h3>
              <span className="text-[9px] text-white/70 uppercase">Núcleo Activo</span>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-4 rounded-2xl text-[11px] ${m.role === 'user' ? 'bg-blue-600 text-white' : 'theme-bg-subtle theme-text-main border theme-border'}`}>
                  <FormattedMessage text={m.text} />
                </div>
              </div>
            ))}
            {isTyping && <Loader2 className="animate-spin text-blue-500 mx-auto" size={20} />}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t theme-border bg-black/20">
            <div className="flex gap-2">
              <input 
                className="flex-1 glass-input rounded-xl px-4 py-3 text-xs outline-none"
                placeholder="Pregunta algo..."
                value={input}
                onChange={e => setInput(e.target.value)}
              />
              <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl"><Send size={18} /></button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
