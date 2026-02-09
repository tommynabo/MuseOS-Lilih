import React, { useState } from 'react';
import { ContentPiece, ClientProfile } from '../types';
import { ArrowLeft, Save, CheckCircle, Wand2, Scissors, Zap, BookOpen, ChevronRight, Copy, ChevronDown, ChevronUp, Trash2, ExternalLink } from 'lucide-react';
import { generateRefinedDraft } from '../services/geminiService';

interface EditorProps {
  content: ContentPiece;
  clientProfile: ClientProfile;
  onClose: () => void;
  onSave: (updated: ContentPiece) => void;
  onDelete?: (id: string) => void;
}

const Editor: React.FC<EditorProps> = ({ content, clientProfile, onClose, onSave, onDelete }) => {
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

  const handleDelete = () => {
    if (onDelete && window.confirm("¿Estás seguro de que quieres eliminar este post? Esta acción no se puede deshacer.")) {
      onDelete(content.id);
      onClose();
    }
  }

  const copyToClipboard = () => {
    if (content.originalText) {
      navigator.clipboard.writeText(content.originalText);
      // Optionally add toast notification here
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#f8f9fc]">
      {/* Header Simplified */}
      <div className="h-16 flex items-center justify-between px-6 bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Editor de Contenido</span>
            <div className="flex items-center gap-2">
              <span className={`w - 2 h - 2 rounded - full ${content.status === 'approved' ? 'bg-green-500' : content.status === 'drafted' ? 'bg-blue-500' : 'bg-yellow-500'} `}></span>
              <span className="text-sm font-bold text-gray-700 capitalize">{content.status === 'idea' ? 'Borrador' : content.status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onDelete && (
            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mr-2" title="Eliminar Post">
              <Trash2 size={18} />
            </button>
          )}
          <button onClick={handleSaveDraft} className="px-4 py-2 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-bold transition-all">
            Guardar
          </button>
          <button onClick={handleApprove} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-200 transition-all">
            <CheckCircle size={14} /> Aprobar
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Context / Source Material */}
        <div className="w-[350px] hidden lg:flex flex-col border-r border-gray-200 bg-white h-full overflow-y-auto custom-scrollbar">
          <div className="p-6">
            <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
              <BookOpen size={16} className="text-indigo-600" />
              Fuente Original
            </h3>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-4">
              {content.originalUrl ? (
                <a
                  href={content.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-600 py-2.5 rounded-lg text-xs font-bold transition-all mb-4 shadow-sm"
                >
                  <ExternalLink size={14} />
                  Ver Post en LinkedIn
                </a>
              ) : (
                <div className="text-xs text-center text-gray-400 py-2 mb-2 italic">Link no disponible</div>
              )}

              <div className="relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-gray-200 rounded-full"></div>
                <div className="pl-3 py-1">
                  <p className="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap font-medium">
                    "{content.originalText}"
                  </p>
                </div>
              </div>
              <div className="mt-3 text-[10px] font-bold text-gray-400 uppercase text-right">
                — {content.originalAuthor}
              </div>
            </div>

            {content.generatedDraft.researchNotes.length > 0 && (
              <div className="mt-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Notas de Análisis</h4>
                <ul className="space-y-2">
                  {content.generatedDraft.researchNotes.map((note, idx) => (
                    <li key={idx} className="flex gap-2 text-xs text-gray-600 bg-yellow-50/50 p-2.5 rounded-lg border border-yellow-100/50">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right: Working Area */}
        <div className="flex-1 flex flex-col bg-[#f8f9fc] relative">

          {/* AI Tools */}
          <div className="px-8 py-3 bg-white/50 backdrop-blur-sm border-b border-gray-100 flex items-center justify-center gap-2 sticky top-0 z-10">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-2">Mejorar con IA:</span>

            <button onClick={() => handleAIAction('shorten')} disabled={isProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-500 text-[11px] font-bold rounded-full hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Scissors size={12} /> Acortar
            </button>
            <button onClick={() => handleAIAction('punchier')} disabled={isProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-500 text-[11px] font-bold rounded-full hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Zap size={12} /> Más Impacto
            </button>
            <button onClick={() => handleAIAction('add_fact')} disabled={isProcessing} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-500 text-[11px] font-bold rounded-full hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <BookOpen size={12} /> Dato Curioso
            </button>
          </div>

          {/* Writing Area */}
          <div className="flex-1 overflow-y-auto px-8 py-8 max-w-3xl mx-auto w-full custom-scrollbar">
            <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 min-h-[600px] p-8 md:p-12 relative">

              {/* Processing Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 bg-white/90 z-20 flex items-center justify-center rounded-[24px]">
                  <div className="flex items-center gap-3 px-6 py-3 bg-white border border-indigo-100 text-indigo-700 rounded-full font-bold text-sm shadow-xl animate-bounce">
                    <Wand2 size={18} className="animate-spin" /> Optimizando...
                  </div>
                </div>
              )}

              <div className="mb-6">
                <label className="block text-[10px] font-bold text-indigo-500 mb-2 uppercase tracking-wide">Headline / Gancho</label>
                <textarea
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  className="w-full text-xl font-bold text-gray-900 placeholder-gray-300 border-none focus:ring-0 resize-none p-0 bg-transparent leading-tight"
                  placeholder="Escribe un título que atrape..."
                  rows={2}
                />
              </div>

              <div className="h-px bg-gray-100 w-full mb-6"></div>

              <div className="h-full pb-10">
                <label className="block text-[10px] font-bold text-indigo-500 mb-2 uppercase tracking-wide">Cuerpo del Post</label>
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="w-full text-base leading-relaxed text-gray-700 placeholder-gray-300 border-none focus:ring-0 resize-none p-0 bg-transparent h-[500px] outline-none font-normal"
                  placeholder="Empieza a escribir tu post..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
```