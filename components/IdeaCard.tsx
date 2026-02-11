import React from 'react';
import { ArrowRight, Sparkles, Quote, Trash2, Zap, AlertCircle, Target, Brain, TrendingUp, Heart, MessageCircle } from 'lucide-react';
import { ContentPiece } from '../types';
import LinkedInPostLink from './LinkedInPostLink';

interface IdeaCardProps {
  item: ContentPiece;
  onClick: (item: ContentPiece) => void;
  onDelete?: (id: string) => void;
}

// Virality score color gradient
function getScoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (score >= 6) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (score >= 4) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-gray-500 bg-gray-50 border-gray-200';
}

function getEmotionEmoji(emotion?: string): string {
  const map: Record<string, string> = {
    'curiosidad': '🔍', 'miedo': '😨', 'aspiracion': '🚀', 'aspiración': '🚀',
    'indignacion': '😤', 'indignación': '😤', 'sorpresa': '😲', 'nostalgia': '💭',
    'orgullo': '💪', 'empatia': '🤝', 'empatía': '🤝', 'inspiracion': '✨', 'inspiración': '✨'
  };
  return map[(emotion || '').toLowerCase()] || '💡';
}

const IdeaCard: React.FC<IdeaCardProps> = ({ item, onClick, onDelete }) => {
  const analysis = item.aiAnalysis;
  const viralityScore = analysis?.virality_score?.overall;

  return (
    <div
      onClick={() => onClick(item)}
      className="group relative bg-white rounded-[24px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-all cursor-pointer border border-gray-100 hover:border-indigo-100 hover:-translate-y-1"
    >
      {/* Header with Tags + Virality Score Badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          {item.tags.map(tag => (
            <span key={tag} className="text-[10px] uppercase font-bold px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg border border-gray-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
              {tag}
            </span>
          ))}
          {viralityScore && (
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${getScoreColor(viralityScore)} flex items-center gap-1`}>
              <TrendingUp size={10} />
              {viralityScore}/10
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LinkedInPostLink
            url={item.sourceUrl || item.originalUrl}
            variant="button"
            text="Ver post original en LinkedIn"
          />
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

      {/* Hook Preview + AI Analysis */}
      <div className="bg-gradient-to-br from-indigo-50/50 to-white rounded-xl p-4 border border-indigo-50 group-hover:border-indigo-100 transition-colors">
        <h3 className="text-[10px] font-bold text-indigo-500 mb-2 flex items-center gap-1.5">
          <Sparkles size={12} /> SUGERENCIA IA
        </h3>
        <p className="text-gray-900 font-bold text-sm leading-snug mb-3">
          {item.generatedDraft.hook}
        </p>

        {/* Deep AI Analysis - Compact View */}
        {analysis && (
          <div className="mt-3 pt-3 border-t border-indigo-100 space-y-2.5">
            {/* Hook Analysis */}
            {analysis.hook && (
              <div className="flex gap-2 items-start">
                <Target size={12} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-indigo-700">Hook: <span className="font-medium capitalize">{(analysis.hook.type || '').replace(/_/g, ' ')}</span>
                    {analysis.hook.effectiveness && <span className="ml-1 text-indigo-400">({analysis.hook.effectiveness}/10)</span>}
                  </p>
                  {analysis.hook.why_it_works && (
                    <p className="text-[11px] text-gray-600 leading-tight line-clamp-2">{analysis.hook.why_it_works}</p>
                  )}
                </div>
              </div>
            )}

            {/* Emotional Trigger */}
            {analysis.emotional_triggers?.primary_emotion && (
              <div className="flex gap-2 items-start">
                <Heart size={12} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-rose-700">
                    Emoción Principal: <span className="font-medium">{getEmotionEmoji(analysis.emotional_triggers.primary_emotion)} {analysis.emotional_triggers.primary_emotion}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Virality Verdict */}
            {analysis.virality_score?.verdict && (
              <div className="flex gap-2 items-start">
                <Zap size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-amber-700">Veredicto Viral:</p>
                  <p className="text-[11px] text-gray-700 leading-tight line-clamp-2">{analysis.virality_score.verdict}</p>
                </div>
              </div>
            )}

            {/* Engagement Reason */}
            {analysis.engagement_mechanics?.why_people_comment && (
              <div className="flex gap-2 items-start">
                <MessageCircle size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-emerald-700">Motor de Engagement:</p>
                  <p className="text-[11px] text-gray-700 leading-tight line-clamp-2">{analysis.engagement_mechanics.why_people_comment}</p>
                </div>
              </div>
            )}

            {/* Score Bars */}
            {analysis.virality_score && (
              <div className="flex gap-3 pt-2">
                {[
                  { label: 'Original', value: analysis.virality_score.originality },
                  { label: 'Relatable', value: analysis.virality_score.relatability },
                  { label: 'Accionable', value: analysis.virality_score.actionability },
                ].filter(s => s.value).map(s => (
                  <div key={s.label} className="flex-1">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-[9px] font-medium text-gray-400">{s.label}</span>
                      <span className="text-[9px] font-bold text-gray-600">{s.value}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all"
                        style={{ width: `${(s.value! / 10) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Click for More */}
            <p className="text-[9px] text-center text-indigo-400 font-medium pt-1">
              Click para análisis completo →
            </p>
          </div>
        )}

        {/* Fallback: Old viralityAnalysis (backward compat) */}
        {!analysis && item.generatedDraft.viralityAnalysis && (
          <div className="mt-3 pt-3 border-t border-indigo-100 space-y-2">
            <div className="flex gap-2 items-start">
              <Zap size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-amber-700">Potencial Viral:</p>
                <p className="text-[11px] text-gray-700 leading-tight">{item.generatedDraft.viralityAnalysis.viralityReason}</p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <AlertCircle size={12} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-red-700">Cuello de Botella:</p>
                <p className="text-[11px] text-gray-700 leading-tight">{item.generatedDraft.viralityAnalysis.bottleneck}</p>
              </div>
            </div>
          </div>
        )}
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