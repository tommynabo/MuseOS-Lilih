import React, { useState } from 'react';
import { ContentPiece, ClientProfile } from '../types';
import { ArrowLeft, Save, CheckCircle, Wand2, Scissors, Zap, BookOpen, ChevronRight, Copy, ChevronDown, ChevronUp, Trash2, ExternalLink, AlertCircle, Users } from 'lucide-react';
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

      {/* Main Content - NEW LAYOUT: 70% Left (Source), 30% Right (Editor) */}
      <div className="flex-1 flex overflow-hidden"

        {/* Left: Context / Source Material - 70% EXPANDED */}
        <div className="w-7/12 flex flex-col border-r border-gray-200 bg-gradient-to-b from-white to-gray-50 h-full overflow-y-auto custom-scrollbar">
          <div className="p-8 space-y-6">
            {/* Header */}
            <div>
              <h3 className="font-bold text-gray-900 text-lg mb-1 flex items-center gap-2">
                <BookOpen size={18} className="text-indigo-600" />
                Fuente Original
              </h3>
              <p className="text-[10px] text-gray-400 ml-8">Contenido de inspiración - Scroll para leer completo</p>
            </div>

            {/* Link Button - Prominently Displayed */}
            {content.originalUrl && (
              <a
                href={content.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all border border-indigo-400 group"
              >
                <span className="flex items-center gap-2 font-bold text-base">
                  <ExternalLink size={18} />
                  Ver Post Original en LinkedIn
                </span>
                <span className="text-sm font-medium opacity-90">↗</span>
              </a>
            )}

            {/* Original Text - FULL SIZE, NO TRUNCATION */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Texto Original Completo</label>
              <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 relative group min-h-96 max-h-96 overflow-y-auto">
                {/* Quote Mark Decoration */}
                <div className="absolute top-3 left-4 text-gray-200 text-5xl opacity-40 font-serif">"</div>
                
                {/* Actual Text - NO TRUNCATION, FULL READABLE */}
                <p className="text-gray-800 text-base leading-relaxed font-normal whitespace-pre-wrap pl-4 relative z-10">
                  {content.originalText}
                </p>
                
                {/* Copy Button */}
                <button
                  onClick={copyToClipboard}
                  className="absolute top-4 right-4 p-2 bg-gray-100 text-gray-400 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  title="Copiar texto"
                >
                  <Copy size={16} />
                </button>
              </div>
              <p className="text-xs text-gray-400 italic">El texto completo aparece arriba. Usa scroll dentro del cuadro si es muy largo.</p>
            </div>

            {/* Author */}
            {content.originalAuthor && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Por</p>
                <p className="text-base font-bold text-gray-900">{content.originalAuthor}</p>
              </div>
            )}

            {/* Metrics - if available */}
            {content.viralMetrics && (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Métricas de Viralidad del Original</label>
                <div className="grid grid-cols-2 gap-3">
                  {content.viralMetrics.likes > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                      <p className="text-[10px] text-red-600 font-bold uppercase">Likes</p>
                      <p className="text-2xl font-bold text-red-700">{content.viralMetrics.likes.toLocaleString()}</p>
                    </div>
                  )}
                  {content.viralMetrics.comments > 0 && (
                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <p className="text-[10px] text-green-600 font-bold uppercase">Comentarios</p>
                      <p className="text-2xl font-bold text-green-700">{content.viralMetrics.comments.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Research Notes - Improved */}
            {content.generatedDraft.researchNotes.length > 0 && (
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Notas de Análisis</label>
                <div className="space-y-2">
                  {content.generatedDraft.researchNotes.map((note, idx) => (
                    <div key={idx} className="flex gap-3 text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                      <span className="text-yellow-600 font-bold flex-shrink-0 mt-0.5">➜</span>
                      <span className="leading-relaxed">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Virality Analysis - Professional - MOVED TO LEFT PANEL */}
            {content.generatedDraft.viralityAnalysis && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Análisis Profesional de Viralidad</label>
                <div className="space-y-3">
                  {/* Virality Reason */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
                    <div className="flex gap-2 items-start mb-2">
                      <Zap size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Por qué será viral</p>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{content.generatedDraft.viralityAnalysis.viralityReason}</p>
                  </div>

                  {/* Bottleneck */}
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
                    <div className="flex gap-2 items-start mb-2">
                      <AlertCircle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-red-800 uppercase tracking-wider">Cuello de botella</p>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{content.generatedDraft.viralityAnalysis.bottleneck}</p>
                  </div>

                  {/* Engagement Trigger */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <div className="flex gap-2 items-start mb-2">
                      <Sparkles size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-green-800 uppercase tracking-wider">Trigger de engagement</p>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{content.generatedDraft.viralityAnalysis.engagement_trigger}</p>
                  </div>

                  {/* Audience Relevance */}
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex gap-2 items-start mb-2">
                      <Users size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Relevancia de audiencia</p>
                    </div>
                    <p className="text-sm text-gray-800 leading-relaxed">{content.generatedDraft.viralityAnalysis.audience_relevance}</p>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right: Working Area - 30% COMPACT */}
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