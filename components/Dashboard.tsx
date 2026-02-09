import React, { useState } from 'react';
import { Stats, ContentPiece } from '../types';
import IdeaCard from './IdeaCard';
import { PenTool, CheckCircle, Clock, Search, Bell, Sparkles, Zap, TrendingUp, Users, Hash, ChevronRight, Calendar } from 'lucide-react';

interface DashboardProps {
    stats: Stats;
    ideas: ContentPiece[];
    onSelectIdea: (idea: ContentPiece) => void;
    onRefresh?: () => void;
}

import { runGenerateWorkflow, updatePostStatus } from '../services/geminiService';

// ... (existing imports, but keep them if not replacing top of file)

const Dashboard: React.FC<DashboardProps> = ({ stats, ideas, onSelectIdea, onRefresh }) => {
    // State for the Hero Section controls
    const [manualCount, setManualCount] = useState(3);
    const [manualSource, setManualSource] = useState<'keywords' | 'creators'>('keywords');
    const [isGenerating, setIsGenerating] = useState(false);

    const [schedTime, setSchedTime] = useState('09:00');
    const [schedCount, setSchedCount] = useState(5);
    const [schedSource, setSchedSource] = useState<'keywords' | 'creators'>('creators');
    const [schedActive, setSchedActive] = useState(true);

    // Drag and drop state
    const [draggedItem, setDraggedItem] = useState<{ item: ContentPiece; source: string } | null>(null);

    // Filter content by status
    const newIdeas = ideas.filter(i => i.status === 'idea');
    const drafts = ideas.filter(i => i.status === 'drafted');
    const ready = ideas.filter(i => i.status === 'approved' || i.status === 'posted');

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
            return; // Same status, no change
        }

        try {
            // Call API to update status
            await updatePostStatus(item.id, targetStatus);
            // Refresh ideas list
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error("Error updating post:", error);
            alert("Error al mover el post");
        }

        setDraggedItem(null);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            // Use the unified workflow - no popup needed!
            // Keywords/creators are fetched from profile settings
            const result = await runGenerateWorkflow(manualSource, manualCount);

            if (result.error) {
                alert(`Error: ${result.error}`);
            } else {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Glass ping sound
                audio.volume = 0.5;
                audio.play().catch(e => console.log("Audio play failed", e));
                alert(`¡Generación completada! ${result.postsProcessed || 0} posts creados.`);
                if (onRefresh) onRefresh();
            }
        } catch (error) {
            console.error(error);
            alert("Error al iniciar el flujo.");
        } finally {
            setIsGenerating(false);
        }
    };

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

    const SourceToggle = ({ active, onChange }: { active: 'keywords' | 'creators', onChange: (v: 'keywords' | 'creators') => void }) => (
        <div className="flex bg-gray-100 p-1 rounded-xl relative">
            <button
                onClick={() => onChange('keywords')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all z-10 ${active === 'keywords' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <Hash size={14} /> Keywords
            </button>
            <button
                onClick={() => onChange('creators')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all z-10 ${active === 'creators' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <Users size={14} /> Creadores
            </button>
        </div>
    );

    const glowCardClass = "bg-white p-8 rounded-[32px] border-2 border-indigo-400/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-500/50 transition-all duration-300 relative overflow-hidden";

    return (
        <div className="max-w-[1600px] mx-auto p-10">

            {/* Top Navigation / Search */}
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Hola, Creador! 👋</h1>
                    <p className="text-gray-500 mt-1">Tu audiencia está esperando.</p>
                </div>
                <div className="flex items-center gap-6">
                    <div className="relative hidden md:block">
                        <input
                            type="text"
                            placeholder="Buscar..."
                            className="pl-10 pr-4 py-3 w-64 bg-white border border-gray-100 rounded-2xl shadow-sm text-sm focus:ring-2 focus:ring-indigo-100 placeholder-gray-400 outline-none transition-all focus:w-80"
                        />
                        <Search className="absolute left-3.5 top-3.5 text-gray-400" size={18} />
                    </div>
                    <button className="p-3 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-400 hover:text-indigo-600 transition-colors relative hover:shadow-md">
                        <Bell size={20} />
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    </button>
                </div>
            </div>

            {/* MINIMALIST FUNCTIONAL HERO WITH GLOW */}
            <div className="w-full mb-12">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT: Manual Generation */}
                    <div className={`${glowCardClass}`}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600"><Zap size={20} /></div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Generador Manual</h3>
                                <p className="text-xs text-gray-400">Creación bajo demanda</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Cantidad</label>
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{manualCount} Ideas</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={manualCount}
                                    onChange={(e) => setManualCount(Number(e.target.value))}
                                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2 block">Fuente</label>
                                <SourceToggle active={manualSource} onChange={setManualSource} />
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className={`w-full mt-2 bg-gray-900 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 ${isGenerating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Generando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={18} /> Generar Ahora
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* CENTER: Scheduler (The Clock) */}
                    <div className={`${glowCardClass}`}>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-green-50 text-green-600 rounded-xl"><Clock size={20} /></div>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-lg">Piloto Automático</h3>
                                    <p className="text-xs text-gray-400">
                                        {schedActive ? 'Activo diariamente' : 'Pausado'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSchedActive(!schedActive)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${schedActive ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${schedActive ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div className="flex flex-col items-center justify-center mb-8 relative h-24 w-full">
                            <div className="relative z-10 w-full h-full flex items-center justify-center">
                                {/* Invisible Time Input Overlay - positioned specifically over the time display */}
                                <input
                                    type="time"
                                    value={schedTime}
                                    onChange={(e) => setSchedTime(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
                                    style={{ pointerEvents: 'auto' }}
                                />
                                <div className="text-7xl font-bold text-gray-900 tracking-tighter flex items-center hover:text-indigo-600 transition-colors select-none">
                                    {schedTime}
                                </div>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-2 flex items-center gap-1 pointer-events-none">
                                <Calendar size={10} /> Hora de ejecución
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 relative z-20">
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2 block">Volumen</label>
                                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl p-2">
                                    <button onClick={() => setSchedCount(Math.max(1, schedCount - 1))} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold text-lg">-</button>
                                    <span className="font-bold text-gray-900 text-sm">{schedCount}</span>
                                    <button onClick={() => setSchedCount(Math.min(10, schedCount + 1))} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-indigo-600 font-bold text-lg">+</button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2 block">Fuente</label>
                                {/* Mini Source Toggle for Scheduler */}
                                <div className="flex bg-gray-100 p-1 rounded-xl h-[42px]">
                                    <button onClick={() => setSchedSource('keywords')} className={`flex-1 flex items-center justify-center rounded-lg ${schedSource === 'keywords' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><Hash size={14} /></button>
                                    <button onClick={() => setSchedSource('creators')} className={`flex-1 flex items-center justify-center rounded-lg ${schedSource === 'creators' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400'}`}><Users size={14} /></button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: System Status */}
                    <div className={`${glowCardClass}`}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={20} /></div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Sistema</h3>
                                <p className="text-xs text-gray-400">Métricas en tiempo real</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Próxima Tanda</p>
                                    <p className="text-lg font-bold text-gray-900">14h 30m</p>
                                </div>
                                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                            </div>

                            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">Fuentes Activas</p>
                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Online</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold text-gray-500">
                                            {i === 1 ? 'S' : i === 2 ? 'E' : 'R'}
                                        </div>
                                    ))}
                                    <span className="text-xs text-gray-400 ml-1">+4 más</span>
                                </div>
                            </div>

                            <div className="pt-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-gray-500">Cuota de API</span>
                                    <span className="font-bold text-gray-900">24%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div className="bg-indigo-600 h-1.5 rounded-full w-1/4"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* NEW LAYOUT GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* LEFT COLUMN: IDEAS (Backlog) */}
                <div className="flex flex-col gap-6">
                    <SectionHeader
                        icon={PenTool}
                        title="Banco de Ideas"
                        count={newIdeas.length}
                        colorClass="bg-yellow-100"
                        iconColorClass="text-yellow-600"
                    />
                    <div className="space-y-4">
                        {newIdeas.map(item => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={() => handleDragStart(item, 'idea')}
                                className="cursor-move hover:opacity-75 transition-opacity"
                            >
                                <IdeaCard item={item} onClick={onSelectIdea} />
                            </div>
                        ))}
                        {newIdeas.length === 0 && <EmptyState text="Sin nuevas ideas" />}
                    </div>
                </div>

                {/* RIGHT COLUMN: CONTENT ROOM (Drafts & Ready) */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span className="w-1.5 h-6 bg-indigo-600 rounded-full"></span>
                            Sala de Redacción
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* DRAFTS SECTION */}
                        <div 
                            className="bg-gray-50 rounded-[32px] p-6 border border-gray-100/50 transition-colors"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDropOnSection('drafted', e)}
                        >
                            <SectionHeader
                                icon={Clock}
                                title="Borradores en Curso"
                                count={drafts.length}
                                colorClass="bg-blue-100"
                                iconColorClass="text-blue-600"
                            />
                            <div className="space-y-4">
                                {drafts.map(item => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={() => handleDragStart(item, 'drafted')}
                                        onClick={() => onSelectIdea(item)}
                                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all cursor-move group"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">Editando</span>
                                            <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                                        </div>
                                        <h3 className="font-bold text-gray-800 text-sm mb-2 leading-snug group-hover:text-indigo-700 transition-colors">{item.generatedDraft.hook}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">{item.generatedDraft.body}</p>
                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                                            <span className="text-[10px] text-gray-400">Última ed. hace 2h</span>
                                            <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
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
                            className="bg-gray-50 rounded-[32px] p-6 border border-gray-100/50 transition-colors"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDropOnSection('approved', e)}
                        >
                            <SectionHeader
                                icon={CheckCircle}
                                title="Listos para Publicar"
                                count={ready.length}
                                colorClass="bg-green-100"
                                iconColorClass="text-green-600"
                            />
                            <div className="space-y-4">
                                {ready.map(item => (
                                    <div 
                                        key={item.id} 
                                        draggable
                                        onDragStart={() => handleDragStart(item, 'approved')}
                                        className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm opacity-80 hover:opacity-100 transition-all cursor-move"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 bg-green-100 rounded-full text-green-600"><CheckCircle size={12} /></div>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Programado</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-400">Mañana, 09:00</span>
                                        </div>
                                        <h3 className="font-medium text-gray-800 text-sm leading-snug">{item.generatedDraft.hook}</h3>
                                        <button className="w-full mt-3 py-2 text-xs font-bold text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
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
        </div>
    );
};

const EmptyState = ({ text }: { text: string }) => (
    <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
        <p className="text-gray-400 text-sm font-medium">{text}</p>
    </div>
);

export default Dashboard;