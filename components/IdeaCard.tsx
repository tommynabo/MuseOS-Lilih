import React from 'react';
import { ArrowRight, Sparkles, Quote, ExternalLink, Trash2 } from 'lucide-react';
import { ContentPiece } from '../types';

interface IdeaCardProps {
  item: ContentPiece;
  onClick: (item: ContentPiece) => void;
  onDelete?: (id: string) => void;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ item, onClick, onDelete }) => {
  return (
    <div
      onClick={() => onClick(item)}
      className="group bg-white rounded-[24px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all cursor-pointer border border-gray-100 hover:border-indigo-100 hover:-translate-y-1"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-wrap gap-2">
          {item.tags.map(tag => (
            <span key={tag} className="text-[10px] uppercase font-bold px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg border border-gray-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-blue-100 hover:text-blue-600 transition-all"
              title="Ver post original"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
            <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* Source Material */}
      <div className="mb-5 relative pl-4 border-l-2 border-gray-200 group-hover:border-indigo-300 transition-colors">
        <Quote className="absolute -top-1 -left-1.5 bg-white text-gray-300" size={12} fill="currentColor" />
        <p className="text-gray-500 text-xs italic line-clamp-2 leading-relaxed mb-1">
          "{item.originalText}"
        </p>
        <div className="text-[10px] font-bold text-gray-400 uppercase">
          {item.originalAuthor || 'Fuente Desconocida'}
        </div>
      </div>

      {/* Hook Preview */}
      <div className="bg-gradient-to-br from-indigo-50/50 to-white rounded-xl p-4 border border-indigo-50 group-hover:border-indigo-100 transition-colors">
        <h3 className="text-[10px] font-bold text-indigo-500 mb-2 flex items-center gap-1.5">
          <Sparkles size={12} /> SUGERENCIA IA
        </h3>
        <p className="text-gray-900 font-bold text-sm leading-snug">
          {item.generatedDraft.hook}
        </p>
      </div>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('¿Eliminar idea?')) onDelete(item.id);
          }}
          className="absolute top-2 right-2 p-2 bg-white rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-gray-100"
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
};

export default IdeaCard;