import React, { useState } from 'react';
import { X, ThumbsUp, MessageSquare, Share2, Send, MoreHorizontal, Globe, Brain, Target, Heart, Zap, TrendingUp, MessageCircle, BookOpen, Copy, CheckCircle } from 'lucide-react';
import { ContentPiece } from '../types';

interface LinkedInPreviewProps {
    post: ContentPiece;
    isOpen: boolean;
    onClose: () => void;
    authorName?: string;
    authorAvatar?: string;
    authorHeadline?: string;
}

function getScoreColor(score: number): string {
    if (score >= 8) return 'from-emerald-400 to-emerald-600';
    if (score >= 6) return 'from-blue-400 to-blue-600';
    if (score >= 4) return 'from-amber-400 to-amber-600';
    return 'from-gray-400 to-gray-500';
}

function getScoreBg(score: number): string {
    if (score >= 8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 6) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (score >= 4) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-gray-50 text-gray-600 border-gray-200';
}

function getEmotionEmoji(emotion?: string): string {
    const map: Record<string, string> = {
        'curiosidad': '🔍', 'miedo': '😨', 'aspiracion': '🚀', 'aspiración': '🚀',
        'indignacion': '😤', 'indignación': '😤', 'sorpresa': '😲', 'nostalgia': '💭',
        'orgullo': '💪', 'empatia': '🤝', 'empatía': '🤝', 'inspiracion': '✨', 'inspiración': '✨'
    };
    return map[(emotion || '').toLowerCase()] || '💡';
}

