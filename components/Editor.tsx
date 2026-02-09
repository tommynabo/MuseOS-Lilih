import React, { useState } from 'react';
    import { ContentPiece, ClientProfile } from '../types';
    import { ArrowLeft, Save, CheckCircle, Wand2, Scissors, Zap, BookOpen, ChevronRight, Copy, ChevronDown, ChevronUp } from 'lucide-react';
    import { generateRefinedDraft } from '../services/geminiService';
    
    interface EditorProps {
      content: ContentPiece;
      clientProfile: ClientProfile;
      onClose: () => void;
      onSave: (updated: ContentPiece) => void;
    }
    
    const Editor: React.FC<EditorProps> = ({ content, clientProfile, onClose, onSave }) => {
      const [draftBody, setDraftBody] = useState(content.generatedDraft.body);
      const [hook, setHook] = useState(content.generatedDraft.hook);
      const [isProcessing, setIsProcessing] = useState(false);
      const [isSourceOpen, setIsSourceOpen] = useState(true);
    
      const handleAIAction = async (action: 'shorten' | 'punchier' | 'add_fact') => {
        setIsProcessing(true);
        const result = await generateRefinedDraft(draftBody, clientProfile, action);
        setDraftBody(result); 
        setIsProcessing(false);
      };
    
      const handleSaveDraft = () => {
        onSave({
          ...content,
          generatedDraft: { ...content.generatedDraft, hook, body: draftBody },
          status: 'drafted'
        });
      };

      const handleApprove = () => {
        onSave({
            ...content,
            generatedDraft: { ...content.generatedDraft, hook, body: draftBody },
            status: 'approved'
          });
      };

      const copyToClipboard = () => {
        if (content.originalText) {
            navigator.clipboard.writeText(content.originalText);
            // Optionally add toast notification here
        }
      };
    
      return (
        <div className="h-full flex flex-col bg-[#f8f9fc]">
          {/* Header Simplified */}
          <div className="h-20 flex items-center justify-between px-8 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm">
                <ArrowLeft size={20} />
              </button>
              <div>
                  <h2 className="font-bold text-gray-900 text-lg">Editor de Contenido</h2>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {content.status === 'idea' ? 'Borrador Inicial' : 'Editando'} <ChevronRight size={10} /> {content.tags[0]}
                  </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveDraft} className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl text-sm font-bold transition-all">
                Guardar Borrador
              </button>
              <button onClick={handleApprove} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5">
                <CheckCircle size={18} /> Aprobar
              </button>
            </div>
          </div>
    
          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden p-6 gap-6">
            
            {/* Left: Context (Collapsible) */}
            <div className="w-[400px] hidden lg:flex flex-col gap-4 h-full">
                <div className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 flex flex-col shrink-0">
                    <button 
                        onClick={() => setIsSourceOpen(!isSourceOpen)}
                        className="p-6 flex items-center justify-between w-full hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                                <BookOpen size={16} />
                            </div>
                            <h3 className="font-bold text-gray-900 text-sm">Material Fuente</h3>
                        </div>
                        {isSourceOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                    </button>
                    
                    {isSourceOpen && (
                        <div className="px-6 pb-6 border-t border-gray-50">
                             <div className="flex justify-end mb-2 pt-2">
                                <button onClick={copyToClipboard} className="text-xs flex items-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors font-bold">
                                    <Copy size={12} /> Copiar
                                </button>
                             </div>
                            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap italic relative max-h-[300px] overflow-y-auto custom-scrollbar">
                                <span className="text-3xl text-gray-300 absolute -top-2 -left-2">"</span>
                                {content.originalText}
                                <span className="text-3xl text-gray-300 absolute -bottom-4 -right-2">"</span>
                                </p>
                                <div className="mt-4 pt-3 border-t border-gray-200">
                                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wide text-right mb-2">
                                        — {content.originalAuthor || 'Fuente Externa'}
                                    </div>
                                    {content.originalUrl && (
                                        <a 
                                            href={content.originalUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 font-bold transition-colors"
                                        >
                                            <span>🔗</span>
                                            Ver Post Original
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {content.generatedDraft.researchNotes.length > 0 && (
                    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 flex-1 overflow-y-auto">
                        <h3 className="font-bold text-gray-900 text-sm mb-4">Notas de IA</h3>
                        <ul className="space-y-3">
                            {content.generatedDraft.researchNotes.map((note, idx) => (
                            <li key={idx} className="flex gap-3 text-xs text-gray-600 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                                <div className="w-1 bg-indigo-500 rounded-full h-auto shrink-0"></div>
                                {note}
                            </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
    
            {/* Right: Working Area */}
            <div className="flex-1 flex flex-col relative bg-white rounded-[32px] shadow-sm border border-gray-100 overflow-hidden">
                
                {/* AI Tools Bar */}
                <div className="px-8 py-4 border-b border-gray-100 flex items-center gap-3 bg-white z-10">
                   <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg text-white">
                      <Wand2 size={16} />
                   </div>
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-wide mr-2">Herramientas IA:</span>
                   <button onClick={() => handleAIAction('shorten')} disabled={isProcessing} className="editor-btn">
                      <Scissors size={14} /> Acortar
                   </button>
                   <button onClick={() => handleAIAction('punchier')} disabled={isProcessing} className="editor-btn">
                      <Zap size={14} /> Más Impacto
                   </button>
                   <button onClick={() => handleAIAction('add_fact')} disabled={isProcessing} className="editor-btn">
                      <BookOpen size={14} /> Añadir Dato
                   </button>
                </div>
    
                {/* Writing Canvas */}
                <div className="flex-1 overflow-y-auto p-10 max-w-4xl mx-auto w-full custom-scrollbar">
                  <div className="mb-8">
                    <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">El Gancho (Hook)</label>
                    <textarea 
                      value={hook}
                      onChange={(e) => setHook(e.target.value)}
                      className="w-full text-2xl font-bold text-gray-900 placeholder-gray-300 border-none focus:ring-0 resize-none p-0 bg-transparent leading-tight"
                      placeholder="Escribe un título que atrape..."
                      rows={2}
                    />
                  </div>
                  
                  <div className="h-px bg-gray-100 w-full mb-8"></div>
    
                  <div className="relative h-full pb-20">
                    {isProcessing && (
                      <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-sm rounded-xl">
                        <div className="flex items-center gap-3 px-6 py-3 bg-white border border-indigo-100 text-indigo-700 rounded-full font-bold text-sm shadow-xl animate-bounce">
                          <Wand2 size={18} className="animate-spin" /> Optimizando con IA...
                        </div>
                      </div>
                    )}
                    <textarea 
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      className="w-full text-lg leading-loose text-gray-700 placeholder-gray-300 border-none focus:ring-0 resize-none p-0 bg-transparent h-full outline-none font-medium"
                      placeholder="Empieza a escribir tu post..."
                    />
                  </div>
                </div>
            </div>
          </div>
          <style>{`
            .editor-btn {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: white;
                border: 1px solid #f3f4f6;
                color: #6b7280;
                font-size: 12px;
                font-weight: 600;
                border-radius: 12px;
                transition: all 0.2s;
                box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .editor-btn:hover:not(:disabled) {
                border-color: #a5b4fc;
                color: #4f46e5;
                background: #eef2ff;
                transform: translateY(-1px);
            }
            .editor-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background-color: #e5e7eb;
                border-radius: 20px;
            }
          `}</style>
        </div>
      );
    };
    
    export default Editor;