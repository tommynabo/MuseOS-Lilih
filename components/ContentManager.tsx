import React from 'react';
import { ContentPiece } from '../types';
import IdeaCard from './IdeaCard';
import { updatePostStatus } from '../services/geminiService';
import { PenTool, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import LinkedInPostLink from './LinkedInPostLink';

interface ContentManagerProps {
  ideas: ContentPiece[];
  onSelectIdea: (idea: ContentPiece) => void;
}

const ContentManager: React.FC<ContentManagerProps> = ({ ideas, onSelectIdea, onUpdatePost, onDeletePost }) => {
  // Filter content by status
  const newIdeas = ideas.filter(i => i.status === 'idea');
  const drafts = ideas.filter(i => i.status === 'drafted');
  const ready = ideas.filter(i => i.status === 'approved' || i.status === 'posted');

  const SectionHeader = ({ icon: Icon, title, count, colorClass, iconColorClass }: any) => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${colorClass}`}>
          <Icon size={18} className={iconColorClass} />
        </div>
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      </div>
      <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">{count}</span>
    </div>
  );

  const EmptyState = ({ text }: { text: string }) => (
    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
      <p className="text-gray-400 text-sm font-medium">{text}</p>
    </div>
  );

  // ... inside ContentManager component ...
  const [draggedItem, setDraggedItem] = React.useState<{ item: ContentPiece; source: string } | null>(null);

  const handleDragStart = (item: ContentPiece, source: string) => {
    setDraggedItem({ item, source });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-indigo-50');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-indigo-50');
  };

  const handleDropOnSection = async (targetStatus: 'idea' | 'drafted' | 'approved', e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-indigo-50');

    if (!draggedItem) return;

    const { item } = draggedItem;
    if (item.status === targetStatus) {
      setDraggedItem(null);
      return;
    }

    // Optimistic Update via Parent
    onUpdatePost(item.id, targetStatus);
    setDraggedItem(null);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-10">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sala de Redacción</h1>
        <p className="text-gray-500">Gestiona todo tu flujo de contenido en un solo lugar.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start h-[calc(100vh-200px)]">

        {/* LEFT COLUMN: IDEAS */}
        <div
          className="flex flex-col gap-6 h-full overflow-hidden transition-colors rounded-[32px] p-2"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropOnSection('idea', e)}
        >
          <SectionHeader
            icon={PenTool}
            title="Banco de Ideas"
            count={newIdeas.length}
            colorClass="bg-yellow-100"
            iconColorClass="text-yellow-600"
          />
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar pb-10">
            {newIdeas.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(item, 'idea')}
              >
                <IdeaCard item={item} onClick={onSelectIdea} onDelete={onDeletePost} />
              </div>
            ))}
            {newIdeas.length === 0 && <EmptyState text="Sin nuevas ideas" />}
          </div>
        </div>

        {/* RIGHT COLUMN: CONTENT ROOM */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">

            {/* DRAFTS SECTION */}
            <div
              className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm h-full flex flex-col transition-colors"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropOnSection('drafted', e)}
            >
              <SectionHeader
                icon={Clock}
                title="Borradores"
                count={drafts.length}
                colorClass="bg-blue-100"
                iconColorClass="text-blue-600"
              />
              <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4">
                {drafts.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item, 'drafted')}
                    onClick={() => onSelectIdea(item)}
                    className="bg-gray-50 p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:bg-white hover:border-indigo-100 transition-all cursor-move group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">Editando</span>
                      <div className="flex items-center gap-2">
                        <LinkedInPostLink
                          url={item.sourceUrl || item.originalUrl}
                          variant="button"
                          iconSize={14}
                          text="Ver fuente en LinkedIn"
                        />
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm mb-2 leading-snug group-hover:text-indigo-700 transition-colors">{item.generatedDraft.hook}</h3>
                    <p className="text-xs text-gray-500 line-clamp-3 mb-3 leading-relaxed">{item.generatedDraft.body}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400">Última ed. hace 2h</span>
                      <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-3/4 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                ))}
                {drafts.length === 0 && <EmptyState text="No hay borradores activos" />}
              </div>
            </div>

            {/* READY SECTION */}
            <div
              className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm h-full flex flex-col transition-colors"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropOnSection('approved', e)}
            >
              <SectionHeader
                icon={CheckCircle}
                title="Programados"
                count={ready.length}
                colorClass="bg-green-100"
                iconColorClass="text-green-600"
              />
              <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar pb-4">
                {ready.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item, 'approved')}
                    className="bg-gray-50 p-5 rounded-2xl border border-gray-100 shadow-sm hover:bg-white transition-all cursor-move"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-green-100 rounded-full text-green-600"><CheckCircle size={12} /></div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Programado</span>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">Mañana, 09:00</span>
                    </div>
                    <h3 className="font-medium text-gray-800 text-sm leading-snug">{item.generatedDraft.hook}</h3>
                    <button className="w-full mt-3 py-2 text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-lg hover:text-indigo-600 hover:border-indigo-100 transition-colors">
                      Ver Preview
                    </button>
                  </div>
                ))}
                {ready.length === 0 && <EmptyState text="Nada programado aún" />}
              </div>
            </div>

          </div>
        </div>
      </div>
      <style>{`
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

export default ContentManager;