const LinkedInPreview: React.FC<LinkedInPreviewProps> = ({
    post,
    isOpen,
    onClose,
    authorName = "Tu Nombre",
    authorAvatar = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200",
    authorHeadline = "Experto en tu Nicho | Ayudando a profesionales"
}) => {
    const [activeTab, setActiveTab] = useState<'preview' | 'analysis'>('preview');
    const [copied, setCopied] = useState(false);
    if (!isOpen) return null;

    const analysis = post.aiAnalysis;
    const hasAnalysis = analysis && analysis.hook;

    const handleCopy = () => {
        const text = post.generatedDraft.body || post.generatedDraft.hook;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#f3f2ef] w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header Modal */}
                <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {/* Tab toggle */}
                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'preview' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'}`}
                        >
                            📱 Vista Previa
                        </button>
                        {hasAnalysis && (
                            <button
                                onClick={() => setActiveTab('analysis')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'analysis' ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                <Brain size={12} /> Análisis IA
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleCopy}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {copied ? <><CheckCircle size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto max-h-[80vh]">

                    {/* ===== PREVIEW TAB ===== */}
                    {activeTab === 'preview' && (
                        <div className="p-4">
                            <div className="bg-white rounded-lg border border-gray-300 shadow-sm">
                                {/* Post Header */}
                                <div className="p-3 flex gap-3">
                                    <img src={authorAvatar} alt={authorName} className="w-12 h-12 rounded-full object-cover" />
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-900 leading-tight hover:text-blue-600 hover:underline cursor-pointer">
                                                    {authorName}
                                                </h4>
                                                <p className="text-xs text-gray-500 line-clamp-1">{authorHeadline}</p>
                                                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                                                    <span>Just now</span>
                                                    <span>•</span>
                                                    <Globe size={10} />
                                                </div>
                                            </div>
                                            <button className="text-gray-500 hover:bg-gray-100 p-1 rounded-full">
                                                <MoreHorizontal size={20} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Post Content */}
                                <div className="px-4 py-2">
                                    <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                                        {post.generatedDraft.body || post.generatedDraft.hook}
                                    </div>
                                </div>

                                {/* Engagement Counts */}
                                <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 border-b border-gray-100 mx-4">
                                    <div className="flex items-center gap-1">
                                        <div className="flex -space-x-1">
                                            <div className="bg-blue-500 rounded-full p-0.5"><ThumbsUp size={8} className="text-white fill-current" /></div>
                                            <div className="bg-red-400 rounded-full p-0.5"><span className="text-[6px] text-white">❤️</span></div>
                                        </div>
                                        <span>12</span>
                                    </div>
                                    <span>2 comments</span>
                                </div>

                                {/* Action Buttons */}
                                <div className="px-2 py-1 flex justify-between items-center">
                                    <ActionBtn icon={ThumbsUp} label="Like" />
                                    <ActionBtn icon={MessageSquare} label="Comment" />
                                    <ActionBtn icon={Share2} label="Repost" />
                                    <ActionBtn icon={Send} label="Send" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===== ANALYSIS TAB ===== */}
                    {activeTab === 'analysis' && analysis && (
                        <div className="p-4 space-y-4">

                            {/* Overall Virality Score */}
                            {analysis.virality_score && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                            <TrendingUp size={16} className="text-indigo-500" />
                                            Puntuación de Viralidad
                                        </h3>
                                        <div className={`px-3 py-1.5 rounded-full font-black text-lg border ${getScoreBg(analysis.virality_score.overall || 0)}`}>
                                            {analysis.virality_score.overall}/10
                                        </div>
                                    </div>

                                    {/* Score Grid */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {[
                                            { label: 'Originalidad', value: analysis.virality_score.originality, icon: '🎨' },
                                            { label: 'Relatability', value: analysis.virality_score.relatability, icon: '🎯' },
                                            { label: 'Accionabilidad', value: analysis.virality_score.actionability, icon: '⚡' },
                                            { label: 'Controversia', value: analysis.virality_score.controversy, icon: '🔥' },
                                        ].map(item => (
                                            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-[11px] font-medium text-gray-500">{item.icon} {item.label}</span>
                                                    <span className="text-xs font-bold text-gray-700">{item.value || 0}/10</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className={`h-full rounded-full bg-gradient-to-r ${getScoreColor(item.value || 0)} transition-all`}
                                                        style={{ width: `${((item.value || 0) / 10) * 100}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Verdict */}
                                    {analysis.virality_score.verdict && (
                                        <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                                            <p className="text-xs font-bold text-indigo-700 mb-1">💡 Veredicto:</p>
                                            <p className="text-sm text-indigo-900 leading-snug">{analysis.virality_score.verdict}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Hook Analysis */}
                            {analysis.hook && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-3">
                                        <Target size={16} className="text-indigo-500" />
                                        Análisis del Hook
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border ${getScoreBg(analysis.hook.effectiveness || 0)}`}>
                                                {(analysis.hook.type || '').replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                Efectividad: <strong>{analysis.hook.effectiveness}/10</strong>
                                            </span>
                                        </div>
                                        {analysis.hook.text && (
                                            <div className="bg-gray-50 rounded-lg p-3 border-l-3 border-l-indigo-400" style={{ borderLeftWidth: '3px' }}>
                                                <p className="text-xs italic text-gray-600">"{analysis.hook.text}"</p>
                                            </div>
                                        )}
                                        {analysis.hook.why_it_works && (
                                            <p className="text-xs text-gray-600 leading-relaxed">{analysis.hook.why_it_works}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Narrative Arc */}
                            {analysis.narrative_arc && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-3">
                                        <BookOpen size={16} className="text-purple-500" />
                                        Arco Narrativo: <span className="font-medium text-purple-600 capitalize">{(analysis.narrative_arc.structure || '').replace(/-/g, ' → ')}</span>
                                    </h3>
                                    {analysis.narrative_arc.phases && (
                                        <div className="space-y-2 mb-3">
                                            {analysis.narrative_arc.phases.map((phase, i) => (
                                                <div key={i} className="flex items-start gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                                        {i + 1}
                                                    </div>
                                                    <p className="text-xs text-gray-600 leading-relaxed">{phase}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {analysis.narrative_arc.turning_point && (
                                        <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                                            <p className="text-[10px] font-bold text-purple-700 mb-0.5">🔄 Punto de Giro:</p>
                                            <p className="text-xs text-purple-900 leading-snug">{analysis.narrative_arc.turning_point}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Emotional Triggers */}
                            {analysis.emotional_triggers && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-3">
                                        <Heart size={16} className="text-rose-500" />
                                        Gatillos Emocionales
                                    </h3>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {analysis.emotional_triggers.primary_emotion && (
                                            <span className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                {getEmotionEmoji(analysis.emotional_triggers.primary_emotion)} {analysis.emotional_triggers.primary_emotion}
                                            </span>
                                        )}
                                        {analysis.emotional_triggers.secondary_emotions?.map((e, i) => (
                                            <span key={i} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                                {getEmotionEmoji(e)} {e}
                                            </span>
                                        ))}
                                    </div>
                                    {analysis.emotional_triggers.emotional_journey && (
                                        <p className="text-xs text-gray-600 leading-relaxed bg-rose-50 p-3 rounded-lg border border-rose-100">
                                            <strong className="text-rose-700">Viaje Emocional:</strong> {analysis.emotional_triggers.emotional_journey}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Persuasion Techniques */}
                            {analysis.persuasion_techniques?.techniques_used && analysis.persuasion_techniques.techniques_used.length > 0 && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-3">
                                        <Brain size={16} className="text-amber-500" />
                                        Técnicas de Persuasión
                                    </h3>
                                    <div className="space-y-3">
                                        {analysis.persuasion_techniques.techniques_used.map((t, i) => (
                                            <div key={i} className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-amber-800">{t.name}</span>
                                                </div>
                                                {t.example && <p className="text-[11px] italic text-amber-700 mb-1">"{t.example}"</p>}
                                                {t.impact && <p className="text-[11px] text-gray-600">{t.impact}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Engagement Mechanics */}
                            {analysis.engagement_mechanics && (
                                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                                    <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2 mb-3">
                                        <MessageCircle size={16} className="text-emerald-500" />
                                        Mecánicas de Engagement
                                    </h3>
                                    {analysis.engagement_mechanics.why_people_comment && (
                                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100 mb-3">
                                            <p className="text-[10px] font-bold text-emerald-700 mb-0.5">💬 Por qué la gente comenta:</p>
                                            <p className="text-xs text-emerald-900 leading-snug">{analysis.engagement_mechanics.why_people_comment}</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'Debate', value: analysis.engagement_mechanics.debate_potential, emoji: '🗣️' },
                                            { label: 'Compartible', value: analysis.engagement_mechanics.shareability, emoji: '🔄' },
                                            { label: 'Guardable', value: analysis.engagement_mechanics.save_worthy, emoji: '🔖' },
                                        ].map(item => (
                                            <div key={item.label} className="text-center bg-gray-50 rounded-lg p-2.5">
                                                <p className="text-lg mb-0.5">{item.emoji}</p>
                                                <p className="text-[10px] font-medium text-gray-500">{item.label}</p>
                                                <p className="text-sm font-black text-gray-800">{item.value || 0}/10</p>
                                            </div>
                                        ))}
                                    </div>
                                    {analysis.engagement_mechanics.call_to_action && (
                                        <p className="text-xs text-gray-500 mt-3 italic">
                                            <strong>CTA:</strong> {analysis.engagement_mechanics.call_to_action}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Replication Strategy */}
                            {analysis.replication_strategy && (
                                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200 shadow-sm">
                                    <h3 className="font-bold text-sm text-indigo-900 flex items-center gap-2 mb-3">
                                        <Zap size={16} className="text-indigo-500" />
                                        Estrategia de Replicación
                                    </h3>
                                    <p className="text-xs text-indigo-800 leading-relaxed whitespace-pre-wrap">{analysis.replication_strategy}</p>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ActionBtn = ({ icon: Icon, label }: { icon: any, label: string }) => (
    <button className="flex items-center gap-1.5 px-3 py-3 hover:bg-gray-100 rounded-lg text-gray-500 font-semibold text-sm flex-1 justify-center transition-colors">
        <Icon size={18} />
        <span className="text-xs sm:text-sm">{label}</span>
    </button>
);

export default LinkedInPreview;
